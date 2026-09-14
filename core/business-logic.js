// הליבה: החוקים העסקיים. משימה 1 בתוכנית שלב 3.
//
// המקור: מפה 2.2 (טבלת מעברי המצב של הפריט), 2.3 (BL-01, BL-02,
// BL-08), ו-CLAUDE.md סעיף 5 ("/core/business-logic.js: BL-01 עד
// BL-21, טבלת המעברים, תנאי הנעילה L1 עד L6").
//
// **הקובץ מכיל את מה שהשלב הזה צריך ואת זה בלבד**: הכללים ש-F-07
// נשען עליהם. BL-03 עד BL-07 ו-BL-09 עד BL-21 נכנסים עם המודולים
// שלהם בשלבים 4 ו-5, ותנאי הנעילה L1 עד L6 הם F-08. כלל בלי מודול
// שאוכף אותו הוא קוד שאיש אינו קורא (CLAUDE.md סעיף 11: אין הרחבת
// היקף).
//
// מה הקובץ הזה אינו עושה, וזה העיקר: אינו נוגע באחסון, אינו מכיר
// מעטפה, אינו יודע מי קרא לו, ואינו מייצר שגיאה במעטפת תשובה. הוא
// מחזיר הכרעה, והמודול שמעליו הוא שהופך אותה לתשובה. לכן החלפת
// BE-05 אינה נוגעת בכללים, והחלפת כלל אינה נוגעת ב-BE-05 (מבחן
// ההחלפה, usecase-f-07 סעיף 8: "BE-05 עובר, בתנאי שהמעברים בליבה").

import { ERROR_CODES } from './errors.js';

// אותה הגנה שיש ב-contract.js: קוד שאינו ברשימה הסגורה נופל בטעינה
// ולא בזמן ריצה (חוק ברזל 8).
function closedCode(code) {
  if (!Object.prototype.hasOwnProperty.call(ERROR_CODES, code)) {
    throw new Error(`קוד שגיאה שאינו ברשימה הסגורה של מפה 4.5: ${code}`);
  }
  return code;
}

const E_TRANSITION_DENIED = closedCode('E-TRANSITION-DENIED');

/** ארבעת מצבי הפריט, מפה 2.1. אין מצב חמישי: הנעילה היא מצב מסלול. */
export const ITEM_STATUSES = Object.freeze(['draft', 'pending', 'approved', 'rejected']);

/** שני מצבי המסלול, מפה 2.1. */
export const SITE_STATUSES = Object.freeze(['open', 'locked']);

// המצב שממנו נוצר פריט חדש. הטבלה כותבת "(חדש)" בעמודת "מהמצב",
// וזה אינו מצב של פריט קיים אלא היעדרו.
export const NO_STATUS = null;

// שני מקורות המעבר. CALLER הוא מעבר שמגיע במעטפה ממסך, והשאלה איזה
// מסך נענית ברשימת המותר ולא כאן. SYSTEM הוא מעבר שהמערכת מבצעת
// מעצמה, ואין לו שורה ברשימת המותר מפני שאיש אינו שולח אותו.
export const CALLER = 'caller';
export const SYSTEM = 'system';

/**
 * טבלת מעברי המצב של הפריט, מפה 2.2, שמונה השורות.
 *
 * העמודות: from (המצב הנוכחי), to (המצב החדש), action (שם הפעולה),
 * source (מי מעביר, ראו מיד), condition (התנאי כלשונו).
 *
 * זה **נתון ולא קוד**: הוספת מעבר היא עריכת שורה כאן, ואין למטה שום
 * if שמכיר מצב מסוים בשמו. הבדיקה מצליבה את שמונה השורות מול המפה.
 *
 * **עמודת "מי רשאי (from)" של המפה אינה יושבת כאן, וזה מכוון**:
 * פער 36. מפה 4.3 קובעת "הוספת מסך או פונה: שורה, לא קוד", ומבחן
 * מבנה 06 אוכף שאין שם פונה בקוד המערכת. שתי שורות במפה מושכות
 * לשני כיוונים, ולכן ההכרעה: שם הפונה יושב ברשימת המותר בלבד, שהיא
 * נתונים, ו-CORE-02 בודק אותו לפני שהבקשה מגיעה לכאן (BL-11 צעד 3).
 * כל שורה בטבלת 2.2 שנושאת שם מסך יש לה שורה מקבילה ברשימת המותר,
 * ובדיקת הממשקים מצליבה את השתיים כדי שלא ייפרדו.
 *
 * מה שכן נשאר כאן הוא ההבחנה שרשימת המותר אינה יכולה לבטא: מעבר
 * שאיש אינו שולח במעטפה. השורה approved ל-draft היא "BE-05
 * אוטומטית" במפה, ולכן source שלה הוא system, ומעטפה שתבקש אותה
 * תיפול קודם ב-E-ALLOW-DENIED (אין לה שורה) וגם כאן.
 */
export const ITEM_TRANSITIONS = Object.freeze([
  {
    from: NO_STATUS,
    to: 'draft',
    action: 'create_item',
    source: CALLER,
    condition: 'שלמות: טקסט, עמוד, תחנה, מקור, קואורדינטות בגבולות',
  },
  {
    from: 'draft',
    to: 'pending',
    action: 'submit',
    source: CALLER,
    condition: 'שלמות כנ"ל',
  },
  {
    from: 'pending',
    to: 'approved',
    action: 'approve',
    source: CALLER,
    condition: 'אין',
  },
  {
    from: 'pending',
    to: 'rejected',
    action: 'reject',
    source: CALLER,
    condition: 'הערה רשות',
  },
  {
    from: 'approved',
    to: 'pending',
    action: 'return',
    source: CALLER,
    condition: 'נרשם',
  },
  {
    from: 'rejected',
    to: 'pending',
    action: 'return',
    source: CALLER,
    condition: 'נרשם',
  },
  {
    from: 'approved',
    to: 'draft',
    action: 'revert',
    source: SYSTEM,
    condition: 'עריכת טקסט (edit_item); המסלול נפתח אם היה locked',
  },
  {
    from: 'rejected',
    to: 'draft',
    action: 'edit_item',
    source: CALLER,
    condition: 'נרשם',
  },
]);

/**
 * BL-02: מעברי מצב לפי טבלה 2.2 בלבד.
 *
 * מחזיר { allowed: true, to, row } למעבר שיש לו שורה, או
 * { allowed: false, code: 'E-TRANSITION-DENIED', data } לכל מעבר אחר.
 * מפה 2.2, השורה האחרונה: "כל מעבר אחר נדחה ב-E-TRANSITION-DENIED
 * ונרשם".
 *
 * שתי שאלות ושתי תשובות, ולא אחת: רשימת המותר שואלת אם הפונה רשאי
 * לשלוח את הפעולה, וזו שואלת אם הפעולה חוקית מהמצב הנוכחי. פעולה
 * שמותרת לפונה ואסורה מהמצב עוברת את הראשונה ונדחית כאן.
 *
 * @param {object} attempt
 * @param {string|null} attempt.status המצב הנוכחי, או NO_STATUS ליצירה.
 * @param {string} attempt.action שם הפעולה.
 * @param {string} [attempt.source] CALLER למעבר שהגיע במעטפה (ברירת
 *   המחדל), SYSTEM למעבר שהמערכת מבצעת מעצמה. מעטפה שתבקש מעבר
 *   שמקורו SYSTEM נדחית.
 */
export function canTransition({ status = NO_STATUS, action, source = CALLER } = {}) {
  const row = ITEM_TRANSITIONS.find(
    (transition) => transition.from === status
      && transition.action === action
      && transition.source === source,
  );

  if (row) {
    return { allowed: true, to: row.to, row };
  }

  // הדחייה נושאת את שלושת הערכים שהרכיבו אותה, כדי ששורת היומן
  // והנוסח למפתח יראו מה בדיוק לא נמצא בטבלה.
  return {
    allowed: false,
    code: E_TRANSITION_DENIED,
    data: { status, action, source },
  };
}

/** הפעולות החוקיות ממצב נתון. נקרא בבדיקה. */
export function allowedActions({ status = NO_STATUS, source = CALLER } = {}) {
  return ITEM_TRANSITIONS
    .filter((row) => row.from === status && row.source === source)
    .map((row) => row.action);
}

/**
 * BL-01: אין שינוי מצב של פריט או מסלול בלי רשומת APPROVALS. כשל
 * כתיבה מבטל את המעבר (usecase-f-07 זרימה ב).
 *
 * הכלל הוא סדר פעולות, ולכן הוא אינו יכול להיאכף בפונקציה שמחזירה
 * אמת או שקר: הוא נאכף בכך שהמודול כותב את הרשומה ראשונה, ומשנה
 * את המצב רק אחרי שהכתיבה הצליחה. מה שכן יושב כאן הוא **צורת
 * הרשומה**, כדי ששום מודול לא ימציא שדה ולא ישמיט שדה (מפה 2.1,
 * ישות APPROVALS).
 *
 * הרשומה append-only: אין כאן פונקציה שמעדכנת רשומה קיימת, ולא
 * במקרה.
 */
export const APPROVAL_FIELDS = Object.freeze([
  'approval_id',
  'time',
  'who',
  'target',
  'action',
  'from_status',
  'to_status',
  'note',
]);

/**
 * מרכיב רשומת APPROVALS. הערכים מגיעים מבחוץ, כולל המזהה והזמן:
 * הליבה אינה מייצרת מזהים ואינה קוראת שעון, ולכן הבדיקה יכולה
 * להזריק זמן קבוע ולהשוות רשומה שלמה.
 *
 * who: פער 32. מפה 2.1 מגדירה את השדה, ו-4.1 אינה נותנת לו מקום
 * במעטפה. בהכרעת בעלת הפרויקט 14.09.2026 נרשם בו שם הפונה שהגיע
 * במעטפה, ולא שם אדם: אין אימות זהות ב-v1 (מפה 2.1, ADMIN_USERS),
 * ורשומה שתטען לדעת מי האדם תהיה שקר מתועד. הערך מגיע מבחוץ, ולכן
 * הקובץ הזה אינו מכיר אף שם פונה (מפה 4.3, מבחן מבנה 06).
 */
export function buildApprovalRecord({
  approval_id: approvalId,
  time,
  who,
  target,
  action,
  from_status: fromStatus,
  to_status: toStatus,
  note = '',
}) {
  return {
    approval_id: approvalId,
    time,
    who,
    target,
    action,
    from_status: fromStatus,
    to_status: toStatus,
    // ההערה רשות בכל מעבר (הוכרע 10.09.2026, usecase-f-07 צעד 8):
    // הרשומה נכתבת גם כשההערה ריקה, ומחרוזת ריקה היא ערך ולא היעדר.
    note: typeof note === 'string' ? note : '',
  };
}

/**
 * BL-08: שער B פתוח כאשר המסלול locked ו-M-06 גדול או שווה 1.
 * כאשר enforce_gate_b כבוי, המצב מוצג ואינו נאכף.
 *
 * מה שאינו כאן: **חישוב M-06 עצמו**. מפה 3.2 מטילה אותו על BE-06
 * ("חישוב M-06, מצב שער B"), ו-usecase-f-07 צעד 14 מגדיר אותו
 * כספירה מעל רשומות RIGHTS_MOU ו-SOURCES. הליבה מחזיקה את התנאי,
 * והמודול מחזיק את הספירה: כך החלפת כלל הפתיחה אינה נוגעת בשליפה,
 * והחלפת מקור הנתונים אינה נוגעת בכלל.
 *
 * reasons נושא את התנאים שלא התקיימו, כדי שהמסך יציג מה חסר במקום
 * "חסום" בלי הסבר.
 *
 * @param {object} state
 * @param {string} state.site_status מצב המסלול, open או locked.
 * @param {number} state.m06 מספר המכונים עם הסכם בתוקף המכסה 100%.
 * @param {boolean} state.enforce הערך של enforce_gate_b מטבלת ה-reference.
 */
export function gateB({ site_status: siteStatus, m06 = 0, enforce = false } = {}) {
  const reasons = [];
  if (siteStatus !== 'locked') reasons.push('site_not_locked');
  if (!(m06 >= 1)) reasons.push('m06_zero');

  const open = reasons.length === 0;

  return {
    open,
    m06,
    site_status: siteStatus ?? null,
    // האכיפה והמצב הם שני דברים. שער חסום כשהאכיפה כבויה מוצג כחסום
    // ואינו חוסם (BL-08, usecase-f-07 זרימה ו3), והמסך אומר זאת
    // במפורש במקום להציג מסלול פתוח בלי סיבה.
    enforced: enforce === true,
    blocking: open === false && enforce === true,
    reasons,
  };
}
