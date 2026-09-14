// בדיקת האריזה: הקובץ היחיד למסירה. משימה 9 בתוכנית שלב 2.
//
// המקור: decision-04 ב1 ("קובץ יחיד בלחיצה כפולה"), הכרעה ד בתוכנית
// השלב, ובדיקת הקבלה של שורה 9.
//
// הטענה שהבדיקה הזאת שומרת עליה: **הקובץ שנמסר הוא אותה מערכת.**
// לא מערכת שנייה שנכתבה בשביל המסירה, ולא תת קבוצה שלה. לכן היא
// אינה בודקת "הסקריפט רץ בלי שגיאה" אלא שלושה דברים:
//
//   סגור: כל מודול שנקודת הכניסה מייבאת, וכל handler שרשום בטבלת
//   המודולים וקובצו קיים, נמצא באריזה. מודול שיישכח יישכח בשקט,
//   ולכן הרשימה נגזרת מהמקור ולא מהאריזה.
//
//   זהות: הנתונים והעיצוב שבאריזה הם בית בבית מה שבקבצים.
//
//   ניתוק: לא נשארה באריזה שום הפניה החוצה. הפניה אחת שנשארה
//   פירושה קובץ שנפתח ריק בלחיצה כפולה, וזה בדיוק מה שהמסירה
//   אמורה למנוע.
//
// מה שהבדיקה הזאת אינה יכולה לבדוק: שהדפדפן באמת מריץ את הקובץ.
// זו בדיקת הקבלה הידנית של שורה 9, והיא נעשית בדפדפן אמיתי מ-file://.
//
//   node tests/structure/bundle.test.js

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('בדיקת האריזה');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const out = join(mkdtempSync(join(tmpdir(), 'mora-bundle-')), 'bundle.html');

const run = () => spawnSync(process.execPath, ['tools/bundle.js', out], { cwd: ROOT, encoding: 'utf8' });

const first = run();
check('הסקריפט רץ ומסתיים בהצלחה', first.status, 0);
check('הקובץ נוצר', existsSync(out), true);

// סקריפט שנפל אינו משאיר קובץ, וקריאה שלו הייתה מפילה את הבדיקה
// בלי שורת סיכום. שגיאה מדווחת עדיפה על קריסה: היא אומרת מה קרה.
if (first.status !== 0 || !existsSync(out)) {
  const output = `${first.stderr ?? ''}${first.stdout ?? ''}`;
  const reason = output.split('\n').find((line) => line.includes('Error')) ?? 'בלי פלט';
  check('האריזה נכשלה, ואין קובץ לבדוק', reason.trim(), '');
  report();
  process.exit(1);
}

const bundle = readFileSync(out, 'utf8');
const source = (path) => readFileSync(join(ROOT, path), 'utf8');

// --- סגור: כל מה שצריך להיות שם, נמצא שם ---

// הרשימה נגזרת מנקודת הכניסה ומטבלת המודולים, ולא מהאריזה. בדיקה
// שסופרת את מה שנארז אינה יודעת מה נשכח.
const entry = source('index.html');
const entryImports = [...entry.matchAll(/from\s+'\.\/([^']+)'/g)].map((m) => m[1]);

check('נקודת הכניסה מייבאת שמונה מודולים', entryImports.length, 8);

const missing = entryImports.filter((path) => !bundle.includes(`__registry[${JSON.stringify(path)}]`));
check('כל מודול שנקודת הכניסה מייבאת נמצא באריזה', missing, []);

// הסגור אינו עוצר בייבוא הישיר: מודול שמייבא מודול נמצא גם הוא.
for (const nested of ['core/contract.js', 'core/errors.js', 'screens/view.js', 'data/demo/demo-data.json']) {
  check(`${nested} נארז גם הוא`, bundle.includes(`__registry[${JSON.stringify(nested)}]`), true);
}

// עמודת ה-handler: מודול שירות שקובצו קיים חייב להיארז, אחרת
// האריזה תיפול חזרה להדגמה בזמן שהפיתוח כבר מריץ את האמיתי.
const modulesTable = JSON.parse(source('registry/modules.json'));
const handlers = modulesTable.modules
  .map((row) => row.handler)
  .filter((handler) => typeof handler === 'string' && handler !== '')
  .filter((handler) => !handler.startsWith('tests/'))
  .filter((handler) => existsSync(join(ROOT, handler)));

check(
  'כל handler קיים מטבלת המודולים נארז',
  handlers.filter((path) => !bundle.includes(`__registry[${JSON.stringify(path)}]`)),
  [],
);

// עזרי הבדיקה אינם נארזים, בדיוק כפי שנקודת הכניסה אינה טוענת אותם.
check('עזרי בדיקה אינם באריזה', /__registry\["tests\//.test(bundle), false);

// --- זהות: מה שבפנים הוא מה שבקבצים ---

// הטבלאות נכנסות כבלוקים, בצורה שנקודת הכניסה כבר מחפשת
// (היא מעדיפה בלוק על פני fetch, ולכן אותו קוד רץ בשני המצבים).
const TABLES = {
  modules: 'registry/modules.json',
  allow_list: 'registry/allow-list.json',
  reference: 'data/reference.json',
  demo: 'data/demo/demo-data.json',
};

for (const [name, path] of Object.entries(TABLES)) {
  const block = bundle.match(
    new RegExp(`<script type="application/json" data-table="${name}">([\\s\\S]*?)</script>`),
  );
  check(`הטבלה ${name} נמצאת בגוף הקובץ`, Boolean(block), true);
  check(
    `והיא זהה לקובץ ${path}`,
    block ? JSON.parse(block[1].replace(/<\\\//g, '</')) : null,
    JSON.parse(source(path)),
  );
}

// העיצוב: הקובץ היחיד שמגדיר ערך עיצוב נכנס כמות שהוא, וגם שבעת
// קובצי הרכיבים שהוא מייבא.
check('אין תגית עיצוב חיצונית', /<link\b/.test(bundle), false);
check('ערכת העיצוב בפנים', bundle.includes('/* design/tokens.css */'), true);

const components = source('design/components/index.css')
  .match(/@import\s+"\.\/([^"]+)"/g)
  .map((line) => line.match(/\.\/([^"]+)/)[1]);

check('שבעה קובצי רכיבים', components.length, 7);
check(
  'כל קובץ רכיב נכנס לאריזה',
  components.filter((name) => !bundle.includes(`/* design/components/${name} */`)),
  [],
);

// --- ניתוק: אין הפניה החוצה ---

const outward = [
  ['תגית link', /<link\b/],
  ['סקריפט חיצוני', /<script[^>]*\ssrc=/],
  ['הצהרת import', /^\s*import\s/m],
  ['ייבוא יחסי', /\bfrom\s+['"]\.\.?\//],
  ['@import בעיצוב', /@import\s+["']/],
];

check(
  'לא נשארה הפניה החוצה',
  outward.filter(([, pattern]) => pattern.test(bundle)).map(([what]) => what),
  [],
);

// הייבוא הדינמי של נקודת הכניסה תורגם לטוען. אילו נשאר כמות שהוא,
// הוא היה מנסה למשוך קובץ מהדיסק ונופל בשקט לתוך ה-catch, ומודול
// שירות אמיתי היה נעלם מהמסירה בלי שאיש ישים לב.
check('הייבוא הדינמי תורגם', bundle.includes('await __import('), true);

// --- אותו סקריפט, אותו קובץ ---

// אריזה שאינה דטרמיניסטית אינה ניתנת להשוואה, ואי אפשר לדעת אם
// מסירה שנייה שונה מהראשונה בגלל הקוד או בגלל הסקריפט.
const second = run();
check('הרצה שנייה מחזירה בדיוק אותם בתים', readFileSync(out, 'utf8'), bundle);
check('וגם היא מסתיימת בהצלחה', second.status, 0);

// --- הסקריפט אינו מקור אמת שני ---

// שמות מודולים כתובים בסקריפט היו הופכים אותו לרשימה שנייה שצריך
// לתחזק לצד הנתונים. הוא מכיר את נקודת הכניסה ואת הטבלאות,
// ולא את מי שהן מצביעות עליו.
const script = source('tools/bundle.js');
const named = ['core/orchestrator.js', 'screens/veto/', 'screens/traveler/', 'screens/admin/',
  'repository/driver-browser.js', 'tools/demo-modules.js', 'services/'];

check('הסקריפט אינו מונה מודולים בשמם', named.filter((path) => script.includes(path)), []);

report(` (${bundle.length} תווים, ${entryImports.length} ייבואים ישירים, ${handlers.length} handlers)`);
