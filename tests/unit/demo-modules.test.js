// Unit: מודול ההדגמה ונתוני ההדגמה. משימה 4 בתוכנית שלב 2.
//
// המקור: מסמך הבנייה גרסה 2.2 סעיף 7, מפה 4.4 (טבלת פעולות המסכים),
// והכרעות א ו-ג של תוכנית שלב 2.
//
// שתי הטענות שהבדיקה הזאת שומרת עליהן:
//   נתוני ההדגמה מסומנים כולם, ולכן שלב 7 יכול להסיר אותם בשאילתה.
//   מודול ההדגמה מחזיר ואינו מחליט, ולכן ירוק כאן אינו נראה כמו
//   לוגיקה עסקית שכבר עובדת.
//
//   node tests/unit/demo-modules.test.js

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import demoHandler, { DEMO_MODULE_IDS } from '../../tools/demo-modules.js';
import demo from '../../data/demo/demo-data.json' with { type: 'json' };
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, report } = createChecker('Unit: ההדגמה');

// --- נתוני ההדגמה: הכול מסומן ---

const groups = Object.entries(demo).filter(([, value]) => Array.isArray(value));
const rows = groups.flatMap(([group, list]) => list.map((row) => ({ group, row })));

check('הקובץ מחזיק קבוצות ישויות', groups.length > 0, true);

check(
  'כל שורה מסומנת is_demo',
  rows.filter(({ row }) => row.is_demo !== true).map(({ group }) => group).sort(),
  [],
);

// בדיקת הקבלה של שלב 7 היא שאילתה על is_demo. אם שורה אינה מסומנת,
// היא תישאר אחרי הניקוי, ולכן הספירה ההפוכה נבדקת גם היא.
check(
  'ספירת המסומנות שווה לספירת הכול',
  rows.filter(({ row }) => row.is_demo === true).length,
  rows.length,
);

// --- היקף המערך, לפי הכרעה ג ---

check('שמונה פריטי תוכן', demo.content_items.length, 8);
check('שלוש תחנות', demo.sites[0].stops.length, 3);
check(
  'ארבעת מצבי הפריט מיוצגים',
  [...new Set(demo.content_items.map((i) => i.status))].sort(),
  ['approved', 'draft', 'pending', 'rejected'],
);
check('מקור אחד', demo.sources.length, 1);
check('מכון אחד', demo.institutes.length, 1);
check('הסכם אחד', demo.rights_mou.length, 1);
check('נקודת יציאה אחת', demo.exit_points.length, 1);
check('שלושה סשנים', demo.sessions.length, 3);

check(
  'הסשנים נושאים שתיים, שלוש וחמש שאלות',
  demo.sessions.map((s) => demo.interactions.filter((i) => i.session_id === s.session_id).length),
  [2, 3, 5],
);

// המערך נבחר כדי לכסות תצוגה, ולכן שני המקרים שהמסכים צריכים
// להראות נבדקים במפורש.
check(
  'יש תחנה בלי פריט מאושר',
  demo.sites[0].stops.filter((stop) => !demo.content_items
    .some((i) => i.stop_id === stop && i.status === 'approved')).length > 0,
  true,
);

check(
  'יש פריט מאושר בלי עוגן מאומת',
  demo.content_items.some((item) => item.status === 'approved'
    && !demo.geo_anchors.some((a) => a.item_id === item.item_id && a.verified === true)),
  true,
);

// --- מודול ההדגמה: מחזיר ---

{
  const response = demoHandler({ module: 'BE-05', action: 'approve', payload: { item_id: 'x' } });
  check('פעולת כתיבה מחזירה ok', response.ok, true);
  check('התשובה מסומנת הדגמה', response.data.is_demo, true);
  check('אישור הקבלה נושא את שם הפעולה', response.data.acknowledged, 'approve');
  check('אישור הקבלה מחזיר את מה שנשלח', response.data.payload, { item_id: 'x' });
}

{
  const response = demoHandler({ module: 'BE-06', action: 'get_gate', payload: {} });
  check('מצב השער מגיע מנתוני ההדגמה', response.data.site.site_id, demo.sites[0].site_id);
  check('ההסכמים מגיעים מנתוני ההדגמה', response.data.mou.length, demo.rights_mou.length);
}

{
  const response = demoHandler({ module: 'BE-05', action: 'nearestExitPoint', payload: {} });
  check('נקודת היציאה מגיעה מנתוני ההדגמה', response.data.exit_point.exit_id, demo.exit_points[0].exit_id);
}

{
  const response = demoHandler({ module: 'BE-03', action: 'ask', payload: { question: 'מה זה' } });
  check('השאלה חוזרת כמות שהיא', response.data.question, 'מה זה');
  check('התשובה היא טקסט מנתוני ההדגמה', response.data.answer, demo.content_items[0].text);
}

// --- מודול ההדגמה: אינו מחליט ---

// אין מצב. אותה בקשה פעמיים מחזירה בדיוק אותו דבר, ואין השפעה
// על בקשה אחרת. מסך שנראה עובד מפני שההדגמה זוכרת היה מסתיר את
// העובדה שהלוגיקה טרם נבנתה.
{
  const request = { module: 'BE-05', action: 'approve', payload: { item_id: 'item-demo-3' } };
  const first = demoHandler(request);
  const second = demoHandler(request);
  check('אותה בקשה מחזירה את אותה תשובה', first, second);

  const item = demo.content_items.find((i) => i.item_id === 'item-demo-3');
  check('אישור אינו משנה את מצב הפריט', item.status, 'pending');
}

// התשובה היא העתק, ולכן קורא שמשנה בה שדה אינו משנה את נתוני
// ההדגמה לכל שאר הקוראים.
{
  const response = demoHandler({ module: 'BE-06', action: 'get_gate', payload: {} });
  response.data.site.status = 'locked';
  const again = demoHandler({ module: 'BE-06', action: 'get_gate', payload: {} });
  check('התשובה היא העתק ואינה הנתון החי', again.data.site.status, 'open');
}

// --- פעולה שאין לה תשובה אינה מתחזה ---

checkThrows(
  'פעולה שאינה בטבלה נופלת ואינה מחזירה ok',
  () => demoHandler({ module: 'BE-05', action: 'lock_site', payload: {} }),
);

checkThrows(
  'מודול שאינו בטבלה נופל',
  () => demoHandler({ module: 'BE-04', action: 'retrieve', payload: {} }),
);

// --- הקובץ עצמו אינו מחזיק לוגיקה עסקית ---

const source = readFileSync(
  fileURLToPath(new URL('../../tools/demo-modules.js', import.meta.url)),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');

// טבלת המעברים, תנאי הנעילה והספים שייכים לליבה ולמודולי השירות.
// הופעה שלהם כאן פירושה שההדגמה התחילה להחליט.
const BUSINESS = ['from_status', 'to_status', 'threshold', 'relevance', 'L1', 'L2', 'BL-'];

check(
  'אין בקובץ מונח של לוגיקה עסקית',
  BUSINESS.filter((token) => source.includes(token)).sort(),
  [],
);

check(
  'מזהי המודולים שההדגמה עומדת במקומם',
  [...DEMO_MODULE_IDS].sort(),
  ['BE-03', 'BE-05', 'BE-06', 'BE-07'],
);

report(` (${rows.length} שורות הדגמה, ${groups.length} קבוצות)`);
