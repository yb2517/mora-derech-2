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
// הפעולות כאן הן מטבלת פעולות המסכים (מפה 4.4): שמונה פעולות
// הקריאה של פער 30, ופעולות הכתיבה של המסכים שנבנים במשימות 5 ו-6.
// פעולות הכתיבה של מסך הניהול נכנסות במשימה 7, כשיהיה מסך ששולח
// אותן, לפי "משימה אחת בכל פעם".
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

    // שמונה פעולות הקריאה של פער 30. שליפה לפי שוויון מזהה בלבד:
    // אין כאן סינון עסקי, אין דירוג ואין סף. קריאה שאינה מוצאת דבר
    // מחזירה רשימה ריקה, ו-getItem על מזהה שאינו קיים מחזיר null,
    // לפי ההכרעה של 14.09.2026: אין קוד שגיאה חדש.
    listItems: (payload) => ({
      items: rowsOf(demo.content_items)
        .filter((item) => item.site_id === payload?.site_id)
        .filter((item) => payload?.stop_id === undefined || item.stop_id === payload.stop_id)
        .filter((item) => payload?.status === undefined || item.status === payload.status)
        .map(({ text, ...rest }) => rest),
      is_demo: true,
    }),

    getItem: (payload) => {
      const item = rowsOf(demo.content_items)
        .find((row) => row.item_id === payload?.item_id) ?? null;
      return {
        item,
        source: item
          ? rowsOf(demo.sources).find((row) => row.source_id === item.source_id) ?? null
          : null,
        anchor: item
          ? rowsOf(demo.geo_anchors).find((row) => row.item_id === item.item_id) ?? null
          : null,
        is_demo: true,
      };
    },

    listApprovals: () => ({ approvals: rowsOf(demo.approvals), is_demo: true }),

    // getSite בלי site_id מחזיר את המסלול היחיד. מפה 1 קובעת
    // "ממשק חד מסלולי על מודל נתונים רב מסלולי", ואין במפה פעולה
    // שמודיעה למסך על איזה מסלול הוא עובד. ההנחה הזאת מדווחת
    // בדוח השלב ומוכרעת בשלב 3, כש-BE-05 האמיתי נכנס.
    getSite: (payload) => ({
      site: payload?.site_id === undefined
        ? rowsOf(demo.sites)[0] ?? null
        : rowsOf(demo.sites).find((row) => row.site_id === payload.site_id) ?? null,
      is_demo: true,
    }),

    listSources: () => ({ sources: rowsOf(demo.sources), is_demo: true }),

    listInstitutes: () => ({ institutes: rowsOf(demo.institutes), is_demo: true }),

    listMou: () => ({ mou: rowsOf(demo.rights_mou), is_demo: true }),

    listExitPoints: (payload) => ({
      exit_points: rowsOf(demo.exit_points)
        .filter((row) => row.site_id === payload?.site_id),
      is_demo: true,
    }),

    // פעולות הכתיבה של מסך הניהול, משימה 7. אישור קבלה כמו השאר:
    // היצירה, העריכה והנעילה האמיתיות הן של BE-05 בשלבים 3 ו-4.
    create_item: (payload) => acknowledged('create_item', payload),
    edit_item: (payload) => acknowledged('edit_item', payload),
    verify_anchor: (payload) => acknowledged('verify_anchor', payload),
    register_source: (payload) => acknowledged('register_source', payload),
    register_exit_point: (payload) => acknowledged('register_exit_point', payload),
    register_mou: (payload) => acknowledged('register_mou', payload),
    register_institute: (payload) => acknowledged('register_institute', payload),
    lock_site: (payload) => acknowledged('lock_site', payload),
  },

  'BE-06': {
    // מצב השער כפי שהוא רשום בנתוני ההדגמה, בלי חישוב M-06 ובלי
    // קריאת enforce_gate_b: שניהם של BE-06, והוא נבנה בשלב 4.
    get_gate: () => ({
      site: rowsOf(demo.sites)[0] ?? null,
      mou: rowsOf(demo.rights_mou),
      is_demo: true,
    }),

    // טבלת המוכנות יושבת בנתוני ההדגמה ואינה מחושבת כאן. החישוב
    // של L1 עד L4 הוא BL-06, והוא של BE-06 בשלב 4.
    get_lock_readiness: () => ({ conditions: rowsOf(demo.lock_readiness), is_demo: true }),

    set_enforce: (payload) => acknowledged('set_enforce', payload),
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

    // המדדים יושבים בנתוני ההדגמה. חישוב החציון ושיעור ההשלמה הוא
    // של BE-07 בשלב 4, והוא שינוי ליבה מבוקר לפי מקרה שימוש F-09.
    compute_metrics: () => ({ metrics: rowsOf(demo.metrics), is_demo: true }),

    // הייצוא הוא שורות היומן, בלי נתוני הדגמה שמתחזים לייצוא אמיתי.
    export: () => ({
      rows: rowsOf(demo.sessions).map((session) => ({
        session_id: session.session_id,
        completed: session.completed,
        questions: demo.interactions.filter((i) => i.session_id === session.session_id).length,
      })),
      is_demo: true,
    }),
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

/**
 * מזהי המודולים שההדגמה עומדת במקומם. נקרא בנקודת הכניסה ובבדיקה.
 *
 * משלב 3: מודול שנבנה באמת גובר. נקודת הכניסה מחברת את ההדגמה רק
 * למזהה שאין לו handler, ולכן BE-05 ו-BE-06 כבר אינם מגיעים לכאן,
 * ו-BE-03 ו-BE-07 עדיין כן, עד שלב 4. השורות שלהם נשארות בקובץ
 * מפני שהקובץ כולו יורד בשלב 7, ומחיקה חלקית שלו היא עבודה
 * שתימחק ממילא.
 */
export const DEMO_MODULE_IDS = Object.freeze(Object.keys(RESPONSES));

/**
 * הזריעה של הישויות העסקיות, משימה 5 בתוכנית שלב 3.
 *
 * עד שלב 3 נתוני ההדגמה נקראו מכאן ישירות בכל תשובה, ולא נשמרו.
 * משלב 3 הם הנתונים ההתחלתיים של הטבלאות באחסון: מודול אמיתי קורא
 * וכותב, ורענון הדף מראה את מה שקרה. הסימון is_demo נשאר על כל
 * שורה, וההסרה בשלב 7 היא מחיקת הקובץ הזה ושל /data/demo/.
 *
 * עשר הטבלאות שהדרייבר מכיר. ארבע נוספו במשימה 3 של שלב 4, עם
 * המודולים שקוראים אותן: geo_anchors (L3 ו-BL-19), exit_points
 * (F-13 תיקון 1), sessions ו-interactions (BE-07 והמדדים).
 *
 * admin_users אינו נזרע: אין לו טבלה בדרייבר ואין ב-4.2 פעולה
 * שקוראת אותו. מפה 2.1 מגדירה את הישות, ו-v1 אינו מאמת זהות (פער
 * 32, נסגר במפה 3.5), ולכן אין מי שיקרא את השורות האלה.
 */
export const DEMO_SEED = Object.freeze({
  content_items: demo.content_items,
  approvals: demo.approvals,
  sites: demo.sites,
  sources: demo.sources,
  institutes: demo.institutes,
  rights_mou: demo.rights_mou,
  geo_anchors: demo.geo_anchors,
  exit_points: demo.exit_points,
  sessions: demo.sessions,
  interactions: demo.interactions,
});
