// System: F-08 מקצה לקצה על 19 הטקסטים של הקורפוס. משימה 9 בתוכנית
// שלב 7.
//
// המקור: CLAUDE.md סעיף 6 שורת שלב 7 ("L1 עד L4 עוברים על 19 הפריטים;
// נעילה ראשונה מצליחה ונרשמת"); מפה 6.3 (אשכול הנורמה: "נעילה
// קודמת"); מפה 6.1 שורת BE-05 (lock_site עם תחנה בלי approved:
// E-LOCK-REFUSED); BL-06, BL-07, BL-08; usecase-f-08 סעיפים 4, 6ב ו-6ו.
//
// הזרימה: כלי הייבוא מכניס את הקורפוס בהרצה יבשה מול הרשת המדומה
// (19 draft), ואז המעטפות נשלחות כפי שהמסכים שולחים אותן: הסכם
// סינתטי מהמסך של בעלת הפרויקט, הגשה ואישור מפאנל הווטו, אימות
// העוגנים ונקודת יציאה ממסך התוכן, ונעילה. ההסכם והאישורים כאן הם
// של הבדיקה בלבד: במסד החי הם פעולות אדם (תוכנית שלב 7 הכרעות 4 ו-8).
//
//   node tests/system/f-08-corpus-lock.test.js

import { createCloudDriver, PRIMARY_KEYS } from '../../repository/driver-cloud.js';
import { createRepository } from '../../repository/index.js';
import { createOrchestrator } from '../../core/orchestrator.js';
import { createEndpoint } from '../../screens/endpoint.js';
import { create as createGovernance } from '../../services/governance.js';
import { create as createGate } from '../../services/gate.js';
import { importCorpus } from '../../tools/import-corpus.js';
import corpus from '../../data/corpus/jaffa-01.json' with { type: 'json' };
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import { fakePostgrest, manualSchedule } from '../helpers/cloud.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('System: F-08 על הקורפוס, מהייבוא לנעילה');

const KEYS = Object.fromEntries(Object.entries(PRIMARY_KEYS).filter(([table]) => table !== 'audit_log'));
const callerOf = (id) => modulesFile.modules.find((m) => m.id === id).caller;
const SITE = corpus.site.site_id;

const net = fakePostgrest({ keys: KEYS });
const driver = createCloudDriver({
  url: 'https://test.invalid', key: 'test-key', fetch: net.fetch, schedule: manualSchedule(),
  seed: { modules: modulesFile, allow_list: allowFile },
});

// --- הייבוא: 19 draft ---

const imported = await importCorpus({ driver });
check('הייבוא הכניס 19 פריטים', [imported.written.items, imported.failures.length], [19, 0]);

const repository = createRepository(driver);
const orchestrator = createOrchestrator({
  repository,
  handlers: { 'BE-05': createGovernance({ repository }), 'BE-06': createGate({ repository }) },
});
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });
const ask = (screen, module, action, payload = {}) => send({ from: callerOf(screen), module, action, payload, lang: 'he' });
const readiness = async () => (await ask('FE-08', 'BE-06', 'get_lock_readiness', { site_id: SITE })).data.readiness;
const condition = (r, id) => r.conditions.find((c) => c.id === id);

const items = repository.listItems({ site_id: SITE });
const sourceId = repository.listSources()[0].source_id;

{
  const before = await readiness();
  check('לפני הכול: L1 נכשל על 19, L2 על 14 תחנות, L4 בלי הסכם',
    [condition(before, 'L1').failing.length, condition(before, 'L2').failing.length, condition(before, 'L4').passes],
    [19, 14, false]);
}

// --- ההסכם: מכון והסכם על המקור, מהמסך של בעלת הפרויקט (usecase-f-07 צעדים 12 ו-13) ---

const institute = await ask('FE-08', 'BE-05', 'register_institute', { name: 'מכון לבדיקה' });
const mou = await ask('FE-08', 'BE-05', 'register_mou', {
  institute_id: institute.data.institute.institute_id, scope: [sourceId],
  signed_at: '2026-09-01T00:00:00.000Z', valid_until: '2099-01-01T00:00:00.000Z', covers_content_contribution: true,
});
check('המכון וההסכם נרשמו', [institute.ok, mou.ok], [true, true]);

// --- הביקורת: הגשה ואישור של 19 הפריטים מפאנל הווטו (usecase-f-07 צעדים 1 עד 11) ---

let submitted = 0;
let approved = 0;
for (const item of items) {
  const s = await ask('FE-06', 'BE-05', 'submit', { item_id: item.item_id });
  const a = await ask('FE-06', 'BE-05', 'approve', { item_id: item.item_id, note: 'נבדק מול המקור' });
  submitted += s.ok ? 1 : 0;
  approved += a.ok ? 1 : 0;
}
check('19 הוגשו ו-19 אושרו', [submitted, approved], [19, 19]);
check('לכל פריט שלוש רשומות: יצירה, הגשה, אישור',
  items.filter((item) => repository.listApprovals({ target: item.item_id }).map((r) => r.action).join() !== 'create_item,submit,approve').length, 0);

{
  const afterReview = await readiness();
  check('אחרי הביקורת: L1, L2 ו-L4 עוברים, L3 נכשל על 19 עוגנים לא מאומתים',
    ['L1', 'L2', 'L3', 'L4'].map((id) => condition(afterReview, id).passes), [true, true, false, true]);
  check('L3 מונה את 19 הפריטים', condition(afterReview, 'L3').failing.length, 19);
}

// --- הנעילה נדחית כשעוגן אחד לא אומת (usecase-f-08 זרימה ב, מפה 6.1) ---

const anchors = repository.listAnchors({ site_id: SITE });
for (const anchor of anchors.slice(1)) {
  await ask('FE-07', 'BE-05', 'verify_anchor', { anchor_id: anchor.anchor_id });
}
{
  const refused = await ask('FE-08', 'BE-05', 'lock_site', { site_id: SITE });
  const unverified = repository.getAnchor(anchors[0].anchor_id);
  check('עוגן אחד לא מאומת: E-LOCK-REFUSED עם L3', [refused.ok, refused.error?.code, refused.error?.data?.failed], [false, 'E-LOCK-REFUSED', ['L3']]);
  check('הדחייה מונה בדיוק את הפריט של העוגן', refused.error?.data?.conditions.find((c) => c.id === 'L3').failing, [unverified.item_id]);
  check('המסלול נשאר open בלי גרסה', [repository.getSite(SITE).status, repository.getSite(SITE).corpus_version], ['open', null]);
}

// --- אימות השטח מסתיים: העוגן האחרון, עם is_crossing, ונקודת יציאה (usecase-f-13) ---

const crossing = await ask('FE-07', 'BE-05', 'verify_anchor', { anchor_id: anchors[0].anchor_id, is_crossing: true, note: 'צומת' });
check('העוגן האחרון אומת וסומן חצייה', [crossing.ok, crossing.data?.anchor?.verified, crossing.data?.anchor?.is_crossing], [true, true, true]);
check('לכל 19 העוגנים ערך is_crossing מפורש, ו-18 בטוחים',
  (() => { const all = repository.listAnchors({ site_id: SITE }); return [all.filter((a) => typeof a.is_crossing === 'boolean').length, all.filter((a) => a.is_crossing === false).length]; })(),
  [19, 18]);
const exit = await ask('FE-07', 'BE-05', 'register_exit_point', { site_id: SITE, name: 'תחנת הרכבת הקלה', lat: 31.7815, lng: 35.2185, type: 'תחבורה ציבורית' });
check('נקודת יציאה נרשמה', exit.ok, true);

// --- הנעילה הראשונה מצליחה ונרשמת (CLAUDE.md סעיף 6) ---

{
  const ready = await readiness();
  check('L1 עד L4 עוברים על 19 הפריטים', [ready.ready, ...['L1', 'L2', 'L3', 'L4'].map((id) => condition(ready, id).passes)], [true, true, true, true, true]);

  const locked = await ask('FE-08', 'BE-05', 'lock_site', { site_id: SITE, note: 'נעילה ראשונה' });
  check('lock_site מצליח עם corpus_version 1', [locked.ok, locked.data?.corpus_version], [true, 1]);
  const site = repository.getSite(SITE);
  check('המסלול נעול, עם זמן וגרסה', [site.status, typeof site.locked_at, site.corpus_version], ['locked', 'string', 1]);
  const record = repository.listApprovals({ target: SITE }).at(-1);
  check('רשומת הנעילה: מי, מהמצב, למצב, ומספר הגרסה בהערה',
    [record.who, record.action, record.from_status, record.to_status, record.note.includes('corpus_version 1')],
    [callerOf('FE-08'), 'lock_site', 'open', 'locked', true]);
  await driver.flush();
  check('הרשומה והמצב הגיעו למסד המדומה',
    [net.rows('sites')[0].status, net.rows('approvals').some((r) => r.action === 'lock_site' && r.target === SITE)], ['locked', true]);

  const gate = await ask('FE-06', 'BE-06', 'get_gate', { site_id: SITE });
  check('שער B פתוח: נעול ו-M-06 אחד (BL-08)', [gate.data?.gate?.open, gate.data?.coverage?.m06], [true, 1]);
}

// --- עריכה אחרי נעילה: המסלול נפתח (L6, BL-07, usecase-f-08 זרימה ו) ---

{
  const target = items[0];
  const edited = await ask('FE-07', 'BE-05', 'edit_item', { item_id: target.item_id, text: `${target.text} תוספת.`, note: 'תיקון מול התמונה' });
  check('עריכת פריט מאושר מחזירה אותו ל-draft ופותחת את המסלול', [edited.ok, edited.data?.status, edited.data?.site_reopened], [true, 'draft', true]);
  check('המסלול open, והגרסה נשמרת לנעילה הבאה', [repository.getSite(SITE).status, repository.getSite(SITE).corpus_version], ['open', 1]);
  const reopened = repository.listApprovals({ target: SITE }).at(-1);
  check('רשומת הפתיחה: מ-locked ל-open בעקבות edit_item', [reopened.action, reopened.from_status, reopened.to_status], ['edit_item', 'locked', 'open']);
  const gate = await ask('FE-06', 'BE-06', 'get_gate', { site_id: SITE });
  check('שער B נסגר עד נעילה מחדש', gate.data?.gate?.open, false);
  const again = await readiness();
  check('L1 נכשל על הפריט שנערך בלבד', condition(again, 'L1').failing, [target.item_id]);
}

// --- כל בקשה נרשמה (מבחן מבנה 04) ---

const audit = repository.listAudit();
check('כל בקשה בזרימה הותירה זוג שורות עם request_id משותף',
  audit.length % 2 === 0 && audit.every((row) => typeof row.request_id === 'string'), true);

report(` (${items.length} פריטים, ${audit.length / 2} בקשות)`);
