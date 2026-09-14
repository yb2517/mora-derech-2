// CORE-04: דרייבר האחסון של שלבים 1 עד 4, אחסון הדפדפן.
//
// המקור: מפה 3.1 (CORE-04: "הגישה היחידה לנתונים, פעולות בשם עסקי,
// דרייבר אחד"), מסמך הבנייה סעיף 3 ("דרייבר ה-Repository, שלבים 1 עד 4:
// אחסון הדפדפן") וחוק ברזל 3 ("רק CORE-04 נוגע באחסון").
//
// **הקובץ היחיד במאגר שנוגע באחסון.** מבחן מבנה 01 בודק בדיוק את זה.
// הדרייבר אינו יודע דבר על מעטפות, על מודולים ועל חוקים עסקיים: הוא
// קורא טבלה ומוסיף שורה, וזה הכול. המשמעות העסקית יושבת ב-index.js.
//
// שלוש טבלאות המערכת והטבלה הרביעית, לפי שורה 5 בתוכנית שלב 1:
// modules, allow_list, audit_log, reference. משימה 1 בתוכנית שלב 3
// הוסיפה את הישויות העסקיות ש-F-07 נוגע בהן, לפי מפה 2.1.

/** שמות הטבלאות שהדרייבר מכיר. */
export const TABLE_NAMES = Object.freeze([
  'modules',
  'allow_list',
  'audit_log',
  'reference',
  // הישויות העסקיות של F-07, מפה 2.1. הדרייבר אינו יודע מה יש בהן:
  // הוא יודע רק איך כותבים אליהן, לפי הטבלה שמתחת.
  'content_items',
  'approvals',
  'sites',
  'sources',
  'institutes',
  'rights_mou',
  'geo_anchors',
]);

// איך מותר לכתוב לכל טבלה. טבלה שאינה כאן היא לקריאה בלבד, וניסיון
// כתיבה אליה נופל בזריקה.
//
//   append  הוספה בלבד, בלי עריכה ובלי מחיקה. audit_log לפי BL-09,
//           APPROVALS לפי מפה 2.1 ("append-only, אין מצב"), ו-RIGHTS_MOU
//           מפני שהסכם נרשם ואינו נערך (F-07 צעד 13).
//   update  עדכון שדות בשורה קיימת, לפי מפתח. CONTENT_ITEMS בלבד,
//           ורק בעמודת status, שהכותב היחיד שלה הוא BE-05 (BL-09).
//
// אין בדרייבר פעולה שמוחקת שורה, ואין פעולה שדורסת טבלה שכבר נזרעה.
const WRITE_MODE = Object.freeze({
  audit_log: 'append',
  approvals: 'append',
  rights_mou: 'append',
  content_items: 'update',
});

const KEY_PREFIX = 'mora-derech/';

function assertKnownTable(name) {
  if (!TABLE_NAMES.includes(name)) {
    throw new Error(`טבלה שאינה מוכרת לדרייבר: ${String(name)}`);
  }
}

/**
 * @param {object} options
 * @param {Storage} [options.storage] מקום האחסון. ברירת המחדל היא
 *   אחסון הדפדפן. בדיקה מזריקה אחסון בזיכרון, ולכן היא רצה בלי דפדפן
 *   ובלי לגעת בנתונים אמיתיים.
 * @param {object} [options.seed] הנתונים ההתחלתיים של הטבלאות לקריאה.
 */
export function createBrowserDriver({ storage = globalThis.localStorage, seed = {} } = {}) {
  if (!storage) {
    throw new Error('אין אחסון זמין: יש להזריק storage');
  }

  function read(name) {
    const raw = storage.getItem(KEY_PREFIX + name);
    return raw === null || raw === undefined ? undefined : JSON.parse(raw);
  }

  function write(name, value) {
    storage.setItem(KEY_PREFIX + name, JSON.stringify(value));
  }

  // זריעה: טבלה שאינה קיימת באחסון מקבלת את הנתונים ההתחלתיים.
  // טבלה שכבר קיימת אינה נדרסת, גם לא בזריעה חוזרת.
  //
  // טבלה שגדלה בהוספה ולא נזרעה נפתחת ריקה, ולכן audit_log מתחילה
  // ריקה תמיד: ההרכבה אינה מעבירה לה זרע.
  for (const name of TABLE_NAMES) {
    if (read(name) !== undefined) continue;
    if (seed[name] !== undefined) {
      write(name, seed[name]);
    } else if (WRITE_MODE[name] === 'append') {
      write(name, []);
    }
  }

  return {
    readTable(name) {
      assertKnownTable(name);
      return read(name);
    },

    appendRow(name, row) {
      assertKnownTable(name);
      if (WRITE_MODE[name] !== 'append') {
        throw new Error(`הטבלה ${name} אינה מקבלת הוספת שורה`);
      }
      const rows = read(name) ?? [];
      rows.push(row);
      write(name, rows);
      return row;
    },

    /**
     * מעדכן שדות בשורה קיימת, לפי מפתח. מותר לטבלה שמצב הכתיבה שלה
     * update בלבד, ולכן אי אפשר לעדכן שורת יומן.
     *
     * מחזיר את השורה המעודכנת, או undefined אם לא נמצאה שורה כזאת.
     * הדרייבר אינו יודע מה מותר לשנות: ההחלטה הזאת היא של BE-05
     * ושל טבלת המעברים בליבה.
     */
    updateRow(name, key, id, patch) {
      assertKnownTable(name);
      if (WRITE_MODE[name] !== 'update') {
        throw new Error(`הטבלה ${name} אינה מקבלת עדכון שורה`);
      }
      const rows = read(name) ?? [];
      const index = rows.findIndex((row) => row?.[key] === id);
      if (index === -1) return undefined;
      rows[index] = { ...rows[index], ...patch };
      write(name, rows);
      return rows[index];
    },
  };
}
