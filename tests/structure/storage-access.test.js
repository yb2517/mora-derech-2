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

// הדרייבר של שלבים 1 עד 4. בשלב 5 ייווסף driver-cloud.js, ולכן הכלל
// נבדק לפי מקום ולא לפי שם: כל נגיעה באחסון יושבת תחת repository/.
const DRIVER_DIR = 'repository/';
const BROWSER_DRIVER = 'repository/driver-browser.js';

// שמות שמסמנים נגיעה באחסון או במחרוזת חיבור.
const STORAGE_TOKENS = [
  'localStorage', 'sessionStorage', 'indexedDB', 'openDatabase',
  'DB_URL', 'DB_KEY', 'connectionString',
];

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

check('קובץ אחד בלבד נוגע באחסון', touching, [BROWSER_DRIVER]);

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

// ממשק ה-Repository עצמו אינו נוגע באחסון: הוא מקבל דרייבר.
const repositoryIndex = files.find((f) => f.path === 'repository/index.js');
check('ממשק ה-Repository נסרק', Boolean(repositoryIndex), true);
check(
  'ממשק ה-Repository אינו נוגע באחסון',
  STORAGE_TOKENS.filter((token) => repositoryIndex.code.includes(token)),
  [],
);

report(` (${files.length} קובצי קוד, ${touching.length} נוגעים באחסון)`);
