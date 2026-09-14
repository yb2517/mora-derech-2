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
// modules, allow_list, audit_log, reference.

/** שמות הטבלאות שהדרייבר מכיר. */
export const TABLE_NAMES = Object.freeze([
  'modules',
  'allow_list',
  'audit_log',
  'reference',
]);

// טבלה שנצרכת לקריאה בלבד נזרעת פעם אחת. audit_log נפתחת ריקה וגדלה
// בלבד: אין בדרייבר פעולה שמוחקת שורה או שדורסת טבלה שכבר נזרעה.
const APPEND_ONLY = 'audit_log';
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
  for (const name of TABLE_NAMES) {
    if (read(name) !== undefined) continue;
    if (name === APPEND_ONLY) {
      write(name, []);
    } else if (seed[name] !== undefined) {
      write(name, seed[name]);
    }
  }

  return {
    readTable(name) {
      assertKnownTable(name);
      return read(name);
    },

    appendRow(name, row) {
      assertKnownTable(name);
      if (name !== APPEND_ONLY) {
        throw new Error(`הוספת שורה מותרת ל-${APPEND_ONLY} בלבד, לא ל-${name}`);
      }
      const rows = read(name) ?? [];
      rows.push(row);
      write(name, rows);
      return row;
    },
  };
}
