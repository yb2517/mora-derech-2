// הבדיקה האדומה השנייה, מפה 6.5 ו-usecase-f-08 L1.
//
// "פריט approved בלי רשומת APPROVALS עובר את L1 (F-08)."
//
// כשל אמיתי בה **חוסם שחרור**: פירושו שמסלול יכול להינעל על תוכן
// שהחוקר מעולם לא ראה, וזו כל שרשרת שער B.
//
// ההזרקה היא הדרך היחידה שבה המצב הזה נוצר: הקוד עצמו אינו מאפשר
// אותו, מפני ש-BE-05 כותב את הרשומה לפני המצב (BL-01). הבדיקה
// כותבת ישירות לאחסון, כלומר מדמה מה שהיה קורה אילו מישהו ערך את
// הנתונים מתחת למערכת, וזה בדיוק מה ש-L1 בא לתפוס.
//
//   node tests/system/red-02-approved-without-record.test.js

import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('אדומה F-08: פריט approved בלי רשומה');

const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { create: createGovernance } = await import('../../services/governance.js');
const { create: createGate } = await import('../../services/gate.js');

const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
const referenceFile = (await import('../../data/reference.json', { with: { type: 'json' } })).default;

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

const item = (id, status) => ({
  item_id: id, site_id: 'site-red', stop_id: 'stop-1', status,
  source_id: 'src-red', page: 3, audience: 'כולם', name: id, text: 'טקסט הפריט.',
});

const anchor = (id) => ({
  anchor_id: `anch-${id}`, item_id: id, lat: 31.781, lng: 35.219,
  verified: true, verified_at: '2026-09-02T00:00:00.000Z', is_crossing: false,
});

const approvalFor = (id) => ({
  approval_id: `appr-${id}`, time: '2026-09-03T00:00:00.000Z', who: 'screen-veto',
  target: id, action: 'approve', from_status: 'pending', to_status: 'approved', note: '',
});

// מסלול שכל תנאיו מתקיימים, ופריט אחד שהוזרק: מצבו approved, ואין
// לו רשומה שמעידה שמישהו העביר אותו לשם.
const seed = {
  modules: modulesFile,
  allow_list: allowFile,
  reference: referenceFile.values,
  sites: [{
    site_id: 'site-red', name: 'מסלול', stops: ['stop-1'], status: 'open',
    bounds: { min_lat: 31.77, max_lat: 31.79, min_lng: 35.20, max_lng: 35.23 },
    locked_at: null, corpus_version: null,
  }],
  sources: [{ source_id: 'src-red', name: 'מקור' }],
  institutes: [{ institute_id: 'inst-red', name: 'מכון' }],
  rights_mou: [{
    mou_id: 'mou-red', institute_id: 'inst-red', scope: ['src-red'],
    signed_at: '2026-09-01T00:00:00.000Z', valid_until: '2099-01-01T00:00:00.000Z',
  }],
  content_items: [item('item-honest', 'approved'), item('item-smuggled', 'approved')],
  geo_anchors: [anchor('item-honest'), anchor('item-smuggled')],
  // הרשומה קיימת לאחד בלבד. זו ההזרקה.
  approvals: [approvalFor('item-honest')],
};

const repository = createRepository(createBrowserDriver({ storage: memoryStorage(), seed }));
const orchestrator = createOrchestrator({
  repository,
  handlers: {
    'BE-05': createGovernance({ repository }),
    'BE-06': createGate({ repository }),
  },
});
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

const readiness = () => send({
  from: 'screen-owner', module: 'BE-06', action: 'get_lock_readiness', payload: { site_id: 'site-red' },
});
const lock = () => send({
  from: 'screen-owner', module: 'BE-05', action: 'lock_site', payload: { site_id: 'site-red' },
});

// --- ההגנה, בשני המקומות שבהם L1 נבדק ---

{
  const response = await readiness();
  const l1 = response.data.readiness.conditions.find((row) => row.id === 'L1');

  check('טבלת המוכנות רצה', response.ok, true);
  check('L1 נכשל', l1.passes, false);
  check('והפריט שהוזרק חוזר בשמו', l1.failing, ['item-smuggled']);
  check('והפריט שעבר את הווטו אינו ברשימה', l1.failing.includes('item-honest'), false);
  check('והמסלול אינו מוכן לנעילה', response.data.readiness.ready, false);
}

{
  const response = await lock();

  check('הנעילה נדחית', response.error.code, 'E-LOCK-REFUSED');
  check('והכשל הוא L1', response.error.data.failed, ['L1']);
  check('והמסלול נשאר פתוח', repository.getSite('site-red').status, 'open');
  check('ו-corpus_version לא התקדם', repository.getSite('site-red').corpus_version, null);
}

// --- הבדיקה ספציפית: רשומה שאינה אישור אינה מספיקה ---

{
  // "נוצר" אינו "אושר". אילו L1 היה מסתפק בקיום רשומה כלשהי, כל
  // פריט היה עובר, מפני שלכל פריט שנוצר דרך create_item יש רשומה.
  repository.appendApproval({
    approval_id: 'appr-created', time: '2026-09-03T00:00:00.000Z', who: 'screen-content',
    target: 'item-smuggled', action: 'create_item', from_status: null, to_status: 'draft', note: '',
  });

  const response = await readiness();
  check('רשומת יצירה אינה פותחת את L1',
    response.data.readiness.conditions.find((row) => row.id === 'L1').failing, ['item-smuggled']);
}

// --- ובצד השני: מסלול תקין כן נעיל ---

{
  // אם ההגנה חוסמת גם מסלול תקין, היא אינה מודדת דבר. הפריט עובר
  // את המסלול המלא דרך הווטו, ורק אז הנעילה מצליחה.
  await send({ from: 'screen-veto', module: 'BE-05', action: 'return', payload: { item_id: 'item-smuggled' } });
  await send({ from: 'screen-veto', module: 'BE-05', action: 'approve', payload: { item_id: 'item-smuggled' } });

  const ready = await readiness();
  check('אחרי מעבר דרך הווטו L1 עובר',
    ready.data.readiness.conditions.find((row) => row.id === 'L1').passes, true);

  const locked = await lock();
  check('והנעילה מצליחה', locked.ok, true);
  check('והמסלול נעול', repository.getSite('site-red').status, 'locked');
  check('ו-corpus_version הוא 1', repository.getSite('site-red').corpus_version, 1);
}

report();
