// המכשיר המדומה לבדיקות המתאמים. משימה 1 בתוכנית שלב 5.
//
// למה הוא קיים: speechSynthesis, SpeechRecognition ו-geolocation
// קיימים בדפדפן בלבד, ומתאם בלי בדיקה הוא מתאם שנבדק ביד בכל
// שינוי (תוכנית שלב 5 סעיף 7, סיכון 1). כמו dom.js למסכים, הקובץ
// הזה מממש בדיוק את מה שהמתאמים משתמשים בו, ולא יותר.
//
// מה שהמדומה אינו יכול להוכיח, שהקול נשמע ושהמיקרופון קולט, נבדק
// בדפדפן ומדווח ככזה בדוח השלב.
//
// הוא יושב תחת tests/ ואינו קוד המערכת, ולכן מבחני המבנה אינם
// סורקים אותו.

/**
 * מנוע דיבור מדומה, בצורת speechSynthesis: getVoices, speak, cancel,
 * ואירוע voiceschanged. כל היגד שנמסר "מסתיים" בתור המשימות, אלא אם
 * הבדיקה עוצרת אותו קודם.
 */
export function fakeSpeechEngine({ voices = [], utteranceMs = 0, clock = null, manual = false } = {}) {
  const spoken = [];
  let current = null;
  let listeners = [];

  // סיום היגד: אוטומטי בתור המשימות, או ידני כשהבדיקה רוצה לעצור
  // באמצע (manual). בשני המקרים השעון המוזרק מתקדם במשך ההיגד.
  function finishCurrent() {
    const utterance = current;
    if (!utterance) return false;
    if (clock) clock.advance(utteranceMs / 1000);
    current = null;
    utterance.onend?.({});
    return true;
  }

  class Utterance {
    constructor(text) {
      this.text = text;
      this.voice = null;
      this.lang = '';
      this.rate = null;
      this.onend = null;
      this.onerror = null;
    }
  }

  const engine = {
    voices,
    getVoices: () => engine.voices,
    addEventListener: (name, fn) => { if (name === 'voiceschanged') listeners.push(fn); },
    announceVoices(list) {
      engine.voices = list;
      const fns = listeners;
      listeners = [];
      for (const fn of fns) fn();
    },
    speak(utterance) {
      spoken.push({ text: utterance.text, voice: utterance.voice?.name ?? null, lang: utterance.lang, rate: utterance.rate });
      current = utterance;
      if (!manual) {
        queueMicrotask(() => {
          if (current === utterance) finishCurrent();
        });
      }
    },
    finishCurrent,
    cancel() {
      const cancelled = current;
      current = null;
      if (cancelled) cancelled.onerror?.({ error: 'canceled' });
    },
    spoken,
  };

  return { engine, Utterance, spoken, finishCurrent };
}

/**
 * מנוע זיהוי דיבור מדומה, בצורת SpeechRecognition: start, abort,
 * והאירועים result, error, end. התסריט קובע מה קורה ב-start.
 */
export function fakeRecognition(script = { transcript: 'שאלה' }) {
  const instances = [];
  class Recognition {
    constructor() {
      this.lang = '';
      this.interimResults = null;
      this.maxAlternatives = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      instances.push(this);
    }

    start() {
      queueMicrotask(() => {
        if (script.error) {
          this.onerror?.({ error: script.error });
        } else if (typeof script.transcript === 'string') {
          this.onresult?.({ results: [[{ transcript: script.transcript }]] });
        }
        this.onend?.({});
      });
    }

    abort() {
      queueMicrotask(() => {
        this.onerror?.({ error: 'aborted' });
        this.onend?.({});
      });
    }
  }
  Recognition.instances = instances;
  return Recognition;
}

/**
 * מיקום מדומה, בצורת navigator.geolocation: watchPosition ו-clearWatch.
 * הבדיקה מזרימה דגימות בעצמה דרך emit, או שגיאה דרך fail.
 */
export function fakeGeolocation({ denied = false } = {}) {
  const watchers = new Map();
  let nextId = 1;
  const options = [];

  return {
    watchPosition(onPosition, onError, opts) {
      options.push(opts);
      const id = nextId;
      nextId += 1;
      watchers.set(id, { onPosition, onError });
      if (denied) {
        queueMicrotask(() => onError?.({ code: 1, PERMISSION_DENIED: 1, message: 'denied' }));
      }
      return id;
    },
    clearWatch(id) {
      watchers.delete(id);
    },
    emit({ lat, lng, accuracy = 5, time = Date.now() }) {
      for (const { onPosition } of watchers.values()) {
        onPosition({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp: time });
      }
    },
    fail(code = 2) {
      for (const { onError } of watchers.values()) onError?.({ code, PERMISSION_DENIED: 1 });
    },
    watching: () => watchers.size,
    options,
  };
}

/**
 * לוח זמנים מדומה: setTimeout ו-setInterval שמתקדמים רק כשהבדיקה
 * מזיזה את השעון. כך "20 שניות" נבדקות בלי להמתין 20 שניות.
 */
export function fakeSchedule(start = 0) {
  let nowMs = start;
  const timers = new Map();
  let nextId = 1;

  const schedule = {
    now: () => nowMs,
    setTimeout(fn, ms) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { fn, at: nowMs + ms, every: null });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval(fn, ms) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { fn, at: nowMs + ms, every: ms });
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    },
    /** מקדם את השעון ומריץ כל טיימר שהגיע זמנו, בסדר. */
    async advance(seconds) {
      const target = nowMs + seconds * 1000;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at);
        if (due.length === 0) break;
        const [id, timer] = due[0];
        nowMs = timer.at;
        if (timer.every === null) timers.delete(id);
        else timer.at += timer.every;
        await timer.fn();
        await flush();
      }
      nowMs = target;
    },
    pending: () => timers.size,
  };
  return schedule;
}

/** מרוקן את תור המשימות הזעירות, כדי שהמנועים המדומים יסיימו. */
export async function flush(rounds = 8) {
  for (let i = 0; i < rounds; i += 1) await Promise.resolve();
}
