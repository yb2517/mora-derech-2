// System: ההליכה המלאה בסימולטור, 12 תחנות. משימה 10 בתוכנית שלב 5.
//
// המקור: מפה 6.3 (אשכול הנורמה: "הליכה מלאה בסימולטור, 12 תחנות,
// ארבע שאלות, נעילה קודמת"; קצה: "תחנה 11 עם pending", "עוגן חצייה
// שהמשפחה עוצרת בו"), CLAUDE.md סעיף 6 שורת שלב 5 ("12 arrive, כל
// שורה עם דגל simulator. דגימה בדיוק 80 מטר: אין אירוע"), BL-15,
// BL-16, BL-19, והכרעה 13 (המסלול נזרע בבדיקה, מסומן).
//
// זו הבדיקה שמחברת את מה שהשלב בנה: הסימולטור מוציא דגימה, AUTO-01
// האמיתי מחליט לפי BL-15 ושולח arrive במעטפה, FE-04 מוסר דרך מנוע
// הקול המדומה ודורך את AUTO-02 האמיתי, AUTO-02 שולח release במעטפה,
// BE-07 רושם, ובסוף המדדים גורעים את הסשן מפני שהוא של סימולטור.
//
// **המסלול סינתטי ומסומן**: 12 תחנות בקו, כמאה מטר זו מזו. נתוני
// ההדגמה אינם משתנים (פער B-38, הכרעה 13).
//
//   node tests/system/f-01-f-03-simulator-walk.test.js

import { createChecker } from '../helpers/assert.js';
import { fakeSchedule, flush } from '../helpers/device.js';

const { check, report } = createChecker('System: ההליכה המלאה בסימולטור');

const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { create: createGovernance } = await import('../../services/governance.js');
const { create: createGate } = await import('../../services/gate.js');
const { create: createRetrieval } = await import('../../services/retrieval.js');
const { create: createDialogue } = await import('../../services/dialogue.js');
const { create: createDelivery } = await import('../../services/delivery.js');
const { create: createLog } = await import('../../services/log.js');
const { create: createGeofence } = await import('../../automation/geofence.js');
const { create: createTimer } = await import('../../automation/timer.js');
const { create: createSimulator } = await import('../../tools/simulator.js');

const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
const referenceFile = (await import('../../data/reference.json', { with: { type: 'json' } })).default;

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

// --- המסלול הסינתטי: 12 תחנות בקו, כמאה מטר זו מזו ---

const STOPS = 12;
const CROSSING_STOP = 6;
const PENDING_STOP = 11;
const BASE = { lat: 31.7811, lng: 35.2192 };
const STEP_DEGREES = 0.0009;

const stopId = (n) => `stop-${String(n).padStart(2, '0')}`;
const at = (n) => ({ lat: BASE.lat + (n - 1) * STEP_DEGREES, lng: BASE.lng });

const items = [];
const anchors = [];
for (let n = 1; n <= STOPS; n += 1) {
  const id = `item-${n}`;
  items.push({
    item_id: id, site_id: 'site-sim', stop_id: stopId(n), name: `נקודה ${n}`,
    text: `זו הנקודה מספר ${n} במסלול המדומה. כאן עומד בניין ${n} עם סיפור משלו.`,
    source_id: 'src-sim', page: n, word_count: 14, audience: 'כולם',
    status: n === PENDING_STOP ? 'pending' : 'approved',
  });
  anchors.push({
    anchor_id: `anchor-${n}`, item_id: id, ...at(n),
    verified: true, verified_at: '2026-09-10T00:00:00.000Z', is_crossing: n === CROSSING_STOP,
  });
}

const seed = {
  modules: modulesFile,
  allow_list: allowFile,
  reference: referenceFile.values,
  sites: [{
    site_id: 'site-sim', name: 'מסלול מדומה', stops: Array.from({ length: STOPS }, (_, i) => stopId(i + 1)),
    status: 'locked', locked_at: '2026-09-10T00:00:00.000Z', corpus_version: 1,
    bounds: { min_lat: 31.77, max_lat: 31.80, min_lng: 35.20, max_lng: 35.23 },
  }],
  sources: [{ source_id: 'src-sim', name: 'מקור מדומה' }],
  institutes: [{ institute_id: 'inst-sim', name: 'מכון מדומה' }],
  rights_mou: [{
    mou_id: 'mou-sim', institute_id: 'inst-sim', scope: ['src-sim'],
    signed_at: '2026-09-01T00:00:00.000Z', valid_until: '2099-01-01T00:00:00.000Z', covers_content_contribution: true,
  }],
  content_items: items,
  geo_anchors: anchors,
  exit_points: [{ exit_id: 'exit-sim', site_id: 'site-sim', ...at(STOPS + 2), name: 'יציאה', type: 'תחבורה' }],
  sessions: [],
  interactions: [],
};

const repository = createRepository(createBrowserDriver({ storage: memoryStorage(), seed }));

// שעון אחד לכולם: המינון של FE-04, הטיימר של AUTO-02 והחותמות.
const schedule = fakeSchedule(Date.UTC(2026, 8, 15, 8, 0, 0));
const clock = () => schedule.now();
const stamp = () => new Date(clock()).toISOString();

const callerOf = (id) => modulesFile.modules.find((row) => row.id === id).caller;

// מנוע הקול המדומה: כל השמעה נמשכת שלוש שניות בשעון המוזרק.
const spoken = [];
const voice = {
  speak: async (text) => {
    spoken.push(text);
    return { ok: true, data: { duration_ms: 3000, interrupted: false, chunks: 1 } };
  },
  stop: () => ({ ok: true, data: { stopped: false } }),
  on: () => () => {},
  hasVoice: () => true,
};

let orchestrator = null;
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

const timer = createTimer({ repository, send, caller: callerOf('AUTO-02'), schedule });
const simulator = createSimulator({ clock });
const geofence = createGeofence({ repository, send, caller: callerOf('AUTO-01'), location: simulator, clock });

orchestrator = createOrchestrator({
  repository,
  handlers: {
    'BE-05': createGovernance({ repository, now: stamp }),
    'BE-06': createGate({ repository }),
    'BE-04': createRetrieval({ repository, send, caller: callerOf('BE-04'), now: stamp }),
    'BE-03': createDialogue({ repository, send, caller: callerOf('BE-03'), now: stamp, voice }),
    'FE-04': createDelivery({ repository, send, caller: callerOf('FE-04'), clock, now: stamp, voice, timer }),
    'BE-07': createLog({ repository, now: stamp }),
  },
  now: stamp,
});

const rows = (type) => repository.listInteractions({ session_id, type });
const settle = async () => { await geofence.settled(); await timer.settled(); await flush(); };

// --- הסשן: דגל simulator מהמסך (usecase-f-09 צעד 1) ---

const opened = await send({
  from: callerOf('FE-05'), module: 'BE-07', action: 'session_start',
  payload: { site_id: 'site-sim', flags: [simulator.flag] },
});
check('הסשן נפתח עם דגל הסימולטור', opened.data.session.flags, ['simulator']);
const session_id = opened.data.session.session_id;

const started = await geofence.start({ session_id, site_id: 'site-sim' });
check('AUTO-01 קרא 12 עוגנים ונקודת יציאה אחת במעטפה', [started.data.anchors, started.data.exit_points], [12, 1]);
simulator.load(anchors.map((anchor, i) => ({ stop_id: stopId(i + 1), lat: anchor.lat, lng: anchor.lng })));

// --- דגימה בדיוק 80 מטר: אין אירוע (CLAUDE.md סעיף 6) ---

simulator.arriveAt(0, { accuracy_m: 80 });
await settle();
check('דגימה בדיוק 80 מטר על התחנה הראשונה: אין arrive', geofence.events().length, 0);
check('ואין שורת יומן', repository.listInteractions({ session_id }).length, 0);
check('הדגימה נספרה כדחויה', geofence.current().rejected, 1);

// --- ההליכה: 12 תחנות, בסדר, עם יציאה מכל אחת ---

for (let n = 1; n <= STOPS; n += 1) {
  simulator.arriveAt(n - 1);
  await settle();

  if (n === CROSSING_STOP) {
    // BL-19: בתחנת החצייה שותקים עד היציאה.
    check(`תחנה ${n} היא חצייה: אין מסירה בזמן השהייה ברדיוס`, rows('pushed').length, n - 1);
    await schedule.advance(60);
    await settle();
    check(`תחנה ${n}: גם אחרי דקה בצומת אין מסירה, השחרור לפי מיקום`, rows('pushed').length, n - 1);
  }

  // ההליכה הלאה. מרווח המינון עובר בדרך, ולכן התחנה הבאה נמסרת מיד.
  await schedule.advance(25);
  simulator.walkOn();
  await settle();

  if (n === CROSSING_STOP) {
    check(`תחנה ${n}: היציאה מהצומת משחררת את הפריט`, rows('pushed').length, n);
  }
  if (n === PENDING_STOP) {
    check(`תחנה ${n} עם פריט pending בלבד: שתיקה ושורת arrived_no_content`,
      [rows('arrived_no_content').length, rows('pushed').length], [1, n - 1]);
  }
}

// --- בדיקת הקבלה של השלב ---

const audit = repository.listAudit();
const arrives = audit.filter((row) => row.action === 'arrive' && row.phase === 'request');
const leaves = audit.filter((row) => row.action === 'leave' && row.phase === 'request');

check('**12 arrive ב-audit_log, כולן מ-module-geofence**',
  [arrives.length, [...new Set(arrives.map((row) => row.from))]], [12, [callerOf('AUTO-01')]]);
check('ו-12 leave', leaves.length, 12);
check('כל arrive נושא request_id', arrives.every((row) => typeof row.request_id === 'string' && row.request_id !== ''), true);

const interactions = repository.listInteractions({ session_id });
check('12 שורות INTERACTIONS: 11 pushed ואחת arrived_no_content',
  [rows('pushed').length, rows('arrived_no_content').length], [11, 1]);
check('כל השורות בסשן שנושא את הדגל simulator',
  interactions.every((row) => row.session_id === session_id) && repository.getSession(session_id).flags.includes('simulator'), true);
check('כל פריט מאושר נמסר פעם אחת בדיוק, בסדר התחנות',
  rows('pushed').map((row) => row.item_id),
  items.filter((item) => item.status === 'approved').map((item) => item.item_id));
check('הפריטים נשמעו דרך מנוע הקול, כפי שאושרו', spoken.length >= 11 && spoken.includes(items[0].text), true);
check('שורת pushed נושאת את משך ההשמעה ואת דיוק המיקום', [rows('pushed')[0].duration_ms, rows('pushed')[0].accuracy], [3000, 5]);
check('הפריט של תחנת החצייה נמסר אחרי היציאה, לא לפניה',
  rows('pushed').findIndex((row) => row.stop_id === stopId(CROSSING_STOP)), CROSSING_STOP - 1);

// --- ארבע שאלות, ארבע יזימות (מפה 6.3) ---

const questions = [
  `מה יש בבניין ${3}`,
  `ספר על הנקודה מספר ${7}`,
  'מי היה כאן לפני מאה שנה',
  'איפה המסעדה הקרובה',
];
for (const question of questions) {
  const asked = await send({
    from: callerOf('FE-05'), module: 'BE-03', action: 'ask',
    payload: { question, session_id, site_id: 'site-sim', stop_id: geofence.current().stop_id ?? undefined },
  });
  check(`השאלה "${question}" נענתה`, asked.ok, true);
}
check('ארבע שורות initiated', rows('initiated').length, 4);
check('שאלה על פריט מאושר נענתה ממנו', rows('initiated').slice(0, 2).every((row) => row.is_fallback === false && row.source_item !== null), true);

// --- המדדים גורעים את הסשן: BL-16 ---

await send({ from: callerOf('FE-05'), module: 'BE-07', action: 'session_end', payload: { session_id } });
const metrics = await send({ from: callerOf('FE-08'), module: 'BE-07', action: 'compute_metrics', payload: { site_id: 'site-sim' } });
check('הסשן נגרע מהמדגם כסימולטור', metrics.data.excluded.simulator, 1);
check('ואינו נספר: n הוא אפס', metrics.data.n, 0);
check('הסשן הושלם: הגיע לתחנה האחרונה', repository.getSession(session_id).completed, true);

// --- AUTO-02 עשה את שלו: אין טיימר תלוי בסוף ---

check('אין טיימר מינון דרוך בסוף ההליכה', timer.armed(session_id), null);

report(` (${arrives.length} arrive, ${interactions.length} שורות יומן, ${spoken.length} השמעות)`);
