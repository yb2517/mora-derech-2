// System: פאנל ה-Veto על נתוני הדגמה. משימה 5 בתוכנית שלב 2.
//
// המקור: מפה 6.3 (בדיקות System לפי מקרי השימוש), F-07,
// doc-build-03-interfaces סעיף 2.1, ובדיקת הקבלה של משימה 5.
//
// זו הרמה הראשונה מסוג System בפרויקט. היא מרכיבה את אותה שרשרת
// שנקודת הכניסה מרכיבה, ומפעילה את המסך כמו שמשתמש מפעיל אותו:
// לחיצה על שורה, הקלדה בשדה, לחיצה על כפתור.
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
const { default: demoHandler, DEMO_MODULE_IDS } = await import('../../tools/demo-modules.js');
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
  },
}));

const handlers = {};
for (const id of DEMO_MODULE_IDS) handlers[id] = demoHandler;

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

  check('הלחיצה השנייה נשלחה', sent.at(-1).action, 'reject');
  check('אישור הקבלה מוצג', dom.host.querySelectorAll('.message--done').length, 1);
}

// --- הערה שהוקלדה נוסעת במעטפה ---

{
  rows().find((row) => row.textContent.includes('התחנה בלי פריט מאושר')).click();
  await settle();

  dom.host.querySelector('textarea').type('נימוק הבדיקה');
  buttons().find((b) => labelOf(b) === 'דחייה').click();
  await settle();

  check('עם הערה אין תזכורת', dom.host.querySelectorAll('.message--warn').length, 0);
  check('ההערה נשלחה במעטפה', sent.at(-1).payload.note, 'נימוק הבדיקה');
  check('הפריט נשלח במעטפה', typeof sent.at(-1).payload.item_id, 'string');
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
  check('מספר הבקשות שווה למספר המעטפות שיצאו', ids.length, sent.length + 1);
}

// --- מה שהוסר במפורש ---

check(
  'אין במסך פעולת איפוס',
  sent.some((e) => String(e.action).includes('reset')),
  false,
);

dom.restore();
report(` (${sent.length} מעטפות, ${rows().length} פריטים)`);
