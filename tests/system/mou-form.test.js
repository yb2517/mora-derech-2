// System: טופס ההסכם על מסך הניהול, מול BE-05 האמיתי. משימה 8
// בתוכנית שלב 3.
//
// המקור: usecase-f-07 צעדים 12 ו-13, ומסמך הבנייה סעיף 6, שלב 3:
// "רושמים הסכם: השער נפתח על המסך".
//
// **למה הקובץ הזה נולד**: הרצה בדפדפן אחרי משימה 8 הראתה שטופס
// ההסכם שולח, מקבל E-ITEM-INCOMPLETE עם שם השדה, ואינו מציג דבר:
// באנר השגיאה מדלג על הקוד הזה בכוונה, מפני שבטופס הפריט הוא מוצג
// על השדה, ולטופס ההסכם לא הייתה סימון כזה. התיקון היה מעטפת שדה
// משותפת, והבדיקה הזאת שומרת עליו.
//
// שאר מסך הניהול נבדק ב-admin-screen.test.js מול ההדגמה. כאן BE-05
// אמיתי, מפני שההדגמה מאשרת קבלה ואינה יכולה לדחות שדה חסר.
//
//   node tests/system/mou-form.test.js

import { installDom } from '../helpers/dom.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('System: טופס ההסכם');

const dom = installDom();

const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { default: demoHandler, DEMO_MODULE_IDS } = await import('../../tools/demo-modules.js');
const { create: createGovernance, ACTIONS } = await import('../../services/governance.js');
const { create } = await import('../../screens/admin/index.js');

const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
const referenceFile = (await import('../../data/reference.json', { with: { type: 'json' } })).default;

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

const repository = createRepository(createBrowserDriver({
  storage: memoryStorage(),
  seed: {
    modules: modulesFile,
    allow_list: allowFile,
    reference: referenceFile.values,
    sites: [{ site_id: 's-1', name: 'מסלול', status: 'open', stops: ['st-1'] }],
    sources: [{ source_id: 'src-1', name: 'מקור ראשון' }, { source_id: 'src-2', name: 'מקור שני' }],
    institutes: [{ institute_id: 'inst-1', name: 'מכון הבדיקה' }],
    content_items: [],
    approvals: [],
    rights_mou: [],
    geo_anchors: [],
  },
}));

// אותה החזרה לפי פעולה שנקודת הכניסה עושה: BE-05 אמיתי לפעולות
// שנבנו, וההדגמה לשאר.
const governance = createGovernance({ repository });
const covered = new Set(ACTIONS);
const handlers = {};
for (const id of DEMO_MODULE_IDS) handlers[id] = demoHandler;
handlers['BE-05'] = (request) => (covered.has(request.action) ? governance(request) : demoHandler(request));

const orchestrator = createOrchestrator({ repository, handlers });
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

const callerOf = (id) => modulesFile.modules.find((m) => m.id === id).caller;

create({
  host: dom.host,
  from: { 'FE-07': callerOf('FE-07'), 'FE-08': callerOf('FE-08') },
  reference: { error_human_text: referenceFile.values.error_human_text },
  send,
});

const settle = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => { setTimeout(resolve, 0); });
};
await settle();

const buttons = () => dom.host.querySelectorAll('button');
const byLabel = (label) => buttons().find((b) => b.textContent.trim() === label);
const invalidFields = () => dom.host.querySelectorAll('.field--invalid');

// מעבר לתפקיד בעלת הפרויקט, שהוא הפונה המורשה ל-register_mou.
byLabel('בעלת הפרויקט').click();
await settle();

check('טופס ההסכם מוצג', Boolean(dom.host.querySelector('#mou-institute')), true);
check('ואין עדיין הסכם רשום', repository.listMou().length, 0);

// --- טופס ריק: השדה החסר מסומן, ולא נשלח דבר לרשומות ---

byLabel('רישום הסכם').click();
await settle();

check('שדה אחד מסומן כחסר', invalidFields().length, 1);
check(
  'והוא המכון, בנוסח לאדם ולא בקוד',
  invalidFields()[0].textContent.includes('institute_id'),
  true,
);
check('ולא נרשם הסכם', repository.listMou().length, 0);

// --- מילוי שדה אחר שדה: החיווי עובר לשדה הבא ---

dom.host.querySelector('#mou-institute').type('inst-1');
byLabel('רישום הסכם').click();
await settle();
check('אחרי המכון, ההיקף מסומן', invalidFields()[0].textContent.includes('scope'), true);

const box = dom.host.querySelectorAll('input')[0];
box.checked = true;
box.dispatch('change');
byLabel('רישום הסכם').click();
await settle();
check('אחרי ההיקף, התוקף מסומן', invalidFields()[0].textContent.includes('valid_until'), true);
check('ועדיין לא נרשם הסכם', repository.listMou().length, 0);

// --- טופס מלא: הרשומה נכתבת ---

dom.host.querySelector('#mou-valid').type('2028-01-01');
byLabel('רישום הסכם').click();
await settle();

check('אין שדה מסומן', invalidFields().length, 0);
check('ההסכם נרשם', repository.listMou().length, 1);

const mou = repository.listMou()[0];
check('עם המכון שנבחר', mou.institute_id, 'inst-1');
check('עם ההיקף שסומן', mou.scope, ['src-1']);
check('עם התוקף שהוקלד', mou.valid_until, '2028-01-01');
check('ותאריך החתימה נרשם', typeof mou.signed_at, 'string');
check('רישום הסכם אינו יוצר רשומת APPROVALS', repository.listApprovals().length, 0);

report();
