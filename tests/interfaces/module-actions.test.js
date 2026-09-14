// בדיקת ממשקים: רשימת המותר מול המודולים שנבנו. מפה 6.2, "רשימת
// המותר: כל צירוף מותר עובר, כל צירוף אחר נדחה", בזווית של סוף
// שלב 4: כל עשרים ושמונה השורות של 4.2 מגיעות למודול אמיתי.
//
// היא נגזרת מהנתונים ולא מרשימה שכתובה כאן: השורות נקראות מרשימת
// המותר, והמודולים מעמודת handler בטבלת המודולים. שורה שתתווסף
// לנתונים תיבדק כאן מעצמה, ומודול שיישבר יתגלה כאן ולא במסך.
//
//   node tests/interfaces/module-actions.test.js

import { createOrchestrator } from '../../core/orchestrator.js';
import { createRepository } from '../../repository/index.js';
import { createBrowserDriver } from '../../repository/driver-browser.js';
import { createEndpoint } from '../../screens/endpoint.js';
import { RESPONSE_FIELDS } from '../../core/contract.js';
import { ERROR_CODE_LIST } from '../../core/errors.js';
import { createChecker } from '../helpers/assert.js';
import { DEMO_SEED } from '../../tools/demo-modules.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };

import { create as createGovernance } from '../../services/governance.js';
import { create as createGate } from '../../services/gate.js';
import { create as createRetrieval } from '../../services/retrieval.js';
import { create as createDialogue } from '../../services/dialogue.js';
import { create as createDelivery } from '../../services/delivery.js';
import { create as createLog } from '../../services/log.js';

const { check, report } = createChecker('ממשקים: הפעולות מול רשימת המותר');

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

const repository = createRepository(createBrowserDriver({
  storage: memoryStorage(),
  seed: { modules: modulesFile, allow_list: allowFile, reference: referenceFile.values, ...DEMO_SEED },
}));

const callerOf = (id) => modulesFile.modules.find((row) => row.id === id).caller;

let orchestrator = null;
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });
const inject = (id) => ({ repository, send, caller: callerOf(id) });

orchestrator = createOrchestrator({
  repository,
  handlers: {
    'BE-05': createGovernance(inject('BE-05')),
    'BE-06': createGate(inject('BE-06')),
    'BE-04': createRetrieval(inject('BE-04')),
    'BE-03': createDialogue(inject('BE-03')),
    'FE-04': createDelivery(inject('FE-04')),
    'BE-07': createLog(inject('BE-07')),
  },
});

// שורות ההדגמה של tool-simulator ומודול הדמה יורדות בשלב 7, ואינן
// חלק מ-4.2. הבדיקה מפרידה ביניהן כדי שלא תסמוך עליהן.
const rows = allowFile.rows.filter((row) => row.is_demo !== true);
const demoRows = allowFile.rows.filter((row) => row.is_demo === true);

check('רשימת המותר נושאת את שורות 4.2', rows.length, 44);
check('ושלוש שורות הדגמה שיורדות בשלב 7', demoRows.length, 3);

// סשן פתוח, כדי ששורות ה-log לא ייפלו על E-SESSION-CLOSED לפני
// שהגיעו למודול. זו הכנת תרחיש, ולא חלק מהטענה.
const opened = await send({
  from: 'screen-traveler', module: 'BE-07', action: 'session_start', payload: { site_id: 'site-demo-jaffa' },
});
const sessionId = opened.data.session.session_id;

// payload סביר לכל פעולה, כדי שהתשובה תהיה של המודול ולא של
// מעטפה חסרה. הטענה אינה על הצלחה עסקית אלא על צורת התשובה.
const PAYLOADS = {
  submit: { item_id: 'item-demo-6' },
  approve: { item_id: 'item-demo-3' },
  reject: { item_id: 'item-demo-7' },
  return: { item_id: 'item-demo-1' },
  create_item: {
    site_id: 'site-demo-jaffa', stop_id: 'stop-demo-a', text: 'טקסט', page: 1,
    source_id: 'src-demo-1', lat: 31.781, lng: 35.219,
  },
  edit_item: { item_id: 'item-demo-6', text: 'טקסט אחר' },
  verify_anchor: { item_id: 'item-demo-8' },
  register_exit_point: { site_id: 'site-demo-jaffa', name: 'נקודה', lat: 31.781, lng: 35.219 },
  register_source: { name: 'מקור' },
  register_institute: { name: 'מכון' },
  register_mou: {
    institute_id: 'inst-demo-1', scope: ['src-demo-1'],
    signed_at: '2026-09-01T00:00:00.000Z', valid_until: '2099-01-01T00:00:00.000Z',
  },
  lock_site: { site_id: 'site-demo-jaffa' },
  listApprovedByStop: { site_id: 'site-demo-jaffa', stop_id: 'stop-demo-a' },
  nearestExitPoint: { site_id: 'site-demo-jaffa', lat: 31.781, lng: 35.219 },
  listItems: { site_id: 'site-demo-jaffa' },
  getItem: { item_id: 'item-demo-1' },
  listApprovals: {},
  getSite: { site_id: 'site-demo-jaffa' },
  listSources: { site_id: 'site-demo-jaffa' },
  listInstitutes: {},
  listMou: {},
  listExitPoints: { site_id: 'site-demo-jaffa' },
  get_gate: { site_id: 'site-demo-jaffa' },
  get_lock_readiness: { site_id: 'site-demo-jaffa' },
  set_enforce: { enforce: false },
  retrieve: { question: 'שאלה', site_id: 'site-demo-jaffa' },
  ask: { question: 'שאלה', site_id: 'site-demo-jaffa', session_id: sessionId },
  arrive: { session_id: sessionId, site_id: 'site-demo-jaffa', stop_id: 'stop-demo-a' },
  leave: { session_id: sessionId, site_id: 'site-demo-jaffa', stop_id: 'stop-demo-a' },
  release: { session_id: sessionId },
  session_start: { site_id: 'site-demo-jaffa' },
  session_end: { session_id: sessionId },
  log: { session_id: sessionId, type: 'pushed', stop_id: 'stop-demo-a' },
  close_stale: { site_id: 'site-demo-jaffa' },
  compute_metrics: { site_id: 'site-demo-jaffa' },
  export: { site_id: 'site-demo-jaffa' },
};

check('לכל פעולה ברשימה יש payload בבדיקה',
  rows.filter((row) => PAYLOADS[row.action] === undefined).map((row) => row.action), []);

// --- כל צירוף מותר עובר, ואף אחד אינו "לא נבנה" ---

const shapes = [];
const unbuilt = [];
const unknownCodes = [];

for (const row of rows) {
  // session_end ו-close_stale סוגרים את הסשן, ולכן הם נבדקים אחרונים.
  if (row.action === 'session_end' || row.action === 'close_stale') continue;

  const response = await send({ from: row.from, module: row.module, action: row.action, payload: PAYLOADS[row.action] });
  const keys = Object.keys(response).sort();
  const valid = keys.every((key) => RESPONSE_FIELDS.includes(key)) && typeof response.ok === 'boolean';

  if (!valid) shapes.push(`${row.from} ${row.module} ${row.action}: ${keys.join()}`);
  if (response.error?.code === 'E-MODULE-FAILED') unbuilt.push(`${row.module} ${row.action}`);
  if (response.ok === false && !ERROR_CODE_LIST.includes(response.error?.code)) {
    unknownCodes.push(`${row.module} ${row.action}: ${response.error?.code}`);
  }
}

check('כל צירוף מותר מחזיר מעטפת תשובה', shapes, []);
check('**אף פעולה אינה חוזרת כ-E-MODULE-FAILED**: כל מודולי 4.2 נבנו', unbuilt, []);
check('ואף קוד שגיאה אינו מחוץ לרשימה הסגורה', unknownCodes, []);

// שתי הפעולות שסוגרות, בסוף.
{
  const ended = await send({ from: 'screen-traveler', module: 'BE-07', action: 'session_end', payload: { session_id: sessionId } });
  check('session_end מחזיר מעטפה', ended.ok, true);

  const stale = await send({ from: 'system-timer', module: 'BE-07', action: 'close_stale', payload: {} });
  check('close_stale מחזיר מעטפה', stale.ok, true);
}

// --- וכל צירוף אחר נדחה ---

{
  // מכפלה של כל הפונים בכל הפעולות, פחות מה שברשימה. הדגימה היא
  // של הצירופים שאינם שם, וכולם חייבים ליפול באותו קוד.
  const callers = [...new Set(allowFile.rows.map((row) => row.from))];
  const actions = [...new Set(rows.map((row) => `${row.module}:${row.action}`))];
  const allowed = new Set(allowFile.rows.map((row) => `${row.from}|${row.module}|${row.action}`));

  const wrong = [];
  for (const from of callers) {
    for (const pair of actions) {
      const [module, action] = pair.split(':');
      if (allowed.has(`${from}|${module}|${action}`)) continue;
      const response = await send({ from, module, action, payload: PAYLOADS[action] ?? {} });
      if (response.error?.code !== 'E-ALLOW-DENIED') {
        wrong.push(`${from} ${module} ${action}: ${response.error?.code ?? 'עבר'}`);
      }
    }
  }

  check('כל צירוף שאינו ברשימה נדחה ב-E-ALLOW-DENIED', wrong, []);
  check('ונבדקו יותר משלוש מאות צירופים', callers.length * actions.length > 300, true);
}

// --- ולכל בקשה שתי שורות ביומן ---

{
  const audit = repository.listAudit();
  const ids = [...new Set(audit.map((row) => row.request_id))];
  check('לכל בקשה שתי שורות עם אותו מזהה',
    ids.every((id) => audit.filter((row) => row.request_id === id).length === 2), true);
  check('והיומן אינו ריק', ids.length > 300, true);
}

report(` (${rows.length} שורות מותרות)`);
