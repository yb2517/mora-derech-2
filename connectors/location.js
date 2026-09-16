// CONN-03: Location Adapter, מתאם המיקום. משימה 3 בתוכנית שלב 5.
//
// המקור: מפה 3.3 (שורת CONN-03: "דגימות מיקום מהמכשיר, או
// מהסימולטור, באותה צורה"), 2.4 (location_sample_interval_s), 4.1
// גרסה 3.8 ("CONN-03 מוזרק ל-AUTO-01"), 4.5 (E-LOCATION-NOT-ALLOWED),
// usecase-f-01-f-03 צעד 1 וזרימה ד, doc-build-03-interfaces סעיף 3.3.
//
// החוזה: start פותח זרם דגימות { lat, lng, accuracy_m, time }, stop
// סוגר אותו. שני מקורות באותו חוזה: המכשיר כאן, והסימולטור
// (TOOL-01) בפיתוח. הצרכן היחיד הוא AUTO-01, והוא אינו יודע איזה
// מהשניים מוזרק לו. זה מבחן ההחלפה של usecase-f-01-f-03 סעיף 8.
//
// המתאם אינו מחשב מרחק, אינו מכיר עוגן ואינו יודע מהי תחנה. הוא
// מתרגם את מה שהמכשיר מוסר לצורה האחת, ומסנן לפי קצב הדגימה מטבלת
// ה-reference. דגימות אינן נשמרות לעולם (BL-18): כל דגימה נמסרת
// למי שהזמין אותה, ונשכחת.

import { error } from '../core/errors.js';

// קוד השגיאה של המכשיר להרשאה שנדחתה, לפי תקן Geolocation.
const PERMISSION_DENIED = 1;

function ok(data) {
  return { ok: true, data };
}

function failed(code, data) {
  return { ok: false, error: error(code, data) };
}

/**
 * @param {object} options
 * @param {object} [options.geolocation] בדפדפן: navigator.geolocation.
 * @param {object} options.reference location_sample_interval_s, מוזרק
 *   מטבלת ה-reference בהרכבה.
 * @param {() => number} [options.clock] השעון במילישניות, לסינון הקצב.
 */
export function create({ geolocation = null, reference = {}, clock = () => Date.now() } = {}) {
  let watch = null;
  let lastAt = null;

  function available() {
    return Boolean(geolocation && typeof geolocation.watchPosition === 'function');
  }

  function ref(key) {
    const value = reference?.[key];
    return value === undefined || value === null
      ? { missing: failed('E-REF-EMPTY', { key }) }
      : { value };
  }

  /**
   * start: פותח את הזרם. onSample מקבל כל דגימה בצורה האחת; onError
   * מקבל E-LOCATION-NOT-ALLOWED פעם אחת, כשהמשפחה סירבה.
   *
   * הרשאה נדחית באיחור, מהמכשיר, ולכן היא מגיעה ב-onError ולא
   * בתשובת start. מכשיר בלי מיקום כלל נכשל כאן מיד, באותו קוד:
   * מבחינת המערכת, אין מיקום.
   */
  function start({ onSample, onError } = {}) {
    const interval = ref('location_sample_interval_s');
    if (interval.missing) return interval.missing;

    if (!available()) {
      return failed('E-LOCATION-NOT-ALLOWED', { reason: 'no_device' });
    }

    stop();
    lastAt = null;
    let denied = false;

    const intervalMs = interval.value * 1000;

    const id = geolocation.watchPosition(
      (position) => {
        if (watch === null || watch.id !== id) return;
        const at = clock();
        // קצב הדגימה: דגימה שמגיעה לפני שעבר המרווח נבלעת. המכשיר
        // מדווח בקצב שלו, והמערכת מקשיבה בקצב שלה.
        if (lastAt !== null && at - lastAt < intervalMs) return;
        lastAt = at;
        onSample?.({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          time: new Date(position.timestamp ?? at).toISOString(),
        });
      },
      (thrown) => {
        if (watch === null || watch.id !== id) return;
        if (thrown?.code === PERMISSION_DENIED && !denied) {
          denied = true;
          stop();
          onError?.(failed('E-LOCATION-NOT-ALLOWED', { reason: 'denied' }));
        }
        // שגיאה זמנית של המכשיר (אין קליטה, פסק זמן) אינה כשל: הזרם
        // נשאר פתוח, והדגימה הבאה תגיע כשתגיע (usecase-f-01-f-03
        // זרימה ב: עיכוב עדיף על טעות).
      },
      { enableHighAccuracy: true, maximumAge: intervalMs },
    );

    watch = { id };
    return ok({ watching: true, interval_s: interval.value });
  }

  /** stop: סוגר את הזרם. אישור, בלי כשל. */
  function stop() {
    if (watch === null) return ok({ stopped: false });
    try {
      geolocation.clearWatch(watch.id);
    } catch {
      // מכשיר שכבר סגר.
    }
    watch = null;
    return ok({ stopped: true });
  }

  return {
    start,
    stop,
    available,
    watching: () => watch !== null,
  };
}
