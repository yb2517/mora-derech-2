// CONN-01: STT Adapter, מתאם הקול הנכנס. משימה 2 בתוכנית שלב 5.
//
// המקור: מפה 3.3 (שורת CONN-01: "listen: אודיו לטקסט, או כשל"),
// 4.1 גרסה 3.8 (מתאם הוא ציוד מוזרק), 4.5 (E-SPEECH-NOT-RECOGNIZED,
// E-MIC-NOT-ALLOWED), usecase-f-04 צעד 2 וזרימה א, usecase-f-02
// סעיף 4 (listen: "טקסט, או כשל: no_speech, not_allowed, aborted"),
// doc-build-03-interfaces סעיפים 3.1 ו-6.
//
// המתאם מקבל את שפת החוזה (lang = he, מפה 4.1) ומתרגם אותה בתוכו
// לקוד שהמנוע דורש. זה תפקידו של מתאם (הכרעה 16 בתוכנית שלב 5):
// לתרגם בין המערכת למערכת חיצונית ולהחזיר צורה קבועה.
//
// התמלול חוזר כפי שהוא, בלי ניקוי ובלי ניסוח: מה שהמשפחה אמרה הוא
// מה שנשלח ל-BE-03. ביטול בידי המשתמשת אינו כשל ואינו קוד שגיאה:
// הרשימה הסגורה של 4.5 אינה מכילה קוד לביטול, ולא יומצא אחד.
//
// הערת הפרטיות של usecase-f-04 סעיף 7 חלה: מנוע הדפדפן שולח את
// האודיו לספק חיצוני ברוב המכשירים. האודיו לעולם אינו נשמר במערכת,
// וגם לא כאן: המתאם מחזיק טקסט בלבד, ורק עד שהוא מחזיר אותו.

import { error } from '../core/errors.js';

// תרגום שפת החוזה לקוד המנוע. ידע על המערכת החיצונית, לא ערך משתנה.
const ENGINE_LANGUAGE = Object.freeze({ he: 'he-IL' });

// שגיאות המנוע שפירושן "המיקרופון אינו זמין", מול "לא זוהה דיבור".
const MIC_ERRORS = ['not-allowed', 'service-not-allowed', 'audio-capture'];
const ABORT_ERRORS = ['aborted'];

function ok(data) {
  return { ok: true, data };
}

function failed(code, data) {
  return { ok: false, error: error(code, data) };
}

/**
 * @param {object} options
 * @param {Function} [options.Recognition] מחלקת מנוע הזיהוי. בדפדפן:
 *   window.SpeechRecognition או window.webkitSpeechRecognition.
 * @param {string} [options.lang] שפת החוזה. he בגרסה 1.
 */
export function create({ Recognition = null, lang = 'he' } = {}) {
  let active = null;

  function available() {
    return typeof Recognition === 'function';
  }

  /**
   * listen: פותח את המיקרופון ומחזיר טקסט, או כשל.
   *
   * התשובה: { ok: true, data: { text } }; כשל: { ok: false, error }
   * עם אחד משני הקודים; ביטול: { ok: false, aborted: true, error: null }.
   */
  function listen() {
    if (!available()) {
      // מכשיר בלי מנוע זיהוי: המיקרופון אינו דרך זמינה. המסך מציע
      // הקלדה, כפי ש-usecase-f-02 סעיף 5 מציע להרשאה שנדחתה.
      return Promise.resolve(failed('E-MIC-NOT-ALLOWED', { reason: 'no_engine' }));
    }

    if (active) {
      // קליטה כפולה אינה קליטה: הקודמת מבוטלת, והחדשה מתחילה.
      stop();
    }

    return new Promise((resolve) => {
      const recognition = new Recognition();
      recognition.lang = ENGINE_LANGUAGE[lang] ?? lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let settled = false;
      const settle = (response) => {
        if (settled) return;
        settled = true;
        if (active?.recognition === recognition) active = null;
        resolve(response);
      };

      recognition.onresult = (event) => {
        const transcript = String(event?.results?.[0]?.[0]?.transcript ?? '').trim();
        if (transcript === '') settle(failed('E-SPEECH-NOT-RECOGNIZED', { reason: 'empty' }));
        else settle(ok({ text: transcript }));
      };

      recognition.onerror = (event) => {
        const code = String(event?.error ?? '');
        if (ABORT_ERRORS.includes(code)) settle({ ok: false, aborted: true, error: null });
        else if (MIC_ERRORS.includes(code)) settle(failed('E-MIC-NOT-ALLOWED', { reason: code }));
        else settle(failed('E-SPEECH-NOT-RECOGNIZED', { reason: code || 'unknown' }));
      };

      // המנוע נסגר בלי תוצאה ובלי שגיאה: שקט.
      recognition.onend = () => settle(failed('E-SPEECH-NOT-RECOGNIZED', { reason: 'no-speech' }));

      active = { recognition };
      try {
        recognition.start();
      } catch (thrown) {
        settle(failed('E-MIC-NOT-ALLOWED', { reason: thrown?.message ?? 'start_failed' }));
      }
    });
  }

  /** stop: ביטול הקליטה הפעילה. אישור, בלי כשל. */
  function stop() {
    const current = active;
    if (!current) return ok({ stopped: false });
    try {
      current.recognition.abort();
    } catch {
      // מנוע שכבר נסגר.
    }
    return ok({ stopped: true });
  }

  return {
    listen,
    stop,
    available,
    listening: () => active !== null,
  };
}
