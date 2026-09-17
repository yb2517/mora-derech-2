// GW-01: AI Gateway, תפר ריק. משימה 2 בתוכנית שלב 6.
//
// המקור: מפה 3.4 שורת GW-01 ("יציאה יחידה לספק AI, Adapter לספק,
// חוזה קריאה"; דרישות: אין ב-v1; קורא: reference, model_tier; כותב:
// אין), מפה 2.4 (model_tier: "אין, v1 בלי AI", והקורא היחיד הוא
// GW-01), מפה 7 שורת שלב 6 ("תפר ריק עם חוזה קריאה אחד לדוגמה"),
// ו-CLAUDE.md סעיף 6 ("קריאה עם model_tier ריק: E-REF-EMPTY, בלי
// פנייה החוצה").
//
// הקובץ הזה הוא המקום היחיד במאגר שממנו תצא אי פעם פנייה לספק AI
// (מבחן מבנה 02). ב-v1 הוא אינו פונה לאיש: אין בו קריאת רשת, אין בו
// ספק, ואין בו סוד. הוא מייבא את CORE-01 בלבד, אינו נוגע באחסון,
// ואינו כותב דבר.
//
// חוזה הקריאה (תוכנית שלב 6, סעיף 5, הכרעות 1 ו-2): השער הוא מודול
// שמקבל את מעטפת הבקשה ומחזיר את מעטפת התשובה של CORE-01, ולא ציוד
// מוזרק. הספק הוא הציוד: מפה מדרגת מודל ל-Adapter, שמוזרקת ב-create
// לפי פער B-34 (מפה 4.1), וריקה ב-v1. החלפת ספק היא החלפת ה-Adapter;
// החלפת השער היא החלפת הקובץ הזה; המודול שיקרא לו רואה מעטפות בלבד.
//
// שלוש התוצאות של קריאה:
//   model_tier ריק: E-REF-EMPTY עם שם ההגדרה (חוק ברזל 5, BL-12).
//   model_tier מלא ויש לו Adapter: ה-Adapter נקרא, והתשובה במעטפה.
//   model_tier מלא ואין לו Adapter: זריקה (הכרעה 3). זו טעות תכנות
//   ולא שגיאה עסקית, ואין לה קוד ברשימה הסגורה (חוק ברזל 8). דרך
//   CORE-02 היא חוזרת כ-E-MODULE-FAILED, קוד שכבר קיים.

import { okResponse, errorResponse } from '../core/contract.js';
import { error } from '../core/errors.js';

/** המפתח בטבלת ה-reference שהשער קורא, מפה 2.4. */
export const MODEL_TIER_KEY = 'model_tier';

/**
 * הפעולה האחת לדוגמה (הכרעה 2, מסומנת כהצעה): ניסוח טקסט, לפי
 * usecase-f-04 הכרעה פתוחה 8. אינה ב-4.2 ואינה ברשימת המותר, ולכן
 * אין מי שרשאי לבקש אותה ב-v1. כשההכרעה הפתוחה 9 תיפתח, החוזה האמיתי
 * ייכתב במפה קודם, והשינוי כאן הוא עריכת הקבוע הזה.
 */
export const EXAMPLE_ACTION = 'compose';

/**
 * שם משתנה הסביבה שה-Adapter העתידי יקרא, בשם בלבד (CLAUDE.md סעיף 3:
 * "לא בשימוש ב-v1"). השער אינו קורא אותו ואינו מזריק אותו לשום קובץ:
 * מפתח ספק הוא סוד שרת, ואינו יכול לשבת בקובץ ארוז שרץ בדפדפן
 * (פער 64). הוא אינו נכנס ל-.env.example (הכרעה 4).
 */
export const ENV_NAMES = Object.freeze(['AI_PROVIDER_KEY']);

function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04. getRef בלבד.
 * @param {Record<string, { call: Function }>} [options.adapters]
 *   דרגת מודל ל-Adapter. הציוד של השער, ריק ב-v1.
 */
export function create({ repository, adapters = {} } = {}) {
  if (!repository) {
    throw new Error('GW-01 זקוק ל-Repository');
  }

  const ACTIONS = {
    async [EXAMPLE_ACTION](request) {
      const tier = repository.getRef(MODEL_TIER_KEY);
      if (isEmpty(tier)) {
        return errorResponse(error('E-REF-EMPTY', { key: MODEL_TIER_KEY }));
      }

      const adapter = adapters[tier];
      if (!adapter || typeof adapter.call !== 'function') {
        throw new Error(`GW-01: אין Adapter לדרגת המודל ${String(tier)}`);
      }

      const result = await adapter.call({ input: request.payload.input, lang: request.lang });
      return okResponse({ output: result?.output ?? null, model_tier: tier });
    },
  };

  return function handle(request) {
    const handler = ACTIONS[request?.action];
    if (typeof handler !== 'function') {
      throw new Error(`GW-01 אינו מממש את הפעולה ${request?.action}`);
    }
    return handler(request);
  };
}
