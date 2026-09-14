// מודול ההדגמה. משימה 4 בתוכנית שלב 2, הכרעה א בהכרעת בעלת הפרויקט
// 14.09.2026.
//
// מה הוא: עומד במקומם של מודולי השירות כל עוד אינם קיימים, כדי
// שהמסכים של שלב 2 יוכלו להציג משהו. מסמך הבנייה סעיף 11 אוסר לבנות
// מודול שירות לפני שהמסכים אושרו, ולכן הקובץ הזה יושב ב-/tools/,
// שסעיף 5 מגדיר כפיתוח בלבד, ואינו ב-/services/.
//
// **מה הוא אינו: הוא אינו מחליט.** אין כאן טבלת מעברים, אין סף, אין
// חישוב ואין בדיקת מצב. יש טבלה שממפה פעולה לתשובה קבועה, ושליפה
// לפי שוויון מזהה. כל מה שנראה כהכרעה עסקית שייך ל-BE-05, ל-BE-06
// ול-BE-07, והוא נבנה בשלבים 3 ו-4.
//
// לכן גם: פעולת כתיבה מקבלת אישור קבלה ואינה משנה דבר. אין כאן
// מצב, ורענון הדף מחזיר את אותם נתונים. זו תכונה ולא חוסר: מסך
// שנראה עובד מפני שההדגמה זוכרת היה מסתיר את העובדה שהלוגיקה
// עדיין לא נבנתה.
//
// פעולה שאין לה שורה בטבלה אינה מקבלת תשובה, והיא חוזרת כ-
// E-MODULE-FAILED דרך ה-Orchestrator. זה מכוון: ההדגמה מכסה את מה
// שהמסכים של המשימות הבאות שולחים, והשאר נראה לעין ואינו מתחזה.
//
// הסרה: שלב 7, לפי חוב טכני 9 בדוח שלב 1. מחיקת הקובץ הזה, מחיקת
// /data/demo/, ומחיקת החזרה בנקודת הכניסה.

import demo from '../data/demo/demo-data.json' with { type: 'json' };

const DEMO = 'הדגמה';

/** אישור קבלה לפעולת כתיבה. אינו משנה דבר ואינו נשמר. */
function acknowledged(action, payload) {
  return {
    acknowledged: action,
    payload: payload ?? null,
    stands_for: DEMO,
    is_demo: true,
  };
}

// שליפה לפי שוויון מזהה. לא סינון עסקי, לא דירוג ולא סף.
const rowsOf = (list) => list.map((row) => ({ ...row }));

// הטבלה. מזהה מודול, שם פעולה, ותשובה קבועה.
//
// הפעולות כאן הן אלה שבטבלת פעולות המסכים (מפה 4.4) עבור המסכים
// שנבנים במשימות 5 ו-6. פעולות מסך הניהול נכנסות במשימה 7, כשיהיה
// מסך ששולח אותן, לפי "משימה אחת בכל פעם".
const RESPONSES = {
  'BE-05': {
    submit: (payload) => acknowledged('submit', payload),
    approve: (payload) => acknowledged('approve', payload),
    reject: (payload) => acknowledged('reject', payload),
    return: (payload) => acknowledged('return', payload),
    nearestExitPoint: () => ({
      exit_point: rowsOf(demo.exit_points)[0] ?? null,
      is_demo: true,
    }),
  },

  'BE-06': {
    // מצב השער כפי שהוא רשום בנתוני ההדגמה, בלי חישוב M-06 ובלי
    // קריאת enforce_gate_b: שניהם של BE-06, והוא נבנה בשלב 4.
    get_gate: () => ({
      site: rowsOf(demo.sites)[0] ?? null,
      mou: rowsOf(demo.rights_mou),
      is_demo: true,
    }),
  },

  'BE-03': {
    // תשובת הדגמה קבועה. אין כאן שליפה, אין דירוג ואין סף: המנוע
    // האמיתי הוא BE-04, והוא נבנה בשלב 4.
    ask: (payload) => ({
      question: payload?.question ?? null,
      answer: rowsOf(demo.content_items)[0]?.text ?? null,
      source_item: rowsOf(demo.content_items)[0]?.item_id ?? null,
      is_fallback: false,
      is_demo: true,
    }),
  },

  'BE-07': {
    session_start: (payload) => acknowledged('session_start', payload),
    session_end: (payload) => acknowledged('session_end', payload),
    log: (payload) => acknowledged('log', payload),
  },
};

/**
 * ה-handler שה-Orchestrator מנתב אליו.
 *
 * @param {object} request מעטפת הבקשה של מפה 4.1.
 * @returns {{ ok: boolean, data: object }}
 */
export default function demoHandler(request) {
  const answer = RESPONSES[request?.module]?.[request?.action];

  if (typeof answer !== 'function') {
    throw new Error(
      `להדגמה אין תשובה ל-${request?.module}, פעולה ${request?.action}`,
    );
  }

  return { ok: true, data: answer(request?.payload) };
}

/** מזהי המודולים שההדגמה עומדת במקומם. נקרא בנקודת הכניסה ובבדיקה. */
export const DEMO_MODULE_IDS = Object.freeze(Object.keys(RESPONSES));
