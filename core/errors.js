// CORE-01: הרשימה הסגורה של קודי השגיאה וההסבר למפתח.
//
// המקור: doc-module-map-v3 סעיף 4.5, עשרים ושניים קודים.
// המפתחות והערכים כאן הועתקו מהטבלה שבמפה כלשונם.
//
// הנוסח לבני אדם אינו יושב כאן. מקומו במפתח error_human_text בטבלת
// ה-reference (משימה 4), לפי המצגת חלק א ולפי doc-error-human-text:
// הקוד וההסבר למפתח בקוד, ההסבר לבני אדם בטבלה שבעלת הפרויקט עורכת.
//
// חוק ברזל 8: קוד שאינו ברשימה הזאת אינו נזרק. הרשימה סגורה, ושינוי בה
// הוא שינוי במפה שקודם לקוד.

/** הקוד וההסבר למפתח, מפה 4.5. */
export const ERROR_CODES = Object.freeze({
  'E-FROM-MISSING': 'שדה from חסר במעטפה',
  'E-FROM-UNKNOWN': 'from אינו ברשימה הסגורה של הפונים',
  'E-ALLOW-DENIED': 'אין שורה ברשימת המותר לצירוף',
  'E-ENVELOPE-INVALID': 'שדה חובה חסר או payload לא תקין',
  'E-AUDIT-WRITE-FAILED': 'לא ניתן לרשום את הבקשה; אינה מנותבת',
  'E-TRANSITION-DENIED': 'מעבר מצב שאינו בטבלה 2.2',
  'E-ITEM-INCOMPLETE': 'שדה חסר ביצירה או בעריכה, עם שם השדה',
  'E-ANCHOR-OUT-OF-BOUNDS': 'קואורדינטות מחוץ לגבולות המסלול',
  'E-APPROVAL-WRITE-FAILED': 'רשומת APPROVALS לא נכתבה; המעבר בוטל',
  'E-LOCK-REFUSED': 'תנאי נעילה נכשל; data מכיל את רשימת הכשלים',
  'E-GATE-CLOSED': 'שער B חסום ואכיפה דולקת',
  'E-QUESTION-INVALID': 'שאלה ריקה, ארוכה מדי או חסרת site_id',
  'E-RETRIEVAL-FAILED': 'כשל בקריאת מאגר המועמדים',
  'E-REF-EMPTY': 'ערך reference חסר',
  'E-SESSION-CLOSED': 'רשומת log לסשן שאינו פתוח',
  'E-LOG-TYPE-INVALID': 'type אינו ברשימה, או from אינו מורשה לסוג',
  'E-LOG-WRITE-FAILED': 'כשל כתיבה אחרי הניסיונות החוזרים; הסשן partial_log',
  'E-NO-HEBREW-VOICE': 'אין קול עברי במכשיר; המסך עובר לטקסט',
  'E-SPEECH-NOT-RECOGNIZED': 'לא זוהה דיבור',
  'E-MIC-NOT-ALLOWED': 'הרשאת מיקרופון נדחתה',
  'E-LOCATION-NOT-ALLOWED': 'הרשאת מיקום נדחתה',
  'E-NO-EXIT-POINT': 'אין נקודת יציאה רשומה למסלול; הודעת חסימת הסוללה אינה יכולה להיבנות',
});

/** עשרים ושניים הקודים, בסדר שבו הם מופיעים ב-4.5. */
export const ERROR_CODE_LIST = Object.freeze(Object.keys(ERROR_CODES));

/**
 * מייצר את ערך ה-error של מעטפת התשובה (מפה 4.1).
 *
 * code חייב להיות ברשימה הסגורה. קוד שאינו בה מפיל את הקריאה בזריקה,
 * ואינו הופך לערך שגיאה: זו טעות תכנות, לא שגיאה עסקית, ולכן היא אינה
 * מקבלת קוד משלה (חוק ברזל 8).
 *
 * data נושא את הפירוט שסעיף 4.5 מבקש במקומות שהוא מבקש אותו, למשל שם
 * השדה ב-E-ITEM-INCOMPLETE ורשימת הכשלים ב-E-LOCK-REFUSED.
 */
export function error(code, data = null) {
  if (!Object.prototype.hasOwnProperty.call(ERROR_CODES, code)) {
    throw new Error(
      `קוד שגיאה שאינו ברשימה הסגורה של מפה 4.5: ${String(code)}`,
    );
  }

  return { code, data };
}
