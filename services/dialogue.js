// BE-03: Dialogue. משימה 7 בתוכנית שלב 4.
//
// המקור: מפה 3.2 (שורת BE-03: "קליטת שאלה, הקשר מיקום, קריאה
// לשליפה, השהיית תוכן נדחף, הרכבה להשמעה"), 4.2 (ask),
// usecase-f-04 צעדים 5 עד 11 וזרימות א עד ז, ו-BL-13.
//
// **המודול אינו שולף בעצמו.** הוא שולח מעטפה ל-BE-04 דרך ה-Orchestrator
// (usecase-f-04 צעד 6: "אין קריאה ישירה בין מודולים"), ולכן אין כאן
// ייבוא של BE-04, אין כאן סף, ואין כאן מאגר מועמדים. מבחן מבנה 08
// שומר על כך.
//
// **והוא אינו כותב ליומן.** BL-09 נותן ל-BE-07 את הבעלות על
// INTERACTIONS, ולכן שורת ה-initiated נשלחת כמעטפה גם היא.
//
// **וגם אינו מנסח מחדש.** BL-13: התשובה היא מה ש-BE-04 החזיר, כפי
// שהוא. מודול שיחה שמנסח מחדש הופך ציטוט מפריט מאושר לטקסט שאיש לא
// אישר, וזה בדיוק הפגם הקטלני של usecase-f-05.
//
// ולכן גם אין כאן ייבוא של errors.js: המודול אינו מייצר קוד שגיאה
// משלו. כשל של השליפה חוזר למעלה עם הקוד שבו הוא ירד.

function ok(data) {
  return { ok: true, data };
}

function defaultNow() {
  return new Date().toISOString();
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04. נקרא לערכי ה-reference בלבד.
 * @param {(request: object) => Promise<object>} options.send הכתובת האחת.
 * @param {string} [options.caller] שם הפונה, מטבלת המודולים ולא מהקוד.
 * @param {() => string} [options.now]
 */
export function create({ repository, send, caller, now = defaultNow } = {}) {
  if (!repository) {
    throw new Error('BE-03 זקוק ל-Repository');
  }

  // הנתון הפרטי של המודול, לפי מפה 3.2: "מצב השאלה הפעילה". הוא
  // חי בזיכרון ואינו נשמר (usecase-f-04 סעיף 7: זיכרון קצר טווח של
  // הסשן, נדרס בכל שינוי).
  let active = null;

  /**
   * **פער 44, ולא השמטה**: usecase-f-04 צעד 5 מטיל על המודול הזה
   * להשהות מסירה נדחפת, וצעד 12 מטיל על FE-04 לחדש אותה. מפה 4.2
   * אינה נותנת ל-module-dialogue אף פעולה ב-FE-04, ורשימת המותר
   * אינה נושאת שורה כזאת, ולכן אין ערוץ בין השניים. הוספת שורה
   * היא הרחבת היקף, והיא עוצרת לפי CLAUDE.md סעיף 9.5.
   *
   * מה שכן מתקיים היום, וזו שורת BE-03 במפה 6.1: פריט מוחזק
   * **נשאר מוחזק** כשמגיעה שאלה, מפני ש-FE-04 משחרר רק ב-release,
   * ושאלה אינה release. הצד שאינו מתקיים הוא עצירת פריט שכבר מדבר,
   * ואין לו משמעות בשלב הזה: מנוע הקול הוא CONN-02, שלב 5.
   */
  function markActive(question) {
    active = { question, at: now() };
    return active;
  }

  const ACTIONS = {
    /**
     * usecase-f-04 צעדים 5 עד 11.
     *
     * הסדר: מסמנים שאלה פעילה, שולחים retrieve דרך ה-Orchestrator,
     * מרכיבים את מה שיישמע בלי לגעת בו, ושולחים שורת initiated.
     */
    ask: async ({ payload = {} }) => {
      if (typeof send !== 'function') {
        throw new Error('BE-03 זקוק לכתובת האחת כדי לפנות ל-BE-04');
      }

      const question = typeof payload.question === 'string' ? payload.question : '';
      markActive(question);

      const retrieval = await send({
        from: caller,
        module: 'BE-04',
        action: 'retrieve',
        payload: {
          question,
          site_id: payload.site_id,
          stop_id: payload.stop_id,
          session_id: payload.session_id,
          audience: payload.audience,
        },
      });

      if (!retrieval.ok) {
        // זרימה ג של usecase-f-05: שגיאת קלט אינה הימנעות, ואינה
        // הופכת לאחת בדרך למעלה. הקוד עובר כפי שהוא, והמסך מבקש
        // לחזור על השאלה. אין שורת initiated: לא הייתה יזימה שלמה.
        active = null;
        return retrieval;
      }

      // BL-13: מה שיישמע הוא מה שהוחזר. אין כאן חיתוך, אין הוספה,
      // ואין ניסוח. הקיצוץ כבר נעשה ב-BE-04 מול answer_max_words.
      const spoken = retrieval.data.answer;

      // צעד 10, ו-usecase-f-04 זרימה ג3: שאלה שקיבלה הימנעות היא
      // עדיין יזימה, ונספרת ב-M-01. לכן השורה נשלחת בשני המקרים.
      const logged = await logInitiated({
        sessionId: payload.session_id,
        stopId: payload.stop_id,
        question,
        sourceItem: retrieval.data.source_item,
        isFallback: retrieval.data.is_fallback === true,
      });

      active = null;

      return ok({
        spoken,
        is_fallback: retrieval.data.is_fallback === true,
        source_item: retrieval.data.source_item,
        source_page: retrieval.data.source_page,
        // המסך צריך לדעת אם היזימה נרשמה: סשן עם יומן חלקי אינו
        // נכנס למדגם של M-01 (BL-16), וזה מתחיל כאן.
        logged,
      });
    },
  };

  /**
   * שורת initiated ל-BE-07 (מפה 4.2, ו-interaction_type_senders
   * בטבלת ה-reference: initiated נשלח ממודול השיחה ומשם בלבד).
   *
   * BL-10: יומן האינטראקציות לעולם אינו חוסם את החוויה בשטח. כשל
   * שליחה נרשם בתשובה ואינו הופך אותה לשגיאה: המשפחה כבר שמעה.
   */
  async function logInitiated({ sessionId, stopId, question, sourceItem, isFallback }) {
    if (typeof send !== 'function' || !sessionId || !caller) return false;
    try {
      const response = await send({
        from: caller,
        module: 'BE-07',
        action: 'log',
        payload: {
          session_id: sessionId,
          type: 'initiated',
          stop_id: stopId ?? null,
          item_id: sourceItem ?? null,
          question,
          source_item: sourceItem ?? null,
          is_fallback: isFallback,
        },
      });
      return response.ok === true;
    } catch {
      return false;
    }
  }

  const handle = function handle(request) {
    const handler = ACTIONS[request?.action];
    if (typeof handler !== 'function') {
      throw new Error(`BE-03 אינו מממש את הפעולה ${request?.action}`);
    }
    return handler(request);
  };

  // נחשף לבדיקה בלבד, ואינו פעולה במעטפה: מפה 4.2 נותנת ל-BE-03
  // פעולה אחת, ask, ואין שנייה.
  handle.activeQuestion = () => (active === null ? null : { ...active });

  return handle;
}
