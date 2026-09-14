// BE-06: Gate Enforcement. משימה 4 בתוכנית שלב 3.
//
// המקור: מפה 3.2 (שורת BE-06: "חישוב M-06, מצב שער B, טבלת המוכנות
// לנעילה"), 4.2 (הפעולות), BL-08, BL-12, ו-usecase-f-07 צעדים 10
// ו-14.
//
// **ההיקף הוא F-07 ואותו בלבד**: get_gate. get_lock_readiness הוא
// טבלת המוכנות של F-08 (BL-06, תנאי L1 עד L5), ו-set_enforce כותב
// לטבלת ה-reference שאין לה כותב מוגדר ב-BL-09. שניהם שלב 4, ובקשה
// אליהם מקבלת E-MODULE-FAILED גלוי.
//
// מה שהמודול הזה מתקן ביחס לבנייה 02: שם M-06 היה קבוע בקוד, ומבחן
// ההחלפה של usecase-f-07 סעיף 8 קבע במפורש "בבנייה 02 M-06 הוא
// קבוע, ולכן היום הוא נכשל". כאן הוא נספר מרשומות RIGHTS_MOU
// ומרשימת המקורות של המסלול, ואין בקובץ הזה מספר כתוב.
//
// מה הוא אינו עושה: אינו קורא ל-BE-05 (חוק ברזל 2), אינו נוגע
// באחסון, ואינו כותב דבר. מפה 3.2: "כותב: אין". מצב השער מחושב
// בכל קריאה ואינו נשמר.

import { error } from '../core/errors.js';
import { gateB } from '../core/business-logic.js';

// המפתח בטבלת ה-reference, מפה 2.4. שם המפתח אינו ערך משתנה: הוא
// שם השדה שקוראים אותו.
const ENFORCE_KEY = 'enforce_gate_b';

function defaultNow() {
  return new Date().toISOString();
}

function ok(data) {
  return { ok: true, data };
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04, מוזרק בהרכבה.
 * @param {() => string} [options.now] הזמן שמולו נבדק תוקף ההסכם.
 */
export function create({ repository, now = defaultNow } = {}) {
  if (!repository) {
    throw new Error('BE-06 זקוק ל-Repository');
  }

  /**
   * האם ההסכם בתוקף במועד הנתון.
   *
   * מפה 2.1 מסמנת את שם שדה התוקף [טרם נקבע, decision-02], והנתונים
   * כותבים valid_until. הסכם בלי תאריך תוקף, או עם תאריך שאינו
   * ניתן לקריאה, אינו נספר: היעדר ראיה לתוקף אינו ראיה לתוקף, ושער
   * שנפתח על סמך רשומה חסרה הוא בדיוק הפגם ש-F-07 בא למנוע.
   */
  function inEffect(mou, at) {
    const until = Date.parse(mou?.valid_until);
    return Number.isNaN(until) ? false : until >= Date.parse(at);
  }

  /**
   * M-06: מספר המכונים עם הסכם בתוקף שמכסה 100% ממקורות המסלול
   * (usecase-f-07 צעד 14).
   *
   * הכיסוי נמדד מול המקורות שפריטי המסלול מפנים אליהם בפועל, ולא
   * מול כלל המקורות במערכת: הסכם צריך לכסות את המסלול הזה.
   * מסלול בלי מקורות כלל אינו מייצר כיסוי, מפני ש"כיסוי של כלום"
   * אינו הסכם שמישהו חתם עליו.
   */
  function coverage(siteId, at) {
    const required = repository.listSources({ site_id: siteId }).map((row) => row.source_id);
    const inEffectMou = repository.listMou().filter((mou) => inEffect(mou, at));

    const covering = required.length === 0
      ? []
      : inEffectMou.filter((mou) => {
        const scope = new Set(mou.scope ?? []);
        return required.every((sourceId) => scope.has(sourceId));
      });

    const institutes = [...new Set(covering.map((mou) => mou.institute_id))];

    return {
      required,
      institutes,
      m06: institutes.length,
      mou_in_effect: inEffectMou.length,
    };
  }

  const ACTIONS = {
    /**
     * מצב שער B (usecase-f-07 צעדים 10, 14 ו-15).
     *
     * התשובה נושאת את המסלול, את הכיסוי ואת ההכרעה של BL-08. המסך
     * מציג, ואינו מחשב.
     */
    get_gate: ({ payload = {} }) => {
      const enforce = repository.getRef(ENFORCE_KEY);

      // חוק ברזל 5: ערך חסר מחזיר E-REF-EMPTY ואינו מומצא. אכיפה
      // שתיקבע כאן בברירת מחדל תהיה החלטה על חסימת משפחה בשטח,
      // ואין לה מקור.
      if (enforce === undefined || enforce === null) {
        return { ok: false, error: error('E-REF-EMPTY', { key: ENFORCE_KEY }) };
      }

      const site = repository.getSite(payload.site_id);
      const at = now();
      const cover = coverage(site?.site_id, at);

      return ok({
        site,
        gate: gateB({ site_status: site?.status, m06: cover.m06, enforce }),
        coverage: cover,
        checked_at: at,
      });
    },
  };

  return function handle(request) {
    const handler = ACTIONS[request?.action];
    if (typeof handler !== 'function') {
      throw new Error(`BE-06 אינו מממש את הפעולה ${request?.action} בשלב הזה`);
    }
    return handler(request);
  };
}
