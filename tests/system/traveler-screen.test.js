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
const { default: demoHandler, DEMO_MODULE_IDS } = await import('../../tools/demo-modules.js');
const { create } = await import('../../screens/traveler/index.js');

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
  seed: { modules: modulesFile, allow_list: allowFile, reference: referenceFile.values },
}));

const handlers = {};
for (const id of DEMO_MODULE_IDS) handlers[id] = demoHandler;

const orchestrator = createOrchestrator({ repository, handlers });
const realSend = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

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
check('כל בקשה יצאה בשם הפונה של המסך', [...new Set(sent.map((e) => e.from))], [caller]);

// UX-01 בהליכה: סיום הסשן, ועוד כפתור השאלה כהפרה המתועדת.
check('שני מגעים בהליכה', buttons().map((b) => b.textContent.trim()), ['שאלה', 'סיום הטיול']);

// --- שאלה ותשובה ---

{
  dom.host.querySelector('input').type('מה קרה כאן');
  byLabel('שאלה').click();
  await settle();

  check('השאלה נשלחה למודול השיחה', sent.at(-1).module, 'BE-03');
  check('השאלה נשלחה כמות שהיא', sent.at(-1).payload.question, 'מה קרה כאן');
  check('התשובה מוצגת בכתב', dom.host.querySelectorAll('.quote').length, 1);
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
  check(
    'נוסח החסימה מגיע מהטבלה',
    dom.host.textContent.includes(referenceFile.values.battery_block_text),
    true,
  );

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
report(` (${sent.length} מעטפות)`);
