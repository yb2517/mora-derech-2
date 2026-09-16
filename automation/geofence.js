// AUTO-01: Geofence, מודול ה-geofence (module-geofence). משימה 5
// בתוכנית שלב 5.
//
// המקור: מפה 3.3 (שורת AUTO-01: "מרחק לעוגנים ולנקודות יציאה, סינון
// דיוק, בחירת הקרוב, arrive ו-leave"), BL-15, 4.2 (ארבע שורות
// module-geofence), 2.4 (geofence_radius_m, exit_margin_m,
// accuracy_threshold_m, crossing_clear_seconds), usecase-f-01-f-03
// צעדים 2, 3, 4, 11 וזרימות א, ב, doc-build-03-automation סעיף 3,
// F-13 תיקון 1 סעיף 3, והכרעות 7, 9 ו-11 בתוכנית שלב 5.
//
// "AUTO-01 אינו יודע מה יש בנקודה. הוא יודע רק 'נכנסנו' ו'יצאנו'.
// מה נמסר הוא עניינו של FE-04, ומה מאושר הוא עניינו של BE-05"
// (doc-build-03-automation סעיף 3).
//
// המודול הוא פונה ואינו נמען: אין לו פעולה ב-4.2, ולכן אין לו
// handler. הוא נטען מטבלת המודולים (עמודת file, הכרעה 6) ומופעל
// ונעצר בידי מי שמרכיב אותו, לפי מחזור חיי הסשן במסך (הכרעה 7).
// כל בקשה שלו נוסעת במעטפה דרך הכתובת האחת עם שם הפונה שקיבל
// בהרכבה: העוגנים ונקודות היציאה מ-BE-05, arrive ו-leave ל-FE-04.
// אין כאן ייבוא של מודול, ואין כאן גישה לאחסון.
//
// מקור הדגימות מוזרק (CONN-03 בשטח, TOOL-01 בפיתוח, מפה 4.1 גרסה
// 3.8). המודול אינו יודע איזה מהשניים קיבל, וזה מבחן ההחלפה של
// usecase-f-01-f-03 סעיף 8.
//
// הזיכרון: התחנה הנוכחית והדגימה התקפה האחרונה, קצר טווח, נדרס בכל
// אירוע, ואינו נשמר (usecase-f-01-f-03 סעיף 7). דגימות אינן נשמרות
// לעולם (BL-18).

import { error } from '../core/errors.js';
import { distanceMeters } from '../core/business-logic.js';

// שמונה רוחות השמיים, בסדר השעון מצפון. לתבנית הודעת החסימה של
// F-13 תיקון 1 ([רוח השמיים]). רשימה סגורה של המצפן, לא ערך משתנה.
const COMPASS = Object.freeze([
  'צפון', 'צפון מזרח', 'מזרח', 'דרום מזרח', 'דרום', 'דרום מערב', 'מערב', 'צפון מערב',
]);

function ok(data) {
  return { ok: true, data };
}

function failed(code, data) {
  return { ok: false, error: error(code, data) };
}

/**
 * הכיוון מנקודה לנקודה, כרוח שמיים. קוד רגיל, באותו מודול שמחשב
 * מרחקים (F-13 תיקון 1 סעיף 3).
 */
export function direction(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const slice = 360 / COMPASS.length;
  return COMPASS[Math.round(bearing / slice) % COMPASS.length];
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04, לערכי ה-reference בלבד.
 * @param {(request: object) => Promise<object>} options.send הכתובת האחת.
 * @param {string} [options.caller] שם הפונה, מטבלת המודולים ולא מהקוד.
 * @param {object} [options.location] מקור הדגימות: CONN-03 או TOOL-01.
 * @param {() => number} [options.clock] השעון במילישניות.
 */
export function create({ repository, send, caller, location = null, clock = () => Date.now() } = {}) {
  if (!repository) {
    throw new Error('AUTO-01 זקוק ל-Repository');
  }

  const state = {
    session_id: null,
    site_id: null,
    anchors: [],
    exit_points: [],
    current_stop: null,
    current_anchor: null,
    outside_since: null,
    last_sample: null,
    samples: 0,
    rejected: 0,
    events: [],
    last_error: null,
    location_error: null,
  };

  const pending = new Set();
  const listeners = new Set();

  function ref(key) {
    const value = repository.getRef(key);
    return value === undefined || value === null
      ? { missing: failed('E-REF-EMPTY', { key }) }
      : { value };
  }

  function thresholds() {
    const keys = ['geofence_radius_m', 'exit_margin_m', 'accuracy_threshold_m', 'crossing_clear_seconds'];
    const values = {};
    for (const key of keys) {
      const found = ref(key);
      if (found.missing) return { missing: found.missing };
      values[key] = found.value;
    }
    return { values };
  }

  function request(module, action, payload) {
    return send({ from: caller, module, action, payload });
  }

  /**
   * המעטפה יוצאת ואינה מעכבת את הדגימה הבאה: FE-04 עשוי להשמיע
   * פריט שלם לפני שהוא עונה, והמשפחה ממשיכה ללכת בינתיים.
   */
  function dispatch(type, stopId, extra = {}) {
    const event = { type, stop_id: stopId, time: new Date(clock()).toISOString() };
    state.events.push(event);
    const promise = request('FE-04', type, {
      session_id: state.session_id,
      site_id: state.site_id,
      stop_id: stopId,
      ...extra,
    }).then((response) => {
      if (!response?.ok) state.last_error = response?.error ?? null;
      for (const fn of listeners) fn({ ...event, response });
      return response;
    }).catch((thrown) => {
      state.last_error = error('E-MODULE-FAILED', { message: thrown?.message });
      return null;
    });
    pending.add(promise);
    promise.finally(() => pending.delete(promise));
    return promise;
  }

  function leaveCurrent() {
    const stopId = state.current_stop;
    state.current_stop = null;
    state.current_anchor = null;
    state.outside_since = null;
    return dispatch('leave', stopId);
  }

  /**
   * BL-15, דגימה אחר דגימה. usecase-f-01-f-03 צעדים 2, 3, 4 ו-11.
   */
  function handleSample(sample) {
    if (state.session_id === null) return { handled: false };
    const found = thresholds();
    if (found.missing) {
      state.last_error = found.missing.error;
      return { handled: false, error: found.missing.error };
    }
    const {
      geofence_radius_m: radius,
      exit_margin_m: margin,
      accuracy_threshold_m: accuracy,
      crossing_clear_seconds: clearSeconds,
    } = found.values;

    state.samples += 1;

    // צעד 2: דגימה שדיוקה גרוע מהסף נדחית ונספרת. אין הפעלה, ואין
    // הפעלה שגויה: "מוטב שתיקה של דקה מאשר תוכן של המבנה הלא נכון".
    if (!Number.isFinite(sample?.accuracy_m) || sample.accuracy_m > accuracy) {
      state.rejected += 1;
      return { handled: true, rejected: true };
    }

    state.last_sample = { ...sample };

    // צעד 3: מרחק לכל עוגן של המסלול, סימון אלה שבטווח, בחירת הקרוב.
    const measured = state.anchors
      .map((anchor) => ({ anchor, distance: distanceMeters(sample, anchor) }))
      .sort((a, b) => a.distance - b.distance);
    const inRange = measured.filter(({ distance }) => distance < radius);

    if (inRange.length > 0) {
      const nearest = inRange[0];
      state.outside_since = null;
      // הקרוב הוא התחנה הנוכחית: אין אירוע.
      if (nearest.anchor.stop_id === state.current_stop) {
        return { handled: true, event: null, stop_id: state.current_stop };
      }
      // תחנה חדשה: arrive. בחפיפה (זרימה א) נבחרת הקרובה בלבד.
      state.current_stop = nearest.anchor.stop_id;
      state.current_anchor = nearest.anchor;
      dispatch('arrive', nearest.anchor.stop_id, { accuracy: sample.accuracy_m });
      return { handled: true, event: 'arrive', stop_id: nearest.anchor.stop_id, distance_m: nearest.distance };
    }

    if (state.current_stop === null) {
      return { handled: true, event: null, stop_id: null };
    }

    // צעד 11: יציאה. כל עוגני התחנה רחוקים מרדיוס ועוד שוליים.
    const ofCurrent = measured.filter(({ anchor }) => anchor.stop_id === state.current_stop);
    const nearestOfCurrent = ofCurrent.length === 0 ? Infinity : ofCurrent[0].distance;

    if (nearestOfCurrent > radius + margin) {
      const stopId = state.current_stop;
      leaveCurrent();
      return { handled: true, event: 'leave', stop_id: stopId, distance_m: nearestOfCurrent };
    }

    // BL-19 והכרעה 9: תחנת חצייה משוחררת גם אחרי crossing_clear_seconds
    // מחוץ לרדיוס, כשהמשפחה עומדת בטבעת שבין הרדיוס לשוליים.
    if (state.current_anchor?.is_crossing === true) {
      if (state.outside_since === null) {
        state.outside_since = clock();
      } else if ((clock() - state.outside_since) / 1000 >= clearSeconds) {
        const stopId = state.current_stop;
        leaveCurrent();
        return { handled: true, event: 'leave', stop_id: stopId, reason: 'crossing_clear' };
      }
    }

    return { handled: true, event: null, stop_id: state.current_stop };
  }

  /**
   * הפעלה לסשן: העוגנים ונקודות היציאה נקראים במעטפה, והזרם נפתח.
   */
  async function start({ session_id: sessionId, site_id: siteId, onError } = {}) {
    const found = thresholds();
    if (found.missing) return found.missing;

    if (!location) {
      return failed('E-LOCATION-NOT-ALLOWED', { reason: 'no_source' });
    }

    const anchors = await request('BE-05', 'listAnchors', { site_id: siteId });
    if (!anchors.ok) return anchors;
    const exits = await request('BE-05', 'listExitPoints', { site_id: siteId });
    if (!exits.ok) return exits;

    stop();

    state.session_id = sessionId;
    state.site_id = siteId;
    state.anchors = (anchors.data.anchors ?? []).filter(
      (row) => Number.isFinite(row.lat) && Number.isFinite(row.lng) && row.stop_id,
    );
    state.exit_points = exits.data.exit_points ?? [];
    state.location_error = null;

    const opened = location.start({
      onSample: handleSample,
      onError: (failure) => {
        state.location_error = failure?.error ?? null;
        onError?.(failure);
      },
    });
    if (!opened.ok) {
      state.location_error = opened.error;
      onError?.(opened);
      return opened;
    }

    return ok({
      session_id: sessionId,
      anchors: state.anchors.length,
      exit_points: state.exit_points.length,
      watching: true,
    });
  }

  function stop() {
    const was = state.session_id !== null;
    location?.stop?.();
    state.session_id = null;
    state.site_id = null;
    state.anchors = [];
    state.exit_points = [];
    state.current_stop = null;
    state.current_anchor = null;
    state.outside_since = null;
    state.last_sample = null;
    return ok({ stopped: was });
  }

  /** התחנה הנוכחית והדגימה התקפה האחרונה, למי שמרכיב (הכרעה 11). */
  function current() {
    return {
      session_id: state.session_id,
      stop_id: state.current_stop,
      sample: state.last_sample === null ? null : { ...state.last_sample },
      samples: state.samples,
      rejected: state.rejected,
      location_error: state.location_error,
    };
  }

  /**
   * נקודת היציאה הקרובה מהדגימה האחרונה, עם מרחק וכיוון. F-13 תיקון 1
   * סעיף 3: "החישוב הוא קוד רגיל באותו מודול שמחשב מרחקים".
   */
  function nearestExit() {
    if (state.last_sample === null || state.exit_points.length === 0) return null;
    const measured = state.exit_points
      .map((point) => ({ point, distance: distanceMeters(state.last_sample, point) }))
      .sort((a, b) => a.distance - b.distance);
    return {
      exit_point: { ...measured[0].point },
      distance_m: Math.round(measured[0].distance),
      direction: direction(state.last_sample, measured[0].point),
    };
  }

  return {
    start,
    stop,
    current,
    nearestExit,
    direction,
    /** מקבל את הדגימה ישירות, לבדיקות ולמקורות שאינם זרם. */
    sample: handleSample,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    /** ממתין לכל המעטפות שיצאו. לבדיקות. */
    settled: () => Promise.all([...pending]),
    events: () => state.events.map((event) => ({ ...event })),
  };
}
