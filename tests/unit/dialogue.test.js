// Unit של BE-03, Dialogue. נגזר מבדיקת הקבלה של משימה 7 בתוכנית
// שלב 4, מ-usecase-f-04 (צעדים 5 עד 11 וזרימות א עד ז), מ-BL-13
// ומ-BL-10, ומשורת BE-03 במפה 6.1 ("שאלה בזמן פריט מוחזק: הפריט
// נשאר מוחזק, התשובה נשמעת").
//
//   node tests/unit/dialogue.test.js

import { create } from '../../services/dialogue.js';
import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };

const { check, checkThrows, report } = createChecker('BE-03 dialogue');

const CALLER = modulesFile.modules.find((row) => row.id === 'BE-03').caller;
const NOW = '2026-09-14T12:00:00.000Z';

const ANSWER = {
  ok: true,
  data: {
    answer: 'שער יפו נבנה בימי סולימאן המפואר.',
    source_item: 'i-gate',
    source_page: 7,
    is_fallback: false,
  },
};

const ABSTENTION = {
  ok: true,
  data: {
    answer: 'אין לי מידע מאומת על זה במסלול הזה.',
    source_item: null,
    source_page: null,
    is_fallback: true,
  },
};

// ה-Orchestrator המזויף: מתעד כל מעטפה, ועונה לפי המודול שאליו
// היא פנתה. כך נראה מבחוץ שהמודול אינו קורא לאיש ישירות.
function fakeSend({ retrieval = ANSWER, logOk = true } = {}) {
  const sent = [];
  const send = async (request) => {
    sent.push(request);
    if (request.module === 'BE-04') return retrieval;
    if (request.module === 'BE-07') return logOk ? { ok: true, data: {} } : { ok: false, error: {} };
    return { ok: false, error: {} };
  };
  send.sent = sent;
  return send;
}

const repository = { getRef: () => undefined };

const askWith = (send, payload) => create({ repository, send, caller: CALLER, now: () => NOW })({
  from: 'screen-traveler', module: 'BE-03', action: 'ask', payload, lang: 'he',
});

const PAYLOAD = {
  question: 'מי בנה את שער יפו?', session_id: 'sess-1', site_id: 's-1', stop_id: 'st-1',
};

// ---------------------------------------------------------------------
// צעד 6: הקריאה ל-BE-04 עוברת ב-Orchestrator
// ---------------------------------------------------------------------

{
  const send = fakeSend();
  const response = await askWith(send, PAYLOAD);

  check('התשובה מוצלחת', response.ok, true);
  check('נשלחו שתי מעטפות', send.sent.length, 2);
  check('הראשונה ל-BE-04', send.sent[0].module, 'BE-04');
  check('בפעולה retrieve', send.sent[0].action, 'retrieve');
  check('בשם הפונה שבטבלת המודולים', send.sent[0].from, CALLER);
  check('והשם הזה הוא module-dialogue', CALLER, 'module-dialogue');
  check('השאלה הועברה', send.sent[0].payload.question, PAYLOAD.question);
  check('וההקשר הועבר איתה', [
    send.sent[0].payload.site_id, send.sent[0].payload.stop_id,
  ], ['s-1', 'st-1']);
}

// ---------------------------------------------------------------------
// BL-13: מה שנשמע הוא מה שהוחזר, בלי ניסוח מחדש
// ---------------------------------------------------------------------

{
  const response = await askWith(fakeSend(), PAYLOAD);
  check('הטקסט להשמעה הוא התשובה כפי שהיא', response.data.spoken, ANSWER.data.answer);
  check('והמקור מוחזר איתו', response.data.source_item, 'i-gate');
  check('והעמוד', response.data.source_page, 7);
  check('ואינו הימנעות', response.data.is_fallback, false);
}

// ---------------------------------------------------------------------
// צעד 10 וזרימה ג3: שורת initiated, גם בהימנעות
// ---------------------------------------------------------------------

{
  const send = fakeSend();
  await askWith(send, PAYLOAD);
  const log = send.sent[1];

  check('המעטפה השנייה היא ל-BE-07', log.module, 'BE-07');
  check('בפעולה log', log.action, 'log');
  check('מסוג initiated', log.payload.type, 'initiated');
  check('בשם מודול השיחה', log.from, CALLER);
  check('עם מזהה הסשן', log.payload.session_id, 'sess-1');
  check('עם התחנה', log.payload.stop_id, 'st-1');
  check('ועם מקור התשובה', log.payload.source_item, 'i-gate');
  check('ובלי דגל הימנעות', log.payload.is_fallback, false);
}

{
  const send = fakeSend({ retrieval: ABSTENTION });
  const response = await askWith(send, PAYLOAD);

  check('הימנעות נשמעת כפי שהיא', response.data.spoken, ABSTENTION.data.answer);
  check('והדגל מוחזר למסך', response.data.is_fallback, true);
  check('ובכל זאת נרשמה שורת initiated', send.sent[1].payload.type, 'initiated');
  check('עם דגל ההימנעות', send.sent[1].payload.is_fallback, true);
  check('ובלי מקור', send.sent[1].payload.source_item, null);
}

// ---------------------------------------------------------------------
// זרימה ג של usecase-f-05: שגיאת קלט עוברת כפי שהיא
// ---------------------------------------------------------------------

{
  const invalid = { ok: false, error: { code: 'E-QUESTION-INVALID', data: { reason: 'empty' } } };
  const send = fakeSend({ retrieval: invalid });
  const response = await askWith(send, { ...PAYLOAD, question: '' });

  check('הקוד עובר כפי שהוא', response.error.code, 'E-QUESTION-INVALID');
  check('ואינו הופך להימנעות', response.ok, false);
  check('ולא נרשמה שורת initiated', send.sent.length, 1);
}

// ---------------------------------------------------------------------
// BL-10: היומן אינו חוסם את החוויה
// ---------------------------------------------------------------------

{
  const send = fakeSend({ logOk: false });
  const response = await askWith(send, PAYLOAD);
  check('כשל רישום אינו מונע את התשובה', response.ok, true);
  check('והמשפחה שומעת', response.data.spoken, ANSWER.data.answer);
  check('והמסך יודע שהשורה לא נרשמה', response.data.logged, false);
}

{
  const throwing = async (request) => {
    if (request.module === 'BE-04') return ANSWER;
    throw new Error('היומן נפל');
  };
  const response = await askWith(throwing, PAYLOAD);
  check('זריקה ביומן אינה מפילה את התשובה', response.ok, true);
  check('והשורה מדווחת כלא נרשמה', response.data.logged, false);
}

{
  const send = fakeSend();
  const response = await askWith(send, { ...PAYLOAD, session_id: undefined });
  check('בלי סשן אין שורת יומן', send.sent.length, 1);
  check('והתשובה בכל זאת חוזרת', response.data.spoken, ANSWER.data.answer);
}

// ---------------------------------------------------------------------
// זרימה ב: שאלה בין תחנות
// ---------------------------------------------------------------------

{
  const send = fakeSend();
  const response = await askWith(send, { ...PAYLOAD, stop_id: undefined });
  check('שאלה בלי תחנה עוברת', response.ok, true);
  check('והתחנה הריקה מועברת לשליפה', send.sent[0].payload.stop_id, undefined);
  check('והשורה נרשמת עם תחנה ריקה', send.sent[1].payload.stop_id, null);
}

// ---------------------------------------------------------------------
// שורת BE-03 במפה 6.1, ופער 44
// ---------------------------------------------------------------------

{
  // המודול מסמן שאלה פעילה בזמן שהשליפה רצה, ומנקה אותה אחריה.
  // זהו הנתון הפרטי היחיד שלו (מפה 3.2), והוא אינו נשמר.
  let during = null;
  const handle = create({
    repository,
    caller: CALLER,
    now: () => NOW,
    send: async (request) => {
      if (request.module === 'BE-04') {
        during = handle.activeQuestion();
        return ANSWER;
      }
      return { ok: true, data: {} };
    },
  });

  check('לפני שאלה אין שאלה פעילה', handle.activeQuestion(), null);
  await handle({ from: 'screen-traveler', module: 'BE-03', action: 'ask', payload: PAYLOAD, lang: 'he' });
  check('בזמן השליפה השאלה פעילה', during.question, PAYLOAD.question);
  check('ואחריה היא מתנקה', handle.activeQuestion(), null);
}

{
  // הצד שכן מתקיים משורת 6.1: BE-03 אינו שולח דבר ל-FE-04, ולכן
  // פריט מוחזק נשאר מוחזק. פער 44: אין ב-4.2 פעולה שתאפשר אחרת.
  const send = fakeSend();
  await askWith(send, PAYLOAD);
  check('שום מעטפה אינה פונה ל-FE-04',
    send.sent.some((request) => request.module === 'FE-04'), false);
  check('ושתי המעטפות הן BE-04 ו-BE-07',
    send.sent.map((request) => request.module), ['BE-04', 'BE-07']);
}

// ---------------------------------------------------------------------
// מה שהמודול אינו עושה
// ---------------------------------------------------------------------

{
  // מפה 3.2, שורת BE-03: "כותב: אין (שולח log)". המודול מקבל
  // Repository שנופל בכל כתיבה, והשאלה עוברת.
  const writing = { getRef: () => undefined };
  for (const name of ['appendInteraction', 'setStatus', 'appendApproval', 'appendItem']) {
    writing[name] = () => { throw new Error(`BE-03 כתב ב-${name}`); };
  }
  const response = await create({
    repository: writing, send: fakeSend(), caller: CALLER, now: () => NOW,
  })({ from: 'screen-traveler', module: 'BE-03', action: 'ask', payload: PAYLOAD, lang: 'he' });
  check('השיחה אינה כותבת דבר', response.ok, true);
}

checkThrows('בלי Repository אין מודול', () => create({}));

{
  const handle = create({ repository, send: fakeSend(), caller: CALLER, now: () => NOW });
  checkThrows('פעולה שאינה במפה נזרקת', () => handle({
    from: 'screen-traveler', module: 'BE-03', action: 'לא קיימת', payload: {}, lang: 'he',
  }));
}

// =====================================================================
// שלב 5, משימה 7: הקול המוזרק, והכרעה 4 (דרך ג להכרעה הפתוחה 12)
// =====================================================================

function fakeVoice({ durationMs = 2500, noVoice = false } = {}) {
  const calls = [];
  return {
    calls,
    speak: async (text) => {
      calls.push(['speak', text]);
      if (noVoice) return { ok: false, error: { code: 'E-NO-HEBREW-VOICE', data: {} } };
      return { ok: true, data: { duration_ms: durationMs, interrupted: false, chunks: 1 } };
    },
    stop: () => { calls.push(['stop']); return { ok: true, data: { stopped: true } }; },
  };
}

const askWithVoice = (send, voice, payload) => create({ repository, send, caller: CALLER, now: () => NOW, voice })({
  from: 'screen-traveler', module: 'BE-03', action: 'ask', payload, lang: 'he',
});

{
  const send = fakeSend();
  const voice = fakeVoice();
  const response = await askWithVoice(send, voice, PAYLOAD);

  check('**שאלה בזמן שפריט מדבר: המנוע מקבל stop ואז את התשובה** (הכרעה 4)',
    voice.calls, [['stop'], ['speak', ANSWER.data.answer]]);
  check('התשובה נושאת את המשך ואינה בכתב', [response.data.duration_ms, response.data.displayed_as_text], [2500, false]);
  const initiated = send.sent.find((r) => r.module === 'BE-07');
  check('שורת initiated נושאת duration_ms ו-displayed_as_text', [initiated.payload.duration_ms, initiated.payload.displayed_as_text], [2500, false]);
  check('ה-stop קדם לקריאה ל-BE-04: העצירה ברגע השאלה, לא ברגע התשובה',
    voice.calls[0][0] === 'stop' && send.sent[0].module === 'BE-04', true);
}

{
  const send = fakeSend();
  const voice = fakeVoice({ noVoice: true });
  const response = await askWithVoice(send, voice, PAYLOAD);
  check('בלי קול עברי: התשובה בכתב, והשאלה עדיין נספרת', [response.ok, response.data.displayed_as_text, response.data.duration_ms, response.data.logged], [true, true, null, true]);
}

{
  const send = fakeSend({ retrieval: ABSTENTION });
  const voice = fakeVoice();
  const response = await askWithVoice(send, voice, PAYLOAD);
  check('הימנעות נאמרת בקול באותו נוסח נעול', voice.calls.at(-1), ['speak', ABSTENTION.data.answer]);
  check('והיא עדיין הימנעות', response.data.is_fallback, true);
}

{
  const send = fakeSend({ retrieval: { ok: false, error: { code: 'E-QUESTION-INVALID', data: {} } } });
  const voice = fakeVoice();
  const response = await askWithVoice(send, voice, PAYLOAD);
  check('שאלה לא תקינה: המנוע נעצר, ואינו משמיע דבר', [response.error.code, voice.calls], ['E-QUESTION-INVALID', [['stop']]]);
}

report();
