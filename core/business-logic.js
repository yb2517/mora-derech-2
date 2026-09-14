// הליבה: החוקים העסקיים. משימה 1 בתוכנית שלב 3.
//
// המקור: מפה 2.2 (טבלת מעברי המצב של הפריט), 2.3 (BL-01, BL-02,
// BL-08), ו-CLAUDE.md סעיף 5 ("/core/business-logic.js: BL-01 עד
// BL-21, טבלת המעברים, תנאי הנעילה L1 עד L6").
//
// **הקובץ מכיל את מה שנבנה עד כה ואת זה בלבד**: בשלב 3 נכנסו
// הכללים ש-F-07 נשען עליהם (BL-01, BL-02, BL-08), ובמשימה 2 של שלב
// 4 נכנסו תנאי הנעילה L1 עד L6 ו-BL-06 ו-BL-07 שנגזרים מהם. שאר
// החוקים נכנסים עם המודולים שאוכפים אותם: BL-03, BL-05, BL-13
// ו-BL-21 עם BE-04, BL-19 עם FE-04, BL-16 ו-BL-17 עם BE-07, ו-BL-15
// ו-BL-20 בשלב 5. כלל בלי מודול שאוכף אותו הוא קוד שאיש אינו קורא
// (CLAUDE.md סעיף 11: אין הרחבת היקף).
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

// ---------------------------------------------------------------------
// תנאי הנעילה, L1 עד L6. משימה 2 בתוכנית שלב 4.
//
// המקור: usecase-f-08 סעיף 4 (טבלת ששת התנאים), BL-06, BL-07,
// ו-CLAUDE.md סעיף 5 ("תנאי הנעילה L1 עד L6" יושבים בקובץ הזה).
//
// ארבעה מהתנאים ניתנים לחישוב על נתונים, ושניים אינם:
//   L1 עד L4 הם שאלות על הנתונים, ולכן הם פונקציות טהורות כאן.
//   L5 הוא פעולת אדם מתועדת. אין מה לחשב בו: מה שיושב כאן הוא
//     המונה של corpus_version, והרשומה עצמה נבנית ב-buildApprovalRecord.
//   L6 הוא כלל שמופעל אחרי הנעילה ולא לפניה (BL-07), ולכן הוא
//     פרדיקט על פעולה ולא תנאי מוכנות.
//
// הפונקציות כאן אינן קוראות נתונים ואינן כותבים: הן מקבלות רשימות
// ומחזירות הכרעה. BE-05 ו-BE-06 הם שקוראים מה-Repository (BL-09),
// ולכן אותו חישוב משרת גם את טבלת המוכנות של usecase-f-08 צעד 9 וגם
// את בדיקת הנעילה עצמה בצעד 11, בלי ששני מקומות יגדירו אותו אחרת.
// ---------------------------------------------------------------------

/** המצבים שמהם פריט נחשב "הוכרע", לפי L1. */
const DECIDED = Object.freeze(['approved', 'rejected']);

/**
 * האם ההסכם בתוקף במועד הנתון.
 *
 * מפה 2.1 מסמנת את שם שדה התוקף [טרם נקבע, decision-02], והנתונים
 * כותבים valid_until. הסכם בלי תאריך תוקף, או עם תאריך שאינו ניתן
 * לקריאה, אינו נספר: היעדר ראיה לתוקף אינו ראיה לתוקף, ושער שנפתח
 * על סמך רשומה חסרה הוא בדיוק הפגם ש-F-07 בא למנוע.
 */
export function mouInEffect(mou, at) {
  const until = Date.parse(mou?.valid_until);
  return Number.isNaN(until) ? false : until >= Date.parse(at);
}

/**
 * כיסוי ההסכמים של המסלול, ו-M-06 שנגזר ממנו.
 *
 * הבסיס הוא **המקורות שפריטי ה-approved של המסלול מפנים אליהם**
 * (הכרעת בעלת הפרויקט 14.09.2026, הכרעה 17 בתוכנית שלב 4, שסוגרת
 * את חוב טכני 14 של דוח שלב 3). זה הבסיס ש-L4 מדבר עליו במפורש
 * ("לכל מקור של פריט approved"), ולכן M-06 ו-L4 מודדים אותו דבר.
 * מסלול בלי פריט approved אינו מייצר כיסוי: כיסוי של כלום אינו
 * הסכם שמישהו חתם עליו.
 *
 * M-06 הוא מספר המכונים שלהם הסכם בתוקף המכסה 100% מהמקורות האלה
 * (usecase-f-07 צעד 14). uncovered הוא הצד השני של אותה שאלה, לפי
 * מקור: מקור שאף הסכם בתוקף אינו מכסה. L4 נשען על שניהם.
 *
 * מפה 3.2 מטילה על BE-06 את "חישוב M-06". הספירה נשארת שלו במובן
 * שהוא זה שקורא את הנתונים ומחזיר את התשובה; הכלל עצמו יושב כאן
 * מפני ש-L4 ו-M-06 היו מגדירים אותו פעמיים, ושתי הגדרות של אותו
 * כלל נפרדות ביום שמישהו משנה אחת מהן.
 */
export function mouCoverage({ items = [], mou = [], at } = {}) {
  const required = [...new Set(
    items
      .filter((item) => item.status === 'approved')
      .map((item) => item.source_id)
      .filter((sourceId) => typeof sourceId === 'string' && sourceId !== ''),
  )];

  const inEffect = mou.filter((row) => mouInEffect(row, at));

  const covering = required.length === 0
    ? []
    : inEffect.filter((row) => {
      const scope = new Set(row.scope ?? []);
      return required.every((sourceId) => scope.has(sourceId));
    });

  const institutes = [...new Set(covering.map((row) => row.institute_id))];

  const covered = new Set(inEffect.flatMap((row) => row.scope ?? []));
  const uncovered = required.filter((sourceId) => !covered.has(sourceId));

  return {
    required,
    institutes,
    m06: institutes.length,
    mou_in_effect: inEffect.length,
    uncovered,
  };
}

/**
 * L1: כל פריט במסלול הוכרע, ולכל פריט approved יש רשומת APPROVALS.
 *
 * **זו ההגנה של הבדיקה האדומה השנייה** (מפה 6.5): פריט שהוזרק
 * ישירות למאגר במצב approved, בלי שעבר את הווטו, אין לו רשומה
 * שמעידה על המעבר, והוא נופל כאן. לכן ההצלבה היא מול רשומה שמצבה
 * החדש הוא approved ולא מול קיום רשומה כלשהי: רשומת "נוצר" אינה
 * אישור.
 */
function conditionL1(items, approvals) {
  const approvedTargets = new Set(
    approvals.filter((row) => row.to_status === 'approved').map((row) => row.target),
  );

  const undecided = items.filter((item) => !DECIDED.includes(item.status));
  const withoutRecord = items.filter(
    (item) => item.status === 'approved' && !approvedTargets.has(item.item_id),
  );

  return {
    id: 'L1',
    name: 'כל פריט הוכרע, ולכל פריט מאושר יש רשומת APPROVALS',
    passes: undecided.length === 0 && withoutRecord.length === 0,
    failing: [...new Set([...undecided, ...withoutRecord].map((item) => item.item_id))],
  };
}

/**
 * L2: לכל תחנה במסלול לפחות פריט אחד במצב approved.
 *
 * הכיסוי נמדד לפי תחנות ולא לפי פריטים (הכרעת בעלת הפרויקט
 * 14.09.2026, הכרעה 10 בתוכנית שלב 4, וההצעה שבטבלת usecase-f-08):
 * פריט rejected אינו חוסם נעילה אם התחנה שלו מכוסה בפריט אחר.
 */
function conditionL2(site, items) {
  const stops = site?.stops ?? [];
  const covered = new Set(
    items.filter((item) => item.status === 'approved').map((item) => item.stop_id),
  );
  const failing = stops.filter((stopId) => !covered.has(stopId));

  return {
    id: 'L2',
    name: 'לכל תחנה במסלול פריט מאושר אחד לפחות',
    passes: stops.length > 0 && failing.length === 0,
    failing,
  };
}

/**
 * L3: לכל פריט approved טקסט, עמוד במקור, שיוך למקור רשום, ועוגן
 * שסומן "אומת בשטח".
 *
 * העוגן מקושר לפריט ב-item_id (מפה 2.1), ולכן פריט בלי עוגן ופריט
 * עם עוגן שלא אומת נופלים באותה שורה: שניהם אינם עומדים בתנאי.
 * זו גם ההגנה שעליה usecase-f-13 זרימה ד נשען: עוגן שלא אומת לא
 * נשאלה עליו שאלת החצייה, ולכן מסלול נעול אינו יכול להכיל אחד כזה.
 */
function conditionL3(items, anchors, sources) {
  const anchorByItem = new Map(anchors.map((anchor) => [anchor.item_id, anchor]));
  const known = new Set(sources.map((row) => row.source_id));

  const failing = items
    .filter((item) => item.status === 'approved')
    .filter((item) => {
      const anchor = anchorByItem.get(item.item_id);
      const hasText = typeof item.text === 'string' && item.text.trim() !== '';
      const hasPage = item.page !== undefined && item.page !== null && item.page !== '';
      const hasSource = known.has(item.source_id);
      return !hasText || !hasPage || !hasSource || anchor?.verified !== true;
    })
    .map((item) => item.item_id);

  return {
    id: 'L3',
    name: 'לכל פריט מאושר טקסט, עמוד, מקור רשום, ועוגן שאומת בשטח',
    passes: failing.length === 0,
    failing,
  };
}

/**
 * L4: לכל מקור של פריט approved רשומת RIGHTS_MOU בתוקף המכסה אותו,
 * ולכן M-06 גדול או שווה 1.
 *
 * שני חצאים, ושניהם נדרשים: מקור שאינו מכוסה כלל, ומצב שבו כל מקור
 * מכוסה בנפרד אך אין מכון יחיד שמכסה את כולם. השני הוא בדיוק מה
 * ש-M-06 סופר, ומה ש-BL-08 דורש כדי לפתוח את שער B.
 */
function conditionL4(coverage) {
  const failing = [...coverage.uncovered];
  const passes = failing.length === 0 && coverage.m06 >= 1;

  return {
    id: 'L4',
    name: 'לכל מקור של פריט מאושר הסכם בתוקף, ו-M-06 אחד לפחות',
    passes,
    failing,
    m06: coverage.m06,
  };
}

/**
 * BL-06: טבלת המוכנות לנעילה, L1 עד L4.
 *
 * אותה פונקציה משרתת את התצוגה (usecase-f-08 צעד 9, BE-06
 * get_lock_readiness) ואת בדיקת הנעילה עצמה (צעד 11, BE-05
 * lock_site). זה מכוון: מסך שמראה "מוכן" ונעילה שנדחית אחריו הם
 * שני חישובים שנפרדו.
 *
 * @param {object} state
 * @param {object} state.site רשומת המסלול, עם רשימת התחנות.
 * @param {object[]} state.items פריטי המסלול, בכל המצבים.
 * @param {object[]} state.anchors העוגנים של הפריטים האלה.
 * @param {object[]} state.approvals יומן ההחלטות של המסלול.
 * @param {object[]} state.sources המקורות הרשומים.
 * @param {object[]} state.mou רשומות ההסכם.
 * @param {string} state.at המועד שמולו נמדד תוקף ההסכם.
 */
export function lockReadiness({
  site, items = [], anchors = [], approvals = [], sources = [], mou = [], at,
} = {}) {
  const coverage = mouCoverage({ items, mou, at });
  const conditions = [
    conditionL1(items, approvals),
    conditionL2(site, items),
    conditionL3(items, anchors, sources),
    conditionL4(coverage),
  ];

  return {
    ready: conditions.every((condition) => condition.passes),
    conditions,
    // התנאים שנכשלו, בשמם, כדי ש-error.data של E-LOCK-REFUSED יישא
    // אותם כפי שמפה 4.5 דורשת ("מכיל את רשימת הכשלים").
    failed: conditions.filter((condition) => !condition.passes).map((condition) => condition.id),
    coverage,
  };
}

/**
 * L5: גרסת הקורפוס של הנעילה הבאה.
 *
 * מונה עולה למסלול, שמתקדם בכל נעילה ונרשם ברשומת הנעילה
 * (usecase-f-08 סעיף 4 ו-צעד 12). מסלול שלא ננעל מעולם מתחיל ב-1.
 */
export function nextCorpusVersion(site) {
  const current = Number(site?.corpus_version);
  return Number.isFinite(current) && current >= 1 ? current + 1 : 1;
}

/**
 * L6 ו-BL-07: הפעולות שמחזירות מסלול נעול למצב open.
 *
 * מפה BL-07: "יצירה או עריכה של פריט במסלול locked מחזירה את המסלול
 * ל-open ואת הפריט ל-draft". הפריט מטופל בטבלת המעברים (השורה
 * approved ל-draft, source system), והמסלול כאן.
 *
 * אימות עוגן אינו ברשימה, וזו הכרעה ולא השמטה (הכרעה 11 בתוכנית
 * שלב 4, בהכרעת בעלת הפרויקט): BL-07 נוקב ב"יצירה או עריכה של
 * פריט", ו-verify_anchor אינו נוגע בטקסט שהחוקר אישר.
 */
export const SITE_REOPENING_ACTIONS = Object.freeze(['create_item', 'edit_item']);

export function siteReopensOn({ site_status: siteStatus, action } = {}) {
  return siteStatus === 'locked' && SITE_REOPENING_ACTIONS.includes(action);
}
