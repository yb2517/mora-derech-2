// FE-05: מסך המטייל. משימה 6 בתוכנית שלב 2.
//
// המקור: מפה 3.3 שורת FE-05, מפה 4.4 (הפעולות שלו ואותן בלבד),
// doc-build-03-interfaces סעיף 2.2, F-04, F-02, F-01, F-13
// ותיקון הסוללה, ו-UX-01.
//
// המסך הזה נקרא בהליכה, בשמש, ביד אחת, כשהיד השנייה מחזיקה ילד.
// לכן הוא מינימלי, ולכן כל דבר שנמצא בו נמצא מסיבה ממוספרת.
//
// UX-01, אפס מגע: שני המגעים המאושרים הם תחילת הסשן וסיומו (הוכרע
// 12.09). כפתור השאלה הוא הפרה מתועדת שנשארת ב-v1, לפי אותה הכרעה
// ולפי סעיף 16 ב-PRD. אין כאן מגע שלישי.
//
// מה שאינו כאן בשלב 2, ויש לו מקום מסומן: קול, מיקרופון ומיקום.
// CONN-01 עד CONN-03 נבנים בשלב 5, ולכן השאלה מוקלדת, ותשובה מוצגת
// בכתב. זה גם מה שהמסך יעשה בשטח כשאין קול עברי (E-NO-HEBREW-VOICE),
// ולכן המסלול הזה אינו זמני.
//
// נוהל הסוללה (BL-20, F-13 תיקון 1) כן כאן, ובכוונה: מפה 2.4 רושמת
// את ארבעת מפתחות הסוללה כמפתחות ש-FE-05 קורא, ומפה 6.1 מגדירה
// בדיקת Unit ל-FE-05 עם סוללה של ארבעה אחוזים. כלומר ההשוואה לסף
// היא של המסך. מה שאינו שלו הוא מקור המדידה, והוא מגיע מהמכשיר
// בשלב 5.

import { createElement, panel, humanError } from '../view.js';

// שני מצבי הסוללה, לפי F-13 תיקון 1. הנוהל דו שלבי: התראה, ואז
// חסימה. החידוש מותנה בחצייה חזרה של סף החידוש.
const BATTERY = { OK: 'ok', WARNED: 'warned', BLOCKED: 'blocked' };

// קודים שהם הודעת מכשיר, ולא כשל פעולה. לפי 2.2 הם נאמרים פעם אחת
// לסשן: משפחה שמקבלת את אותה הודעה בכל תחנה מפסיקה להקשיב.
const DEVICE_CODES = ['E-NO-HEBREW-VOICE', 'E-LOCATION-NOT-ALLOWED', 'E-MIC-NOT-ALLOWED'];

export function create({ host, from, reference, send }) {
  const view = {
    session: null,
    question: '',
    answer: null,
    battery: BATTERY.OK,
    exitPoint: null,
    blockedByGate: false,
    notices: new Set(),
    error: null,
  };

  const errorText = (error) => humanError(reference?.error_human_text, error);

  async function ask(module, action, payload) {
    return send({ from: from, module, action, payload });
  }

  // כל תשובה עוברת כאן. שער סגור עוצר את המסך כולו (2.2), הודעת
  // מכשיר נאמרת פעם אחת לסשן, וכל שאר הכשלים מוצגים כרגיל.
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
      return false;
    }
    view.error = response.error;
    return false;
  }

  // --- הסשן ---

  async function start() {
    const gate = await ask('BE-06', 'get_gate', {});
    if (!absorb(gate)) return render();

    const response = await ask('BE-07', 'session_start', { site_id: gate.data?.site?.site_id });
    if (!absorb(response)) return render();

    view.session = response.data ?? null;
    view.error = null;
    render();
  }

  async function end() {
    const response = await ask('BE-07', 'session_end', {});
    if (!absorb(response)) return render();
    view.session = null;
    view.answer = null;
    view.notices.clear();
    view.battery = BATTERY.OK;
    render();
  }

  async function submitQuestion() {
    const text = view.question.trim();
    if (text === '') return;

    const response = await ask('BE-03', 'ask', { question: text });

    if (!response.ok) {
      // שאלה שלא נענתה היא ניסיון שנכשל, ומודול השיחה אינו יודע
      // עליה: המסך הוא הפונה המורשה לסוג הזה (מפה 4.2 שורת log).
      await ask('BE-07', 'log', { type: 'attempt_failed' });
      absorb(response);
      return render();
    }

    view.answer = response.data ?? null;
    view.question = '';
    view.error = null;
    render();
  }

  // --- נוהל הסוללה ---

  /**
   * מקבל אחוז סוללה ומחיל את הנוהל הדו שלבי.
   *
   * מקור המדידה אינו כאן: בשלב 5 הוא יגיע מהמכשיר. הסף וההשוואה
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
      // הודעת היציאה נבנית מנקודת היציאה הקרובה. בלעדיה אי אפשר
      // לבנות אותה, וזה בדיוק E-NO-EXIT-POINT.
      const response = await ask('BE-05', 'nearestExitPoint', { site_id: view.session?.site_id });
      if (response.ok) view.exitPoint = response.data?.exit_point ?? null;
      else view.error = response.error;
      view.battery = BATTERY.BLOCKED;
    } else if (view.battery === BATTERY.BLOCKED) {
      // חידוש רק מעל סף החידוש, ולא בעצם העלייה מעל סף החסימה.
      if (percent >= resume) view.battery = BATTERY.OK;
    } else if (percent <= warn) {
      view.battery = BATTERY.WARNED;
    } else {
      view.battery = BATTERY.OK;
    }

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
    const template = reference?.battery_block_text;
    const text = typeof template === 'string' && template !== ''
      ? template
      : errorText({ code: 'E-REF-EMPTY' });

    return createElement('div', { class: 'notice-screen' }, [
      createElement('p', { class: 'notice-screen__text' }, text),
      view.exitPoint
        ? createElement('p', { class: 'notice-screen__text' }, view.exitPoint.name)
        : createElement('div', { class: 'message message--error' },
          errorText({ code: 'E-NO-EXIT-POINT' })),
    ]);
  }

  function gateClosedScreen() {
    return createElement('div', { class: 'notice-screen' }, [
      createElement('p', { class: 'notice-screen__text' }, errorText(view.error)),
    ]);
  }

  function walking() {
    const children = [];

    if (view.battery === BATTERY.WARNED) {
      children.push(createElement('div', { class: 'message message--warn' },
        `הסוללה נמוכה. נקודת היציאה הקרובה: ${view.exitPoint?.name ?? 'לא נטענה'}`));
    }

    for (const code of view.notices) {
      children.push(createElement('div', { class: 'message' }, errorText({ code })));
    }

    if (view.error) {
      children.push(createElement('div', { class: 'message message--error' }, errorText(view.error)));
    }

    if (view.answer) {
      children.push(createElement('blockquote', { class: 'quote' }, view.answer.answer ?? ''));
    }

    // כפתור השאלה ושדה ההקלדה. בשלב 5 הכפתור יפעיל גם את המיקרופון,
    // והשדה יישאר בשביל מי שמעדיף להקליד ובשביל מכשיר בלי הרשאה.
    const field = createElement('div', { class: 'field' }, [
      createElement('label', { class: 'field__label', for: 'traveler-question' }, 'שאלה'),
      createElement('input', { class: 'field__control', id: 'traveler-question', type: 'text' }),
    ]);
    const input = field.querySelector('input');
    input.value = view.question;
    input.addEventListener('input', () => { view.question = input.value; });
    children.push(field);

    const askButton = createElement('button', { class: 'btn btn--primary btn--touch', type: 'button' }, 'שאלה');
    askButton.addEventListener('click', submitQuestion);

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

  // מקור המדידה של הסוללה נכנס בשלב 5. עד אז הנוהל מופעל מבחוץ,
  // ובשלב 2 הקורא היחיד הוא מערך הבדיקות.
  return { setBatteryLevel };
}
