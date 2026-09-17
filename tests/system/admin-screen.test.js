// System: מסך הניהול המאוחד על נתוני הדגמה. משימה 7 בתוכנית שלב 2.
//
// הבדיקה הזאת נשארת על מודול ההדגמה גם בשלב 3, ובכוונה: מה שהיא
// בודקת הוא מבנה המסך והגבול בין שני הפונים, ורוב פעולות ה-role של
// צוות התוכן (create_item, verify_anchor, listExitPoints) שייכות
// ל-F-08 ונבנות בשלב 4. ה-Slice האמיתי של F-07 דרך המודולים
// נבדק ב-tests/system/f-07-slice.test.js.
//
// המקור: מפה 6.3, מפה 4.4, ההכרעה מ-12.09 (מסך ניהול אחד עם role,
// ורשימת המותר ממשיכה להבחין לפי from), doc-build-03-interfaces
// סעיפים 2.3 ו-2.4, ו-F-08, F-07, F-09.
//
// הטענה המרכזית כאן: האיחוד הוא בתחזוקה ולא בהרשאות. מסך אחד, שני
// פונים, וגבול שנאכף בנתונים ולא בנימוס.
//
//   node tests/system/admin-screen.test.js

import { installDom } from '../helpers/dom.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('System: מסך הניהול');

const dom = installDom();

const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { FIXTURE_SEED } = await import('../helpers/fixtures.js');
const { create } = await import('../../screens/admin/index.js');
const { create: createGovernance } = await import('../../services/governance.js');
const { create: createGate } = await import('../../services/gate.js');
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
    ...FIXTURE_SEED,
  },
}));

// **משימה 11 של שלב 4, וחוב טכני 11 של דוח שלב 3**: עד כה הבדיקה
// הזאת הורכבה מול מודול ההדגמה, מפני ש-role של צוות התוכן נשען על
// פעולות F-08 שלא היו קיימות. מודול ההדגמה אינו מופיע כאן יותר.
const handlers = {
  'BE-05': createGovernance({ repository }),
  'BE-06': createGate({ repository }),
  'BE-07': createLog({ repository }),
};

const orchestrator = createOrchestrator({ repository, handlers });
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

const callerOf = (id) => modulesFile.modules.find((m) => m.id === id).caller;
const CONTENT = callerOf('FE-07');
const OWNER = callerOf('FE-08');

const sent = [];
const screen = create({
  host: dom.host,
  from: { 'FE-07': CONTENT, 'FE-08': OWNER },
  reference: { error_human_text: referenceFile.values.error_human_text },
  send: async (envelope) => {
    sent.push(envelope);
    return send(envelope);
  },
});

const settle = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => { setTimeout(resolve, 0); });
};
await settle();

const buttons = () => dom.host.querySelectorAll('button');
const byLabel = (label) => buttons().find((b) => b.textContent.trim() === label);
const headings = () => dom.host.querySelectorAll('.panel__head h2').map((h) => h.textContent);

// --- role של צוות התוכן ---

check('נפתח ב-role של צוות התוכן', Boolean(byLabel('צוות התוכן')?.disabled), true);
check('כל בקשה יצאה בשם הפונה של צוות התוכן', [...new Set(sent.map((e) => e.from))], [CONTENT]);

check(
  'המסך מציג את מה ש-2.3 מחייב',
  headings(),
  ['פריטי המסלול', 'פריט חדש', 'העוגן', 'המקורות', 'נקודות היציאה'],
);

check('רשימת הפריטים נטענה', dom.host.querySelectorAll('.list__head').length, 8);

// שדה התחנה מתמלא מרשימת התחנות של המסלול, ושדה המקור מרשימת
// המקורות. שניהם מגיעים מקריאה ולא מקוד.
{
  const selects = dom.host.querySelectorAll('select');
  check('שני שדות נבחרים מתוך רשימה', selects.length, 2);
  check('התחנות מגיעות מהמסלול', selects[0].querySelectorAll('option').length, 3);
  check('המקורות מגיעים מהרשימה', selects[1].querySelectorAll('option').length, 1);
}

// --- הגבול נאכף בנתונים ---

{
  // lock_site שייך לבעלת הפרויקט. אותה פעולה, בשם הפונה של צוות
  // התוכן, נדחית. זו בדיוק בדיקת הקבלה של משימה 7.
  const denied = await send({ from: CONTENT, module: 'BE-05', action: 'lock_site', payload: {} });
  check('lock_site בשם צוות התוכן נדחה', denied.error.code, 'E-ALLOW-DENIED');

  // אותה פעולה בשם בעלת הפרויקט עוברת את רשימת המותר. מה שקורה
  // אחריה הוא עניין עסקי: על נתוני ההדגמה הנעילה נדחית ב-L1 עד L3,
  // וזו התשובה הנכונה. מה שנבדק כאן הוא הגבול, ולא התוצאה.
  const allowed = await send({ from: OWNER, module: 'BE-05', action: 'lock_site', payload: {} });
  check('ובשם בעלת הפרויקט אינו נדחה ברשימת המותר',
    allowed.error?.code === 'E-ALLOW-DENIED', false);
  check('והסירוב הוא עסקי ומנומק', allowed.error.code, 'E-LOCK-REFUSED');
  check('עם התנאים שנכשלו', allowed.error.data.failed, ['L1', 'L2', 'L3']);

  // ולהפך: יצירת פריט שייכת לצוות התוכן.
  const deniedOwner = await send({ from: OWNER, module: 'BE-05', action: 'create_item', payload: {} });
  check('create_item בשם בעלת הפרויקט נדחה', deniedOwner.error.code, 'E-ALLOW-DENIED');
}

// --- יצירת פריט, ושדה חסר ---

{
  const before = sent.length;
  dom.host.querySelectorAll('input')[0].type('פריט חדש לבדיקה');
  byLabel('יצירת פריט').click();
  await settle();

  const envelope = sent[before];
  check('היצירה נשלחה', `${envelope.module}:${envelope.action}`, 'BE-05:create_item');
  check('בשם צוות התוכן', envelope.from, CONTENT);
  check('עם המסלול במעטפה', typeof envelope.payload.site_id, 'string');
  check('ומה שהוקלד', envelope.payload.name, 'פריט חדש לבדיקה');
}

// --- פתיחת פריט: העוגן, והאזהרה על עריכת פריט מאושר ---

{
  const approved = dom.host.querySelectorAll('.list__head')
    .find((row) => row.textContent.includes('פתיחת המסלול'));
  approved.click();
  await settle();

  check('העוגן מוצג', dom.host.textContent.includes('אומת בשטח'), true);
  check(
    'עריכת פריט מאושר מזהירה שהוא יחזור לטיוטה',
    dom.host.querySelectorAll('.message--warn').length,
    1,
  );

  const before = sent.length;
  byLabel('אומת בשטח').click();
  await settle();
  check('אימות העוגן נשלח', sent[before].action, 'verify_anchor');
}

// --- מעבר ל-role של בעלת הפרויקט ---

await screen.switchRole('owner');
await settle();

check(
  'המסך מציג את מה ש-2.4 מחייב',
  headings(),
  ['מכונים והסכמים', 'רישום הסכם', 'מוכנות לנעילה', 'המדדים'],
);

{
  const afterSwitch = sent.filter((e) => e.from === OWNER);
  check('הבקשות אחרי המעבר יצאו בשם בעלת הפרויקט', afterSwitch.length > 0, true);
  check(
    'ובהן טבלת המוכנות והמדדים',
    afterSwitch.map((e) => e.action).filter((a) => ['get_lock_readiness', 'compute_metrics'].includes(a)).sort(),
    ['compute_metrics', 'get_lock_readiness'],
  );
}

check('טבלת המוכנות מציגה ארבעה תנאים', dom.host.querySelectorAll('.table tr').length >= 4, true);
check('תנאי שנכשל מוצג ככזה', dom.host.textContent.includes('לא עובר'), true);
check('התחנה שמכשילה מוצגת בשמה', dom.host.textContent.includes('stop-demo-c'), true);

// 2.4: הכרעת Go או No-Go אינה במערכת. המסך מציג ואינו נועל שער A.
check(
  'המסך מצהיר שההכרעה אינה במערכת',
  dom.host.textContent.includes('הכרעת המעבר אינה במערכת'),
  true,
);

// --- הנעילה אינה משכפלת את תנאי הנעילה ---

{
  // כפתור הנעילה פעיל גם כשהטבלה מראה כשל: BL-06 נאכף ב-BE-05,
  // והמסך אינו מחזיק עותק שני של הכלל.
  const lock = byLabel('נעילת המסלול');
  check('כפתור הנעילה אינו מנוטרל לפי הטבלה', lock.disabled, false);

  const before = sent.length;
  lock.click();
  await settle();
  check('הנעילה נשלחה בשם בעלת הפרויקט', sent[before].from, OWNER);
  check('והיא lock_site', sent[before].action, 'lock_site');
}

// --- הייצוא ---

{
  const before = sent.length;
  byLabel('ייצוא').click();
  await settle();
  check('הייצוא נשלח', `${sent[before].module}:${sent[before].action}`, 'BE-07:export');
}

// --- המסך מבצע את פעולותיו ואותן בלבד ---

{
  const CONTENT_ACTIONS = ['create_item', 'edit_item', 'verify_anchor', 'register_source',
    'register_exit_point', 'listItems', 'getItem', 'getSite', 'listSources', 'listExitPoints'];
  const OWNER_ACTIONS = ['register_mou', 'register_institute', 'set_enforce', 'get_lock_readiness',
    'lock_site', 'compute_metrics', 'export', 'getSite', 'listSources', 'listInstitutes', 'listMou'];
  // get_gate פתוח לשלושת המסכים לפי 4.2, ושניהם נשענים עליו לזהות
  // את המסלול.
  const SHARED = ['get_gate'];

  check(
    'בשם צוות התוכן נשלחו רק פעולות של screen-content',
    [...new Set(sent.filter((e) => e.from === CONTENT).map((e) => e.action))]
      .filter((a) => !CONTENT_ACTIONS.includes(a) && !SHARED.includes(a)),
    [],
  );

  check(
    'בשם בעלת הפרויקט נשלחו רק פעולות של screen-owner',
    [...new Set(sent.filter((e) => e.from === OWNER).map((e) => e.action))]
      .filter((a) => !OWNER_ACTIONS.includes(a) && !SHARED.includes(a)),
    [],
  );

  check('שני הפונים אכן שימשו', [...new Set(sent.map((e) => e.from))].sort(), [CONTENT, OWNER].sort());
}

// --- שם הפונה אינו כתוב בקוד המסך ---

{
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const source = readFileSync(fileURLToPath(new URL('../../screens/admin/index.js', import.meta.url)), 'utf8');
  check('שם הפונה אינו מופיע בקוד המסך', [CONTENT, OWNER].filter((c) => source.includes(c)), []);
}

// --- כל בקשה מותירה שתי שורות תחת מזהה אחד ---

{
  const all = repository.listAudit();
  const ids = [...new Set(all.map((row) => row.request_id))];
  check('לכל בקשה שתי שורות', ids.every((id) => all.filter((r) => r.request_id === id).length === 2), true);
}

dom.restore();
report(` (${sent.length} מעטפות, שני פונים)`);
