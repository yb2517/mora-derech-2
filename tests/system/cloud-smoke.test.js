// System: בדיקת העשן החיה של דרייבר הענן. משימה 13.6 בתוכנית שלב 5
// חלק ב.
//
// המקור: בדיקת הקבלה של שלב 1 במסמך הבנייה סעיף 6 ("שולחים בקשה
// מותרת: עוברת, ונרשמות שתי שורות audit_log עם אותו request_id"),
// ובדיקת הקבלה של שלב 3 ("החוקר מאשר פריט, ורואה רשומת APPROVALS"),
// שתיהן מול המסד עצמו ולא מול הזיכרון: אחרי הכתיבה נפתח דרייבר
// שני שמושך מהמסד, ומה שהוא רואה הוא העדות.
//
// רצה רק כשמשתני הסביבה קיימים. בלעדיהם היא מדווחת דילוג, ולא
// ירוק: מערך שעובר מפני שלא ניסה אינו מערך.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node tests/system/cloud-smoke.test.js

import { createChecker } from '../helpers/assert.js';
import { ENV_NAMES, createCloudDriver } from '../../repository/driver-cloud.js';

const { check, report } = createChecker('System: עשן חי מול מסד הענן');

const url = process.env[ENV_NAMES.url];
const key = process.env[ENV_NAMES.key];

if (!url || !key) {
  report(` (דולג: אין ${ENV_NAMES.url} ו-${ENV_NAMES.key} בסביבה)`);
} else {
  const { createRepository } = await import('../../repository/index.js');
  const { createOrchestrator } = await import('../../core/orchestrator.js');
  const { createEndpoint } = await import('../../screens/endpoint.js');
  const { create: createGovernance } = await import('../../services/governance.js');
  const { create: createGate } = await import('../../services/gate.js');
  const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
  const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
  const demo = (await import('../../data/demo/demo-data.json', { with: { type: 'json' } })).default;

  const seed = { modules: modulesFile, allow_list: allowFile };
  const callerOf = (id) => modulesFile.modules.find((m) => m.id === id).caller;

  const driver = createCloudDriver({ env: process.env, seed });
  await driver.load();
  check('המסד נמשך, ו-reference נזרע', typeof driver.readTable('reference')?.geofence_radius_m, 'number');

  const repository = createRepository(driver);
  const handlers = { 'BE-05': createGovernance({ repository }), 'BE-06': createGate({ repository }) };
  const orchestrator = createOrchestrator({ repository, handlers });
  const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

  // 1. בקשה מותרת: שתי שורות audit_log עם אותו request_id, במסד.
  const gate = await send({ from: callerOf('FE-06'), module: 'BE-06', action: 'get_gate', payload: { site_id: demo.sites[0].site_id }, lang: 'he' });
  check('get_gate עובר', gate.ok, true);
  const requestId = repository.listAudit().at(-1)?.request_id;
  check('יש request_id', typeof requestId, 'string');

  // 2. אישור פריט: פריט חדש למסלול ההדגמה, submit ואז approve.
  const site = demo.sites[0];
  const created = await send({
    from: callerOf('FE-07'), module: 'BE-05', action: 'create_item', lang: 'he',
    payload: {
      site_id: site.site_id, stop_id: site.stops[0], source_id: demo.sources[0].source_id,
      name: 'smoke-test', text: 'פריט בדיקת עשן. נכתב בידי מערך הבדיקות ואינו תוכן.', page: 1,
      lat: (site.bounds.min_lat + site.bounds.max_lat) / 2, lng: (site.bounds.min_lng + site.bounds.max_lng) / 2,
    },
  });
  check('create_item עובר', created.ok, true);
  const itemId = created.data?.item?.item_id;
  const submitted = await send({ from: callerOf('FE-06'), module: 'BE-05', action: 'submit', payload: { item_id: itemId }, lang: 'he' });
  const approved = await send({ from: callerOf('FE-06'), module: 'BE-05', action: 'approve', payload: { item_id: itemId }, lang: 'he' });
  check('submit ואז approve עוברים', [submitted.ok, approved.ok], [true, true]);

  const flushed = await driver.flush();
  check('התור התרוקן למסד, בלי דחיות', flushed, { queued: 0, failed: 0 });

  // העדות: דרייבר שני, שמושך מהמסד בלבד.
  const witness = createCloudDriver({ env: process.env, seed });
  await witness.load();
  const audit = witness.readTable('audit_log').filter((row) => row.request_id === requestId);
  check('במסד: שתי שורות audit_log עם אותו request_id', audit.map((row) => row.phase), ['request', 'response']);
  check('השורה חוזרת עם from ועם התוצאה', [audit[0].from, audit[1].ok], [callerOf('FE-06'), true]);
  const approvals = witness.readTable('approvals').filter((row) => row.target === itemId);
  check('במסד: רשומות APPROVALS לפריט, יצירה, הגשה ואישור', approvals.map((row) => row.action), ['create_item', 'submit', 'approve']);
  check('הפריט במסד במצב approved', witness.readTable('content_items').find((row) => row.item_id === itemId)?.status, 'approved');

  report(` (${url.replace(/^https?:\/\//, '').split('.')[0]}, פריט ${itemId})`);
}
