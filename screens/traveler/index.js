// FE-05: מסך המטייל. משימה 6 בתוכנית שלב 2, הושלם במשימה 8 בתוכנית
// שלב 5.
//
// המקור: מפה 3.3 שורת FE-05, מפה 4.4 (הפעולות שלו ואותן בלבד),
// doc-build-03-interfaces סעיף 2.2, F-04, F-02, F-01, F-13
// ותיקון הסוללה, UX-01, usecase-f-09 צעד 1 (הדגלים), והכרעות 3, 7,
// 10, 11, 18 בתוכנית שלב 5.
//
// המסך הזה נקרא בהליכה, בשמש, ביד אחת, כשהיד השנייה מחזיקה ילד.
// לכן הוא מינימלי, ולכן כל דבר שנמצא בו נמצא מסיבה ממוספרת.
//
// UX-01, אפס מגע: שני המגעים המאושרים הם תחילת הסשן וסיומו (הוכרע
// 12.09). כפתור השאלה הוא הפרה מתועדת שנשארת ב-v1, לפי אותה הכרעה
// ולפי סעיף 16 ב-PRD. אין כאן מגע שלישי: אותו כפתור שולח את מה
// שהוקלד, ואם לא הוקלד דבר הוא פותח את המיקרופון.
//
// **שלב 5, הציוד המוזרק** (מפה 4.1 גרסה 3.8): המסך מקבל את מנוע
// הקול (CONN-02, אותו מופע שמוזרק ל-FE-04 ול-BE-03) ואת המיקרופון
// (CONN-01). הוא מדבר איתם ישירות, כמו עם המכשיר, ואינו שולח להם
// מעטפה: מסירת קול היא פעולת ציוד ולא בקשה עסקית. כל בקשה עסקית
// ממשיכה לצאת במעטפה, לכתובת האחת, בשם הפונה שהוזרק.
//
// **מה המסך אינו עושה**: אינו מפעיל את המיקום ואינו עוצר אותו. הוא
// חושף אירועי מחזור חיים (הסשן התחיל, הסתיים, הסוללה חסמה, חודשה)
// למי שמרכיב אותו, ונקודת הכניסה מחברת אותם ל-AUTO-01 (הכרעה 7).
// המסך אינו מכיר את המודול, ומבחן מבנה 03 שומר על כך.
//
// נוהל הסוללה (BL-20, F-13 תיקון 1): הסף וההשוואה כאן, לפי מפה 2.4
// ומפה 6.1. מקור המדידה מגיע מהמכשיר דרך ההרכבה (הכרעה 10), ומיקום
// המשפחה לחישוב נקודת היציאה מגיע מ-AUTO-01 דרך ההרכבה (הכרעה 11).

import { createElement, panel, humanError } from '../view.js';

// שני מצבי הסוללה, לפי F-13 תיקון 1. הנוהל דו שלבי: התראה, ואז
// חסימה. החידוש מותנה בחצייה חזרה של סף החידוש.
const BATTERY = { OK: 'ok', WARNED: 'warned', BLOCKED: 'blocked' };

// קודים שהם הודעת מכשיר, ולא כשל פעולה. לפי 2.2 הם נאמרים פעם אחת
// לסשן: משפחה שמקבלת את אותה הודעה בכל תחנה מפסיקה להקשיב.
const DEVICE_CODES = ['E-NO-HEBREW-VOICE', 'E-LOCATION-NOT-ALLOWED', 'E-MIC-NOT-ALLOWED'];

// הודעת מכשיר לדגל סשן (usecase-f-09 צעד 1, מפה 2.1 שורת SESSIONS).
const FLAG_OF_CODE = {
  'E-NO-HEBREW-VOICE': 'no_hebrew_voice',
  'E-LOCATION-NOT-ALLOWED': 'no_location',
};

// שלושת המשתנים בתבנית הודעת החסימה (F-13 תיקון 1 סעיף 1).
const TEMPLATE_FIELDS = [
  ['[נקודת ציון]', 'name'],
  ['[מטרים]', 'distance'],
  ['[רוח השמיים]', 'direction'],
];

const UNKNOWN = 'לא ידוע';

/**
 * @param {object} options
 * @param {HTMLElement} options.host
 * @param {string} options.from שם הפונה, מטבלת המודולים.
 * @param {object} options.reference הערכים שהמסך קורא, מוזרקים.
 * @param {Function} options.send הכתובת האחת.
 * @param {object} [options.voice] CONN-02: speak, stop, on, hasVoice.
 * @param {object} [options.microphone] CONN-01: listen, stop, available.
 * @param {object} [options.device] מה שההרכבה יודעת על המכשיר:
 *   flags() לדגלי הסשן שאינם של המסך (simulator), position() לדגימה
 *   האחרונה של AUTO-01, direction(from, to) לרוח השמיים.
 */
export function create({ host, from, reference, send, voice = null, microphone = null, device = null }) {
  const view = {
    site: null,
    resumed: false,
    stop: null,
    session: null,
    question: '',
    answer: null,
    nowSpeaking: null,
    listening: false,
    battery: BATTERY.OK,
    exit: null,
    blockedByGate: false,
    notices: new Set(),
    sessionFlags: new Set(),
    error: null,
  };

  const listeners = new Map();

  function emit(event, detail) {
    for (const fn of listeners.get(event) ?? []) fn(detail);
  }

  const errorText = (error) => humanError(reference?.error_human_text, error);

  async function ask(module, action, payload) {
    return send({ from: from, module, action, payload });
  }

  // כל תשובה עוברת כאן. שער סגור עוצר את המסך כולו (2.2), הודעת
  // מכשיר נאמרת פעם אחת לסשן ונרשמת כדגל, וכל שאר הכשלים מוצגים
  // כרגיל.
  function absorb(response) {
    if (response.ok) return true;
    const code = response.error?.code;
    if (code === 'E-GATE-CLOSED') {
      view.blockedByGate = true;
      view.error = response.error;
      return false;
    }
    if (DEVICE_CODES.includes(code)) {
      view.notices.add(code);
      if (FLAG_OF_CODE[code]) view.sessionFlags.add(FLAG_OF_CODE[code]);
      return false;
    }
    view.error = response.error;
    return false;
  }

  // --- הציוד ---

  // מה שנאמר מוצג על המסך: בהיעדר קול עברי זו הדרך היחידה של
  // המשפחה לקבל את התוכן (usecase-f-04 זרימה ד), ועם קול זה מה
  // שנשמע עכשיו. אירועי CONN-02 מגיעים מכל מי שמדבר דרך אותו מופע:
  // הפריט של FE-04, התשובה של BE-03, ומשפטי הפתיחה של המסך עצמו.
  if (voice && typeof voice.on === 'function') {
    voice.on('start', ({ text }) => {
      view.nowSpeaking = text;
      render();
    });
    voice.on('unavailable', ({ text }) => {
      view.nowSpeaking = text;
      absorb({ ok: false, error: { code: 'E-NO-HEBREW-VOICE', data: null } });
      render();
    });
  }

  function speak(text) {
    if (!voice || typeof voice.speak !== 'function') return Promise.resolve(null);
    if (typeof text !== 'string' || text === '') return Promise.resolve(null);
    return voice.speak(text).then((response) => {
      if (response && !response.ok) absorb(response);
      return response;
    });
  }

  function stopVoice() {
    if (voice && typeof voice.stop === 'function') voice.stop();
  }

  /** הדגלים של הסשן ברגע נתון: מה שההרכבה יודעת, ומה שהמסך למד. */
  function currentFlags() {
    const known = typeof device?.flags === 'function' ? device.flags() : [];
    const flags = new Set([...(Array.isArray(known) ? known : []), ...view.sessionFlags]);
    if (voice && typeof voice.hasVoice === 'function' && !voice.hasVoice()) flags.add('no_hebrew_voice');
    return [...flags];
  }

  // --- הסשן ---

  async function start() {
    const gate = await ask('BE-06', 'get_gate', {});
    if (!absorb(gate)) return render();

    view.site = gate.data?.site ?? null;

    // רשימת הקולות של המכשיר נטענת בעצלות; הדגל no_hebrew_voice
    // נקבע רק אחרי שהיא נטענה.
    if (voice && typeof voice.voicesLoaded === 'function') await voice.voicesLoaded();

    const response = await ask('BE-07', 'session_start', {
      site_id: view.site?.site_id,
      flags: currentFlags(),
    });
    if (!absorb(response)) return render();

    // BE-07 מחזיר { session, resumed }: הסשן עצמו, ואם הוא חידוש
    // של סשן פתוח (הכרעה 2 של שלב 4).
    view.session = response.data?.session ?? null;
    view.resumed = response.data?.resumed === true;
    view.error = null;
    render();

    emit('session:start', { session: view.session, site_id: view.session?.site_id ?? view.site?.site_id });

    // usecase-f-13 צעד 1: משפט הבטיחות נשמע פעם אחת, לפני כל תוכן.
    // ואחריו משפט הפרטיות (PRD סעיף 25). ההשמעה אינה מעכבת את המסך.
    speakOpening();
  }

  async function speakOpening() {
    const safety = reference?.safety_opening_text;
    const privacy = reference?.privacy_opening_text;
    if (typeof safety === 'string' && safety !== '') await speak(safety);
    if (typeof privacy === 'string' && privacy !== '') await speak(privacy);
  }

  async function end() {
    const flags = currentFlags();
    // usecase-f-13 צעד 9: סיום אחרי התראת הסוללה מסומן, כדי ש-M-02
    // יבחין בין נשירה מסוללה לנשירה מחוסר עניין.
    if (view.battery === BATTERY.WARNED) flags.push('ended_on_battery');

    stopVoice();
    const sessionId = view.session?.session_id;
    const response = await ask('BE-07', 'session_end', { session_id: sessionId, flags });
    if (!absorb(response)) return render();
    view.session = null;
    view.answer = null;
    view.nowSpeaking = null;
    view.resumed = false;
    view.notices.clear();
    view.sessionFlags.clear();
    view.battery = BATTERY.OK;
    view.exit = null;
    render();
    emit('session:end', { session_id: sessionId });
  }

  async function submitQuestion(text) {
    const question = String(text ?? '').trim();
    if (question === '') return;

    // ההקשר נשלח עם השאלה: מזהה הסשן למען היומן, המסלול למען
    // השליפה, והתחנה הנוכחית כשהיא ידועה. התחנה מגיעה מ-AUTO-01 דרך
    // ההרכבה; בלי מיקום היא ריקה, וזה מצב תקין (usecase-f-04 זרימה ב).
    const response = await ask('BE-03', 'ask', {
      question,
      session_id: view.session?.session_id,
      site_id: view.session?.site_id ?? view.site?.site_id,
      stop_id: currentStop() ?? undefined,
    });

    if (!response.ok) {
      // שאלה שלא נענתה היא ניסיון שנכשל, ומודול השיחה אינו יודע
      // עליה: המסך הוא הפונה המורשה לסוג הזה (מפה 4.2 שורת log).
      await ask('BE-07', 'log', {
        type: 'attempt_failed',
        session_id: view.session?.session_id,
      });
      absorb(response);
      return render();
    }

    view.answer = response.data ?? null;
    view.question = '';
    view.error = null;
    render();
  }

  function currentStop() {
    if (typeof device?.stop !== 'function') return view.stop;
    return device.stop() ?? view.stop ?? null;
  }

  /**
   * כפתור השאלה: מה שהוקלד נשלח; בלי הקלדה נפתח המיקרופון
   * (usecase-f-04 צעדים 1 ו-2, זרימה א). כשל קליטה הוא ניסיון שנכשל
   * (הצעת א2, שאושרה בשלב 4 כסוג attempt_failed), ולא יזימה.
   */
  async function onQuestion() {
    const typed = view.question.trim();
    if (typed !== '') return submitQuestion(typed);
    if (!microphone || typeof microphone.listen !== 'function' || !microphone.available()) return;

    // שאלה בקול עוצרת את מה שמדבר: המשפחה מדברת, המערכת מקשיבה.
    stopVoice();
    view.listening = true;
    view.error = null;
    render();
    const heard = await microphone.listen();
    view.listening = false;

    if (heard.ok) return submitQuestion(heard.data.text);
    if (heard.aborted) return render();

    if (heard.error?.code === 'E-SPEECH-NOT-RECOGNIZED') {
      await ask('BE-07', 'log', {
        type: 'attempt_failed',
        session_id: view.session?.session_id,
      });
      view.error = heard.error;
      return render();
    }
    absorb(heard);
    return render();
  }

  // --- נוהל הסוללה ---

  /**
   * נקודת היציאה הקרובה, עם מרחק וכיוון מהמיקום שהאוטומציה יודעת.
   * המרחק מחושב ב-BE-05 מהמיקום שנשלח ב-payload (מפה 4.2), והכיוון
   * באותו מקום שמחשב מרחקים לעוגנים (F-13 תיקון 1, הכרעה 11).
   */
  async function loadExitPoint() {
    const position = typeof device?.position === 'function' ? device.position() : null;
    const payload = { site_id: view.session?.site_id };
    if (position && Number.isFinite(position.lat) && Number.isFinite(position.lng)) {
      payload.lat = position.lat;
      payload.lng = position.lng;
    }
    const response = await ask('BE-05', 'nearestExitPoint', payload);
    if (!response.ok) {
      view.error = response.error;
      view.exit = null;
      return;
    }
    const point = response.data?.exit_point ?? null;
    view.exit = point === null ? null : {
      name: point.name ?? UNKNOWN,
      distance: typeof response.data.distance_m === 'number' ? String(response.data.distance_m) : UNKNOWN,
      direction: position && typeof device?.direction === 'function'
        ? (device.direction(position, point) ?? UNKNOWN)
        : UNKNOWN,
    };
  }

  function blockText() {
    const template = reference?.battery_block_text;
    if (typeof template !== 'string' || template === '') return errorText({ code: 'E-REF-EMPTY', data: { key: 'battery_block_text' } });
    return TEMPLATE_FIELDS.reduce(
      (text, [placeholder, field]) => text.split(placeholder).join(view.exit?.[field] ?? UNKNOWN),
      template,
    );
  }

  /**
   * מקבל אחוז סוללה ומחיל את הנוהל הדו שלבי.
   *
   * מקור המדידה אינו כאן: הוא מגיע מהמכשיר דרך ההרכבה. הסף וההשוואה
   * כן כאן, לפי מפה 2.4 ומפה 6.1.
   */
  async function setBatteryLevel(percent) {
    const warn = reference?.battery_warn_percent;
    const block = reference?.battery_block_percent;
    const resume = reference?.battery_resume_percent;

    // ערך חסר אינו מומצא. בלי סף אין נוהל, והמסך מדווח ואינו מנחש.
    for (const [key, value] of [['battery_warn_percent', warn], ['battery_block_percent', block], ['battery_resume_percent', resume]]) {
      if (typeof value !== 'number') {
        view.error = { code: 'E-REF-EMPTY', data: { key } };
        return render();
      }
    }

    if (percent < block) {
      const wasBlocked = view.battery === BATTERY.BLOCKED;
      // הודעת היציאה נבנית מנקודת היציאה הקרובה. בלעדיה אי אפשר
      // לבנות אותה, וזה בדיוק E-NO-EXIT-POINT.
      await loadExitPoint();
      view.battery = BATTERY.BLOCKED;
      render();
      if (!wasBlocked) {
        // BL-20: המערכת מפסיקה מסירה ומכבה את המיקום ואת הקול. מי
        // שמרכיב עוצר את האוטומציה; המסך עוצר את מה שמדבר, אומר את
        // ההודעה פעם אחת בקול, ומשאיר אותה כטקסט סטטי (תיקון 1 סעיף 2).
        emit('battery:block', { session_id: view.session?.session_id });
        stopVoice();
        if (view.session) speak(blockText());
      }
      return;
    }

    if (view.battery === BATTERY.BLOCKED) {
      // חידוש רק מעל סף החידוש, ולא בעצם העלייה מעל סף החסימה.
      if (percent >= resume) {
        view.battery = BATTERY.OK;
        render();
        emit('battery:resume', { session: view.session, site_id: view.session?.site_id });
      }
      return;
    }

    if (percent <= warn) {
      const wasWarned = view.battery === BATTERY.WARNED;
      // תיקון 1 סעיף 2: אותו מידע בשני הספים. ההתראה כוללת את נקודת
      // היציאה, המרחק והכיוון, כדי שההחלטה תהיה מושכלת.
      if (!wasWarned && view.session) await loadExitPoint();
      view.battery = BATTERY.WARNED;
    } else {
      view.battery = BATTERY.OK;
    }

    render();
  }

  /**
   * הודעה שמגיעה מהמכשיר אחרי תחילת הסשן, דרך ההרכבה: הרשאת מיקום
   * שנדחתה מגיעה מ-AUTO-01 ולא מתשובה למעטפה של המסך. אותו כלל:
   * פעם אחת לסשן, ודגל.
   */
  function notify(response) {
    absorb(response);
    render();
  }

  // --- תצוגה ---

  function opening() {
    const children = [];

    // משפט הבטיחות, F-13. נקרא מטבלת ה-reference ואינו כתוב כאן.
    const safety = reference?.safety_opening_text;
    children.push(typeof safety === 'string' && safety !== ''
      ? createElement('p', {}, safety)
      : createElement('div', { class: 'message message--error' },
        errorText({ code: 'E-REF-EMPTY' })));

    // משפט הפרטיות, PRD סעיף 25. פער 31 הוסיף את המפתח למפה 2.4
    // בהכרעת בעלת הפרויקט, והנוסח עצמו ממתין לאישורה. עד אז המסך
    // מציג ערך חסר עם שם המפתח, ואינו ממציא נוסח למשפחה.
    const privacy = reference?.privacy_opening_text;
    children.push(typeof privacy === 'string' && privacy !== ''
      ? createElement('p', {}, privacy)
      : createElement('div', { class: 'message message--warn' },
        errorText({ code: 'E-REF-EMPTY', data: { key: 'privacy_opening_text' } })));

    // שגיאה שנוצרה לפני תחילת הסשן, למשל סף סוללה חסר, נראית כאן.
    // בלי השורה הזאת היא נכתבת למצב ואינה מגיעה לעין.
    if (view.error) {
      children.push(createElement('div', { class: 'message message--error' }, errorText(view.error)));
    }

    const startButton = createElement('button', { class: 'btn btn--primary btn--touch', type: 'button' }, 'התחלת הטיול');
    startButton.addEventListener('click', start);
    children.push(createElement('div', { class: 'btn-row' }, [startButton]));

    return panel('לפני שיוצאים', createElement('div', {}, children));
  }

  function batteryBlockScreen() {
    // הודעה סטטית, בלי אינטראקציה: BL-20 מכבה מסירה, מיקום וקול.
    return createElement('div', { class: 'notice-screen' }, [
      createElement('p', { class: 'notice-screen__text' }, blockText()),
      view.exit
        ? null
        : createElement('div', { class: 'message message--error' },
          errorText({ code: 'E-NO-EXIT-POINT' })),
    ]);
  }

  function gateClosedScreen() {
    return createElement('div', { class: 'notice-screen' }, [
      createElement('p', { class: 'notice-screen__text' }, errorText(view.error)),
    ]);
  }

  function exitSummary() {
    if (!view.exit) return 'לא נטענה';
    return `${view.exit.name}, ${view.exit.distance} מטר, ${view.exit.direction}`;
  }

  function walking() {
    const children = [];

    if (view.battery === BATTERY.WARNED) {
      children.push(createElement('div', { class: 'message message--warn' },
        `הסוללה נמוכה. נקודת היציאה הקרובה: ${exitSummary()}`));
    }

    for (const code of view.notices) {
      children.push(createElement('div', { class: 'message' }, errorText({ code })));
    }

    if (view.error) {
      children.push(createElement('div', { class: 'message message--error' }, errorText(view.error)));
    }

    // מה שנאמר עכשיו, או מה שהיה נאמר אילו היה קול: הטקסט של
    // הפריט הנדחף, כפי שאושר (BL-13, usecase-f-04 זרימה ד).
    if (view.nowSpeaking) {
      children.push(createElement('p', { class: 'text-sm text-muted' }, view.nowSpeaking));
    }

    if (view.answer) {
      // BE-03 מחזיר spoken: מה שיישמע, כפי ש-BE-04 החזיר אותו
      // ובלי ניסוח מחדש (BL-13). הוא מוצג גם כטקסט, תמיד: בהיעדר
      // קול זו התשובה, ועם קול זה מה שנשמע.
      children.push(createElement('blockquote', { class: 'quote' }, view.answer.spoken ?? ''));

      // תשובת הימנעות אינה שגיאה, והמסך אומר את זה: היא מצב תקין
      // (usecase-f-05 זרימה א), ובלי הסימון היא נראית כמו תשובה.
      if (view.answer.is_fallback === true) {
        children.push(createElement('div', { class: 'message' }, 'אין מידע מאומת על השאלה הזאת במסלול.'));
      } else if (view.answer.source_page !== null && view.answer.source_page !== undefined) {
        children.push(createElement('span', { class: 'list__meta' }, `מקור: עמוד ${view.answer.source_page}`));
      }
    }

    // כפתור השאלה ושדה ההקלדה. הכפתור שולח את מה שהוקלד, ובלי
    // הקלדה פותח את המיקרופון. השדה נשאר בשביל מי שמעדיף להקליד
    // ובשביל מכשיר בלי הרשאה (usecase-f-04 צעד 2).
    const field = createElement('div', { class: 'field' }, [
      createElement('label', { class: 'field__label', for: 'traveler-question' }, 'שאלה'),
      createElement('input', { class: 'field__control', id: 'traveler-question', type: 'text' }),
      view.listening ? createElement('span', { class: 'field__hint' }, 'מקשיב') : null,
    ]);
    const input = field.querySelector('input');
    input.value = view.question;
    input.addEventListener('input', () => { view.question = input.value; });
    children.push(field);

    const askButton = createElement('button', { class: 'btn btn--primary btn--touch', type: 'button' }, 'שאלה');
    askButton.addEventListener('click', onQuestion);

    const endButton = createElement('button', { class: 'btn btn--touch', type: 'button' }, 'סיום הטיול');
    endButton.addEventListener('click', end);

    children.push(createElement('div', { class: 'btn-row' }, [askButton, endButton]));

    return panel('הטיול פעיל', createElement('div', {}, children));
  }

  function render() {
    if (view.blockedByGate) return host.replaceChildren(gateClosedScreen());
    if (view.battery === BATTERY.BLOCKED) return host.replaceChildren(batteryBlockScreen());
    host.replaceChildren(view.session ? walking() : opening());
  }

  render();

  return {
    setBatteryLevel,
    notify,
    /** אירועי מחזור החיים למי שמרכיב: session:start, session:end, battery:block, battery:resume. */
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event)?.delete(fn);
    },
    /** נחשף לבדיקה בלבד. */
    state: () => ({
      session_id: view.session?.session_id ?? null,
      battery: view.battery,
      flags: currentFlags(),
      exit: view.exit ? { ...view.exit } : null,
      now_speaking: view.nowSpeaking,
    }),
  };
}
