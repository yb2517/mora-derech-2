// הליבה: החוקים העסקיים. משימה 2 בתוכנית שלב 3.
//
// המקור: מפה 2.2 (טבלת מעברי המצב של הפריט), 2.3 (BL-01, BL-02),
// CLAUDE.md סעיף 5 ("BL-01 עד BL-21, טבלת המעברים, תנאי הנעילה L1 עד
// L6"), ו-usecase-f-07 סעיף 8: "BE-05: שום דבר יישבר, כל עוד טבלת
// המעברים יושבת בליבה ולא בתוכו".
//
// **למה כאן ולא ב-BE-05**: מודול שמחזיק את החוק שלו אינו ניתן להחלפה,
// מפני שהחלפתו מוחקת את החוק. הטבלה כאן היא נתון, ו-BE-05 קורא אותה.
// החלפת BE-05 מחר אינה נוגעת בשורה אחת ממה שמותר.
//
// מה יש כאן בשלב 3: טבלה 2.2 במלואה, ותנאי השלמות. מה אין: L1 עד L6
// (BL-06) ויתר החוקים, שנכנסים בשלב 4 עם המודולים שלהם. חוק בלי
// מודול שאוכף אותו הוא קוד מת, ואינו נכתב מראש.

/**
 * ארבעת המצבים הקנוניים של פריט. מפה 2.2: "ארבעת השמות באנגלית הם
 * הקנוניים, והעברית ביאור במסך בלבד. אין מצב חמישי לפריט: הנעילה
 * היא מצב מסלול".
 */
export const ITEM_STATUSES = Object.freeze(['draft', 'pending', 'approved', 'rejected']);

/**
 * טבלת המעברים, מפה 2.2, שורה לשורה. from_status הוא null לפריט חדש.
 *
 * **עמודת "מי רשאי" שבמפה אינה כאן**, וזו לא השמטה. הניסיון הראשון
 * החזיק אותה, ומבחן מבנה 06 תפס אותו מיד: שם פונה בקוד המערכת הופך
 * שינוי שם פונה משורה בנתונים לעריכת קוד. מי רשאי לבקש פעולה נאכף
 * בשורה ברשימת המותר ובידי CORE-02, ושם בלבד. הטבלה כאן עונה על
 * שאלה אחרת: לאיזה מצב הפריט רשאי לעבור.
 */
export const TRANSITIONS = Object.freeze([
  { action: 'create_item', from_status: null, to_status: 'draft', requires_completeness: true },
  { action: 'submit', from_status: 'draft', to_status: 'pending', requires_completeness: true },
  { action: 'approve', from_status: 'pending', to_status: 'approved', requires_completeness: false },
  { action: 'reject', from_status: 'pending', to_status: 'rejected', requires_completeness: false },
  { action: 'return', from_status: 'approved', to_status: 'pending', requires_completeness: false },
  { action: 'return', from_status: 'rejected', to_status: 'pending', requires_completeness: false },
  { action: 'revert', from_status: 'approved', to_status: 'draft', requires_completeness: false },
  { action: 'edit_item', from_status: 'rejected', to_status: 'draft', requires_completeness: false },
].map((row) => Object.freeze(row)));

/**
 * תנאי השלמות של פריט, מפה 2.2: "טקסט, עמוד, תחנה, מקור, קואורדינטות
 * בגבולות".
 *
 * הקואורדינטות אינן שדה בפריט אלא רשומת GEO_ANCHORS, ולכן הן נבדקות
 * בנפרד. בדיקת הגבולות עצמה אינה כאן: SITES.bounds מסומן [הצעה]
 * במפה 2.1 ואינו קיים ברשומות, וזה פער שדוח השלב מחזיר.
 */
export const REQUIRED_ITEM_FIELDS = Object.freeze(['text', 'page', 'stop_id', 'source_id']);

/**
 * BL-02: מעברי מצב לפי טבלה 2.2 בלבד.
 *
 * מחזיר את שורת המעבר, או undefined אם אין שורה כזאת. הצירוף
 * (פעולה, מצב נוכחי) הוא מפתח יחיד בטבלה: return מופיע פעמיים,
 * ושתי השורות נבדלות במצב שממנו הן יוצאות.
 *
 * @param {string} action שם הפעולה במעטפה.
 * @param {string|null} fromStatus המצב הנוכחי של הפריט, ו-null לחדש.
 */
export function findTransition(action, fromStatus) {
  return TRANSITIONS.find(
    (row) => row.action === action && row.from_status === (fromStatus ?? null),
  );
}

/**
 * השדות החסרים בפריט, לפי תנאי השלמות. רשימה ריקה פירושה שלם.
 *
 * העוגן נבדק בנפרד ומועבר כארגומנט, מפני שהליבה אינה קוראת נתונים:
 * מי שקורא הוא ה-Repository, ומי שמזמין את הקריאה הוא BE-05.
 *
 * @param {object} item שורת CONTENT_ITEMS.
 * @param {object|null} anchor שורת GEO_ANCHORS של הפריט, או null.
 */
export function missingItemFields(item, anchor) {
  const missing = REQUIRED_ITEM_FIELDS.filter((field) => {
    const value = item?.[field];
    return value === undefined || value === null || value === '';
  });
  if (!anchor || typeof anchor.lat !== 'number' || typeof anchor.lng !== 'number') {
    missing.push('anchor');
  }
  return missing;
}

/**
 * BL-01: אין שינוי מצב בלי רשומת APPROVALS, וכשל כתיבה מבטל את המעבר.
 *
 * החוק עצמו אינו פונקציה אלא סדר פעולות, והוא נאכף ב-BE-05: הרשומה
 * נכתבת לפני שינוי המצב, וכישלונה מחזיר E-APPROVAL-WRITE-FAILED בלי
 * שהמצב זז. הקבוע הזה קיים כדי שהסדר יהיה נקוב בשם במקום אחד,
 * ושהבדיקה תוכל להצביע עליו.
 */
export const APPROVAL_BEFORE_STATUS = Object.freeze({
  rule: 'BL-01',
  order: ['appendApproval', 'setItemStatus'],
  source: 'usecase-f-07 זרימה ב; מפה 2.3',
});
