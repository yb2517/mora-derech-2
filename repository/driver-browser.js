// CORE-04: דרייבר האחסון של שלבים 1 עד 4, אחסון הדפדפן.
//
// המקור: מפה 3.1 (CORE-04: "הגישה היחידה לנתונים, פעולות בשם עסקי,
// דרייבר אחד"), מסמך הבנייה סעיף 3 ("דרייבר ה-Repository, שלבים 1 עד 4:
// אחסון הדפדפן") וחוק ברזל 3 ("רק CORE-04 נוגע באחסון").
//
// **הקובץ היחיד במאגר שנוגע באחסון.** מבחן מבנה 01 בודק בדיוק את זה.
// הדרייבר אינו יודע דבר על מעטפות, על מודולים ועל חוקים עסקיים: הוא
// קורא טבלה, מוסיף שורה ומעדכן שורה, וזה הכול. המשמעות העסקית יושבת
// ב-index.js.
//
// שלוש טבלאות המערכת והטבלה הרביעית נכנסו בשלב 1. שש הטבלאות
// העסקיות נכנסו במשימה 2 של שלב 3, עם ה-Slice הראשון: עד אז לא היה
// מה לשמור, ומשימה 2 היא נגיעה בליבה לפי CLAUDE.md סעיף 9.2.
//
// ארבע הטבלאות האחרונות של מפה 2.1 נכנסו במשימה 1 של שלב 4, מאותו
// טעם ובאותו כלל: geo_anchors, exit_points, sessions ו-interactions.
// אין כאן פעולת מחיקה לאף טבלה, ואין החלפת טבלה שלמה.

// טבלאות שנזרעות פעם אחת ונקראות בלבד: הן הנתונים של CORE-03 ושל
// טבלת ה-reference, ואיש אינו כותב אליהן בזמן ריצה.
const SEEDED_ONLY = Object.freeze(['modules', 'allow_list', 'reference']);

// טבלאות שגדלות בלבד. שורה שנכתבה אינה משתנה ואינה נמחקת:
// audit_log לפי BL-09, ו-APPROVALS לפי מפה 2.1 ("append-only, נכתב
// בלבד. אין עריכה ואין מחיקה").
// INTERACTIONS נוסף במשימה 1 של שלב 4, לפי מפה 2.1 ("append-only,
// נכתב בלבד") ו-BL-18: שורת אינטראקציה שאפשר לערוך אינה עדות.
const APPEND_ONLY = Object.freeze(['audit_log', 'approvals', 'interactions']);

// הישויות העסקיות של מפה 2.1. הן גדלות בשורות חדשות, ושורה קיימת
// ניתנת לעדכון (למשל status של פריט).
//
// שלוש מהן נוספו במשימה 1 של שלב 4, מפני שמודולי השלב זקוקים להן:
// geo_anchors (L3, verify_anchor, is_crossing של BL-19), exit_points
// (F-13 תיקון 1, nearestExitPoint) ו-sessions (BE-07, ועדכון ended_at
// ו-completed בסגירה).
const ENTITIES = Object.freeze([
  'content_items',
  'sites',
  'sources',
  'institutes',
  'rights_mou',
  'geo_anchors',
  'exit_points',
  'sessions',
]);

/** שמות הטבלאות שהדרייבר מכיר. */
export const TABLE_NAMES = Object.freeze([...SEEDED_ONLY, ...APPEND_ONLY, ...ENTITIES]);

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
 * @param {object} [options.seed] הנתונים ההתחלתיים של הטבלאות.
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
  // טבלה שכבר קיימת אינה נדרסת, גם לא בזריעה חוזרת. זה מה שהופך את
  // רענון הדף למבחן אמיתי: מה שנכתב בפעם הקודמת נשאר.
  for (const name of TABLE_NAMES) {
    if (read(name) !== undefined) continue;
    if (seed[name] !== undefined) {
      write(name, seed[name]);
    } else if (name !== 'reference') {
      // טבלה בלי זריעה נפתחת ריקה. reference יוצא מן הכלל: הוא אוסף
      // מפתחות ולא רשימת שורות, ומפתח חסר הוא E-REF-EMPTY ולא ריק.
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
      if (SEEDED_ONLY.includes(name)) {
        throw new Error(`הטבלה ${name} נזרעת ואינה נכתבת בזמן ריצה`);
      }
      const rows = read(name) ?? [];
      rows.push(row);
      write(name, rows);
      return row;
    },

    /**
     * מעדכן שורה אחת לפי מפתח, ומחזיר את השורה אחרי העדכון, או
     * undefined אם לא נמצאה.
     *
     * אינו זמין לטבלה שגדלה בלבד: שורת יומן שאפשר לעדכן אינה יומן.
     * אין כאן מחיקה, ואין החלפת טבלה שלמה.
     */
    updateRow(name, key, id, patch) {
      assertKnownTable(name);
      if (!ENTITIES.includes(name)) {
        throw new Error(`עדכון שורה אינו מותר בטבלה ${name}`);
      }
      const rows = read(name) ?? [];
      const index = rows.findIndex((row) => row[key] === id);
      if (index === -1) return undefined;
      rows[index] = { ...rows[index], ...patch };
      write(name, rows);
      return rows[index];
    },
  };
}
