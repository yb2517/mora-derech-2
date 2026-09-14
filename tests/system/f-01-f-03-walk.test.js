// System: ההליכה, מהגעה לנקודה ועד המדדים. משימה 12 בתוכנית שלב 4.
//
// המקור: מפה 6.3 (שלושת אשכולות ה-System), usecase-f-01-f-03
// (הזרימה הראשית וזרימות א, ג, ז), usecase-f-13 (החצייה),
// usecase-f-09 (הסשן והמדדים), ו-BL-16, BL-19.
//
// זו הבדיקה שמחברת את מה שהשלב בנה: מעטפת arrive נוסעת דרך
// ה-Orchestrator ל-FE-04, FE-04 מבקש את פריטי הנקודה מ-BE-05, שותק
// בחצייה, מוסר אחרי המרווח, ושולח שורות ל-BE-07, ובסוף המדדים
// מחושבים מאותן שורות.
//
// **המפעילים של שלב 5 אינם כאן**: AUTO-01 ו-AUTO-02 נבנים אז.
// המעטפות נשלחות בשמם מהבדיקה, לפי השורות שכבר ברשימת המותר,
// וזהו בדיוק הגבול שהשלב הזה הגיע אליו.
//
//   node tests/system/f-01-f-03-walk.test.js

import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('System: ההליכה והמדדים');

const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { create: createGovernance } = await import('../../services/governance.js');
const { create: createDelivery } = await import('../../services/delivery.js');
const { create: createLog } = await import('../../services/log.js');

const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
const referenceFile = (await import('../../data/reference.json', { with: { type: 'json' } })).default;

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

// מסלול משלושה סוגי נקודות: נקודה רגילה, נקודת חצייה, ונקודה בלי
// פריט מאושר. שלושתן מהזרימות, ולא מהדמיון.
const item = (id, stopId, text) => ({
  item_id: id, site_id: 'site-walk', stop_id: stopId, status: 'approved',
  source_id: 'src-walk', page: 1, audience: 'כולם', name: id, text,
});

const seed = {
  modules: modulesFile,
  allow_list: allowFile,
  reference: referenceFile.values,
  sites: [{
    site_id: 'site-walk', name: 'מסלול', stops: ['stop-a', 'stop-cross', 'stop-empty', 'stop-last'],
    status: 'locked', locked_at: '2026-09-10T00:00:00.000Z', corpus_version: 1,
    bounds: { min_lat: 31.77, max_lat: 31.79, min_lng: 35.20, max_lng: 35.23 },
  }],
  sources: [{ source_id: 'src-walk', name: 'מקור' }],
  rights_mou: [{
    mou_id: 'mou-walk', institute_id: 'inst-walk', scope: ['src-walk'],
    signed_at: '2026-09-01T00:00:00.000Z', valid_until: '2099-01-01T00:00:00.000Z',
  }],
  content_items: [
    item('i-a', 'stop-a', 'הנקודה הראשונה של המסלול.'),
    item('i-cross', 'stop-cross', 'הנקודה שבצומת.'),
    item('i-last', 'stop-last', 'הנקודה האחרונה של המסלול.'),
    { ...item('i-hidden', 'stop-empty', 'פריט שטרם אושר.'), status: 'pending' },
  ],
  geo_anchors: [
    { anchor_id: 'an-a', item_id: 'i-a', lat: 31.781, lng: 35.219, verified: true, verified_at: 'T', is_crossing: false },
    { anchor_id: 'an-cross', item_id: 'i-cross', lat: 31.782, lng: 35.218, verified: true, verified_at: 'T', is_crossing: true },
    { anchor_id: 'an-last', item_id: 'i-last', lat: 31.783, lng: 35.217, verified: true, verified_at: 'T', is_crossing: false },
    { anchor_id: 'an-hidden', item_id: 'i-hidden', lat: 31.784, lng: 35.216, verified: false, verified_at: null, is_crossing: false },
  ],
};

const repository = createRepository(createBrowserDriver({ storage: memoryStorage(), seed }));

let clockValue = Date.UTC(2026, 8, 14, 6, 0, 0);
const clock = () => clockValue;
const advance = (seconds) => { clockValue += seconds * 1000; };
const stamp = () => new Date(clockValue).toISOString();

const callerOf = (id) => modulesFile.modules.find((row) => row.id === id).caller;

let orchestrator = null;
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

orchestrator = createOrchestrator({
  repository,
  handlers: {
    'BE-05': createGovernance({ repository, now: stamp }),
    'FE-04': createDelivery({ repository, send, caller: callerOf('FE-04'), clock, now: stamp }),
    'BE-07': createLog({ repository, now: stamp }),
  },
  now: stamp,
});

const geofence = (action, payload) => send({ from: callerOf('AUTO-01'), module: 'FE-04', action, payload });
const timer = (action, payload) => send({ from: callerOf('AUTO-02'), module: 'FE-04', action, payload });

// --- תחילת הסשן ---

const opened = await send({
  from: 'screen-traveler', module: 'BE-07', action: 'session_start', payload: { site_id: 'site-walk' },
});
const session_id = opened.data.session.session_id;
check('הסשן נפתח', opened.ok, true);

// --- הנקודה הראשונה: מסירה ---

{
  const arrive = await geofence('arrive', { session_id, site_id: 'site-walk', stop_id: 'stop-a', accuracy: 12 });
  check('הפריט נמסר', arrive.data.delivered.item_id, 'i-a');
  check('ואין מוחזק', arrive.data.held, null);
  check('ונרשמה שורת pushed', repository.listInteractions({ session_id, type: 'pushed' }).length, 1);
  check('עם דיוק המיקום',
    repository.listInteractions({ session_id, type: 'pushed' })[0].accuracy, 12);
}

// --- נקודת החצייה: שתיקה, ואז שחרור ביציאה (BL-19) ---

{
  advance(60);
  const arrive = await geofence('arrive', { session_id, site_id: 'site-walk', stop_id: 'stop-cross' });

  check('בחצייה אין מסירה', arrive.data.delivered, null);
  check('הפריט מוחזק', arrive.data.held.reason, 'crossing');
  check('ואין טיימר דרוך', arrive.data.timer_armed, false);
  check('ולא נרשמה שורה חדשה', repository.listInteractions({ session_id, type: 'pushed' }).length, 1);

  // usecase-f-13 זרימה א: עמידה ארוכה בצומת אינה משחררת.
  advance(120);
  const held = await timer('release', { session_id });
  check('הטיימר אינו משחרר בחצייה', held.data.delivered, null);

  const leave = await geofence('leave', { session_id, site_id: 'site-walk', stop_id: 'stop-cross' });
  check('היציאה מהצומת משחררת', leave.data.delivered.item_id, 'i-cross');
  check('ונרשמה שורה שנייה', repository.listInteractions({ session_id, type: 'pushed' }).length, 2);
}

// --- הנקודה בלי פריט מאושר: שתיקה וממצא ---

{
  advance(5);
  const arrive = await geofence('arrive', { session_id, site_id: 'site-walk', stop_id: 'stop-empty' });

  check('המערכת שותקת', arrive.data.silent, true);
  check('הפריט שטרם אושר אינו נמסר', arrive.data.delivered, null);
  check('ונרשמה הגעה בלי תוכן',
    repository.listInteractions({ session_id, type: 'arrived_no_content' }).length, 1);
}

// --- הנקודה האחרונה, והמינון ---

{
  // עשר שניות אחרי המסירה הקודמת: הפריט מוחזק לעשר הנותרות.
  // הגעה לנקודה בלי תוכן אינה מאפסת את המרווח, מפני שלא נמסר דבר.
  advance(5);
  const arrive = await geofence('arrive', { session_id, site_id: 'site-walk', stop_id: 'stop-last' });
  check('הגעה בתוך המרווח מוחזקת', arrive.data.held.item_id, 'i-last');
  check('לזמן שנותר מהמרווח', arrive.data.hold_for_s, 10);

  advance(10);
  const released = await timer('release', { session_id });
  check('הטיימר משחרר אחרי המרווח', released.data.delivered.item_id, 'i-last');
  check('ושלוש שורות pushed', repository.listInteractions({ session_id, type: 'pushed' }).length, 3);
}

// --- סיום הסשן: הגעה לנקודה האחרונה היא השלמה ---

{
  const ended = await send({
    from: 'screen-traveler', module: 'BE-07', action: 'session_end', payload: { session_id },
  });
  check('הסשן נסגר', typeof ended.data.session.ended_at, 'string');
  check('והושלם, מפני שנרשמה הגעה לנקודה האחרונה', ended.data.completed, true);
}

// --- כניסה חוזרת אחרי הסשן אינה אפשרית ---

{
  const closed = await geofence('arrive', { session_id, site_id: 'site-walk', stop_id: 'stop-a' });
  // FE-04 אינו יודע שהסשן נסגר, אך שורת היומן שלו נדחית. הכרעה 12
  // ממילא משתיקה כניסה חוזרת לנקודה שכבר נמסרה.
  check('כניסה חוזרת לנקודה שנמסרה שותקת', closed.data.reason, 'already_delivered');
}

// --- המדדים, מאותן שורות ---

{
  const metrics = await send({
    from: 'screen-owner', module: 'BE-07', action: 'compute_metrics', payload: { site_id: 'site-walk' },
  });

  check('הסשן נכנס למדגם', metrics.data.n, 1);
  check('M-02 הוא 1', metrics.data.metrics.find((row) => row.metric === 'M-02').value, 1);
  check('M-01 הוא אפס: לא נשאלה שאלה',
    metrics.data.metrics.find((row) => row.metric === 'M-01').value, 0);
  check('ולכן אינו עובר', metrics.data.metrics.find((row) => row.metric === 'M-01').passes, false);
  check('והמדגם מסומן כקטן מהסף', metrics.data.sample_small, true);
  check('הגעה בלי תוכן נספרת כממצא', metrics.data.counts.arrived_no_content, 1);
}

// --- BL-16: סשן סימולטור אינו נספר ---

{
  const sim = await send({
    from: 'screen-traveler', module: 'BE-07', action: 'session_start',
    payload: { site_id: 'site-walk', flags: ['simulator'] },
  });
  const simulated = sim.data.session.session_id;
  await geofence('arrive', { session_id: simulated, site_id: 'site-walk', stop_id: 'stop-a' });
  await send({ from: 'screen-traveler', module: 'BE-07', action: 'session_end', payload: { session_id: simulated } });

  const metrics = await send({
    from: 'screen-owner', module: 'BE-07', action: 'compute_metrics', payload: { site_id: 'site-walk' },
  });
  check('הסשן המסומן אינו נספר', metrics.data.n, 1);
  check('והגריעה מדווחת', metrics.data.excluded.simulator, 1);
}

// --- ולכל בקשה שתי שורות ביומן, עם אותו מזהה ---

{
  const audit = repository.listAudit();
  const ids = [...new Set(audit.map((row) => row.request_id))];
  check('לכל בקשה שתי שורות', ids.every((id) => audit.filter((row) => row.request_id === id).length === 2), true);

  // המעטפה ש-FE-04 שלח ל-BE-05 נרשמה גם היא: מודול שפונה למודול
  // עובר באותו מסלול, ולכן הוא נראה ביומן כמו כל פונה.
  const internal = audit.filter((row) => row.from === callerOf('FE-04'));
  check('הפניות של FE-04 נרשמו ביומן', internal.length > 0, true);
  check('והן פונות ל-BE-05 ול-BE-07',
    [...new Set(internal.map((row) => row.module))].sort(), ['BE-05', 'BE-07']);
}

report();
