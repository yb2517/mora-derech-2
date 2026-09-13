// CORE-01: שתי המעטפות של החוזה.
//
// המקור: doc-module-map-v3 סעיף 4.1 (המעטפות), BL-11 צעד 1 (סדר בדיקת הפונה),
// ו-4.5 (הרשימה הסגורה של קודי השגיאה).
//
// הקובץ הזה אינו מייבא דבר, אינו נוגע באחסון, ואינו מכיר שום מודול.
// אף מודול אינו מגדיר מעטפה משלו: שתיהן כאן (חוק ברזל 1 במסמך הבנייה).

// שני הקודים שהקובץ הזה מחזיר, מתוך הרשימה הסגורה במפה 4.5.
// משימה 2 בתוכנית השלב מרכזת את 22 הקודים ב-/core/errors.js; משם והלאה
// שני אלה ייובאו ולא יוגדרו כאן. שני הקבצים הם CORE-01, ולכן אין כאן
// ייבוא בין מודולים (חוק ברזל 7).
const E_FROM_MISSING = 'E-FROM-MISSING';
const E_ENVELOPE_INVALID = 'E-ENVELOPE-INVALID';

// מעטפת הבקשה, מפה 4.1: { from, module, action, payload, lang }
export const REQUEST_FIELDS = Object.freeze([
  'from',
  'module',
  'action',
  'payload',
  'lang',
]);

// מעטפת התשובה, מפה 4.1: { ok, data, error }
export const RESPONSE_FIELDS = Object.freeze(['ok', 'data', 'error']);

// הרשימה הסגורה של הפונים, מפה 4.1 כלשונה.
// validate אינו בודק אותה: זהו צעד 2 ב-BL-11, והוא יושב ב-CORE-02
// ומחזיר E-FROM-UNKNOWN לפי 4.5. הרשימה יושבת כאן מפני שסעיף 4.1
// הוא סעיף המעטפות, וסעיף 5 במסמך הבנייה ממפה אותו לקובץ הזה.
export const FROM_LIST = Object.freeze([
  'screen-veto',
  'screen-traveler',
  'screen-content',
  'screen-owner',
  'module-dialogue',
  'module-delivery',
  'module-retrieval',
  'module-geofence',
  'system-timer',
  'tool-simulator',
]);

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// שדה חובה טקסטואלי. מחרוזת ריקה או רווחים בלבד נחשבת שדה חסר:
// אין בה ערך שאפשר לבדוק מולו דבר.
function isFilledString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function rejected(code, field) {
  return { valid: false, code, data: { field } };
}

/**
 * בודק מעטפת בקשה מול סעיף 4.1 במפה.
 *
 * מחזיר { valid: true } למעטפה תקינה, או
 * { valid: false, code, data: { field } } עם קוד מהרשימה הסגורה.
 *
 * סדר הבדיקה נגזר מ-BL-11 (from קודם לכל) ואחריו מסדר השדות בסעיף 4.1.
 * validate מסמן; CORE-02 הוא שמחזיר את הקוד במעטפת התשובה (4.5).
 */
export function validate(request) {
  if (!isPlainObject(request)) {
    return rejected(E_ENVELOPE_INVALID, 'envelope');
  }

  // BL-11 צעד 1: from קיים. צעדים 2 ו-3 (רשימה סגורה, רשימת המותר) ב-CORE-02.
  if (!isFilledString(request.from)) {
    return rejected(E_FROM_MISSING, 'from');
  }

  if (!isFilledString(request.module)) {
    return rejected(E_ENVELOPE_INVALID, 'module');
  }

  if (!isFilledString(request.action)) {
    return rejected(E_ENVELOPE_INVALID, 'action');
  }

  // "payload לא תקין" הוא המקרה השני ש-4.5 מונה תחת E-ENVELOPE-INVALID.
  if (!isPlainObject(request.payload)) {
    return rejected(E_ENVELOPE_INVALID, 'payload');
  }

  // lang הוא שדה חובה בסעיף 4.1. המפה אינה מגדירה רשימה סגורה של ערכים,
  // ולכן הבדיקה כאן היא בדיקת קיום בלבד ואינה ממציאה רשימה. פער מדווח.
  if (!isFilledString(request.lang)) {
    return rejected(E_ENVELOPE_INVALID, 'lang');
  }

  return { valid: true };
}

/** מעטפת תשובה מוצלחת, מפה 4.1. */
export function okResponse(data = null) {
  return { ok: true, data, error: null };
}

/**
 * מעטפת תשובה כושלת, מפה 4.1.
 * הארגומנט הוא ערך ה-error שמייצרת error(code, data) ב-/core/errors.js
 * (משימה 2). הקובץ הזה אינו יודע להרכיב אותו ואינו מכיר את 22 הקודים.
 */
export function errorResponse(error) {
  return { ok: false, data: null, error };
}
