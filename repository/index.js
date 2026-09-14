// CORE-04: ה-Repository. הגישה היחידה לנתונים, בפעולות בשם עסקי.
//
// המקור: מפה 3.1 (CORE-04), BL-09 (כותב אחד לכל עמודה), מסמך הבנייה
// חוק 3, ושורה 5 בתוכנית שלב 1.
//
// הקובץ הזה **אינו נוגע באחסון**. הוא מקבל דרייבר ומשתמש בשלוש
// פעולות גלם בלבד, readTable, appendRow ו-updateRow. החלפת הדרייבר,
// מאחסון הדפדפן למסד ענן בשלב 5, היא העברת ארגומנט אחר: אף שורה כאן
// אינה משתנה, ואף מודול אחר אינו יודע שהיא קרתה (מבחן ההחלפה, חוק 1).
//
// אין בממשק פעולת מחיקה. audit_log ו-APPROVALS גדלים בלבד.
//
// הפעולות על הישויות העסקיות נכנסו במשימה 2 של שלב 3, לפי
// usecase-f-07 סעיף 8: השמות עסקיים, ולא שמות של טבלאות ושל שאילתות.
// משימה 1 של שלב 4 הוסיפה את העוגנים, נקודות היציאה, הסשנים
// והאינטראקציות, ואת הכתיבה לפריט ולמסלול שהיו חסרות: עד שלב 3 פריט
// נוצר בזריעה בלבד, ומסלול לא שינה מצב מעולם.
// **אין כאן חוק עסקי**: מה מותר ומתי הוא של הליבה ושל BE-05. כאן יש
// קריאה וכתיבה בשם שאפשר להבין.

const REFERENCE = 'reference';
const AUDIT_LOG = 'audit_log';
const MODULES = 'modules';
const ALLOW_LIST = 'allow_list';

// שש הישויות של מפה 2.1 שה-Slice הראשון נוגע בהן.
const CONTENT_ITEMS = 'content_items';
const APPROVALS = 'approvals';
const SITES = 'sites';
const SOURCES = 'sources';
const INSTITUTES = 'institutes';
const RIGHTS_MOU = 'rights_mou';

// ארבע הישויות שמשימה 1 של שלב 4 מוסיפה, לפי מפה 2.1.
const GEO_ANCHORS = 'geo_anchors';
const EXIT_POINTS = 'exit_points';
const SESSIONS = 'sessions';
const INTERACTIONS = 'interactions';

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

// רשומה בלי מזהה אינה ניתנת להצלבה, ולכן היא נדחית כאן ולא נכתבת
// חצי. אותו נימוק שבו request_id חובה בשורת audit_log ו-approval_id
// ברשומת APPROVALS.
function requireId(record, key, name) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`${name} חייב להיות אובייקט`);
  }
  if (typeof record[key] !== 'string' || record[key].trim() === '') {
    throw new Error(`${name} חייב ${key}`);
  }
}

export function createRepository(driver) {
  assertDriver(driver);

  // טבלה שאינה קיימת עדיין היא רשימה ריקה, ולא נפילה: הקורא מקבל
  // "אין" ולא "השתבש".
  function rows(name) {
    return driver.readTable(name) ?? [];
  }

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

    // --- הישויות העסקיות, מפה 2.1. משימה 2 בתוכנית שלב 3 ---

    /** פריט תוכן אחד. null לפריט שאינו קיים, ולא שגיאה (מפה גרסה 3.2). */
    getItem(itemId) {
      return copy(rows(CONTENT_ITEMS).find((row) => row.item_id === itemId)) ?? null;
    },

    /**
     * פריטים, מסוננים בשוויון בלבד: מסלול, תחנה, מצב. הסינון העסקי
     * של BL-03 (מאושר, מהמסלול הנוכחי, ממקור תחת הסכם) אינו כאן:
     * הוא של BE-04, והוא שלב 4.
     */
    listItems({ site_id: siteId, stop_id: stopId, status } = {}) {
      return rows(CONTENT_ITEMS)
        .filter((row) => siteId === undefined || row.site_id === siteId)
        .filter((row) => stopId === undefined || row.stop_id === stopId)
        .filter((row) => status === undefined || row.status === status)
        .map(copy);
    },

    /**
     * משנה את מצב הפריט. מחזיר את הפריט אחרי השינוי, או null אם אינו
     * קיים.
     *
     * הכותב היחיד של העמודה הזאת הוא BE-05 (BL-09), והסדר של BL-01,
     * רשומת APPROVALS קודם, הוא של BE-05 ולא של כאן: ה-Repository
     * אינו יודע למה ביקשו ממנו לכתוב.
     */
    setStatus(itemId, status) {
      return copy(driver.updateRow(CONTENT_ITEMS, 'item_id', itemId, { status })) ?? null;
    },

    /**
     * מוסיף רשומת APPROVALS. append-only: אין פעולה שמעדכנת רשומה
     * קיימת ואין פעולה שמוחקת אותה (מפה 2.1).
     *
     * approval_id הוא חובה, מאותה סיבה שבה request_id חובה בשורת
     * audit_log: רשומת ביקורת בלי מזהה אינה ניתנת להצלבה.
     */
    appendApproval(record) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error('רשומת APPROVALS חייבת להיות אובייקט');
      }
      if (typeof record.approval_id !== 'string' || record.approval_id.trim() === '') {
        throw new Error('רשומת APPROVALS חייבת approval_id');
      }
      return copy(driver.appendRow(APPROVALS, copy(record)));
    },

    /** יומן ההחלטות. עם target, רק רשומות הפריט או המסלול הזה. */
    listApprovals({ target } = {}) {
      return rows(APPROVALS)
        .filter((row) => target === undefined || row.target === target)
        .map(copy);
    },

    /** המסלול. בלי מזהה, המסלול היחיד של גרסה 1 (מפה 1). */
    getSite(siteId) {
      const all = rows(SITES);
      const site = siteId === undefined ? all[0] : all.find((row) => row.site_id === siteId);
      return copy(site) ?? null;
    },

    /** המקורות. עם site_id, המקורות שפריטי המסלול מפנים אליהם. */
    listSources({ site_id: siteId } = {}) {
      const all = rows(SOURCES);
      if (siteId === undefined) return all.map(copy);
      const used = new Set(
        rows(CONTENT_ITEMS).filter((row) => row.site_id === siteId).map((row) => row.source_id),
      );
      return all.filter((row) => used.has(row.source_id)).map(copy);
    },

    listInstitutes() {
      return rows(INSTITUTES).map(copy);
    },

    /**
     * רשומות ההסכם.
     *
     * usecase-f-07 סעיף 8 מונה getMouCoverage בין הפעולות בשם עסקי.
     * הכיסוי אינו נשלף כאן אלא מחושב ב-BE-06, מפני שמפה 3.2 מטילה
     * עליו את חישוב M-06, ו-BL-09 מגדיר את ה-Repository כגישה
     * לנתונים. מה שיוצא מכאן הוא ההסכמים והמקורות, ומי שסופר הוא
     * המודול. מדווח בדוח השלב.
     */
    listMou() {
      return rows(RIGHTS_MOU).map(copy);
    },

    appendMou(record) {
      return copy(driver.appendRow(RIGHTS_MOU, copy(record)));
    },

    appendInstitute(record) {
      return copy(driver.appendRow(INSTITUTES, copy(record)));
    },

    appendSource(record) {
      return copy(driver.appendRow(SOURCES, copy(record)));
    },

    // --- ארבע הישויות של שלב 4, ושתי הכתיבות שהיו חסרות ---

    /**
     * מוסיף פריט תוכן. הכותב היחיד הוא BE-05 (BL-09), והשלמות של
     * usecase-f-08 צעד 3 היא שלו: כאן נכתב מה שביקשו לכתוב.
     */
    appendItem(record) {
      requireId(record, 'item_id', 'פריט');
      return copy(driver.appendRow(CONTENT_ITEMS, copy(record)));
    },

    /**
     * מעדכן שדות בפריט קיים, ומחזיר אותו אחרי העדכון או null.
     *
     * setStatus נשאר בנפרד ולא נבלע כאן: מצב הפריט הוא העמודה שכל
     * BL-01 עומד עליה, ופעולה בשם שלה קלה יותר להצליב מול היומן.
     */
    updateItem(itemId, patch) {
      return copy(driver.updateRow(CONTENT_ITEMS, 'item_id', itemId, copy(patch))) ?? null;
    },

    /**
     * מעדכן את רשומת המסלול: status, locked_at ו-corpus_version של
     * usecase-f-08 צעד 12, ופתיחה חוזרת של BL-07.
     */
    updateSite(siteId, patch) {
      return copy(driver.updateRow(SITES, 'site_id', siteId, copy(patch))) ?? null;
    },

    /** עוגן אחד לפי מזהה. null לעוגן שאינו קיים. */
    getAnchor(anchorId) {
      return copy(rows(GEO_ANCHORS).find((row) => row.anchor_id === anchorId)) ?? null;
    },

    /**
     * העוגן של פריט. מפה 2.1 מקשרת עוגן לפריט ב-item_id, ולכן זו
     * הדרך שבה FE-04 מגיע ל-is_crossing של הנקודה שהוא עומד למסור.
     */
    getAnchorByItem(itemId) {
      return copy(rows(GEO_ANCHORS).find((row) => row.item_id === itemId)) ?? null;
    },

    /**
     * עוגנים. עם site_id, העוגנים של פריטי המסלול: לעוגן עצמו אין
     * site_id במפה 2.1, והשיוך עובר דרך הפריט.
     */
    listAnchors({ site_id: siteId, item_id: itemId } = {}) {
      const all = rows(GEO_ANCHORS);
      const ofSite = siteId === undefined
        ? all
        : (() => {
            const items = new Set(
              rows(CONTENT_ITEMS).filter((row) => row.site_id === siteId).map((row) => row.item_id),
            );
            return all.filter((row) => items.has(row.item_id));
          })();
      return ofSite.filter((row) => itemId === undefined || row.item_id === itemId).map(copy);
    },

    appendAnchor(record) {
      requireId(record, 'anchor_id', 'עוגן');
      return copy(driver.appendRow(GEO_ANCHORS, copy(record)));
    },

    /** מעדכן עוגן: verified, verified_at, is_crossing, קואורדינטות. */
    updateAnchor(anchorId, patch) {
      return copy(driver.updateRow(GEO_ANCHORS, 'anchor_id', anchorId, copy(patch))) ?? null;
    },

    /** נקודות היציאה של המסלול (F-13 תיקון 1). */
    listExitPoints({ site_id: siteId } = {}) {
      return rows(EXIT_POINTS)
        .filter((row) => siteId === undefined || row.site_id === siteId)
        .map(copy);
    },

    appendExitPoint(record) {
      requireId(record, 'exit_id', 'נקודת יציאה');
      return copy(driver.appendRow(EXIT_POINTS, copy(record)));
    },

    /** סשן אחד. null לסשן שאינו קיים. */
    getSession(sessionId) {
      return copy(rows(SESSIONS).find((row) => row.session_id === sessionId)) ?? null;
    },

    /**
     * סשנים. עם site_id, סשני המסלול; עם from ו-to, סשנים שהתחילו
     * בטווח. הטווח הוא זה של compute_metrics (usecase-f-09 צעד 8),
     * וההשוואה על started_at, מפני שסשן פתוח עדיין אינו נסגר.
     */
    listSessions({ site_id: siteId, from, to } = {}) {
      return rows(SESSIONS)
        .filter((row) => siteId === undefined || row.site_id === siteId)
        .filter((row) => from === undefined || row.started_at >= from)
        .filter((row) => to === undefined || row.started_at <= to)
        .map(copy);
    },

    appendSession(record) {
      requireId(record, 'session_id', 'סשן');
      return copy(driver.appendRow(SESSIONS, copy(record)));
    },

    /** מעדכן סשן: ended_at, completed, last_stop_id, flags. */
    updateSession(sessionId, patch) {
      return copy(driver.updateRow(SESSIONS, 'session_id', sessionId, copy(patch))) ?? null;
    },

    /**
     * מוסיף שורת INTERACTIONS. append-only, כמו APPROVALS: אין פעולה
     * שמעדכנת שורה קיימת ואין פעולה שמוחקת אותה (מפה 2.1, BL-18).
     */
    appendInteraction(record) {
      requireId(record, 'interaction_id', 'שורת INTERACTIONS');
      return copy(driver.appendRow(INTERACTIONS, copy(record)));
    },

    /** שורות היומן. עם session_id, שורות הסשן; עם type, סוג אחד. */
    listInteractions({ session_id: sessionId, type } = {}) {
      return rows(INTERACTIONS)
        .filter((row) => sessionId === undefined || row.session_id === sessionId)
        .filter((row) => type === undefined || row.type === type)
        .map(copy);
    },
  };
}
