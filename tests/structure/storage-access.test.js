// מבחן מבנה 01: "חיבור לנתונים בקובץ אחד" (מפה 6.4, חוק ברזל 3).
// זו בדיקת הקבלה של משימה 5 בתוכנית שלב 1.
//
//   node tests/structure/storage-access.test.js

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('מבחן מבנה 01');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// dist הוא פלט האריזה של משימה 9 ולא מקור: הוא עותק משורשר של
// אותם קבצים, והוא אינו במאגר. כלל מבני חל על המקום שאפשר
// לערוך, ולכן הוא נסרק כאן כמו node_modules, כלומר לא.
const SKIP_DIRS = new Set(['.git', 'docs', 'tests', 'node_modules', '.claude', 'dist']);
const CODE_EXTENSIONS = ['.js', '.mjs', '.html'];

// שני הדרייברים, כל אחד בקובץ אחד (decision-05 סעיף 6: "מבחן מבנה 01
// ממשיך לדרוש שחיפוש מחרוזת החיבור יחזיר קובץ אחד, וזה יהיה
// driver-cloud.js"). הכלל נבדק לפי מקום ולפי סוג: כל נגיעה באחסון
// יושבת תחת repository/, אחסון הדפדפן בקובץ אחד, ומחרוזת החיבור
// לענן בקובץ אחד. פער 59 בתוכנית חלק ב.
const DRIVER_DIR = 'repository/';
const BROWSER_DRIVER = 'repository/driver-browser.js';
const CLOUD_DRIVER = 'repository/driver-cloud.js';

// שמות שמסמנים נגיעה באחסון הדפדפן.
const BROWSER_TOKENS = ['localStorage', 'sessionStorage', 'indexedDB', 'openDatabase'];

// שמות שמסמנים את מחרוזת החיבור לענן: שמות משתני הסביבה של הספק
// (מסמך הבנייה 2.8 סעיף 3), נתיב ה-REST שלו, והשמות שהיו הצעה
// לפני ההכרעה.
const CLOUD_TOKENS = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', '/rest/v1/', 'supabase.co',
  'DB_URL', 'DB_KEY', 'connectionString',
];

const STORAGE_TOKENS = [...BROWSER_TOKENS, ...CLOUD_TOKENS];

function collectFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) found.push(...collectFiles(full));
    } else if (CODE_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      found.push(full);
    }
  }
  return found;
}

// הערה שמזכירה "אחסון הדפדפן" אינה נגיעה באחסון. מסירים הערות.
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

const files = collectFiles(ROOT).map((full) => ({
  path: relative(ROOT, full).split('\\').join('/'),
  code: withoutComments(readFileSync(full, 'utf8')),
}));

check('הסריקה מצאה קובצי קוד', files.length > 0, true);

const touching = files
  .filter((f) => STORAGE_TOKENS.some((token) => f.code.includes(token)))
  .map((f) => f.path)
  .sort();

check('שני קבצים בלבד נוגעים באחסון, שני הדרייברים', touching, [BROWSER_DRIVER, CLOUD_DRIVER]);

const touchingBrowser = files
  .filter((f) => BROWSER_TOKENS.some((token) => f.code.includes(token)))
  .map((f) => f.path)
  .sort();
check('אחסון הדפדפן בקובץ אחד', touchingBrowser, [BROWSER_DRIVER]);

const touchingCloud = files
  .filter((f) => CLOUD_TOKENS.some((token) => f.code.includes(token)))
  .map((f) => f.path)
  .sort();
check('מחרוזת החיבור לענן בקובץ אחד', touchingCloud, [CLOUD_DRIVER]);

check(
  'אין נגיעה באחסון מחוץ ל-repository',
  touching.filter((p) => !p.startsWith(DRIVER_DIR)),
  [],
);

// הוודאות ההפוכה: הבדיקה באמת מזהה נגיעה, ואינה עוברת מפני שהיא
// סורקת את המקום הלא נכון או מסננת יותר מדי.
const driver = files.find((f) => f.path === BROWSER_DRIVER);
check('קובץ הדרייבר נסרק', Boolean(driver), true);
check('הדרייבר אכן נוגע באחסון', driver.code.includes('localStorage'), true);

const cloud = files.find((f) => f.path === CLOUD_DRIVER);
check('קובץ דרייבר הענן נסרק', Boolean(cloud), true);
check('דרייבר הענן אכן נושא את שמות משתני הסביבה', ['SUPABASE_URL', 'SUPABASE_ANON_KEY'].every((token) => cloud.code.includes(token)), true);
check('דרייבר הענן אינו נוגע באחסון הדפדפן', BROWSER_TOKENS.filter((token) => cloud.code.includes(token)), []);

// ממשק ה-Repository עצמו אינו נוגע באחסון: הוא מקבל דרייבר.
const repositoryIndex = files.find((f) => f.path === 'repository/index.js');
check('ממשק ה-Repository נסרק', Boolean(repositoryIndex), true);
check(
  'ממשק ה-Repository אינו נוגע באחסון',
  STORAGE_TOKENS.filter((token) => repositoryIndex.code.includes(token)),
  [],
);

report(` (${files.length} קובצי קוד, ${touching.length} נוגעים באחסון)`);
