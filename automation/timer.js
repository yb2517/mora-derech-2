// AUTO-02: Timer, מפעיל הזמן (system-timer). משימה 6 בתוכנית שלב 5.
//
// המקור: מפה 3.3 (שורת AUTO-02: "release למינון, close_stale
// לסשנים"), 4.2 (שתי שורות system-timer), 2.4 (stale_session_minutes),
// usecase-f-01-f-03 צעד 7, usecase-f-09 צעד 7, doc-build-03-automation
// סעיף 4 ("שני טיימרים, חוזה אחד"), והכרעות 8 ו-12 בתוכנית שלב 5.
//
// שני טיימרים, חוזה אחד:
//
//   טיימר המינון: נדרך בידי FE-04 כשפריט מוחזק, דרך ממשק הדריכה
//   שמוזרק לו כציוד (הכרעה 8). בפקיעה system-timer שולח release
//   כמעטפה, והבקשה נרשמת ב-audit_log כמו כל בקשה. אם FE-04 עונה
//   שהפריט עדיין מוחזק (hold_for_s), הטיימר נדרך שוב לפרק שנותר.
//   פריט שנזנח לפני הפקיעה: release חוזר ok עם released false, ולא
//   כשגיאה, ואין מה לדרוך.
//
//   טיימר הסשנים: close_stale פעם אחת עם ההרכבה, ואז כל
//   stale_session_minutes (הכרעה 12: "סשן שהאפליקציה נסגרה בו נסגר
//   בפתיחה הבאה"). ב-v1 בקובץ יחיד הטיימר רץ בדפדפן ולכן פועל רק
//   כשהאפליקציה פתוחה; במעבר לענן הוא עובר לשרת בלי שינוי בחוזה.
//
// המודול הוא פונה ואינו נמען: אין לו פעולה ב-4.2 ואין לו handler.
// לוח הזמנים מוזרק, ולכן "20 שניות" נבדקות בלי להמתין 20 שניות.

import { error } from '../core/errors.js';

// מילישניות בדקה. יחידת המרה, לא ערך עסקי: הפרק עצמו מגיע מהטבלה.
const MS_PER_MINUTE = 60000;

function ok(data) {
  return { ok: true, data };
}

function failed(code, data) {
  return { ok: false, error: error(code, data) };
}

function defaultSchedule() {
  return {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id),
    setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
    clearInterval: (id) => globalThis.clearInterval(id),
  };
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04, לערכי ה-reference בלבד.
 * @param {(request: object) => Promise<object>} options.send הכתובת האחת.
 * @param {string} [options.caller] שם הפונה, מטבלת המודולים ולא מהקוד.
 * @param {object} [options.schedule] setTimeout ו-setInterval, מוזרקים.
 */
export function create({ repository, send, caller, schedule = defaultSchedule() } = {}) {
  if (!repository) {
    throw new Error('AUTO-02 זקוק ל-Repository');
  }

  // טיימר מינון אחד לכל סשן: דריכה חדשה מחליפה את הקודמת.
  const dosage = new Map();
  let stale = null;
  const pending = new Set();
  const fired = [];

  function ref(key) {
    const value = repository.getRef(key);
    return value === undefined || value === null
      ? { missing: failed('E-REF-EMPTY', { key }) }
      : { value };
  }

  function track(promise) {
    pending.add(promise);
    promise.finally(() => pending.delete(promise));
    return promise;
  }

  function request(module, action, payload) {
    return track(
      send({ from: caller, module, action, payload })
        .catch((thrown) => failed('E-MODULE-FAILED', { message: thrown?.message })),
    );
  }

  /**
   * release: המעטפה של usecase-f-01-f-03 צעד 7.
   */
  async function fireRelease({ session_id: sessionId, stop_id: stopId, item_id: itemId }) {
    dosage.delete(sessionId);
    const response = await request('FE-04', 'release', { session_id: sessionId, stop_id: stopId, item_id: itemId });
    fired.push({ type: 'release', session_id: sessionId, stop_id: stopId, item_id: itemId, ok: response?.ok === true });

    // הפריט עדיין מוחזק: המרווח נמדד מסיום המסירה הקודמת, ו-FE-04
    // אומר כמה נותר. דורכים שוב, ולא מוותרים.
    const remaining = response?.ok === true ? response.data?.hold_for_s : null;
    if (typeof remaining === 'number' && remaining > 0) {
      arm({ session_id: sessionId, stop_id: stopId, item_id: itemId, seconds: remaining });
    }
    return response;
  }

  /**
   * ממשק הדריכה, מוזרק ל-FE-04 (הכרעה 8). seconds הוא מה שנותר
   * ממרווח המינון, ו-FE-04 הוא שיודע אותו: הערך אינו נקרא כאן.
   */
  function arm({ session_id: sessionId, stop_id: stopId, item_id: itemId, seconds } = {}) {
    if (!sessionId || !Number.isFinite(seconds) || seconds < 0) {
      return ok({ armed: false });
    }
    cancel(sessionId);
    const id = schedule.setTimeout(
      () => fireRelease({ session_id: sessionId, stop_id: stopId, item_id: itemId }),
      seconds * 1000,
    );
    dosage.set(sessionId, { id, stop_id: stopId, item_id: itemId, seconds });
    return ok({ armed: true, seconds });
  }

  function cancel(sessionId) {
    const current = dosage.get(sessionId);
    if (!current) return ok({ cancelled: false });
    schedule.clearTimeout(current.id);
    dosage.delete(sessionId);
    return ok({ cancelled: true });
  }

  function fireCloseStale(siteId) {
    return request('BE-07', 'close_stale', siteId === undefined ? {} : { site_id: siteId })
      .then((response) => {
        fired.push({ type: 'close_stale', ok: response?.ok === true, closed: response?.data?.closed?.length ?? null });
        return response;
      });
  }

  /**
   * טיימר הסשנים: פעם אחת עכשיו, ואז כל stale_session_minutes.
   */
  async function start({ site_id: siteId } = {}) {
    const minutes = ref('stale_session_minutes');
    if (minutes.missing) return minutes.missing;

    stop();
    const first = await fireCloseStale(siteId);
    stale = schedule.setInterval(() => fireCloseStale(siteId), minutes.value * MS_PER_MINUTE);
    return ok({ every_minutes: minutes.value, first: first?.ok === true });
  }

  function stop() {
    const was = stale !== null;
    if (stale !== null) schedule.clearInterval(stale);
    stale = null;
    for (const sessionId of [...dosage.keys()]) cancel(sessionId);
    return ok({ stopped: was });
  }

  return {
    arm,
    cancel,
    start,
    stop,
    armed: (sessionId) => {
      const current = dosage.get(sessionId);
      return current ? { stop_id: current.stop_id, item_id: current.item_id, seconds: current.seconds } : null;
    },
    running: () => stale !== null,
    fired: () => fired.map((row) => ({ ...row })),
    settled: () => Promise.all([...pending]),
  };
}
