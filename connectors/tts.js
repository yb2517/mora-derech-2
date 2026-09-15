// CONN-02: TTS Adapter, מתאם הקול היוצא. משימה 1 בתוכנית שלב 5.
//
// המקור: מפה 3.3 (שורת CONN-02: "speak ו-stop, קול עברי מפורש,
// שרשור, השהיה אחרי ביטול"), 4.1 גרסה 3.8 (מתאם הוא ציוד מוזרק ולא
// נמען), 4.5 (E-NO-HEBREW-VOICE), 6.1 (שורת CONN-02), usecase-f-02
// סעיף 4 (חוזה ה-Adapter ושלושת כללי הבנייה), doc-build-03-interfaces
// סעיף 3.2, ותוכנית שלב 5 סעיף 8 (החילוץ מאב הטיפוס).
//
// המתאם אינו יודע מי קרא לו ולמה (doc-build-03-interfaces סעיף 1).
// הוא מקבל טקסט ומחזיר אירועי התחלה וסיום ומשך. הוא אינו כותב
// ליומן: המודול שקרא לו כותב. הוא אינו פונה ואינו נמען, ולכן אין לו
// מעטפה, שורה ברשימת המותר או שורת audit_log: מסירת קול היא פעולת
// ציוד ולא בקשה עסקית (מפה 4.1 גרסה 3.8).
//
// מנוע הדיבור מוזרק, ולכן המתאם נבדק מול מנוע מדומה במערך ורץ מול
// speechSynthesis בדפדפן. החלפת המנוע היא החלפת ההזרקה, והמודולים
// שמשתמשים במתאם אינם משתנים (מבחן ההחלפה, usecase-f-02 סעיף 8).
//
// שלושת כללי החוזה, מלולאת הקבלה של 03.09.2026 דרך אב הטיפוס:
//   1. הקול העברי נבחר במפורש, לפי שפה ולא לפי שם: שם הקול שונה
//      בכל מכשיר, ושפתו לא. בלי קול עברי לא מקריאים כלל, "כדי שלא
//      יישמעו רק מספרים".
//   2. טקסט ארוך משורשר בקטעים, בגבול משפט, בלי הפסקה נשמעת. ההפניות
//      לקטעים נשמרות, "בלי זה כרום זורק קטעים באמצע".
//   3. אחרי ביטול יש השהיה קצרה לפני ההשמעה הבאה: "דיבור מיד אחרי
//      cancel נופל לקול ברירת המחדל".

import { error } from '../core/errors.js';

// כינויי השפה, כתרגום של המתאם למנוע: מכשירים ישנים מסמנים עברית
// כ-iw. זהו ידע על המערכת החיצונית, ולא ערך משתנה.
const LANGUAGE_ALIASES = Object.freeze({ he: ['he', 'iw'] });

// ההשהיה אחרי ביטול, בשניות. פרט מימוש של המתאם מול המנוע ולא ערך
// עסקי (תוכנית שלב 5 סעיף 8), ולכן אינו בטבלת ה-reference.
const CANCEL_PAUSE_S = 0.15;

// כמה זמן להמתין לרשימת הקולות של המנוע לפני שמסיקים שאין קול,
// בשניות. הדפדפן טוען את הרשימה בעצלות ומודיע ב-voiceschanged.
const VOICES_WAIT_S = 1;

const CANCELLED_ERRORS = ['canceled', 'interrupted'];

function ok(data) {
  return { ok: true, data };
}

function failed(code, data) {
  return { ok: false, error: error(code, data) };
}

function defaultSchedule() {
  return {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  };
}

/**
 * חלוקה לקטעים בגבול משפט. משפט ארוך במיוחד נשאר קטע אחד: חיתוך
 * באמצע משפט היה נשמע, וזה בדיוק מה שהכלל אוסר.
 */
export function sentences(text) {
  return String(text ?? '')
    .split(/(?<=[.!?:;])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/**
 * @param {object} options
 * @param {object} [options.engine] מנוע הדיבור: getVoices, speak,
 *   cancel, ואירוע voiceschanged. בדפדפן: window.speechSynthesis.
 * @param {Function} [options.Utterance] מחלקת ההיגד של המנוע.
 * @param {object} options.reference voice_id ו-voice_rate, מוזרקים
 *   מטבלת ה-reference בהרכבה. ערך חסר מחזיר E-REF-EMPTY ואינו מומצא.
 * @param {() => number} [options.clock] השעון במילישניות, למשך.
 * @param {object} [options.schedule] setTimeout מוזרק, לבדיקות.
 */
export function create({
  engine = null,
  Utterance = null,
  reference = {},
  clock = () => Date.now(),
  schedule = defaultSchedule(),
} = {}) {
  const listeners = new Map();
  const queue = [];
  let job = null;

  function emit(event, detail) {
    for (const fn of listeners.get(event) ?? []) fn(detail);
  }

  function ref(key) {
    const value = reference?.[key];
    return value === undefined || value === null
      ? { missing: failed('E-REF-EMPTY', { key }) }
      : { value };
  }

  function available() {
    return Boolean(engine && typeof engine.speak === 'function' && typeof Utterance === 'function');
  }

  function wait(seconds) {
    return new Promise((resolve) => schedule.setTimeout(resolve, seconds * 1000));
  }

  function voices() {
    try {
      return engine.getVoices() ?? [];
    } catch {
      return [];
    }
  }

  /** ממתין לרשימת הקולות כשהמנוע טרם טען אותה. */
  function voicesLoaded() {
    if (voices().length > 0) return Promise.resolve(voices());
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve(voices());
      };
      if (typeof engine.addEventListener === 'function') {
        engine.addEventListener('voiceschanged', done, { once: true });
      } else {
        engine.onvoiceschanged = done;
      }
      schedule.setTimeout(done, VOICES_WAIT_S * 1000);
    });
  }

  /** הקול הראשון במכשיר ששפתו מתחילה בבורר השפה, או באחד מכינוייו. */
  function voiceFor(voiceId, list) {
    const wanted = LANGUAGE_ALIASES[String(voiceId).toLowerCase()] ?? [String(voiceId).toLowerCase()];
    return list.find((voice) => {
      const lang = String(voice?.lang ?? '').toLowerCase();
      return wanted.some((prefix) => lang === prefix || lang.startsWith(`${prefix}-`) || lang.startsWith(`${prefix}_`));
    }) ?? null;
  }

  function finish(current, interrupted) {
    if (job !== current) return;
    job = null;
    queue.length = 0;
    const duration = Math.max(0, clock() - current.started_at);
    const detail = { text: current.text, duration_ms: duration, interrupted, chunks: current.parts.length };
    emit('end', detail);
    current.resolve(ok(detail));
  }

  function speakPart(current, voice, rate, index) {
    if (job !== current) return;
    if (index >= current.parts.length) {
      finish(current, false);
      return;
    }
    const utterance = new Utterance(current.parts[index]);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    utterance.onend = () => speakPart(current, voice, rate, index + 1);
    utterance.onerror = (event) => {
      if (CANCELLED_ERRORS.includes(event?.error)) finish(current, true);
      else speakPart(current, voice, rate, index + 1);
    };
    queue.push(utterance);
    engine.speak(utterance);
  }

  function cancelCurrent() {
    const current = job;
    if (!current) return false;
    try {
      engine.cancel();
    } catch {
      // מנוע שאין לו מה לבטל.
    }
    finish(current, true);
    return true;
  }

  /**
   * speak: טקסט נכנס, אירועי התחלה וסיום ומשך יוצאים.
   *
   * ההבטחה נפתרת בסיום ההשמעה, או בקטיעה. כשל אינו זריקה: הוא
   * תשובה עם קוד מהרשימה הסגורה, כדי שהמודול שקרא ידע מה לרשום.
   */
  async function speak(text) {
    const voiceId = ref('voice_id');
    if (voiceId.missing) return voiceId.missing;
    const rate = ref('voice_rate');
    if (rate.missing) return rate.missing;

    const spoken = String(text ?? '').trim();

    if (!available()) {
      emit('unavailable', { text: spoken });
      return failed('E-NO-HEBREW-VOICE', { reason: 'no_engine' });
    }

    const voice = voiceFor(voiceId.value, await voicesLoaded());
    if (!voice) {
      emit('unavailable', { text: spoken });
      return failed('E-NO-HEBREW-VOICE', { voice_id: voiceId.value });
    }

    // ביטול ואז השהיה, לפי כלל 3. הביטול תמיד: השמעה חדשה מחליפה
    // את הקודמת, כמו באב הטיפוס, ומה שנקטע נסגר עם המשך שהושמע.
    const cancelled = cancelCurrent();
    if (cancelled) {
      try {
        engine.cancel();
      } catch {
        // מנוע שאין לו מה לבטל.
      }
      await wait(CANCEL_PAUSE_S);
    }

    return new Promise((resolve) => {
      const current = {
        text: spoken,
        parts: sentences(spoken),
        started_at: clock(),
        resolve,
      };
      job = current;
      emit('start', { text: spoken, chunks: current.parts.length });
      speakPart(current, voice, rate.value, 0);
    });
  }

  /** stop: עצירה. אישור, בלי כשל. */
  function stop() {
    return ok({ stopped: cancelCurrent() });
  }

  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  }

  /** האם יש במכשיר קול בשפה של voice_id. סינכרוני, לדגל הסשן. */
  function hasVoice() {
    const voiceId = ref('voice_id');
    if (voiceId.missing || !available()) return false;
    return voiceFor(voiceId.value, voices()) !== null;
  }

  return {
    speak,
    stop,
    on,
    hasVoice,
    available,
    voicesLoaded,
    speaking: () => (job === null ? null : { text: job.text }),
  };
}
