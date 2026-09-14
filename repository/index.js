// CORE-04: ה-Repository. הגישה היחידה לנתונים, בפעולות בשם עסקי.
//
// המקור: מפה 3.1 (CORE-04), BL-09 (כותב אחד לכל עמודה), מסמך הבנייה
// חוק 3, ושורה 5 בתוכנית שלב 1.
//
// הקובץ הזה **אינו נוגע באחסון**. הוא מקבל דרייבר ומשתמש בשתי פעולות
// גלם בלבד, readTable ו-appendRow. החלפת הדרייבר, מאחסון הדפדפן למסד
// ענן בשלב 5, היא העברת ארגומנט אחר: אף שורה כאן אינה משתנה, ואף
// מודול אחר אינו יודע שהיא קרתה (מבחן ההחלפה, חוק 1).
//
// אין בממשק פעולת מחיקה ואין פעולת דריסה. audit_log גדל בלבד.
//
// רשימת הפעולות היא זו של שורה 5 בתוכנית, ובשלב הזה בלבד: אין עדיין
// ישויות עסקיות, ולכן אין פעולות עליהן. הן נכנסות בשלב 3.

const REFERENCE = 'reference';
const AUDIT_LOG = 'audit_log';
const MODULES = 'modules';
const ALLOW_LIST = 'allow_list';

function assertDriver(driver) {
  const missing = ['readTable', 'appendRow'].filter(
    (name) => typeof driver?.[name] !== 'function',
  );
  if (missing.length > 0) {
    throw new Error(`הדרייבר אינו מממש: ${missing.join(', ')}`);
  }
}

// הנתונים יוצאים כהעתק. קורא שמקבל את המערך החי יכול לדרוס בו שורה,
// וזה היה הופך את audit_log למשהו שאינו append-only בפועל.
function copy(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function createRepository(driver) {
  assertDriver(driver);

  return {
    /**
     * ערך מטבלת ה-reference, לפי מפתח. BL-12.
     *
     * מחזיר undefined למפתח שאינו בטבלה, ו-null למפתח שקיים ואין לו
     * ערך מוכרע. הקובץ הזה אינו מייצר E-REF-EMPTY ואינו ממציא ערך:
     * המודול הקורא הוא שיודע אם הוא מתפקד בלי הערך, והוא שמחזיר את
     * הקוד (מפה 4.5: "היכן נזרק: הליבה").
     */
    getRef(key) {
      const values = driver.readTable(REFERENCE);
      if (!values || !Object.prototype.hasOwnProperty.call(values, key)) {
        return undefined;
      }
      return copy(values[key]);
    },

    /**
     * מוסיף שורה ל-audit_log. הכותב היחיד של הטבלה הזאת הוא
     * ה-Orchestrator, לפי BL-09.
     *
     * request_id הוא חובה: מבחן מבנה 04 דורש שכל בקשה תותיר שורות עם
     * מזהה משותף, ושורה בלי מזהה אינה ניתנת להצלבה.
     */
    appendAudit(row) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error('שורת audit_log חייבת להיות אובייקט');
      }
      if (typeof row.request_id !== 'string' || row.request_id.trim() === '') {
        throw new Error('שורת audit_log חייבת request_id');
      }
      return copy(driver.appendRow(AUDIT_LOG, copy(row)));
    },

    /**
     * שורות audit_log. עם request_id, רק השורות של אותה בקשה.
     * קיים מפני שבדיקת הקבלה של השלב קוראת את מה שנרשם.
     */
    listAudit({ request_id: requestId } = {}) {
      const rows = copy(driver.readTable(AUDIT_LOG)) ?? [];
      return requestId === undefined
        ? rows
        : rows.filter((row) => row.request_id === requestId);
    },

    /** רשימת המותר, CORE-03. */
    listAllowed() {
      const table = driver.readTable(ALLOW_LIST);
      return copy(table?.rows) ?? [];
    },

    /**
     * שמות הפונים של הרשימה הסגורה, מפה 4.1.
     *
     * נגזרים מטבלת המודולים: שם הפונה הוא תכונה של המודול, ולכן
     * הוספת מסך היא שורה בנתונים ולא שינוי קוד (מפה 4.3, מבחן מבנה 06).
     * קיים מפני שצעד 2 ב-BL-11 זקוק לו, ורק CORE-04 קורא נתונים.
     */
    listCallers() {
      const table = driver.readTable(MODULES);
      return (table?.modules ?? [])
        .map((module) => module.caller)
        .filter((caller) => typeof caller === 'string' && caller !== '');
    },

    /** שורת מודול לפי מזהה, CORE-03. undefined למודול שאינו רשום. */
    getModule(id) {
      const table = driver.readTable(MODULES);
      return copy(table?.modules?.find((module) => module.id === id));
    },
  };
}
