// Unit של כלי הייבוא, משימה 4 בתוכנית שלב 7: הרצה יבשה מול הרשת
// המדומה של דרייבר הענן.
//
// המקור: בדיקת הקבלה של משימה 4 בתוכנית שלב 7; usecase-f-08 צעדים 1
// עד 4 (פריט draft, עוגן לא מאומת, רשומת יצירה); BL-01; מבחן מבנה 04
// (כל בקשה רשומה עם request_id); usecase-f-08 זרימה ג (קואורדינטות
// מחוץ לגבולות: E-ANCHOR-OUT-OF-BOUNDS, לא נכתב דבר).
//
//   node tests/unit/import-corpus.test.js

import { createCloudDriver, PRIMARY_KEYS } from '../../repository/driver-cloud.js';
import { createRepository } from '../../repository/index.js';
import { createOrchestrator } from '../../core/orchestrator.js';
import { create as createGate } from '../../services/gate.js';
import { importCorpus } from '../../tools/import-corpus.js';
import corpus from '../../data/corpus/jaffa-01.json' with { type: 'json' };
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };
import { fakePostgrest, manualSchedule } from '../helpers/cloud.js';
import { createChecker } from '../helpers/assert.js';

const { check, checkThrowsAsync, report } = createChecker('כלי הייבוא של הקורפוס');

// audit_log נושא שתי שורות לכל request_id, ולכן המפתח הראשי שלו אינו
// מפתח ייחודי ברשת המדומה.
const KEYS = Object.fromEntries(Object.entries(PRIMARY_KEYS).filter(([table]) => table !== 'audit_log'));
const seed = { modules: modulesFile, allow_list: allowFile };
const callerOf = (id) => modulesFile.modules.find((m) => m.id === id).caller;

function build({ tables = {} } = {}) {
  const net = fakePostgrest({ tables, keys: KEYS });
  const driver = createCloudDriver({ url: 'https://test.invalid', key: 'test-key', fetch: net.fetch, seed, schedule: manualSchedule() });
  return { net, driver };
}

// --- בלי דרייבר: נזרק ---

await checkThrowsAsync('בלי דרייבר: נזרק', () => importCorpus({}));

// --- ההרצה היבשה ---

const { net, driver } = build();
const first = await importCorpus({ driver });

check('נכתבו מסלול אחד, מקור אחד ו-19 פריטים, וכל מפתחות ה-reference',
  first.written, { reference: Object.keys(referenceFile.values).length, sites: 1, sources: 1, items: 19 });
check('לא דולג דבר בהרצה הראשונה', first.skipped, { reference: 0, sites: 0, sources: 0, items: 0 });
check('אין כשלים במודול', first.failures, []);
check('התור התרוקן למסד, בלי דחיות', [first.flush, first.rejected], [{ queued: 0, failed: 0 }, []]);

const items = net.rows('content_items');
check('19 פריטים במסד, כולם draft', [items.length, items.filter((row) => row.status === 'draft').length], [19, 19]);
check('כל פריט במסלול jaffa-01 ומפנה למקור שנרשם',
  items.filter((row) => row.site_id !== 'jaffa-01' || row.source_id !== net.rows('sources')[0].source_id).map((r) => r.name), []);
check('word_count חושב בידי BE-05 ושווה לקובץ',
  corpus.items.filter((item) => items.find((row) => row.name === item.name)?.word_count !== item.word_count).map((i) => i.item_id), []);
check('audience נשמר כפי שהגיע', items.filter((row) => row.audience !== 'כולם').length, 0);

const anchors = net.rows('geo_anchors');
check('19 עוגנים, אף אחד לא מאומת ואף אחד לא חצייה',
  [anchors.length, anchors.filter((a) => a.verified === false && a.is_crossing === false).length], [19, 19]);
check('לכל פריט עוגן אחד עם הקואורדינטות מהקובץ',
  corpus.items.filter((item) => {
    const row = items.find((r) => r.name === item.name);
    const anchor = anchors.find((a) => a.item_id === row?.item_id);
    return !anchor || anchor.lat !== item.lat || anchor.lng !== item.lng;
  }).map((i) => i.item_id), []);

const approvals = net.rows('approvals');
check('19 רשומות יצירה ב-APPROVALS, בשם הפונה של מסך התוכן',
  [approvals.length, approvals.filter((a) => a.action === 'create_item' && a.who === callerOf('FE-07') && a.to_status === 'draft').length], [19, 19]);

const audit = net.rows('audit_log');
check('40 שורות audit_log: 20 בקשות, כל אחת עם שורת בקשה ושורת תשובה', audit.length, 40);
const byRequest = new Map();
for (const row of audit) byRequest.set(row.request_id, [...(byRequest.get(row.request_id) ?? []), row.phase]);
check('לכל request_id בדיוק זוג בקשה ותשובה',
  [...byRequest.values()].filter((phases) => phases.sort().join() !== 'request,response').length, 0);
check('כל הבקשות מהפונה של מסך התוכן', audit.filter((row) => row.from_module !== callerOf('FE-07')).length, 0);

check('רשומת המסלול נזרעה כפי שבקובץ', net.rows('sites'), [corpus.site]);
check('המקור נרשם דרך register_source עם השדות מהקובץ, ו-BE-05 הקצה לו מזהה',
  (({ source_id, name, file, publisher }) => ({ generated: source_id.startsWith('src-'), name, file, publisher }))(net.rows('sources')[0]),
  { generated: true, name: corpus.source.name, file: corpus.source.file, publisher: corpus.source.publisher });
check('ההתאמה בין מזהה הקורפוס למזהה הרשומה מלאה',
  [first.mapping.length, first.mapping.every(([corpusId, itemId]) => corpusId.startsWith('J-') && itemId.startsWith('item-'))], [19, true]);

// --- טבלת המוכנות אחרי הייבוא: L1 נכשל על 19, וזה המצב הנכון ---

{
  const repository = createRepository(driver);
  const orchestrator = createOrchestrator({ repository, handlers: { 'BE-06': createGate({ repository }) } });
  const readiness = await orchestrator.handle({ from: callerOf('FE-08'), module: 'BE-06', action: 'get_lock_readiness', payload: { site_id: 'jaffa-01' }, lang: 'he' });
  const l1 = readiness.data?.readiness?.conditions?.find((c) => c.id === 'L1');
  check('אחרי הייבוא המסלול אינו מוכן לנעילה', readiness.data?.readiness?.ready, false);
  check('L1 נכשל על 19 הפריטים, מפני שכולם draft', [l1?.passes, l1?.failing?.length], [false, 19]);
}

// --- הרצה שנייה: אפס נכתב ---

const second = await importCorpus({ driver: build({ tables: { ...net.state } }).driver });
check('הרצה שנייה אינה מכפילה דבר', second.written, { reference: 0, sites: 0, sources: 0, items: 0 });
check('והכול דולג', second.skipped, { reference: Object.keys(referenceFile.values).length, sites: 1, sources: 1, items: 19 });

// --- קואורדינטה מחוץ לגבולות: הפריט נדחה ואינו נכתב ---

{
  const moved = structuredClone(corpus);
  moved.items[0].lat = moved.site.bounds.max_lat + 1;
  const run = build();
  const result = await importCorpus({ driver: run.driver, corpus: moved });
  check('18 נכתבו ואחד נדחה', [result.written.items, result.failures.length], [18, 1]);
  check('הדחייה היא E-ANCHOR-OUT-OF-BOUNDS על הפריט שהוזז',
    [result.failures[0].item_id, result.failures[0].code], [moved.items[0].item_id, 'E-ANCHOR-OUT-OF-BOUNDS']);
  check('הפריט שנדחה אינו במסד, וגם לא עוגנו ולא רשומתו',
    [run.net.rows('content_items').length, run.net.rows('geo_anchors').length, run.net.rows('approvals').length], [18, 18, 18]);
  check('הבקשה שנדחתה נרשמה ב-audit_log עם הקוד',
    run.net.rows('audit_log').some((row) => row.phase === 'response' && JSON.stringify(row).includes('E-ANCHOR-OUT-OF-BOUNDS')), true);
}

report(` (${items.length} פריטים, ${audit.length} שורות יומן)`);
