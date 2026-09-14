// System: F-07 מקצה לקצה, ה-Slice הראשון. משימה 8 בתוכנית שלב 3.
//
// המקור: מפה 6.3 (בדיקות System לפי מקרי השימוש), מפה סעיף 7 שורת
// שלב 3 ("UAT של החוקר ושל בעלת הפרויקט; BL-01"), usecase-f-07
// (הזרימה הראשית, השלמת הקורפוס, וזרימות א, ב, ג, ד).
//
// זו הבדיקה שמוכיחה את טענת השלב: מעטפה שיוצאת ממסך נוסעת דרך
// ה-Orchestrator למודול אמיתי, נבדקת מול טבלת המעברים שבליבה,
// מותירה רשומת ביקורת, משנה נתונים שנשמרים, ומשנה את מה שהמסך
// הבא רואה.
//
// השרשרת מורכבת כאן בדיוק כפי שנקודת הכניסה מרכיבה אותה, כולל
// הזרקת ה-Repository למודולים. BE-07 אינו מורכב, ובכוונה: הוא שלב
// 4, ובקשה אליו מראה מה קורה למודול שטרם נבנה.
//
//   node tests/system/f-07-slice.test.js

import { installDom } from '../helpers/dom.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('System: F-07 מקצה לקצה');

const dom = installDom();

const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { DEMO_SEED } = await import('../../tools/demo-modules.js');
const { create: createGovernance } = await import('../../services/governance.js');
const { create: createGate } = await import('../../services/gate.js');
const { create: createVeto } = await import('../../screens/veto/index.js');
const { create: createAdmin } = await import('../../screens/admin/index.js');

const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
const referenceFile = (await import('../../data/reference.json', { with: { type: 'json' } })).default;

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

// אותו אחסון לשתי ההרכבות, ולכן "רענון הדף" כאן הוא הרכבה שנייה
// מעל אותם נתונים, בדיוק כמו בדפדפן.
const storage = memoryStorage();

// נתוני ההדגמה נטענים בלי רשומות ההסכם, כדי שהריצה תתחיל מ-M-06 = 0
// ותראה אותו עולה ל-1 ברישום. נתוני ההדגמה המאושרים נושאים הסכם
// אחד, ולכן הסרתו כאן היא הכנת תרחיש ולא שינוי נתונים.
const seed = {
  modules: modulesFile,
  allow_list: allowFile,
  reference: referenceFile.values,
  ...DEMO_SEED,
  rights_mou: [],
};

function compose() {
  const repository = createRepository(createBrowserDriver({ storage, seed }));
  const handlers = {
    'BE-05': createGovernance({ repository }),
    'BE-06': createGate({ repository }),
  };
  const orchestrator = createOrchestrator({ repository, handlers });
  const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });
  return { repository, send };
}

const callerOf = (id) => modulesFile.modules.find((m) => m.id === id).caller;
const reference = { error_human_text: referenceFile.values.error_human_text };

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => { setTimeout(resolve, 0); });
};

const text = () => dom.host.textContent;
const buttons = () => dom.host.querySelectorAll('button');
const byLabel = (label) => buttons().find((b) => b.textContent.trim() === label);

// =====================================================================
// חלק א: החוקר. הזרימה הראשית, צעדים 5 עד 11
// =====================================================================

const first = compose();

createVeto({
  host: dom.host, from: callerOf('FE-06'), reference, send: first.send,
});
await settle();

check('המסלול נטען מ-BE-06', text().includes('מסלול הדגמה'), true);
check('בלי הסכם: M-06 = 0', text().includes('M-06: 0'), true);
check('והשער חסום משתי הסיבות', [
  text().includes('אין הסכם חתום'), text().includes('המסלול אינו נעול'),
], [true, true]);

// צעד 5: החוקר פותח פריט ורואה את הטקסט המלא ואת העמוד במקור.
{
  const row = dom.host.querySelectorAll('.list__head')
    .find((node) => node.textContent.includes('פריט שהוגש להכרעה'));
  row.click();
  await settle();

  check('הטקסט המלא מוצג', dom.host.querySelector('.quote').textContent.length > 0, true);
  check('המקור והעמוד מוצגים', text().includes('חוברת הדגמה'), true);
}

// צעד 6 עד 11: החוקר מאשר, והמסך מציג את התוצאה.
{
  const before = first.repository.listApprovals().length;

  dom.host.querySelector('textarea').type('נבדק מול המקור');
  byLabel('אישור').click();
  await settle();

  check('המצב על המסך השתנה', text().includes('מ-הוגש ל-מאושר'), true);
  check('נוספה רשומה אחת ליומן', first.repository.listApprovals().length, before + 1);

  // בדיקת הקבלה של השלב: זמן, מבצע, מצב קודם, מצב חדש.
  const record = first.repository.listApprovals().at(-1);
  check('הרשומה נושאת את המבצע', record.who, callerOf('FE-06'));
  check('ואת שני המצבים', [record.from_status, record.to_status], ['pending', 'approved']);
  check('ואת ההערה', record.note, 'נבדק מול המקור');
  check('ויש לה זמן וזיהוי', [typeof record.time, typeof record.approval_id], ['string', 'string']);

  check('הפריט נשמר במצבו החדש', first.repository.getItem('item-demo-3').status, 'approved');
  check('והיומן שעל המסך גדל', dom.host.querySelectorAll('.log__entry').length, 6);
}

// זרימה ד: אותו אישור פעם שנייה נדחה, ואינו מותיר רשומה.
{
  const before = first.repository.listApprovals().length;
  const denied = await first.send({
    from: callerOf('FE-06'), module: 'BE-05', action: 'approve', payload: { item_id: 'item-demo-3' },
  });
  check('אישור חוזר נדחה', denied.error.code, 'E-TRANSITION-DENIED');
  check('ואין רשומה חדשה', first.repository.listApprovals().length, before);
}

// זרימה ג: אותה פעולה, ממסך שאינו מורשה.
{
  const denied = await first.send({
    from: callerOf('FE-05'), module: 'BE-05', action: 'approve', payload: { item_id: 'item-demo-7' },
  });
  check('approve ממסך המטייל נדחה', denied.error.code, 'E-ALLOW-DENIED');
  check('והפריט לא נגע', first.repository.getItem('item-demo-7').status, 'pending');
}

// =====================================================================
// חלק ב: בעלת הפרויקט. צעדים 12 עד 15
// =====================================================================

dom.host.replaceChildren();

const owner = compose();
const ownerScreen = createAdmin({
  host: dom.host,
  from: { 'FE-07': callerOf('FE-07'), 'FE-08': callerOf('FE-08') },
  reference,
  send: owner.send,
});
await settle();

await ownerScreen.switchRole('owner');
await settle();

check('אין הסכמים רשומים', text().includes('אין הסכמים רשומים'), true);

// פאנל שהמודול שלו טרם נבנה אומר זאת, ואינו מפיל את המסך.
check('פאנל המדדים מציג את הכשל', dom.host.querySelectorAll('.message--error').length > 0, true);
check('ופאנל ההסכמים ממשיך לעבוד', text().includes('רישום הסכם'), true);

// שדה חסר: הבקשה נשלחת, והמודול מחזיר את שם השדה.
{
  byLabel('רישום הסכם').click();
  await settle();
  check('הסכם בלי מכון נדחה בשדה', dom.host.querySelectorAll('.field--invalid').length > 0, true);
  check('ולא נרשם דבר', owner.repository.listMou().length, 0);
}

// צעד 12: הרישום המלא.
{
  const institute = dom.host.querySelectorAll('select')
    .find((node) => node.getAttribute('id') === 'mou-institute_id');
  institute.type('inst-demo-1');
  await settle();

  // ההיקף: בחירת המקור שהמסלול משתמש בו.
  byLabel('חוברת הדגמה: רחוב יפו').click();
  await settle();

  const dates = dom.host.querySelectorAll('input')
    .filter((node) => node.getAttribute('type') === 'date');
  dates[0].type('2026-09-01');
  dates[1].type('2027-09-01');
  await settle();

  byLabel('רישום הסכם').click();
  await settle();

  check('ההסכם נרשם', owner.repository.listMou().length, 1);
  const mou = owner.repository.listMou()[0];
  check('עם המכון שנבחר', mou.institute_id, 'inst-demo-1');
  check('ועם ההיקף שנבחר', mou.scope, ['src-demo-1']);
  check('ועם שני התאריכים', [mou.signed_at, mou.valid_until], ['2026-09-01', '2027-09-01']);
  check('והוא מכסה גם תרומת תוכן', mou.covers_content_contribution, true);
  check('והוא מוצג בטבלה', text().includes('מכון הדגמה'), true);
  check('ההודעה אומרת שהשער חושב מחדש', text().includes('מצב השער חושב מחדש'), true);
}

// =====================================================================
// חלק ג: השער אחרי הרישום, וכשל הכתיבה
// =====================================================================

// צעדים 14 ו-15, ופער 34: M-06 עלה ל-1, והשער נשאר חסום עד הנעילה.
{
  const gate = await owner.send({
    from: callerOf('FE-06'), module: 'BE-06', action: 'get_gate', payload: {},
  });
  check('M-06 = 1 אחרי הרישום', gate.data.coverage.m06, 1);
  check('והמכון המכסה הוא זה שנרשם', gate.data.coverage.institutes, ['inst-demo-1']);
  check('השער עדיין חסום', gate.data.gate.open, false);
  check('והסיבה היחידה היא שהמסלול אינו נעול', gate.data.gate.reasons, ['site_not_locked']);
}

// "רענון הדף": הרכבה שלישית מעל אותו אחסון.
{
  dom.host.replaceChildren();
  const again = compose();
  createVeto({ host: dom.host, from: callerOf('FE-06'), reference, send: again.send });
  await settle();

  check('הפריט שאושר נשאר מאושר אחרי טעינה מחדש', again.repository.getItem('item-demo-3').status, 'approved');
  check('היומן נשמר', again.repository.listApprovals().length >= 6, true);
  check('והשער מציג M-06 = 1', text().includes('M-06: 1'), true);
}

// BL-01: כשל כתיבת היומן מבטל את המעבר, דרך כל השרשרת.
{
  const broken = compose();
  const original = broken.repository.appendApproval;
  broken.repository.appendApproval = () => { throw new Error('האחסון נכשל'); };

  const before = broken.repository.getItem('item-demo-7').status;
  const response = await broken.send({
    from: callerOf('FE-06'), module: 'BE-05', action: 'approve', payload: { item_id: 'item-demo-7' },
  });

  check('הקוד הוא E-APPROVAL-WRITE-FAILED', response.error.code, 'E-APPROVAL-WRITE-FAILED');
  check('**מצב הפריט לא השתנה**', broken.repository.getItem('item-demo-7').status, before);
  check('ולקוד יש נוסח לאדם בטבלה', typeof referenceFile.values.error_human_text['E-APPROVAL-WRITE-FAILED'], 'string');

  broken.repository.appendApproval = original;
}

// --- כל בקשה מותירה שתי שורות תחת מזהה אחד (מבחן מבנה 04) ---

{
  const all = first.repository.listAudit();
  const ids = [...new Set(all.map((row) => row.request_id))];
  check('לכל בקשה שתי שורות', ids.every((id) => all.filter((r) => r.request_id === id).length === 2), true);
  check('והיומן אינו ריק', ids.length > 0, true);

  // גם בקשה שנדחתה נרשמת, עם הקוד שבו נדחתה.
  const rejected = all.filter((row) => row.rejected_with === 'E-ALLOW-DENIED');
  check('הבקשה שנדחתה נרשמה עם הקוד', rejected.length, 1);
}

// --- מודול שטרם נבנה אינו מתחזה ---

{
  const response = await first.send({
    from: callerOf('FE-08'), module: 'BE-05', action: 'lock_site', payload: {},
  });
  check('lock_site מחזיר E-MODULE-FAILED', response.error.code, 'E-MODULE-FAILED');
  check('והמסלול נשאר פתוח', first.repository.getSite().status, 'open');
}

dom.restore();
report();
