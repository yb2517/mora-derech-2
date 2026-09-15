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
//
// **משימה 7 בתוכנית שלב 5**: המודול מקבל את מנוע הקול, CONN-02, כציוד
// מוזרק (מפה 4.1 גרסה 3.8, הכרעה 3), אותו מופע שמוזרק ל-FE-04. וזו
// ההכרעה הפתוחה 12 במפה, שנסגרה בהכרעה 4 של תוכנית שלב 5 בדרך ג:
// פריט נדחף שמדבר נעצר כשמגיעה שאלה, לא דרך פעולה חדשה ב-FE-04
// אלא דרך stop של הציוד המשותף. הפריט אינו מתחדש (הכרעה 6 של
// תוכנית שלב 4). התשובה נשמעת דרך אותו ציוד, ומשך ההשמעה נרשם.

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
export function create({ repository, send, caller, now = defaultNow, voice = null } = {}) {
  if (!repository) {
    throw new Error('BE-03 זקוק ל-Repository');
  }

  // הנתון הפרטי של המודול, לפי מפה 3.2: "מצב השאלה הפעילה". הוא
  // חי בזיכרון ואינו נשמר (usecase-f-04 סעיף 7: זיכרון קצר טווח של
  // הסשן, נדרס בכל שינוי).
  let active = null;

  /**
   * **פער 44 ודרכו לסגירה**: usecase-f-04 צעד 5 מטיל על המודול הזה
   * להשהות מסירה נדחפת, ומפה 4.2 אינה נותנת ל-module-dialogue אף
   * פעולה ב-FE-04. שני החצאים של ההשהיה מתקיימים בלי ערוץ כזה:
   *
   *   פריט מוחזק **נשאר מוחזק** (מפה 6.1, שורת BE-03), מפני ש-FE-04
   *   משחרר רק ב-release או ב-leave, ושאלה אינה אף אחד מהם.
   *
   *   פריט שכבר מדבר **נעצר**, דרך stop של מנוע הקול המשותף
   *   (הכרעה 4 בתוכנית שלב 5, דרך ג). FE-04 שהמתין לסיום ההשמעה
   *   מקבל אותה כקטיעה ורושם את המשך שהושמע בפועל.
   */
  function markActive(question) {
    active = { question, at: now() };
    if (voice && typeof voice.stop === 'function') voice.stop();
    return active;
  }

  /**
   * ההשמעה של התשובה, דרך הציוד המוזרק. בלי מנוע: בכתב, כמו בשלב 4.
   * בלי קול עברי: המסך מציג (usecase-f-04 זרימה ד).
   */
  async function speak(text) {
    if (!voice || typeof voice.speak !== 'function') {
      return { displayed_as_text: true, duration_ms: null };
    }
    const response = await voice.speak(text);
    if (response.ok) {
      return { displayed_as_text: false, duration_ms: response.data.duration_ms ?? null };
    }
    if (response.error?.code === 'E-NO-HEBREW-VOICE') {
      return { displayed_as_text: true, duration_ms: null };
    }
    return { failure: response };
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

      // צעד 9: ההשמעה. ערך חסר בטבלת ה-reference עולה כמות שהוא.
      const speech = await speak(spoken);
      if (speech.failure) {
        active = null;
        return speech.failure;
      }

      // צעד 10, ו-usecase-f-04 זרימה ג3: שאלה שקיבלה הימנעות היא
      // עדיין יזימה, ונספרת ב-M-01. לכן השורה נשלחת בשני המקרים.
      const logged = await logInitiated({
        sessionId: payload.session_id,
        stopId: payload.stop_id,
        question,
        sourceItem: retrieval.data.source_item,
        isFallback: retrieval.data.is_fallback === true,
        durationMs: speech.duration_ms,
        displayedAsText: speech.displayed_as_text,
      });

      active = null;

      return ok({
        spoken,
        is_fallback: retrieval.data.is_fallback === true,
        source_item: retrieval.data.source_item,
        source_page: retrieval.data.source_page,
        displayed_as_text: speech.displayed_as_text,
        duration_ms: speech.duration_ms,
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
  async function logInitiated({
    sessionId, stopId, question, sourceItem, isFallback, durationMs = null, displayedAsText = false,
  }) {
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
          duration_ms: durationMs,
          displayed_as_text: displayedAsText,
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
