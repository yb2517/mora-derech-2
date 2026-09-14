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
// רשימת הפעולות של שורה 5 בתוכנית שלב 1 היא הקבוצה הראשונה כאן.
// משימה 1 בתוכנית שלב 3 הוסיפה את הפעולות על הישויות העסקיות של
// F-07, בשמות שמקרה השימוש עצמו נקב בהם בסעיף 8: getItem, setStatus,
// appendApproval, listByStatus, getMouCoverage. השמות כאן עסקיים
// מפני שזה מה שמאפשר להחליף דרייבר בלי לגעת באף מודול.
//
// **מה הקובץ הזה אינו עושה**: אינו מחליט. אין כאן טבלת מעברים, אין
// בדיקת שלמות ואין חישוב M-06. הוא מביא שורות ומחזיר שורות, וכל
// הכרעה עסקית יושבת ב-BE-05, ב-BE-06 ובטבלת המעברים שבליבה.

const REFERENCE = 'reference';
const AUDIT_LOG = 'audit_log';
const MODULES = 'modules';
const ALLOW_LIST = 'allow_list';
const CONTENT_ITEMS = 'content_items';
const APPROVALS = 'approvals';
const SITES = 'sites';
const SOURCES = 'sources';
const INSTITUTES = 'institutes';
const RIGHTS_MOU = 'rights_mou';
const GEO_ANCHORS = 'geo_anchors';

function assertDriver(driver) {
  const missing = ['readTable', 'appendRow', 'updateRow'].filter(
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

    // --- הישויות העסקיות של F-07. משימה 1 בתוכנית שלב 3 ---
    //
    // הסינון כאן הוא לפי שוויון מפתח בלבד, מפני שזה מה שמסד נתונים
    // עושה בשאילתה. סינון עסקי (approved בלבד, מקור תחת הסכם בתוקף)
    // אינו כאן: הוא של BE-05 ושל BL-03.

    /** פריטי תוכן, לפי מסלול, תחנה ומצב. מפה 2.1 CONTENT_ITEMS. */
    listItems({ site_id: siteId, stop_id: stopId, status } = {}) {
      const rows = copy(driver.readTable(CONTENT_ITEMS)) ?? [];
      return rows
        .filter((row) => siteId === undefined || row.site_id === siteId)
        .filter((row) => stopId === undefined || row.stop_id === stopId)
        .filter((row) => status === undefined || row.status === status);
    },

    /** פריט לפי מזהה, או null. */
    getItem(itemId) {
      const rows = copy(driver.readTable(CONTENT_ITEMS)) ?? [];
      return rows.find((row) => row.item_id === itemId) ?? null;
    },

    /**
     * מצב הפריט. הכותב היחיד של העמודה הזאת הוא BE-05, לפי BL-09.
     * מחזיר את השורה המעודכנת, או undefined אם אין פריט כזה.
     */
    setItemStatus(itemId, status) {
      return copy(driver.updateRow(CONTENT_ITEMS, 'item_id', itemId, { status }));
    },

    /**
     * רשומת APPROVALS. append-only לפי מפה 2.1: אין בממשק פעולה
     * שעורכת רשומה ואין פעולה שמוחקת אותה.
     */
    appendApproval(row) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error('רשומת APPROVALS חייבת להיות אובייקט');
      }
      return copy(driver.appendRow(APPROVALS, copy(row)));
    },

    /** רשומות APPROVALS, ועם target רק אלה של אותו פריט או מסלול. */
    listApprovals({ target } = {}) {
      const rows = copy(driver.readTable(APPROVALS)) ?? [];
      return target === undefined ? rows : rows.filter((row) => row.target === target);
    },

    /** מסלולים, ומסלול לפי מזהה. מפה 2.1 SITES. */
    listSites() {
      return copy(driver.readTable(SITES)) ?? [];
    },

    getSite(siteId) {
      const rows = copy(driver.readTable(SITES)) ?? [];
      return rows.find((row) => row.site_id === siteId) ?? null;
    },

    /** מקורות, מכונים והסכמים. מפה 2.1 SOURCES, INSTITUTES, RIGHTS_MOU. */
    listSources() {
      return copy(driver.readTable(SOURCES)) ?? [];
    },

    listInstitutes() {
      return copy(driver.readTable(INSTITUTES)) ?? [];
    },

    listMou() {
      return copy(driver.readTable(RIGHTS_MOU)) ?? [];
    },

    /** רשומת הסכם חדשה. נרשמת ואינה נערכת (F-07 צעד 13). */
    appendMou(row) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error('רשומת RIGHTS_MOU חייבת להיות אובייקט');
      }
      return copy(driver.appendRow(RIGHTS_MOU, copy(row)));
    },

    /**
     * העוגן של פריט, או null. נקרא כאן ונכתב בשלב 4 (verify_anchor),
     * מפני ש-F-07 צעד 5 מציג אותו ותנאי השלמות של submit דורש אותו.
     */
    getAnchorForItem(itemId) {
      const rows = copy(driver.readTable(GEO_ANCHORS)) ?? [];
      return rows.find((row) => row.item_id === itemId) ?? null;
    },
  };
}
