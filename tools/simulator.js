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

// מרחק יחסי בין שתי נקודות, להשוואה בלבד: מעלות אורך מכווצות לפי
// קו הרוחב. אינו מטרים, ואינו המרחק של AUTO-01.
function spread(from, to) {
  const dLat = to.lat - from.lat;
  const dLng = (to.lng - from.lng) * Math.cos((from.lat * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}

/**
 * סדר הסיור: הנקודות לפי סדר התחנות במסלול (site.stops), ובתוך
 * תחנה לפי העמוד במקור, שהוא סדר הקריאה בחוברת. שתי נקודות באותה
 * תחנה ובאותו עמוד: הקרובה יותר לתחילת המסלול קודמת, מפני שהסיור
 * מתרחק מנקודת ההתחלה. זה כלל של הכלי ולא של המערכת: לפריט אין שדה
 * סדר במפה 2.1.
 *
 * בלי הסדר הזה הנקודות יוצאות בסדר המזהים, ובמסד הענן המזהים
 * אקראיים: הלחצן הראשון בפאנל לא היה תחילת הסיור.
 *
 * @param {Array<{stop_id, page, lat, lng}>} points
 * @param {string[]} stops סדר התחנות של המסלול.
 */
export function routeOrder(points = [], stops = []) {
  const position = (stopId) => {
    const index = stops.indexOf(stopId);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };
  const page = (point) => (Number.isFinite(point.page) ? point.page : Number.POSITIVE_INFINITY);
  const byStopAndPage = (a, b) => (position(a.stop_id) - position(b.stop_id)) || (page(a) - page(b));
  const start = [...points].sort(byStopAndPage)[0];
  return [...points].sort((a, b) => byStopAndPage(a, b)
    || (spread(start, a) - spread(start, b)));
}

// דגל הסשן שמסך המטייל רושם כשהסימולטור הוא מקור הדגימות (מפה 2.1
// שורת SESSIONS, BL-16). השם יושב כאן, ליד מי שהוא מסמן.
export const SESSION_FLAG = 'simulator';

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
    flag: SESSION_FLAG,

    /**
     * המסלול להליכה: רשימת נקודות { stop_id, page, lat, lng, name },
     * בדרך כלל עוגני המסלול. עם stops הן נטענות בסדר הסיור
     * (routeOrder); בלעדיו, בסדר שבו נמסרו.
     */
    load(points = [], { stops = null } = {}) {
      const ordered = Array.isArray(stops) ? routeOrder(points, stops) : points;
      route = ordered.map((point) => ({ ...point }));
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
