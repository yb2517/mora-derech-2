// Unit של דרייבר הענן, CORE-04. נגזר מבדיקת הקבלה של משימה 13.3
// בתוכנית שלב 5 חלק ב: אותו חוזה של דרייבר הדפדפן; הוספה לטבלה
// זרועה נזרקת; עדכון בטבלה שגדלה בלבד נזרק; כשל רשת אינו מאבד
// שורה; והחלפת הדרייבר אינה נוגעת ב-Repository (מבחן ההחלפה,
// decision-05 סעיף 2).
//
//   node tests/unit/driver-cloud.test.js

import { createRepository } from '../../repository/index.js';
import { createBrowserDriver } from '../../repository/driver-browser.js';
import { createCloudDriver, CLOUD_TABLES, ENV_NAMES, TABLE_NAMES } from '../../repository/driver-cloud.js';
import { TABLE_NAMES as BROWSER_TABLE_NAMES } from '../../repository/driver-browser.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };
import { FIXTURE_SEED as demo } from '../helpers/fixtures.js';
import { fakePostgrest, manualSchedule, settle } from '../helpers/cloud.js';
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, report } = createChecker('CORE-04 driver-cloud');

const URL_VALUE = 'https://example.invalid';
const KEY_VALUE = 'public-key-for-tests';
const KEYS = {
  reference: 'key', approvals: 'approval_id', interactions: 'interaction_id',
  content_items: 'item_id', sites: 'site_id', sources: 'source_id', institutes: 'institute_id',
  rights_mou: 'mou_id', geo_anchors: 'anchor_id', exit_points: 'exit_id', sessions: 'session_id',
};
const seed = { modules: modulesFile, allow_list: allowFile };

function referenceRows() {
  return Object.entries(referenceFile.values).map(([key, value]) => ({ key, value }));
}

function build({ tables = {}, failures = [] } = {}) {
  const net = fakePostgrest({ tables: { reference: referenceRows(), ...tables }, keys: KEYS });
  const schedule = manualSchedule();
  const driver = createCloudDriver({
    url: URL_VALUE, key: KEY_VALUE, fetch: net.fetch, seed, schedule, onFailure: (f) => failures.push(f),
  });
  return { driver, net, schedule };
}

// --- החוזה: אותן ארבע פעולות, אותן ארבע עשרה טבלאות ---

check('שמות משתני הסביבה לפי decision-05', ENV_NAMES, { url: 'SUPABASE_URL', key: 'SUPABASE_ANON_KEY' });
check('הדרייבר מכיר את אותן טבלאות של דרייבר הדפדפן', [...TABLE_NAMES], [...BROWSER_TABLE_NAMES]);
check('שתים עשרה טבלאות בענן, שתיים עם הקוד', [CLOUD_TABLES.length, TABLE_NAMES.length - CLOUD_TABLES.length], [12, 2]);
checkThrows('בלי כתובת: נזרק, עם שמות המשתנים', () => createCloudDriver({ key: KEY_VALUE, fetch: () => {} }));
checkThrows('בלי רשת: נזרק', () => createCloudDriver({ url: URL_VALUE, key: KEY_VALUE, fetch: null }));
{
  const net = fakePostgrest({ tables: { reference: referenceRows() } });
  const driver = createCloudDriver({ env: { SUPABASE_URL: URL_VALUE, SUPABASE_ANON_KEY: KEY_VALUE }, fetch: net.fetch, seed });
  await driver.load();
  check('הערכים נקראים מאובייקט משתני הסביבה לפי ENV_NAMES', net.calls[0].headers.apikey, KEY_VALUE);
  check('הכתובת נבנית מהערך', net.calls[0].method, 'GET');
}

{
  const { driver } = build();
  check('ה-Repository מקבל את הדרייבר', typeof createRepository(driver).getRef, 'function');
}

// --- load: המשיכה, הסדר, והמפתח בכותרות ---

{
  const { driver, net } = build({ tables: { sites: demo.sites, content_items: demo.content_items } });
  check('לפני load אין טבלת ענן', driver.readTable('sites'), undefined);
  check('אבל ה-Registry מהזריעה קיים מיד', driver.readTable('allow_list').rows.length > 0, true);
  await driver.load();
  check('load מושך את שתים עשרה הטבלאות', net.calls.filter((c) => c.method === 'GET').map((c) => c.table).sort(), [...CLOUD_TABLES].sort());
  check('כל בקשה נושאת את המפתח פעמיים, כפי שהספק דורש', net.calls.every((c) => c.headers.apikey === KEY_VALUE && c.headers.Authorization === `Bearer ${KEY_VALUE}`), true);
  check('הישויות הגיעו', driver.readTable('content_items').length, demo.content_items.length);
  check('reference הפך לאוסף מפתחות', driver.readTable('reference').geofence_radius_m, referenceFile.values.geofence_radius_m);
  check('loaded', driver.loaded(), true);
}

// --- appendRow: בזיכרון מיד, ובמסד אחרי התור ---

{
  const { driver, net } = build();
  await driver.load();
  const row = { approval_id: 'appr-1', time: 't1', who: 'screen-veto', target: 'item-1', action: 'approve', from_status: 'pending', to_status: 'approved', note: '' };
  const returned = driver.appendRow('approvals', row);
  check('appendRow מחזיר את השורה', returned, row);
  check('השורה בזיכרון מיד, לפני שהרשת ענתה', driver.readTable('approvals').length, 1);
  await settle();
  check('התור התרוקן', driver.queued(), 0);
  check('השורה במסד', net.rows('approvals'), [row]);
  const post = net.calls.find((c) => c.method === 'POST');
  check('ההוספה מבקשת תשובה מינימלית', post.headers.Prefer, 'return=minimal');
}

// --- הטבלאות הזרועות: אותו שומר של דרייבר הדפדפן ---

{
  const { driver } = build();
  await driver.load();
  for (const table of ['modules', 'allow_list', 'reference']) {
    let message = '';
    try { driver.appendRow(table, { id: 'X' }); message = 'לא נזרק'; } catch (t) { message = t.message; }
    check(`הוספת שורה ל-${table} נחסמת`, message.includes('נזרעת ואינה נכתבת בזמן ריצה'), true);
  }
  for (const table of ['audit_log', 'approvals', 'interactions']) {
    checkThrows(`עדכון שורה ב-${table} נזרק`, () => driver.updateRow(table, 'id', 'X', { note: 'שונה' }));
  }
  checkThrows('טבלה שאינה מוכרת נזרקת', () => driver.readTable('secrets'));
  check('אחרי הזריקות אין דבר בתור', driver.queued(), 0);
}

// --- updateRow: מסנן שוויון על המפתח, ותיקון בזיכרון ---

{
  const { driver, net } = build({ tables: { content_items: demo.content_items } });
  await driver.load();
  const id = demo.content_items[0].item_id;
  const updated = driver.updateRow('content_items', 'item_id', id, { status: 'draft' });
  check('updateRow מחזיר את השורה אחרי העדכון', updated.status, 'draft');
  check('שורה שאינה קיימת: undefined', driver.updateRow('content_items', 'item_id', 'אין', { status: 'x' }), undefined);
  await settle();
  const patch = net.calls.find((c) => c.method === 'PATCH');
  check('העדכון נשלח כ-PATCH עם גוף העדכון בלבד', [patch.table, patch.body], ['content_items', { status: 'draft' }]);
  check('המסד עודכן', net.rows('content_items').find((r) => r.item_id === id).status, 'draft');
}

// --- setRefKey: upsert, ומפתח אחד ---

{
  const { driver, net } = build();
  await driver.load();
  driver.setRefKey('enforce_gate_b', true);
  check('הערך בזיכרון מיד', driver.readTable('reference').enforce_gate_b, true);
  await settle();
  const post = net.calls.find((c) => c.method === 'POST' && c.table === 'reference');
  check('הכתיבה היא upsert של מפתח אחד', [post.headers.Prefer.includes('merge-duplicates'), post.body], [true, { key: 'enforce_gate_b', value: true }]);
  check('במסד המפתח התעדכן ולא הוכפל', net.rows('reference').filter((r) => r.key === 'enforce_gate_b'), [{ key: 'enforce_gate_b', value: true }]);
}

// --- audit_log: התרגום לשם ובחזרה, והשורה של ה-Orchestrator אינה משתנה ---

{
  const { driver, net } = build();
  await driver.load();
  const row = { request_id: 'req-1', phase: 'response', at: 't', from: 'screen-veto', module: 'BE-05', action: 'approve', ok: false, code: 'E-ALLOW-DENIED' };
  driver.appendRow('audit_log', row);
  await settle();
  const stored = net.rows('audit_log')[0];
  check('במסד: from_module ו-outcome', stored, {
    request_id: 'req-1', phase: 'response', at: 't', from_module: 'screen-veto', module: 'BE-05', action: 'approve',
    outcome: { ok: false, code: 'E-ALLOW-DENIED' },
  });
  const second = build({ tables: { audit_log: net.rows('audit_log') } });
  await second.driver.load();
  check('אחרי משיכה: השורה חוזרת בדיוק כפי שנכתבה', second.driver.readTable('audit_log'), [row]);
}

// --- כשל רשת: השורה נשארת בתור, ונשלחת בניסיון הבא ---

{
  const { driver, net, schedule } = build();
  await driver.load();
  net.setNetworkDown(true);
  driver.appendRow('interactions', { interaction_id: 'int-1', session_id: 's', time: 't', type: 'session_start' });
  driver.appendRow('interactions', { interaction_id: 'int-2', session_id: 's', time: 't', type: 'pushed' });
  await settle();
  check('שתי השורות בזיכרון', driver.readTable('interactions').length, 2);
  check('שתיהן ממתינות בתור', driver.queued(), 2);
  check('כלום לא הגיע למסד', net.rows('interactions'), []);
  check('ניסיון חוזר נדרך, שנייה אחת', schedule.pending.map((p) => p.ms), [1000]);
  const flushed = await driver.flush();
  check('flush מדווח מה נשאר', flushed, { queued: 2, failed: 0 });

  net.setNetworkDown(false);
  await schedule.fire();
  await settle();
  check('אחרי שהרשת חזרה: התור ריק', driver.queued(), 0);
  check('שתי השורות במסד, בסדר', net.rows('interactions').map((r) => r.interaction_id), ['int-1', 'int-2']);
  check('אין כשל קבוע', driver.failures(), []);
}

// --- ההשהיה גדלה ואינה עוברת את התקרה ---

{
  const { driver, net, schedule } = build();
  await driver.load();
  net.setNetworkDown(true);
  driver.appendRow('approvals', { approval_id: 'a' });
  await settle();
  const delays = [];
  for (let i = 0; i < 6; i += 1) {
    delays.push(schedule.pending[0]?.ms);
    await schedule.fire();
    await settle();
  }
  check('ההשהיה מוכפלת עד 8 שניות', delays, [1000, 2000, 4000, 8000, 8000, 8000]);
}

// --- דחייה של המסד: כשל קבוע, מדווח, ואינו חוסם את השורה הבאה ---

{
  const failures = [];
  const { driver, net } = build({ failures });
  await driver.load();
  net.rejectWith(400, { message: 'column does not exist' });
  driver.appendRow('approvals', { approval_id: 'bad', extra: 1 });
  await settle();
  net.rejectWith(null);
  driver.appendRow('approvals', { approval_id: 'good' });
  await settle();
  check('השורה שנדחתה יצאה מהתור ונרשמה ככשל', [driver.queued(), driver.failures().length], [0, 1]);
  check('הכשל נושא את הטבלה, המצב והשורה', [failures[0].table, failures[0].status, failures[0].body.approval_id], ['approvals', 400, 'bad']);
  check('השורה הבאה הגיעה למסד', net.rows('approvals').map((r) => r.approval_id), ['good']);
  check('בזיכרון שתיהן: המראה אינה נמחקת מעצמה', driver.readTable('approvals').length, 2);
}

// --- כשל שרת: זמני, ולא קבוע ---

{
  const { driver, net, schedule } = build();
  await driver.load();
  net.rejectWith(503);
  driver.appendRow('approvals', { approval_id: 'later' });
  await settle();
  check('503 משאיר את השורה בתור', [driver.queued(), driver.failures().length], [1, 0]);
  net.rejectWith(null);
  await schedule.fire();
  await settle();
  check('ואז נשלחת', net.rows('approvals').map((r) => r.approval_id), ['later']);
}

// --- refresh: מכשיר שני נראה, ומה שממתין אינו אובד ---

{
  const { driver, net, schedule } = build({ tables: { sessions: [] } });
  await driver.load();
  net.state.sessions.push({ session_id: 'from-other-device', site_id: 's' });
  net.setNetworkDown(true);
  driver.appendRow('sessions', { session_id: 'mine', site_id: 's' });
  await settle();
  net.setNetworkDown(false);
  await driver.refresh();
  check('אחרי refresh: הסשן של המכשיר השני נראה, ושלי נשלח', net.rows('sessions').map((r) => r.session_id).sort(), ['from-other-device', 'mine']);
  check('בזיכרון שניהם', driver.readTable('sessions').map((r) => r.session_id).sort(), ['from-other-device', 'mine']);
  await schedule.fire();
}

// --- עמודים: טבלה גדולה נמשכת במלואה ---

{
  const many = Array.from({ length: 2345 }, (_, i) => ({ request_id: `r${i}`, phase: 'request', at: `t${String(i).padStart(5, '0')}`, from_module: 'x', module: 'y', action: 'z', outcome: {} }));
  const { driver, net } = build({ tables: { audit_log: many } });
  await driver.load();
  check('כל השורות נמשכו', driver.readTable('audit_log').length, 2345);
  check('בשלושה עמודים', net.calls.filter((c) => c.method === 'GET' && c.table === 'audit_log').length, 3);
}

// --- מבחן ההחלפה: אותו Repository, אותה סדרת פעולות, אותן טבלאות ---
//
// decision-05 סעיף 2: "הדרייבר מתחלף, ה-Repository לא". הסדרה
// נוגעת בכל פעולת כתיבה של ה-Repository, ובסופה שתים עשרה הטבלאות
// זהות בית בבית בשני הדרייברים.

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

{
  const browser = createRepository(createBrowserDriver({
    storage: memoryStorage(),
    seed: { ...seed, reference: referenceFile.values, ...Object.fromEntries(CLOUD_TABLES.filter((t) => t !== 'reference').map((t) => [t, demo[t] ?? []])) },
  }));
  const cloudTables = Object.fromEntries(CLOUD_TABLES.filter((t) => t !== 'reference').map((t) => [t, demo[t] ?? []]));
  const { driver: cloudDriver, net } = build({ tables: cloudTables });
  await cloudDriver.load();
  const cloud = createRepository(cloudDriver);

  for (const repository of [browser, cloud]) {
    repository.appendAudit({ request_id: 'req-1', phase: 'request', from: 'screen-veto', module: 'BE-05', action: 'approve' });
    repository.appendAudit({ request_id: 'req-1', phase: 'response', from: 'screen-veto', module: 'BE-05', action: 'approve', ok: true });
    repository.setRef('enforce_gate_b', true);
    repository.setStatus(demo.content_items[1].item_id, 'approved');
    repository.updateSite(demo.sites[0].site_id, { status: 'locked', locked_at: 't-lock', corpus_version: 'v1' });
  }
  await settle();

  check('אחרי אותה סדרה: השורות זהות בשני הדרייברים (audit_log)', cloud.listAudit(), browser.listAudit());
  check('הפריט עודכן זהה', cloud.getItem(demo.content_items[1].item_id), browser.getItem(demo.content_items[1].item_id));
  check('המפתח זהה', cloud.getRef('enforce_gate_b'), browser.getRef('enforce_gate_b'));
  check('המסד קיבל את כל הכתיבות', [cloudDriver.queued(), net.rows('audit_log').length, net.rows('reference').find((r) => r.key === 'enforce_gate_b').value], [0, 2, true]);
  check('המסלול נעול במסד', net.rows('sites')[0].status, 'locked');
}

report();
