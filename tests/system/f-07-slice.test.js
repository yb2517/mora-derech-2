// System: F-07 מקצה לקצה דרך ה-Orchestrator. משימה 9 בתוכנית שלב 3.
//
// המקור: usecase-f-07 הזרימה הראשית (צעדים 1 עד 14) והזרימות
// החלופיות ב, ג ו-ד; מפה 6.3; ומסמך הבנייה סעיף 6, בדיקת הקבלה של
// שלב 3: "החוקר מאשר פריט, ורואה רשומת APPROVALS עם זמן, מבצע, מצב
// קודם וחדש. מכשילים את כתיבת ה-APPROVALS: מצב הפריט אינו משתנה".
//
// הבדיקה מרכיבה את המערכת כפי שנקודת הכניסה מרכיבה אותה, ושולחת
// מעטפות בלבד. היא אינה קוראת ל-BE-05 ישירות: זה מה שהופך אותה
// לבדיקת מערכת ולא לבדיקת יחידה.
//
//   node tests/system/f-07-slice.test.js

import { createBrowserDriver } from '../../repository/driver-browser.js';
import { createRepository } from '../../repository/index.js';
import { createOrchestrator } from '../../core/orchestrator.js';
import { create as createGovernance } from '../../services/governance.js';
import { create as createGate } from '../../services/gate.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('System: F-07 מקצה לקצה');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const SITE = { site_id: 'site-1', name: 'מסלול הבדיקה', stops: ['stop-1', 'stop-2'], status: 'open' };

const ITEMS = [
  { item_id: 'it-draft', site_id: 'site-1', stop_id: 'stop-1', status: 'draft', text: 'טקסט', page: 4, source_id: 'src-1' },
  { item_id: 'it-pending', site_id: 'site-1', stop_id: 'stop-1', status: 'pending', text: 'טקסט', page: 5, source_id: 'src-1' },
  { item_id: 'it-approved', site_id: 'site-1', stop_id: 'stop-2', status: 'approved', text: 'טקסט', page: 6, source_id: 'src-1' },
  { item_id: 'it-partial', site_id: 'site-1', stop_id: 'stop-2', status: 'draft', text: 'טקסט', source_id: 'src-1' },
  { item_id: 'it-other', site_id: 'site-2', stop_id: 'stop-9', status: 'draft', text: 'טקסט', page: 1, source_id: 'src-2' },
];

const ANCHORS = ITEMS.map((item, index) => ({
  anchor_id: `an-${index}`, item_id: item.item_id, lat: 31.78, lng: 35.21, verified: true, is_crossing: false,
}));

function build({ failApprovals = false, mou = [] } = {}) {
  const storage = memoryStorage();
  const driver = createBrowserDriver({
    storage,
    seed: {
      modules: modulesFile,
      allow_list: allowFile,
      reference: referenceFile.values,
      content_items: ITEMS.map((row) => ({ ...row })),
      approvals: [],
      sites: [{ ...SITE }],
      sources: [{ source_id: 'src-1', name: 'מקור' }, { source_id: 'src-2', name: 'מקור אחר' }],
      institutes: [{ institute_id: 'inst-1', name: 'מכון' }],
      rights_mou: mou,
      geo_anchors: ANCHORS,
    },
  });

  // זרימה ב של usecase-f-07: הדרייבר מחזיר כשל בכתיבת היומן. הכשל
  // מוזרק בשכבה הנמוכה ביותר, ולכן הוא בודק את השרשרת כולה ולא
  // מודול שמדמה לעצמו כישלון.
  const guarded = failApprovals
    ? {
      ...driver,
      appendRow(name, row) {
        if (name === 'approvals') throw new Error('כשל כתיבה מדומה');
        return driver.appendRow(name, row);
      },
    }
    : driver;

  const repository = createRepository(guarded);
  let clock = 0;
  const deps = {
    repository,
    now: () => `2026-09-14T10:00:0${clock += 1}.000Z`,
    newId: () => `id-${clock}`,
  };

  const orchestrator = createOrchestrator({
    repository,
    handlers: { 'BE-05': createGovernance(deps), 'BE-06': createGate(deps) },
    newRequestId: (() => { let n = 0; return () => `req-${n += 1}`; })(),
  });

  const send = (from, module, action, payload) => orchestrator.handle({
    from, module, action, payload, lang: 'he',
  });

  return { send, repository };
}

// --- הזרימה הראשית: צעדים 1 עד 11 ---

{
  const { send, repository } = build();

  // צעד 1 ו-2: הגשה לביקורת.
  const submitted = await send('screen-veto', 'BE-05', 'submit', { item_id: 'it-draft' });
  check('submit עבר', submitted.ok, true);
  check('הפריט עבר ל-pending', submitted.data.status, 'pending');
  check('והמצב הקודם מדווח', submitted.data.from_status, 'draft');
  check('הרשומה נכתבה', repository.getItem('it-draft').status, 'pending');

  // צעדים 5 עד 9: החוקר פותח ומאשר.
  const opened = await send('screen-veto', 'BE-05', 'getItem', { item_id: 'it-pending' });
  check('getItem מחזיר את הפריט', opened.data.item.item_id, 'it-pending');
  check('ואת הטקסט המלא, לפי צעד 5', opened.data.item.text, 'טקסט');
  check('ואת המקור', opened.data.source.source_id, 'src-1');
  check('ואת העוגן', opened.data.anchor.item_id, 'it-pending');

  const approved = await send('screen-veto', 'BE-05', 'approve', { item_id: 'it-pending', note: 'מדויק' });
  check('approve עבר', approved.ok, true);
  check('הפריט approved', repository.getItem('it-pending').status, 'approved');

  // בדיקת הקבלה של השלב: הרשומה, עם ארבעת השדות.
  const log = repository.listApprovals({ target: 'it-pending' });
  check('נרשמה רשומה אחת', log.length, 1);
  check('עם זמן', typeof log[0].time, 'string');
  check('עם מבצע', log[0].who, 'screen-veto');
  check('עם מצב קודם', log[0].from_status, 'pending');
  check('עם מצב חדש', log[0].to_status, 'approved');
  check('עם הפעולה', log[0].action, 'approve');
  check('ועם ההערה', log[0].note, 'מדויק');

  // המסך רואה את היומן דרך מעטפה, לא דרך ה-Repository (צעד 11).
  const approvals = await send('screen-veto', 'BE-05', 'listApprovals', { site_id: 'site-1' });
  check('listApprovals מחזיר את שתי הרשומות של המסלול', approvals.data.approvals.length, 2);
  check(
    'ורק של המסלול הזה',
    approvals.data.approvals.every((row) => row.target.startsWith('it-')),
    true,
  );

  // מבחן מבנה 04: שתי שורות audit_log לכל בקשה, עם אותו מזהה.
  const audit = repository.listAudit();
  check('כל בקשה הותירה שתי שורות', audit.length % 2, 0);
  const first = repository.listAudit({ request_id: 'req-1' });
  check('שתי שורות לבקשה הראשונה', first.length, 2);
  check('שתיהן עם אותו מזהה', new Set(first.map((r) => r.request_id)).size, 1);
  check('אחת בקשה ואחת תשובה', first.map((r) => r.phase), ['request', 'response']);
}

// --- זרימה ד: מעבר מצב אסור ---

{
  const { send, repository } = build();

  const denied = await send('screen-veto', 'BE-05', 'approve', { item_id: 'it-approved' });
  check('approve על פריט approved נדחה', denied.ok, false);
  check('בקוד המעבר האסור', denied.error.code, 'E-TRANSITION-DENIED');
  check('והמצב הקודם בנתוני השגיאה', denied.error.data.from_status, 'approved');
  check('הפריט לא זז', repository.getItem('it-approved').status, 'approved');
  check('ולא נרשמה רשומה', repository.listApprovals({ target: 'it-approved' }).length, 0);

  const missing = await send('screen-veto', 'BE-05', 'approve', { item_id: 'אין-כזה' });
  check('פריט שאינו קיים נדחה באותו קוד', missing.error.code, 'E-TRANSITION-DENIED');
  check('ואין לו מצב קודם', missing.error.data.from_status, null);
}

// --- תנאי השלמות של submit ---

{
  const { send, repository } = build();
  const incomplete = await send('screen-veto', 'BE-05', 'submit', { item_id: 'it-partial' });
  check('submit לפריט בלי עמוד נדחה', incomplete.ok, false);
  check('בקוד השלמות', incomplete.error.code, 'E-ITEM-INCOMPLETE');
  check('ושם השדה בנתוני השגיאה', incomplete.error.data.field, 'page');
  check('הפריט נשאר draft', repository.getItem('it-partial').status, 'draft');
}

// --- זרימה ג: בקשה ממסך שאינו מורשה ---

{
  const { send, repository } = build();
  const denied = await send('screen-traveler', 'BE-05', 'approve', { item_id: 'it-pending' });
  check('approve ממסך המטייל נדחה', denied.ok, false);
  check('בקוד רשימת המותר', denied.error.code, 'E-ALLOW-DENIED');
  check('הפריט לא זז', repository.getItem('it-pending').status, 'pending');
  check('ואין רשומה ביומן ההחלטות', repository.listApprovals().length, 0);
  check('אבל הבקשה נרשמה ב-audit_log', repository.listAudit().length, 2);
  check(
    'ושורת הבקשה נושאת את קוד הדחייה',
    repository.listAudit()[0].rejected_with,
    'E-ALLOW-DENIED',
  );
}

// --- זרימה ב: כתיבת יומן ההחלטות נכשלה. BL-01 ---

{
  const { send, repository } = build({ failApprovals: true });
  const failed = await send('screen-veto', 'BE-05', 'approve', { item_id: 'it-pending' });

  check('הבקשה נכשלה', failed.ok, false);
  check('בקוד כשל הכתיבה', failed.error.code, 'E-APPROVAL-WRITE-FAILED');
  // זו ההגנה עצמה: אין פריט מאושר בלי עדות.
  check('**מצב הפריט לא השתנה**', repository.getItem('it-pending').status, 'pending');
  check('ואין רשומה ביומן', repository.listApprovals().length, 0);
  check('והכשל נרשם ב-audit_log', repository.listAudit().at(-1).error_code, 'E-APPROVAL-WRITE-FAILED');
}

// --- צעדים 12 עד 15: רישום ההסכם ו-M-06 ---

{
  const { send } = build({ mou: [] });

  const before = await send('screen-veto', 'BE-06', 'get_gate', { site_id: 'site-1' });
  check('בלי הסכם M-06 הוא אפס', before.data.gate.m06, 0);
  check('והשער אינו פתוח', before.data.gate.open, false);
  check('הספירות מהרשומות', before.data.counts, { draft: 2, pending: 1, approved: 1, rejected: 0 });

  const registered = await send('screen-owner', 'BE-05', 'register_mou', {
    institute_id: 'inst-1',
    scope: ['src-1'],
    valid_until: '2027-01-01T00:00:00.000Z',
  });
  check('ההסכם נרשם', registered.ok, true);
  check('עם מזהה', typeof registered.data.mou.mou_id, 'string');

  const after = await send('screen-veto', 'BE-06', 'get_gate', { site_id: 'site-1' });
  check('M-06 עלה לאחד, מרשומה ולא מקבוע', after.data.gate.m06, 1);
  check('המכון המכסה מדווח', after.data.covering_institutes, ['inst-1']);
  check('ומקורות הפריטים המאושרים', after.data.sources_of_approved, ['src-1']);

  // BL-08: שער B דורש גם locked, ונעילה היא שלב 4. פער בדוח.
  check('השער עדיין אינו פתוח, מפני שהמסלול אינו נעול', after.data.gate.open, false);
  check('והמסך יודע למה', after.data.gate.locked, false);

  // הסכם שפג אינו נספר.
  const expired = await send('screen-owner', 'BE-05', 'register_mou', {
    institute_id: 'inst-1', scope: ['src-1'], valid_until: '2020-01-01T00:00:00.000Z',
  });
  check('גם הסכם שפג נרשם', expired.ok, true);
  const still = await send('screen-veto', 'BE-06', 'get_gate', { site_id: 'site-1' });
  check('אבל אינו מוסיף ל-M-06', still.data.gate.m06, 1);

  const noScope = await send('screen-owner', 'BE-05', 'register_mou', { institute_id: 'inst-1' });
  check('הסכם בלי היקף נדחה', noScope.error.code, 'E-ITEM-INCOMPLETE');
  check('ושם השדה מדווח', noScope.error.data.field, 'scope');

  const noInstitute = await send('screen-owner', 'BE-05', 'register_mou', {
    institute_id: 'inst-9', scope: ['src-1'], valid_until: '2027-01-01T00:00:00.000Z',
  });
  check('הסכם למכון שאינו רשום נדחה', noInstitute.error.data.field, 'institute_id');
}

// --- רשימת המותר: הפעולות של F-07 מותרות למסך שלהן ולו בלבד ---

{
  const { send } = build();
  const fromOwner = await send('screen-owner', 'BE-05', 'approve', { item_id: 'it-pending' });
  check('בעלת הפרויקט אינה מאשרת פריט', fromOwner.error.code, 'E-ALLOW-DENIED');

  const mouFromVeto = await send('screen-veto', 'BE-05', 'register_mou', {});
  check('החוקר אינו רושם הסכם', mouFromVeto.error.code, 'E-ALLOW-DENIED');

  const unknown = await send('screen-invented', 'BE-05', 'approve', { item_id: 'it-pending' });
  check('פונה שאינו ברשימה הסגורה', unknown.error.code, 'E-FROM-UNKNOWN');
}

report();
