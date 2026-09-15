// TOOL-01: Walk Simulator, סימולטור ההליכה. משימה 4 בתוכנית שלב 5.
// פיתוח בלבד.
//
// המקור: מפה 3.3 (שורת TOOL-01: "הזרמת דגימות מלאכותיות ל-CONN-03"),
// 4.1 גרסה 3.8 ("TOOL-01 הוא מקור דגימות חלופי שמוזרק במקומו
// בפיתוח"), usecase-f-01-f-03 זרימה ה, doc-build-03-automation סעיף
// 2, ותוכנית שלב 5 סעיף 8 (החילוץ מאב הטיפוס: לחיצה על נקודה כדי
// "להגיע" אליה, ו"המשך ללכת").
//
// הסימולטור מממש את אותו חוזה של CONN-03: start עם onSample, stop,
// ודגימות באותם ארבעה שדות. AUTO-01 מקבל אותו במקום מתאם המיקום
// ואינו יודע על כך. ההבדל היחיד בין הליכה אמיתית להליכה מדומה הוא
// הדגל simulator על הסשן, שהמסך רושם ב-session_start (BL-16).
//
// מה שהסימולטור אינו עושה: אינו שולח arrive בעצמו. הוא מוציא דגימה
// בקואורדינטות של עוגן, ו-AUTO-01 מחליט לפי BL-15 שהגענו. כך
// ההליכה בסימולטור בודקת את ה-geofence האמיתי ולא עוקפת אותו
// (תוכנית שלב 5 סעיף 8: "בשלב הזה הסימולטור מוציא דגימות בלבד,
// ו-AUTO-01 מחליט").
//
// שורות tool-simulator ברשימת המותר נוגעות ל-arrive ול-leave בלבד,
// ואינן נוגעות לדגימות (מפה 4.1). הן משמשות את מערך הבדיקות שרוצה
// לדבר עם FE-04 ישירות, ולא את הקובץ הזה.

// דיוק הדגימה המדומה, במטרים: "GPS טוב". ניתן לקביעה בכל דגימה.
const DEFAULT_ACCURACY_M = 5;

// כמה מעלות להתרחק כדי להיות "בין נקודות": כמחצית קילומטר, הרחק
// מכל רדיוס. ערך של הכלי, לא של המערכת.
const AWAY_DEGREES = 0.005;

function ok(data) {
  return { ok: true, data };
}

/**
 * @param {object} options
 * @param {() => number} [options.clock] השעון במילישניות, לחותמת הזמן.
 */
export function create({ clock = () => Date.now() } = {}) {
  let stream = null;
  let route = [];
  let position = null;
  const emitted = [];

  function sample({ lat, lng, accuracy_m = DEFAULT_ACCURACY_M }) {
    const row = { lat, lng, accuracy_m, time: new Date(clock()).toISOString() };
    position = row;
    emitted.push(row);
    stream?.onSample?.(row);
    return ok({ sample: row, delivered: stream !== null });
  }

  return {
    /** אותו חוזה של CONN-03. */
    start({ onSample, onError } = {}) {
      stream = { onSample, onError };
      return ok({ watching: true, simulator: true });
    },

    stop() {
      const was = stream !== null;
      stream = null;
      return ok({ stopped: was });
    },

    available: () => true,
    watching: () => stream !== null,

    /**
     * המסלול להליכה: רשימת נקודות { stop_id, lat, lng, name }. בדרך
     * כלל עוגני המסלול, בסדר התחנות.
     */
    load(points = []) {
      route = points.map((point) => ({ ...point }));
      return ok({ points: route.length });
    },

    route: () => route.map((point) => ({ ...point })),

    /**
     * "להגיע" לנקודה: דגימה בקואורדינטות של הנקודה, בדיוק שניתן
     * לקבוע. דיוק גרוע הוא הדרך לבדוק את BL-15 בלי מכשיר.
     */
    arriveAt(which, { accuracy_m = DEFAULT_ACCURACY_M } = {}) {
      const point = typeof which === 'number'
        ? route[which]
        : route.find((row) => row.stop_id === which || row.name === which);
      if (!point) return { ok: false, error: null, reason: 'unknown_point' };
      return sample({ lat: point.lat, lng: point.lng, accuracy_m });
    },

    /**
     * "המשך ללכת": דגימה הרחק מכל נקודה, כדי לצאת מהרדיוס.
     */
    walkOn({ accuracy_m = DEFAULT_ACCURACY_M } = {}) {
      const base = position ?? route[0] ?? { lat: 0, lng: 0 };
      return sample({ lat: base.lat + AWAY_DEGREES, lng: base.lng + AWAY_DEGREES, accuracy_m });
    },

    /** דגימה חופשית, לבדיקות שרוצות לעמוד במרחק מסוים. */
    sampleAt(point) {
      return sample(point);
    },

    position: () => (position === null ? null : { ...position }),
    emitted: () => emitted.map((row) => ({ ...row })),
  };
}
