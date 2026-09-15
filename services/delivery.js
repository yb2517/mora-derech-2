// FE-04: Delivery and Dosage. משימה 8 בתוכנית שלב 4.
//
// המקור: מפה 3.2 (שורת FE-04: "פריטי הנקודה, בדיקת is_crossing,
// מרווח המינון, החזקה, מסירה בסדר"), 4.2 (arrive, leave, release),
// usecase-f-01-f-03 צעדים 5 עד 11, usecase-f-13 צעדים 3 עד 6,
// ו-BL-19.
//
// המזהה FE נשמר מהמפה הקודמת, וזהו **מודול שירות ולא מסך** (מפה
// 3.2, הערה בשורה). הוא אינו מציג דבר: הוא מחזיר מה יש למסור.
//
// **משימה 7 בתוכנית שלב 5**: המודול מקבל שני פריטי ציוד מוזרקים
// (מפה 4.1 גרסה 3.8, הכרעות 3 ו-8): מנוע הקול, CONN-02, שמשמיע את
// הפריט שנמסר; וממשק הדריכה של AUTO-02, שדורך את טיימר המינון
// כשפריט מוחזק. שניהם ציוד ולא נמענים: אין להם מעטפה, והבקשה
// העסקית שחוזרת מהטיימר, release, ממשיכה לנסוע במעטפה מ-system-timer.
// בלי ציוד מוזרק המודול עובד כמו בשלב 4: מוסר בכתב ואינו דורך.
//
// המסירה נגמרת כשההשמעה נגמרת: מרווח המינון נמדד "מסיום המסירה
// הקודמת" (doc-build-03-automation סעיף 4), ושורת pushed נרשמת אז,
// עם המשך שהושמע בפועל (הכרעה 17). בלי קול עברי השורה נרשמת מיד עם
// displayed_as_text.
//
// שלושה דברים שהוא אינו עושה:
//   אינו מחשב מרחקים ואינו מחליט לאיזו נקודה הגענו. זה AUTO-01
//   ו-BL-15, שלב 5. לכאן מגיע stop_id מוכרע.
//
//   אינו קורא CONTENT_ITEMS ואינו קורא GEO_ANCHORS ישירות. מפה 3.2
//   כותבת "דרך BE-05", ולכן הוא שולח מעטפה כמו כל פונה.
//
//   אינו כותב ליומן. BL-09 נותן ל-BE-07 את הבעלות על INTERACTIONS.
//
// הסדר שבו הוא בודק הוא חלק מהחוזה, לא פרט מימוש: **is_crossing
// לפני המינון** (usecase-f-13 צעד 3: "הבדיקה קודמת לבדיקת המינון:
// אין טעם להחזיק פריט שאסור למסור בכלל").

import { error } from '../core/errors.js';

function ok(data) {
  return { ok: true, data };
}

function failed(code, data) {
  return { ok: false, error: error(code, data) };
}

function defaultNow() {
  return () => Date.now();
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04, לערכי ה-reference.
 * @param {(request: object) => Promise<object>} options.send הכתובת האחת.
 * @param {string} [options.caller] שם הפונה, מטבלת המודולים.
 * @param {() => number} [options.clock] השעון, במילישניות. מוזרק
 *   בבדיקה, ולכן "חמש שניות אחרי" נבדק בלי להמתין חמש שניות.
 */
export function create({
  repository, send, caller, clock = defaultNow(), now, voice = null, timer = null,
} = {}) {
  if (!repository) {
    throw new Error('FE-04 זקוק ל-Repository');
  }

  const stamp = now ?? (() => new Date(clock()).toISOString());

  // הנתונים הפרטיים של המודול, לפי מפה 3.2: "הפריט המוחזק, זמן
  // המסירה הקודמת". זיכרון קצר טווח של הסשן (usecase-f-04 סעיף 7),
  // שאינו נשמר ונמחק עם הרענון.
  const sessions = new Map();

  function stateOf(sessionId) {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        held: null,
        last_delivery_at: null,
        current_stop: null,
        delivered_items: new Set(),
      });
    }
    return sessions.get(sessionId);
  }

  function ref(key) {
    const value = repository.getRef(key);
    return value === undefined || value === null
      ? { missing: failed('E-REF-EMPTY', { key }) }
      : { value };
  }

  /** פריטי הנקודה, דרך BE-05 (מפה 3.2). */
  async function itemsOfStop({ siteId, stopId, audience }) {
    const response = await send({
      from: caller,
      module: 'BE-05',
      action: 'listApprovedByStop',
      payload: { site_id: siteId, stop_id: stopId, audience },
    });
    return response;
  }

  /**
   * שורת יומן ל-BE-07. BL-10: היומן אינו חוסם את החוויה בשטח, ולכן
   * כשל נרשם בתשובה ואינו הופך אותה לשגיאה.
   */
  async function log(payload) {
    if (typeof send !== 'function' || !payload.session_id || !caller) return false;
    try {
      const response = await send({
        from: caller, module: 'BE-07', action: 'log', payload,
      });
      // חוב טכני 17 של שלב 4, הכרעה 15 בתוכנית שלב 5: סשן שנסגר
      // (בסיום, או ב-close_stale של AUTO-02) אינו יכול לקבל שורה,
      // ואין ל-FE-04 דרך לדעת זאת מראש. היומן אומר לו, והוא שוכח
      // את הסשן: הפריט המוחזק, הטיימר והזיכרון קצר הטווח.
      if (response.ok !== true && response.error?.code === 'E-SESSION-CLOSED') {
        forget(payload.session_id);
      }
      return response.ok === true;
    } catch {
      return false;
    }
  }

  function forget(sessionId) {
    sessions.delete(sessionId);
    timer?.cancel?.(sessionId);
  }

  /**
   * ההשמעה, דרך הציוד המוזרק. בלי מנוע: מסירה בכתב, כמו בשלב 4.
   * בלי קול עברי: המסך מציג (usecase-f-04 זרימה ד), והשורה מסומנת
   * displayed_as_text. ערך חסר בטבלת ה-reference עולה כמות שהוא.
   */
  async function speak(item) {
    if (!voice || typeof voice.speak !== 'function') {
      return { displayed_as_text: true, duration_ms: null, interrupted: false };
    }
    const response = await voice.speak(item.text);
    if (response.ok) {
      return {
        displayed_as_text: false,
        duration_ms: response.data.duration_ms ?? null,
        interrupted: response.data.interrupted === true,
      };
    }
    if (response.error?.code === 'E-NO-HEBREW-VOICE') {
      return { displayed_as_text: true, duration_ms: null, interrupted: false };
    }
    return { failure: response };
  }

  /** דריכת טיימר המינון, דרך הציוד המוזרק (הכרעה 8). */
  function arm({ sessionId, stopId, itemId, seconds }) {
    if (!timer || typeof timer.arm !== 'function') return false;
    const response = timer.arm({ session_id: sessionId, stop_id: stopId, item_id: itemId, seconds });
    return response?.ok === true && response.data?.armed === true;
  }

  /**
   * המסירה עצמה: הפריט יוצא, הזמן נרשם, והשורה נשלחת.
   *
   * **הכרעה 14 בתוכנית שלב 4, בהכרעת בעלת הפרויקט**: פריט שחורג
   * מ-pushed_item_max_words נמסר במלואו, והחריגה מדווחת. מפה 2.4
   * כותבת "פריטים ארוכים יותר יפוצלו בידי צוות התוכן", כלומר
   * הפיצול הוא פעולת אדם. קיצוץ אוטומטי היה מסירה של טקסט שהחוקר
   * לא אישר.
   */
  async function deliver({ state, sessionId, stopId, item, maxWords, gap, accuracy, rest = [] }) {
    const words = String(item.text ?? '').trim().split(/\s+/).filter(Boolean).length;

    // הפריט נחשב נמסר מרגע שההשמעה מתחילה: כניסה חוזרת בזמן ההשמעה
    // אינה משמיעה אותו שוב (הכרעה 12 של שלב 4).
    state.delivered_items.add(item.item_id);

    const spoken = await speak(item);
    if (spoken.failure) return spoken.failure;

    // סיום המסירה: מכאן נמדד מרווח המינון.
    state.last_delivery_at = clock();

    // צעד 9: פריטים נוספים של אותה נקודה נמסרים **כל אחד אחרי
    // מרווח המינון**, בסדר הפריטים. הפריט הבא נכנס להחזקה וטיימר
    // נדרך, וזה מה שהופך את release לפעולה שיש לה מה לעשות.
    const next = rest.find((row) => !state.delivered_items.has(row.item_id)) ?? null;
    state.held = next === null
      ? null
      : { item: next, stop_id: stopId, reason: 'gap', accuracy: accuracy ?? null, rest };
    const timerArmed = next === null
      ? false
      : arm({ sessionId, stopId, itemId: next.item_id, seconds: gap });

    const logged = await log({
      session_id: sessionId,
      type: 'pushed',
      stop_id: stopId,
      item_id: item.item_id,
      accuracy: accuracy ?? null,
      duration_ms: spoken.duration_ms,
      displayed_as_text: spoken.displayed_as_text,
      time: stamp(),
    });

    return {
      delivered: item,
      words,
      over_limit: words > maxWords,
      displayed_as_text: spoken.displayed_as_text,
      duration_ms: spoken.duration_ms,
      interrupted: spoken.interrupted,
      held: next === null ? null : { item_id: next.item_id, reason: 'gap' },
      timer_armed: timerArmed,
      logged,
    };
  }

  /**
   * הפריט הבא של הנקודה שטרם נמסר בסשן הזה, בסדר הפריטים
   * (usecase-f-01-f-03 צעדים 5 ו-9).
   *
   * הכרעה 12: כניסה חוזרת אינה משמיעה שוב אוטומטית, ולכן פריט
   * שנמסר אינו חוזר. השמעה חוזרת היא F-11, שאינו ב-v1.
   */
  function nextItem(state, items) {
    return items.find((item) => !state.delivered_items.has(item.item_id)) ?? null;
  }

  const ACTIONS = {
    /**
     * הגעה לנקודה, usecase-f-01-f-03 צעדים 5 עד 10 ו-usecase-f-13
     * צעדים 3 עד 4.
     *
     * הסדר: פריטי הנקודה, ואז is_crossing, ואז המינון, ואז המסירה.
     */
    arrive: async ({ payload = {} }) => {
      const gap = ref('delivery_gap_s');
      if (gap.missing) return gap.missing;
      const maxWords = ref('pushed_item_max_words');
      if (maxWords.missing) return maxWords.missing;

      const sessionId = payload.session_id;
      const state = stateOf(sessionId);
      state.current_stop = payload.stop_id;

      const response = await itemsOfStop({
        siteId: payload.site_id, stopId: payload.stop_id, audience: payload.audience,
      });
      if (!response.ok) return response;

      const items = response.data.items ?? [];
      const anchors = response.data.anchors ?? [];

      // צעד 6: רשימה ריקה. המערכת שותקת, אינה ממציאה ואינה מחפשת
      // פריט קרוב אחר (הכרעה 13, וההצעה שבסיפור).
      if (items.length === 0) {
        const logged = await log({
          session_id: sessionId,
          type: 'arrived_no_content',
          stop_id: payload.stop_id,
          accuracy: payload.accuracy ?? null,
          time: stamp(),
        });
        return ok({ delivered: null, held: null, silent: true, reason: 'no_content', logged });
      }

      const item = nextItem(state, items);

      // הכרעה 12: כל פריטי הנקודה כבר נמסרו בסשן הזה, ולכן כניסה
      // חוזרת שותקת.
      if (item === null) {
        return ok({ delivered: null, held: null, silent: true, reason: 'already_delivered' });
      }

      // **BL-19, לפני בדיקת המינון.** עוגן שסומן is_crossing אינו
      // מפעיל מסירה: הפריט מוחזק, ואין טיימר. השחרור נמדד לפי
      // מיקום ולא לפי זמן (usecase-f-13 צעדים 4 ו-5, וזרימה א).
      const anchor = anchors.find((row) => row.item_id === item.item_id);
      if (anchor?.is_crossing === true) {
        state.held = {
          item, stop_id: payload.stop_id, reason: 'crossing',
          accuracy: payload.accuracy ?? null, rest: items,
        };
        return ok({
          delivered: null,
          held: { item_id: item.item_id, reason: 'crossing' },
          timer_armed: false,
          reason: 'crossing',
        });
      }

      // צעד 7: המינון. פחות מ-delivery_gap_s מאז המסירה הקודמת,
      // והפריט מוחזק וטיימר נדרך. system-timer שולח release כשהוא
      // פוקע (מפה 4.2).
      const since = state.last_delivery_at === null
        ? null
        : (clock() - state.last_delivery_at) / 1000;

      if (since !== null && since < gap.value) {
        const holdFor = Math.max(0, Math.round(gap.value - since));
        state.held = {
          item, stop_id: payload.stop_id, reason: 'gap',
          accuracy: payload.accuracy ?? null, rest: items,
        };
        const armed = arm({ sessionId, stopId: payload.stop_id, itemId: item.item_id, seconds: holdFor });
        return ok({
          delivered: null,
          held: { item_id: item.item_id, reason: 'gap' },
          timer_armed: armed,
          hold_for_s: holdFor,
          reason: 'gap',
        });
      }

      const delivered = await deliver({
        state, sessionId, stopId: payload.stop_id, item,
        maxWords: maxWords.value, gap: gap.value, accuracy: payload.accuracy, rest: items,
      });
      return delivered.ok === false ? delivered : ok(delivered);
    },

    /**
     * יציאה מהנקודה, usecase-f-01-f-03 צעד 11 ו-usecase-f-13 צעד 5.
     *
     * שני דברים שונים קורים לפריט המוחזק, לפי הסיבה שבגללה הוחזק:
     *   חצייה: זהו האירוע המשחרר. הפריט נמסר עכשיו
     *     (usecase-f-13 צעד 6: "FE-04 משחרר את הפריט המוחזק וממשיך
     *     בזרימה הרגילה").
     *   מינון: הפריט נזנח. המשפחה כבר אינה שם, והכרעה 12 קובעת
     *     שפריט נמסר רק כל עוד היא בתוך הרדיוס.
     */
    leave: async ({ payload = {} }) => {
      const gap = ref('delivery_gap_s');
      if (gap.missing) return gap.missing;
      const maxWords = ref('pushed_item_max_words');
      if (maxWords.missing) return maxWords.missing;

      const sessionId = payload.session_id;
      const state = stateOf(sessionId);
      const held = state.held;

      state.current_stop = null;

      if (!held) return ok({ delivered: null, held: null, released: false });

      if (held.reason === 'crossing' && held.stop_id === payload.stop_id) {
        state.held = null;
        const delivered = await deliver({
          state, sessionId, stopId: held.stop_id, item: held.item,
          maxWords: maxWords.value, gap: gap.value, accuracy: held.accuracy, rest: held.rest ?? [],
        });
        return delivered.ok === false ? delivered : ok({ ...delivered, released: true });
      }

      state.held = null;
      timer?.cancel?.(sessionId);
      return ok({ delivered: null, held: null, released: false, abandoned: held.item.item_id });
    },

    /**
     * מפעיל הזמן, usecase-f-01-f-03 צעד 7. system-timer שולח release
     * כשטיימר המינון פוקע.
     *
     * פריט שמוחזק בגלל חצייה **אינו משוחרר כאן**: השחרור שלו נמדד
     * לפי מיקום ולא לפי זמן (usecase-f-13 זרימה א: "הרמזור מתחלף,
     * המשפחה עומדת בצומת דקה, הפריט נשאר מוחזק").
     */
    release: async ({ payload = {} }) => {
      const gap = ref('delivery_gap_s');
      if (gap.missing) return gap.missing;
      const maxWords = ref('pushed_item_max_words');
      if (maxWords.missing) return maxWords.missing;

      const sessionId = payload.session_id;
      const state = stateOf(sessionId);
      const held = state.held;

      if (!held) return ok({ delivered: null, held: null, reason: 'nothing_held' });

      if (held.reason === 'crossing') {
        return ok({
          delivered: null,
          held: { item_id: held.item.item_id, reason: 'crossing' },
          reason: 'crossing',
        });
      }

      const since = state.last_delivery_at === null
        ? null
        : (clock() - state.last_delivery_at) / 1000;

      if (since !== null && since < gap.value) {
        return ok({
          delivered: null,
          held: { item_id: held.item.item_id, reason: 'gap' },
          hold_for_s: Math.max(0, Math.round(gap.value - since)),
          reason: 'gap',
        });
      }

      state.held = null;
      const delivered = await deliver({
        state, sessionId, stopId: held.stop_id, item: held.item,
        maxWords: maxWords.value, gap: gap.value, accuracy: held.accuracy, rest: held.rest ?? [],
      });
      return delivered.ok === false ? delivered : ok(delivered);
    },
  };

  const handle = function handle(request) {
    const handler = ACTIONS[request?.action];
    if (typeof handler !== 'function') {
      throw new Error(`FE-04 אינו מממש את הפעולה ${request?.action}`);
    }
    return handler(request);
  };

  /** נחשף לבדיקה בלבד. אינו פעולה במעטפה: 4.2 נותנת שלוש. */
  handle.stateOf = (sessionId) => {
    const state = sessions.get(sessionId);
    return state === undefined ? null : {
      held: state.held === null ? null : { item_id: state.held.item.item_id, reason: state.held.reason },
      current_stop: state.current_stop,
      delivered_items: [...state.delivered_items],
    };
  };

  return handle;
}
