// System: פאנל ה-Veto. משימה 5 בתוכנית שלב 2, ומשימה 6 בתוכנית
// שלב 3.
//
// המקור: מפה 6.3 (בדיקות System לפי מקרי השימוש), F-07,
// doc-build-03-interfaces סעיף 2.1, ובדיקות הקבלה של שתי המשימות.
//
// זו הרמה הראשונה מסוג System בפרויקט. היא מרכיבה את אותה שרשרת
// שנקודת הכניסה מרכיבה, ומפעילה את המסך כמו שמשתמש מפעיל אותו:
// לחיצה על שורה, הקלדה בשדה, לחיצה על כפתור.
//
// מה השתנה בשלב 3: השרשרת כאן אינה עוברת עוד במודול ההדגמה. BE-05
// ו-BE-06 האמיתיים מורכבים בדיוק כפי שנקודת הכניסה מרכיבה אותם,
// והמסך מדבר איתם. מסך שנבדק מול הדגמה שאינה מה שרץ באפליקציה
// בודק משהו אחר.
//
// מה היא אינה בודקת: שהטקסט נראה, שהצבע נכון ושהפריסה מסתדרת.
// אלה נבדקים בדפדפן ומדווחים ככאלה בדוח השלב.
//
//   node tests/system/veto-panel.test.js

import { installDom } from '../helpers/dom.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('System: פאנל הווטו');

const dom = installDom();

// ההרכבה נטענת אחרי שה-DOM מותקן, מפני שהמסך נבנה מולו.
const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { FIXTURE_SEED } = await import('../helpers/fixtures.js');
const { create: createGovernance } = await import('../../services/governance.js');
const { create: createGate } = await import('../../services/gate.js');
const { create } = await import('../../screens/veto/index.js');

const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
const referenceFile = (await import('../../data/reference.json', { with: { type: 'json' } })).default;

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const repository = createRepository(createBrowserDriver({
  storage: memoryStorage(),
  seed: {
    modules: modulesFile,
    allow_list: allowFile,
    reference: referenceFile.values,
    ...FIXTURE_SEED,
  },
}));

const handlers = {
  'BE-05': createGovernance({ repository }),
  'BE-06': createGate({ repository }),
};

const orchestrator = createOrchestrator({ repository, handlers });
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

// שם הפונה נגזר מטבלת המודולים, כמו בנקודת הכניסה.
const caller = modulesFile.modules.find((m) => m.id === 'FE-06').caller;

const sent = [];
create({
  host: dom.host,
  from: caller,
  reference: { error_human_text: referenceFile.values.error_human_text },
  send: async (envelope) => {
    sent.push(envelope);
    return send(envelope);
  },
});

// הטעינה אסינכרונית ועוברת דרך שרשרת awaits של ה-Orchestrator,
// ולכן ההמתנה היא לתור המשימות ולא לתור המיקרו משימות.
const settle = async () => {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => { setTimeout(resolve, 0); });
};
await settle();

const rows = () => dom.host.querySelectorAll('.list__head');
const buttons = () => dom.host.querySelectorAll('.list__body .btn-row button');
const labelOf = (button) => button.textContent.trim();

// --- הטעינה: המסך מציג את מה ש-2.1 מחייב ---

check('שלוש הבקשות של הטעינה נשלחו', sent.map((e) => e.action), ['get_gate', 'listItems', 'listApprovals']);
check('כל בקשה יצאה בשם הפונה של המסך', [...new Set(sent.map((e) => e.from))], [caller]);
check('פס השערים מוצג', dom.host.querySelectorAll('.gate').length, 1);
check('הרשימה מציגה שמונה פריטים', rows().length, 8);
check('יומן ההחלטות מוצג', dom.host.querySelectorAll('.log__entry').length, 5);

// פס השערים מציג את M-06 שחושב מרשומה, ואת מה שחסר כדי לפתוח.
// נתוני ההדגמה נושאים הסכם אחד בתוקף שמכסה את המקור היחיד, ולכן
// M-06 = 1, והשער חסום מפני שהמסלול אינו נעול (BL-08, פער 34).
{
  const strip = dom.host.querySelector('.gate').textContent;
  check('M-06 מוצג', strip.includes('M-06: 1'), true);
  check('השער חסום', strip.includes('השער חסום'), true);
  check('והסיבה מוצגת', strip.includes('המסלול אינו נעול'), true);
  check('והאכיפה הכבויה מוצהרת', strip.includes('אכיפת שער B כבויה'), true);
}

// ספירת המצבים בכותרת הפאנל, לפי 2.1
check('ספירה לכל אחד מארבעת המצבים', dom.host.querySelectorAll('.panel__counts .status').length, 4);

// שורה מציגה מצב, תחנה, עמוד וספירת מילים
{
  const meta = rows()[0].querySelector('.list__meta').textContent;
  check('השורה נושאת תחנה, עמוד וספירת מילים', [
    meta.includes('stop-demo-a'), meta.includes('עמוד'), meta.includes('מילים'),
  ], [true, true, true]);
}

// --- פתיחת פריט: הפריט המלא עם טקסט המקור ---

const pendingRow = rows().find((row) => row.textContent.includes('פריט שהוגש להכרעה'));
pendingRow.click();
await settle();

check('נשלחה בקשת getItem', sent.at(-1).action, 'getItem');
check('הטקסט המלא מוצג', dom.host.querySelector('.quote').textContent.length > 0, true);
check('שדה ההערה קיים', Boolean(dom.host.querySelector('textarea')), true);

// --- כפתור המצב הנוכחי מנוטרל ---

check(
  'בפריט שהוגש, הפעולות שמובילות לאותו מצב מנוטרלות',
  buttons().map((b) => `${labelOf(b)}:${b.disabled}`),
  ['הגשה:true', 'אישור:false', 'דחייה:false', 'החזרה:true'],
);

// --- התזכורת הרכה: מזכירה ואינה חוסמת ---

{
  const before = sent.length;
  buttons().find((b) => labelOf(b) === 'דחייה').click();
  await settle();

  check('התזכורת מוצגת', dom.host.querySelectorAll('.message--warn').length, 1);
  check('הלחיצה הראשונה לא שלחה דבר', sent.length, before);

  // לחיצה שנייה עוברת. תזכורת שחוסמת אינה תזכורת.
  buttons().find((b) => labelOf(b) === 'דחייה').click();
  await settle();

  // המעבר עצמו, ואחריו טעינה מחדש: הפריטים, היומן והשער. לכן
  // המעטפה האחרונה אינה בהכרח זו של הפעולה.
  const rejected = sent.slice(before).find((e) => e.action === 'reject');
  check('הלחיצה השנייה נשלחה', Boolean(rejected), true);
  check('אישור הקבלה מוצג', dom.host.querySelectorAll('.message--done').length, 1);
  check('ההודעה אומרת מאיזה מצב לאיזה', dom.host.querySelector('.message--done').textContent.includes('מ-הוגש ל-נדחה'), true);

  // בדיקת הקבלה של המשימה: הרשומה נוספה ליומן ההחלטות שעל המסך.
  check('יומן ההחלטות גדל בשורה', dom.host.querySelectorAll('.log__entry').length, 6);
  const last = repository.listApprovals().at(-1);
  check('הרשומה נושאת מבצע, מצב קודם וחדש', [last.who, last.from_status, last.to_status], [caller, 'pending', 'rejected']);
  check('ויש לה זמן', typeof last.time, 'string');
}

// --- הערה שהוקלדה נוסעת במעטפה ---

{
  rows().find((row) => row.textContent.includes('התחנה בלי פריט מאושר')).click();
  await settle();

  const before = sent.length;
  dom.host.querySelector('textarea').type('נימוק הבדיקה');
  buttons().find((b) => labelOf(b) === 'דחייה').click();
  await settle();

  const rejected = sent.slice(before).find((e) => e.action === 'reject');
  check('עם הערה אין תזכורת', dom.host.querySelectorAll('.message--warn').length, 0);
  check('ההערה נשלחה במעטפה', rejected.payload.note, 'נימוק הבדיקה');
  check('הפריט נשלח במעטפה', typeof rejected.payload.item_id, 'string');

  // ההערה נשמרה ברשומה, וזה מה שהחוקר יראה בפעם הבאה.
  check('ההערה נשמרה ביומן', repository.listApprovals().at(-1).note, 'נימוק הבדיקה');
}

// --- מעבר שאינו בטבלה נדחה, והמצב אינו משתנה (זרימה ד) ---

{
  const approvalsBefore = repository.listApprovals().length;
  const denied = await send({
    from: caller, module: 'BE-05', action: 'approve', payload: { item_id: 'item-demo-5' }, lang: 'he',
  });
  check('approve על פריט שנדחה נדחה', denied.error.code, 'E-TRANSITION-DENIED');
  check('המצב לא השתנה', repository.getItem('item-demo-5').status, 'rejected');
  check('ולא נוספה רשומה', repository.listApprovals().length, approvalsBefore);
}

// --- המסך מבצע את פעולותיו ואותן בלבד ---

check(
  'כל הפעולות שהמסך שלח הן מטבלת פעולות המסך',
  [...new Set(sent.map((e) => e.action))]
    .filter((action) => !['get_gate', 'listItems', 'listApprovals', 'getItem', 'submit', 'approve', 'reject', 'return'].includes(action)),
  [],
);

{
  // פעולה שאינה בטבלה, נשלחת ישירות דרך הכתובת: נדחית, והנוסח
  // לאדם מגיע מטבלת ה-reference ולא מהמסך.
  const denied = await send({ from: caller, module: 'BE-05', action: 'lock_site', payload: {} });
  check('פעולה שאינה של המסך נדחית', denied.error.code, 'E-ALLOW-DENIED');
  check(
    'לקוד יש נוסח לאדם בטבלה',
    typeof referenceFile.values.error_human_text['E-ALLOW-DENIED'],
    'string',
  );
}

// --- כל בקשה מותירה שתי שורות תחת מזהה אחד (מבחן מבנה 04) ---

{
  const all = repository.listAudit();
  const ids = [...new Set(all.map((row) => row.request_id))];
  check('לכל בקשה שתי שורות', ids.every((id) => all.filter((r) => r.request_id === id).length === 2), true);
  // שתי מעטפות נוספות נשלחו ישירות דרך הכתובת ולא מהמסך: המעבר
  // האסור של זרימה ד, והפעולה שאינה של המסך.
  check('מספר הבקשות שווה למספר המעטפות שיצאו', ids.length, sent.length + 2);
}

// --- מה שהוסר במפורש ---

check(
  'אין במסך פעולת איפוס',
  sent.some((e) => String(e.action).includes('reset')),
  false,
);

dom.restore();
report(` (${sent.length} מעטפות, ${rows().length} פריטים)`);
