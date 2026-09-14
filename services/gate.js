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
import { gateB, mouCoverage } from '../core/business-logic.js';

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
   * M-06 והכיסוי (usecase-f-07 צעד 14).
   *
   * הכלל עצמו יושב בליבה מאז משימה 2 של שלב 4, מפני ש-L4 של F-08
   * שואל את אותה שאלה, ושתי הגדרות של אותו כלל נפרדות ביום שמישהו
   * משנה אחת מהן. מה שנשאר כאן הוא מה שמפה 3.2 מטילה על BE-06:
   * לקרוא את הנתונים ולהחזיר את התשובה.
   *
   * **שינוי מול שלב 3**: הבסיס צומצם למקורות שפריטי ה-approved של
   * המסלול מפנים אליהם, במקום כל פריטי המסלול (הכרעה 17 בתוכנית
   * שלב 4, בהכרעת בעלת הפרויקט 14.09.2026, שסוגרת את חוב טכני 14).
   */
  function coverage(siteId, at) {
    return mouCoverage({
      items: repository.listItems({ site_id: siteId }),
      mou: repository.listMou(),
      at,
    });
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
