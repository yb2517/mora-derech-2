// System: מסך המטייל על נתוני הדגמה. משימה 6 בתוכנית שלב 2.
//
// המקור: מפה 6.3, מפה 6.1 (שורת FE-05: סוללה 4%), מפה 4.4,
// doc-build-03-interfaces סעיף 2.2, F-04, F-13 ותיקון הסוללה,
// ו-UX-01.
//
//   node tests/system/traveler-screen.test.js

import { installDom } from '../helpers/dom.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('System: מסך המטייל');

const dom = installDom();

const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { DEMO_SEED } = await import('../../tools/demo-modules.js');
const { create } = await import('../../screens/traveler/index.js');
const { create: createGovernance } = await import('../../services/governance.js');
const { create: createGate } = await import('../../services/gate.js');
const { create: createRetrieval } = await import('../../services/retrieval.js');
const { create: createDialogue } = await import('../../services/dialogue.js');
const { create: createLog } = await import('../../services/log.js');

const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
const referenceFile = (await import('../../data/reference.json', { with: { type: 'json' } })).default;

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const repository = createRepository(createBrowserDriver({
  storage: memoryStorage(),
  seed: {
    modules: modulesFile,
    allow_list: allowFile,
    reference: referenceFile.values,
    // נתוני ההדגמה, כדי שיהיה מסלול, פריטים מאושרים ונקודת יציאה.
    ...DEMO_SEED,
    // הסשנים של ההדגמה אינם נזרעים כאן: הבדיקה פותחת סשן משלה,
    // ושלושת הסשנים הסינתטיים היו הופכים אותה לתלויה בהם.
    sessions: [],
    interactions: [],
  },
}));

// **משימה 11 של שלב 4: המסך מדבר עם המודולים האמיתיים.** עד שלב 3
// הבדיקה הזאת הורכבה מול מודול ההדגמה, מפני ש-BE-03, BE-04, FE-04
// ו-BE-07 לא היו קיימים. מודול ההדגמה אינו מופיע כאן יותר.
let orchestrator = null;
const realSend = createEndpoint({
  handle: (envelope) => orchestrator.handle(envelope),
});
const handlers = {
  'BE-05': createGovernance({ repository }),
  'BE-06': createGate({ repository }),
  'BE-04': createRetrieval({ repository, send: realSend, caller: modulesFile.modules.find((m) => m.id === 'BE-04').caller }),
  'BE-03': createDialogue({ repository, send: realSend, caller: modulesFile.modules.find((m) => m.id === 'BE-03').caller }),
  'BE-07': createLog({ repository }),
};
orchestrator = createOrchestrator({ repository, handlers });

const caller = modulesFile.modules.find((m) => m.id === 'FE-05').caller;

// ערכי ה-reference שהמסך מקבל בהזרקה, בדיוק כמו בנקודת הכניסה.
const REF_KEYS = [
  'error_human_text', 'safety_opening_text', 'battery_block_text',
  'battery_warn_percent', 'battery_block_percent', 'battery_resume_percent',
];
const reference = Object.fromEntries(REF_KEYS.map((key) => [key, referenceFile.values[key]]));

const sent = [];
// חוליה שמאפשרת להחזיר שגיאה במקום תשובה, כדי לבדוק את מסלולי
// הכשל בלי להמציא קוד ובלי לשנות את המודול.
let intercept = null;
const send = async (envelope) => {
  sent.push(envelope);
  if (intercept) {
    const forced = intercept(envelope);
    if (forced) return forced;
  }
  return realSend(envelope);
};

const screen = create({ host: dom.host, from: caller, reference, send });

const settle = async () => {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => { setTimeout(resolve, 0); });
};
const buttons = () => dom.host.querySelectorAll('button');
const byLabel = (label) => buttons().find((b) => b.textContent.trim() === label);

// --- לפני הסשן: משפט הבטיחות, ומגע אחד ---

check('משפט הבטיחות מוצג מהטבלה', dom.host.textContent.includes(referenceFile.values.safety_opening_text), true);

// UX-01: לפני היציאה יש מגע אחד, תחילת הסשן. כל כפתור נוסף כאן
// הוא מגע שלא אושר.
check('מגע אחד לפני היציאה', buttons().map((b) => b.textContent.trim()), ['התחלת הטיול']);

// משפט הפרטיות אין לו מפתח בטבלה, ולכן המסך מציג ערך חסר ואינו
// ממציא נוסח. זהו הפער שמדווח בדוח השלב.
check(
  'במקום משפט הפרטיות מוצגת הודעת ערך חסר',
  dom.host.querySelectorAll('.message--warn').length,
  1,
);

// --- תחילת הסשן ---

byLabel('התחלת הטיול').click();
await settle();

check('הסשן נפתח דרך שתי בקשות', sent.map((e) => e.action), ['get_gate', 'session_start']);
check('ונרשם סשן אמיתי', repository.listSessions().length, 1);
check('והוא פתוח', repository.listSessions()[0].ended_at, null);
check('כל בקשה יצאה בשם הפונה של המסך', [...new Set(sent.map((e) => e.from))], [caller]);

// UX-01 בהליכה: סיום הסשן, ועוד כפתור השאלה כהפרה המתועדת.
check('שני מגעים בהליכה', buttons().map((b) => b.textContent.trim()), ['שאלה', 'סיום הטיול']);

// --- שאלה ותשובה ---

{
  dom.host.querySelector('input').type('מה קרה כאן');
  byLabel('שאלה').click();
  await settle();

  // המסך שולח למודול השיחה, ומודול השיחה שולח לשליפה: שתי המעטפות
  // האלה אינן עוברות דרך ה-send של הבדיקה, מפני שהן יוצאות מתוך
  // המודול אל אותה כתובת אחת.
  const asked = sent.filter((e) => e.module === 'BE-03');
  check('השאלה נשלחה למודול השיחה', asked.at(-1).module, 'BE-03');
  check('השאלה נשלחה כמות שהיא', asked.at(-1).payload.question, 'מה קרה כאן');
  check('ועם הקשר הסשן והמסלול', [
    typeof asked.at(-1).payload.session_id, typeof asked.at(-1).payload.site_id,
  ], ['string', 'string']);
  check('התשובה מוצגת בכתב', dom.host.querySelectorAll('.quote').length, 1);

  // השאלה אינה בקורפוס ההדגמה, ולכן התשובה היא הימנעות. זה מצב
  // תקין, והמסך אומר זאת (usecase-f-05 זרימה א).
  check('והנוסח הוא נוסח ההימנעות',
    dom.host.querySelector('.quote').textContent, referenceFile.values.fallback_text);

  // שורת initiated נכתבה בידי BE-07, ולא בידי המסך.
  const session = repository.listSessions()[0];
  const rows = repository.listInteractions({ session_id: session.session_id });
  check('נרשמה שורת יזימה', rows.filter((row) => row.type === 'initiated').length, 1);
  check('ונרשמה שורת הימנעות מהשליפה', rows.filter((row) => row.type === 'abstained').length, 1);
}

// --- שאלה שיש עליה תשובה בקורפוס ---

{
  const item = repository.listItems({ status: 'approved' })[0];
  const word = item.text.split(' ').find((w) => w.length > 4);

  dom.host.querySelector('input').type(word);
  byLabel('שאלה').click();
  await settle();

  const quoted = dom.host.querySelector('.quote').textContent;
  check('התשובה אינה הימנעות', quoted !== referenceFile.values.fallback_text, true);

  // BL-13: התשובה היא ציטוט או קיצוץ מפריט מאושר, בלי מילה שאינה
  // בו. איזה פריט ניצח הוא עניין של הדירוג, ולכן הטענה היא על
  // הקבוצה: היא חייבת להיות ציטוט מאחד מהם.
  check('והיא ציטוט מפריט מאושר',
    repository.listItems({ status: 'approved' }).some((row) => row.text.includes(quoted)), true);
  check('והמקור מוצג', dom.host.textContent.includes('מקור: עמוד'), true);
}

// --- שאלה שנכשלה נרשמת כניסיון שנכשל ---

{
  intercept = (envelope) => (envelope.module === 'BE-03'
    ? { ok: false, data: null, error: { code: 'E-QUESTION-INVALID', data: null } }
    : null);

  dom.host.querySelector('input').type('שאלה שתיכשל');
  byLabel('שאלה').click();
  await settle();
  intercept = null;

  const last = sent.slice(-2);
  check('אחרי כשל נשלחה רשומת ניסיון', last.map((e) => `${e.module}:${e.action}`), ['BE-03:ask', 'BE-07:log']);
  check('סוג הרשומה הוא ניסיון שנכשל', last[1].payload.type, 'attempt_failed');
  check(
    'הנוסח לאדם מוצג מהטבלה',
    dom.host.textContent.includes(referenceFile.values.error_human_text['E-QUESTION-INVALID']),
    true,
  );
}

// --- הודעת מכשיר נאמרת פעם אחת לסשן ---

{
  intercept = (envelope) => (envelope.module === 'BE-03'
    ? { ok: false, data: null, error: { code: 'E-NO-HEBREW-VOICE', data: null } }
    : null);

  for (let i = 0; i < 3; i += 1) {
    dom.host.querySelector('input').type(`שאלה ${i}`);
    byLabel('שאלה').click();
    await settle();
  }
  intercept = null;

  const text = referenceFile.values.error_human_text['E-NO-HEBREW-VOICE'];
  const shown = dom.host.querySelectorAll('.message').filter((m) => m.textContent === text);
  check('שלוש שאלות, הודעת מכשיר אחת', shown.length, 1);
}

// אשכול הכשל של 6.3 מונה "אין קול עברי" ו"הרשאת מיקום נדחתה" כשני
// מקרים. הכלל "פעם אחת לסשן" הוא לכל קוד ולא לסשן כולו: אילו היה
// לסשן, ההודעה השנייה הייתה נבלעת מפני שהראשונה כבר נאמרה.
{
  intercept = (envelope) => (envelope.module === 'BE-03'
    ? { ok: false, data: null, error: { code: 'E-LOCATION-NOT-ALLOWED', data: null } }
    : null);

  for (let i = 0; i < 2; i += 1) {
    dom.host.querySelector('input').type(`שאלה על מיקום ${i}`);
    byLabel('שאלה').click();
    await settle();
  }
  intercept = null;

  const voice = referenceFile.values.error_human_text['E-NO-HEBREW-VOICE'];
  const location = referenceFile.values.error_human_text['E-LOCATION-NOT-ALLOWED'];
  const shownOf = (text) => dom.host.querySelectorAll('.message')
    .filter((m) => m.textContent === text).length;

  check('הרשאת מיקום שנדחתה מוצגת', shownOf(location), 1);
  check('והודעת הקול לא נאמרה שוב', shownOf(voice), 1);
}

// --- נוהל הסוללה, לפי F-13 תיקון 1 ---

{
  const warn = referenceFile.values.battery_warn_percent;
  const block = referenceFile.values.battery_block_percent;
  const resume = referenceFile.values.battery_resume_percent;

  await screen.setBatteryLevel(warn);
  await settle();
  check('בסף ההתראה מוצגת התראה', dom.host.querySelectorAll('.message--warn').length, 1);
  check('ההתראה אינה חוסמת', Boolean(byLabel('שאלה')), true);

  // שורת ה-Unit של FE-05 במפה 6.1: סוללה של ארבעה אחוזים.
  await screen.setBatteryLevel(4);
  await settle();
  check('מתחת לסף החסימה המסך נחסם', dom.host.querySelectorAll('.notice-screen').length, 1);
  check('במסך החסימה אין אינטראקציה', buttons().length, 0);
  check('נקודת היציאה נשלפה', sent.at(-1).action, 'nearestExitPoint');
  // שלב 5: התבנית ממולאת בשלושת המשתנים (F-13 תיקון 1 סעיף 1). בלי
  // מיקום מהאוטומציה, המרחק והכיוון אינם ידועים ונאמרים ככאלה, ולא
  // מוצגים סוגריים למשפחה.
  const exitPoint = repository.listExitPoints()[0];
  const filledBlock = referenceFile.values.battery_block_text
    .split('[נקודת ציון]').join(exitPoint.name)
    .split('[מטרים]').join('לא ידוע')
    .split('[רוח השמיים]').join('לא ידוע');
  check('נוסח החסימה מגיע מהטבלה, ממולא', dom.host.textContent.includes(filledBlock), true);

  // חידוש רק מעל סף החידוש, ולא בעצם החזרה מעל סף החסימה.
  await screen.setBatteryLevel(block + 1);
  await settle();
  check('מעל סף החסימה ומתחת לחידוש, עדיין חסום', dom.host.querySelectorAll('.notice-screen').length, 1);

  await screen.setBatteryLevel(resume + 1);
  await settle();
  check('מעל סף החידוש המסך חוזר', Boolean(byLabel('שאלה')), true);
}

// --- סף חסר אינו מומצא ---

{
  const bare = installDom();
  const other = create({
    host: bare.host,
    from: caller,
    reference: { error_human_text: referenceFile.values.error_human_text, safety_opening_text: 'x' },
    send,
  });
  await other.setBatteryLevel(4);
  await settle();

  // הטענה היא ששם ההגדרה החסרה מוצג, ולא רק שמופיע איפשהו נוסח
  // של ערך חסר: משפט הפרטיות מייצר ממילא הודעה כזאת, ובלי שם
  // המפתח הבדיקה הייתה עוברת גם בלי ההגנה.
  check('שם ההגדרה החסרה מוצג', bare.host.textContent.includes('battery_warn_percent'), true);
  check('הסוללה לא חסמה בלי סף', bare.host.querySelectorAll('.notice-screen').length, 0);

  // התבנית מולאה מ-error.data, לפי הכרעת פער 8. ההופעה של שם
  // המפתח בתוך המשפט היא ההוכחה: בלי ההזרקה היו מוצגים סוגריים.
  const filled = referenceFile.values.error_human_text['E-REF-EMPTY']
    .replace('[שם ההגדרה]', 'battery_warn_percent');
  check('הנוסח מולא מ-error.data', bare.host.textContent.includes(filled), true);
}

// --- שער סגור עוצר את המסך כולו ---

{
  const closed = installDom();
  create({
    host: closed.host,
    from: caller,
    reference,
    send: async (envelope) => (envelope.action === 'get_gate'
      ? { ok: false, data: null, error: { code: 'E-GATE-CLOSED', data: null } }
      : realSend(envelope)),
  });
  await settle();
  closed.host.querySelectorAll('button').find((b) => b.textContent.trim() === 'התחלת הטיול').click();
  await settle();

  check('שער סגור מחליף את המסך כולו', closed.host.querySelectorAll('.notice-screen').length, 1);
  check('ואין בו מגע', closed.host.querySelectorAll('button').length, 0);
  check(
    'והנוסח לאדם מהטבלה',
    closed.host.textContent.includes(referenceFile.values.error_human_text['E-GATE-CLOSED']),
    true,
  );
}

// --- סיום הסשן ---

{
  byLabel('סיום הטיול').click();
  await settle();
  check('הסשן נסגר', sent.at(-1).action, 'session_end');
  check('המסך חוזר למצב שלפני היציאה', Boolean(byLabel('התחלת הטיול')), true);
}

// --- המסך מבצע את פעולותיו ואותן בלבד ---

check(
  'כל הפעולות הן מטבלת פעולות המסך',
  [...new Set(sent.map((e) => e.action))].sort(),
  ['ask', 'get_gate', 'log', 'nearestExitPoint', 'session_end', 'session_start'],
);

{
  const denied = await realSend({ from: caller, module: 'BE-05', action: 'approve', payload: {} });
  check('פעולה שאינה של המסך נדחית', denied.error.code, 'E-ALLOW-DENIED');
}

dom.restore();

// =====================================================================
// שלב 5, משימה 8: אוזניים, פה וסוללה
// =====================================================================

// המסך מקבל ציוד מדומה בצורת CONN-01 ו-CONN-02, ואת מה שההרכבה
// יודעת על המכשיר. המודולים האמיתיים נשארים מאחורי הכתובת האחת.
{
  const voiceCalls = [];
  const voiceListeners = new Map();
  let hebrewVoice = false;
  const voice = {
    speak: async (text) => {
      voiceCalls.push(['speak', text]);
      for (const fn of voiceListeners.get(hebrewVoice ? 'start' : 'unavailable') ?? []) fn({ text });
      return hebrewVoice
        ? { ok: true, data: { duration_ms: 1200, interrupted: false, chunks: 1 } }
        : { ok: false, error: { code: 'E-NO-HEBREW-VOICE', data: null } };
    },
    stop: () => { voiceCalls.push(['stop']); return { ok: true, data: { stopped: true } }; },
    on: (event, fn) => { if (!voiceListeners.has(event)) voiceListeners.set(event, new Set()); voiceListeners.get(event).add(fn); },
    hasVoice: () => hebrewVoice,
    voicesLoaded: async () => [],
  };

  let heard = { ok: true, data: { text: 'שאלה בקול' } };
  const microphone = {
    available: () => true,
    listen: async () => heard,
    stop: () => ({ ok: true, data: { stopped: false } }),
  };

  let position = null;
  const device = {
    flags: () => ['simulator'],
    position: () => position,
    direction: () => 'צפון מזרח',
    stop: () => 'stop-demo-a',
  };

  const events = [];
  const stage5Dom = installDom();
  const sent5 = [];
  const send5 = async (envelope) => { sent5.push(envelope); return realSend(envelope); };
  const withDevice = create({ host: stage5Dom.host, from: caller, reference, send: send5, voice, microphone, device });
  for (const name of ['session:start', 'session:end', 'battery:block', 'battery:resume']) {
    withDevice.on(name, (detail) => events.push([name, detail?.session?.session_id ?? detail?.session_id ?? null]));
  }
  const buttons5 = () => stage5Dom.host.querySelectorAll('button');
  const byLabel5 = (label) => buttons5().find((b) => b.textContent.trim() === label);

  // --- תחילת הסשן: הדגלים, משפט הבטיחות בקול, אירוע מחזור החיים ---

  byLabel5('התחלת הטיול').click();
  await settle();

  const started = sent5.find((e) => e.action === 'session_start');
  check('session_start נושא את דגלי המכשיר: סימולטור, ובלי קול עברי', started.payload.flags.sort(), ['no_hebrew_voice', 'simulator']);
  const session5 = repository.getSession(withDevice.state().session_id);
  check('הדגלים נרשמו בסשן', session5.flags.sort(), ['no_hebrew_voice', 'simulator']);
  check('משפט הבטיחות נאמר פעם אחת, לפני כל תוכן', voiceCalls[0], ['speak', referenceFile.values.safety_opening_text]);
  check('אירוע session:start יצא עם מזהה הסשן', events, [['session:start', session5.session_id]]);
  check('בלי קול עברי: ההודעה מוצגת פעם אחת', stage5Dom.host.querySelectorAll('.message')
    .filter((m) => m.textContent === referenceFile.values.error_human_text['E-NO-HEBREW-VOICE']).length, 1);
  check('ומה שהיה נאמר מוצג כטקסט', stage5Dom.host.textContent.includes(referenceFile.values.safety_opening_text), true);
  check('שני מגעים בהליכה, גם עם מיקרופון', buttons5().map((b) => b.textContent.trim()), ['שאלה', 'סיום הטיול']);

  // --- שאלה בקול: הכפתור בלי הקלדה פותח את המיקרופון ---

  byLabel5('שאלה').click();
  await settle();
  const askedByVoice = sent5.filter((e) => e.module === 'BE-03').at(-1);
  check('התמלול נשלח כשאלה, כמות שהוא', askedByVoice.payload.question, 'שאלה בקול');
  check('התחנה הנוכחית מגיעה מהאוטומציה דרך ההרכבה', askedByVoice.payload.stop_id, 'stop-demo-a');
  check('מה שדיבר נעצר לפני ההאזנה', voiceCalls.some((c) => c[0] === 'stop'), true);

  // --- קליטה שנכשלה: ניסיון שנכשל, לא יזימה ---

  const before = repository.listInteractions({ session_id: session5.session_id }).length;
  heard = { ok: false, error: { code: 'E-SPEECH-NOT-RECOGNIZED', data: {} } };
  byLabel5('שאלה').click();
  await settle();
  const rows5 = repository.listInteractions({ session_id: session5.session_id });
  check('שקט: נרשם attempt_failed ולא initiated', rows5.slice(before).map((r) => r.type), ['attempt_failed']);
  check('והנוסח לאדם מוצג', stage5Dom.host.textContent.includes(referenceFile.values.error_human_text['E-SPEECH-NOT-RECOGNIZED']), true);

  heard = { ok: false, aborted: true, error: null };
  byLabel5('שאלה').click();
  await settle();
  check('ביטול בידי המשפחה: לא נרשם דבר', repository.listInteractions({ session_id: session5.session_id }).length, rows5.length);

  // --- הודעה מהמכשיר אחרי ההתחלה, דרך ההרכבה ---

  withDevice.notify({ ok: false, error: { code: 'E-LOCATION-NOT-ALLOWED', data: null } });
  withDevice.notify({ ok: false, error: { code: 'E-LOCATION-NOT-ALLOWED', data: null } });
  check('הרשאת מיקום שנדחתה מוצגת פעם אחת', stage5Dom.host.querySelectorAll('.message')
    .filter((m) => m.textContent === referenceFile.values.error_human_text['E-LOCATION-NOT-ALLOWED']).length, 1);
  check('והדגל no_location נוסף', withDevice.state().flags.includes('no_location'), true);

  // --- הסוללה עם מיקום: התראה, חסימה עם מרחק וכיוון, חידוש ---

  position = { lat: 31.7811, lng: 35.2192 };
  await withDevice.setBatteryLevel(referenceFile.values.battery_warn_percent);
  await settle();
  check('ההתראה כוללת את נקודת היציאה, המרחק והכיוון', stage5Dom.host.querySelector('.message--warn').textContent.includes('צפון מזרח'), true);
  const exitAt = withDevice.state().exit;
  check('המרחק חושב ב-BE-05 מהמיקום שנשלח', Number.isFinite(Number(exitAt.distance)), true);

  hebrewVoice = true;
  voiceCalls.length = 0;
  await withDevice.setBatteryLevel(4);
  await settle();
  check('חסימה: אירוע battery:block יצא', events.at(-1), ['battery:block', session5.session_id]);
  check('הקול נעצר ואז הודעת החסימה נאמרה פעם אחת', voiceCalls.map((c) => c[0]), ['stop', 'speak']);
  const filled = referenceFile.values.battery_block_text
    .split('[נקודת ציון]').join(exitAt.name)
    .split('[מטרים]').join(exitAt.distance)
    .split('[רוח השמיים]').join('צפון מזרח');
  check('ההודעה ממולאת בשלושת המשתנים', voiceCalls[1][1], filled);
  check('והיא נשארת כטקסט סטטי', stage5Dom.host.textContent.includes(filled), true);

  await withDevice.setBatteryLevel(4);
  await settle();
  check('סוללה שנשארת נמוכה: אין הודעה שנייה', voiceCalls.length, 2);

  await withDevice.setBatteryLevel(referenceFile.values.battery_resume_percent + 1);
  await settle();
  check('חידוש: אירוע battery:resume יצא', events.at(-1), ['battery:resume', session5.session_id]);

  // --- סיום אחרי התראה: ended_on_battery, והקול נעצר ---

  await withDevice.setBatteryLevel(referenceFile.values.battery_warn_percent - 1);
  await settle();
  byLabel5('סיום הטיול').click();
  await settle();
  const ended = sent5.find((e) => e.action === 'session_end');
  // no_hebrew_voice נשאר: הוא נלמד בסשן הזה, גם אם הקול הופיע אחר כך.
  check('session_end נושא את הדגלים שנצברו, ובהם ended_on_battery ו-no_location',
    ended.payload.flags.sort(), ['ended_on_battery', 'no_hebrew_voice', 'no_location', 'simulator']);
  check('הסשן נסגר עם הדגלים', repository.getSession(session5.session_id).flags.sort(),
    ['ended_on_battery', 'no_hebrew_voice', 'no_location', 'simulator']);
  check('אירוע session:end יצא', events.at(-1), ['session:end', session5.session_id]);
  check('מגע אחד אחרי הסיום', buttons5().map((b) => b.textContent.trim()), ['התחלת הטיול']);
}

report(` (${sent.length} מעטפות)`);
