// Unit של AUTO-02, הטיימר. נגזר מבדיקת הקבלה של משימה 6 בתוכנית
// שלב 5, מ-doc-build-03-automation סעיפים 4 ו-6 ("פריט מוחזק, 20
// שניות: release פעם אחת"; "סשן בלי אירוע 61 דקות: closed,
// completed = false"), ממפה 6.3 (הפסקה של 45 דקות), ומהכרעות 8 ו-12.
//
// טיימר המינון נבדק מול Orchestrator מזויף, וטיימר הסשנים מול BE-07
// האמיתי על אחסון בזיכרון: הסגירה עצמה היא של BE-07, והטיימר רק
// שולח בזמן.
//
//   node tests/unit/timer.test.js

import { create } from '../../automation/timer.js';
import { create as createLog } from '../../services/log.js';
import { createBrowserDriver } from '../../repository/driver-browser.js';
import { createRepository } from '../../repository/index.js';
import { fakeSchedule } from '../helpers/device.js';
import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };

const { check, report } = createChecker('AUTO-02 timer');

const CALLER = modulesFile.modules.find((row) => row.id === 'AUTO-02').caller;
const REFERENCE = { stale_session_minutes: 60 };

function fakeSend(answer = () => ({ ok: true, data: { released: true } })) {
  const sent = [];
  const send = async (request) => {
    sent.push(request);
    return answer(request);
  };
  send.sent = sent;
  return send;
}

const repository = (reference = REFERENCE) => ({ getRef: (key) => reference[key] });

// ---------------------------------------------------------------------
// טיימר המינון: פריט מוחזק, 20 שניות, release אחד בדיוק
// ---------------------------------------------------------------------

{
  const schedule = fakeSchedule();
  const send = fakeSend();
  const timer = create({ repository: repository(), send, caller: CALLER, schedule });

  check('דריכה', timer.arm({ session_id: 'sess-1', stop_id: 'st-1', item_id: 'i-1', seconds: 20 }), { ok: true, data: { armed: true, seconds: 20 } });
  check('הטיימר דרוך', timer.armed('sess-1'), { stop_id: 'st-1', item_id: 'i-1', seconds: 20 });

  await schedule.advance(19);
  check('אחרי 19 שניות: אין release', send.sent.length, 0);

  await schedule.advance(1);
  await timer.settled();
  check('אחרי 20 שניות: release אחד, בשם הפונה מהנתונים, במעטפה ל-FE-04',
    send.sent.map((r) => [r.from, r.module, r.action, r.payload]),
    [[CALLER, 'FE-04', 'release', { session_id: 'sess-1', stop_id: 'st-1', item_id: 'i-1' }]]);
  check('הטיימר נמחק אחרי הפקיעה', timer.armed('sess-1'), null);

  await schedule.advance(60);
  check('ואין release שני', send.sent.length, 1);
  check('היומן הפנימי', timer.fired(), [{ type: 'release', session_id: 'sess-1', stop_id: 'st-1', item_id: 'i-1', ok: true }]);
}

// --- דריכה חוזרת מחליפה את הקודמת, ולא נוספת עליה ---

{
  const schedule = fakeSchedule();
  const send = fakeSend();
  const timer = create({ repository: repository(), send, caller: CALLER, schedule });
  timer.arm({ session_id: 'sess-1', stop_id: 'st-1', item_id: 'i-1', seconds: 20 });
  await schedule.advance(10);
  timer.arm({ session_id: 'sess-1', stop_id: 'st-1', item_id: 'i-2', seconds: 20 });
  await schedule.advance(10);
  check('הדריכה הראשונה בוטלה: אחרי 20 שניות מהראשונה אין release', send.sent.length, 0);
  await schedule.advance(10);
  await timer.settled();
  check('הפריט השני משוחרר בזמנו', send.sent.map((r) => r.payload.item_id), ['i-2']);
}

// --- פריט שנזנח: FE-04 עונה released false, ואין דריכה חדשה ---

{
  const schedule = fakeSchedule();
  const send = fakeSend(() => ({ ok: true, data: { delivered: null, held: null, released: false } }));
  const timer = create({ repository: repository(), send, caller: CALLER, schedule });
  timer.arm({ session_id: 'sess-1', stop_id: 'st-1', item_id: 'i-1', seconds: 20 });
  await schedule.advance(20);
  await timer.settled();
  check('release יצא', send.sent.length, 1);
  check('התשובה אינה שגיאה, ואין טיימר חדש', [timer.fired()[0].ok, timer.armed('sess-1'), schedule.pending()], [true, null, 0]);
}

// --- FE-04 עונה שנותר עוד זמן: הטיימר נדרך שוב לפרק שנותר ---

{
  const schedule = fakeSchedule();
  let calls = 0;
  const send = fakeSend(() => {
    calls += 1;
    return calls === 1
      ? { ok: true, data: { held: { item_id: 'i-1', reason: 'gap' }, hold_for_s: 7 } }
      : { ok: true, data: { delivered: { item_id: 'i-1' } } };
  });
  const timer = create({ repository: repository(), send, caller: CALLER, schedule });
  timer.arm({ session_id: 'sess-1', stop_id: 'st-1', item_id: 'i-1', seconds: 20 });
  await schedule.advance(20);
  check('הדריכה החוזרת לפרק שנותר', timer.armed('sess-1').seconds, 7);
  await schedule.advance(7);
  await timer.settled();
  check('שני release: הראשון החזיר המתנה, השני מסר', send.sent.length, 2);
}

// --- ביטול, ודריכה שאינה תקינה ---

{
  const schedule = fakeSchedule();
  const send = fakeSend();
  const timer = create({ repository: repository(), send, caller: CALLER, schedule });
  timer.arm({ session_id: 'sess-1', stop_id: 'st-1', item_id: 'i-1', seconds: 20 });
  check('ביטול', timer.cancel('sess-1'), { ok: true, data: { cancelled: true } });
  await schedule.advance(30);
  check('אחרי ביטול אין release', send.sent.length, 0);
  check('ביטול שני: לא היה מה לבטל', timer.cancel('sess-1'), { ok: true, data: { cancelled: false } });
  check('דריכה בלי סשן: לא נדרך', timer.arm({ seconds: 5 }), { ok: true, data: { armed: false } });
  check('דריכה בלי שניות: לא נדרך', timer.arm({ session_id: 's' }), { ok: true, data: { armed: false } });
}

// ---------------------------------------------------------------------
// טיימר הסשנים: close_stale עם ההרכבה ואז כל stale_session_minutes,
// מול BE-07 האמיתי
// ---------------------------------------------------------------------

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

{
  const schedule = fakeSchedule(Date.parse('2026-09-15T10:00:00.000Z'));
  const now = () => new Date(schedule.now()).toISOString();

  const repo = createRepository(createBrowserDriver({
    storage: memoryStorage(),
    seed: {
      modules: modulesFile, allow_list: allowFile, reference: referenceFile.values,
      sites: [{ site_id: 'site-1', name: 'מסלול', stops: ['st-1'], status: 'open', locked_at: null, corpus_version: 0 }],
      sessions: [], interactions: [],
    },
  }));
  const log = createLog({ repository: repo, now });

  // הכתובת האחת המזויפת: מנתבת close_stale ל-BE-07 האמיתי ומתעדת.
  const sent = [];
  const send = async (request) => {
    sent.push(request);
    return log({ ...request });
  };

  // סשן שנפתח בטעינה הקודמת, ואיש לא סגר.
  repo.appendSession({
    session_id: 'sess-old', site_id: 'site-1', started_at: '2026-09-15T08:00:00.000Z',
    ended_at: null, completed: false, last_stop_id: null, flags: [], previous_session_id: null,
  });

  const timer = create({ repository: repo, send, caller: CALLER, schedule });
  const started = await timer.start({ site_id: 'site-1' });
  check('start: פעם אחת עכשיו, ואז כל 60 דקות', started, { ok: true, data: { every_minutes: 60, first: true } });
  check('close_stale יצא עם ההרכבה, בשם הפונה מהנתונים', sent.map((r) => [r.from, r.module, r.action]), [[CALLER, 'BE-07', 'close_stale']]);
  check('הסשן הישן נסגר, completed = false', [repo.getSession('sess-old').ended_at !== null, repo.getSession('sess-old').completed], [true, false]);

  // סשן חדש, שרושם אירוע ואז שותק 45 דקות: הפסקת קפה, לא נשירה.
  repo.appendSession({
    session_id: 'sess-new', site_id: 'site-1', started_at: now(),
    ended_at: null, completed: false, last_stop_id: null, flags: [], previous_session_id: null,
  });
  await schedule.advance(45 * 60);
  check('אחרי 45 דקות: close_stale לא רץ עדיין, והסשן פתוח', [sent.length, repo.getSession('sess-new').ended_at], [1, null]);

  await schedule.advance(15 * 60);
  await timer.settled();
  check('אחרי 60 דקות: close_stale רץ שוב', sent.length, 2);
  check('סשן בן 60 דקות בדיוק אינו נסגר: הכלל הוא "לא רשם אירוע במשך" הפרק', repo.getSession('sess-new').ended_at, null);

  await schedule.advance(60 * 60);
  await timer.settled();
  check('אחרי 61 דקות ויותר בלי אירוע: הסשן נסגר', [sent.length, repo.getSession('sess-new').ended_at !== null, repo.getSession('sess-new').completed], [3, true, false]);

  check('stop עוצר את הטיימר התקופתי', timer.stop(), { ok: true, data: { stopped: true } });
  await schedule.advance(120 * 60);
  check('אחרי stop אין close_stale', sent.length, 3);
  check('היומן הפנימי מונה את הסגירות', timer.fired().map((f) => [f.type, f.closed]), [['close_stale', 1], ['close_stale', 0], ['close_stale', 1]]);
}

// --- ערך חסר: E-REF-EMPTY, בלי שליחה ---

{
  const send = fakeSend();
  const timer = create({ repository: repository({}), send, caller: CALLER, schedule: fakeSchedule() });
  const started = await timer.start({ site_id: 'site-1' });
  check('stale_session_minutes חסר: E-REF-EMPTY', [started.error.code, started.error.data.key, send.sent.length], ['E-REF-EMPTY', 'stale_session_minutes', 0]);
}

report();
