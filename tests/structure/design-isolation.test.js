// בדיקת הקבלה של שלב 2: "מחליפים ערכת עיצוב, ואף מסך לא משתנה"
// (מפה סעיף 7 שורת שלב 2; מסמך הבנייה סעיף 6; מפה 3.3 שורת DESIGN-01:
// "כל מסך משתמש בו ואינו מגדיר עיצוב משלו").
//
// זו אינה אחת משמונת מבחני המבנה של 6.4. זו בדיקת הקבלה של השלב,
// והיא רצה איתם מפני שהיא מאותו סוג: היא סורקת את המאגר בפועל.
//
// הטענה שהיא מוכיחה: קיים בדיוק קובץ אחד שאפשר לשנות בו ערך עיצוב,
// ולכן החלפת ערכה אינה יכולה להגיע לרכיב או למסך. אין כאן "החלפנו
// וזה נראה אחרת": יש כאן שאין מסלול אחר שדרכו עיצוב נכנס למערכת.
//
//   node tests/structure/design-isolation.test.js

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('בדיקת בידוד העיצוב');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TOKENS = 'design/tokens.css';
const DESIGN_DIR = 'design';
const SCREENS_DIR = 'screens';

// הקובץ היחיד שמותר לו להחזיק ערך עיצוב.
const THEME_FILES = new Set([TOKENS]);

function collect(dir, pattern) {
  const found = [];
  const full = join(ROOT, dir);
  if (!existsSync(full)) return found;
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (pattern.test(entry)) found.push(path);
    }
  };
  walk(full);
  return found.map((path) => ({
    path: relative(ROOT, path).split('\\').join('/'),
    raw: readFileSync(path, 'utf8'),
  }));
}

// הערה שמסבירה צבע אינה צבע. וכן: תנאי של @media אינו ערך עיצוב
// שניתן להחזיק ב-var, מפני שמאפיין מותאם אינו נקרא בתוך תנאי מדיה.
// זו מגבלה של CSS ולא בחירה, והיא מוצהרת כאן ולא נעקפת בשקט.
function scannable(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/@media[^{]*\{/g, '@media {');
}

const designFiles = collect(DESIGN_DIR, /\.css$/);
const screenFiles = collect(SCREENS_DIR, /\.(css|js|mjs|html)$/);
const all = [...designFiles, ...screenFiles].map((f) => ({ ...f, code: scannable(f.raw) }));

check('קובץ הערכה קיים', designFiles.some((f) => f.path === TOKENS), true);
check('ערכת העיצוב מחזיקה קובצי רכיבים', designFiles.length > 1, true);

// --- 1. ערך עיצוב יושב בקובץ אחד ---

const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;
// fr ואחוזים הם פריסה ולא ערך עיצוב, ואפס הוא אפס בכל ערכה.
const LENGTH = /(?:^|[^0-9a-zA-Z.-])[0-9]*\.?[0-9]+(?:px|rem|em|ch|pt|vh|vw|vmin|vmax)\b/;

const colorOffenders = all
  .filter((f) => !THEME_FILES.has(f.path) && COLOR.test(f.code))
  .map((f) => f.path);

check('אין ערך צבע מחוץ לקובץ הערכה', colorOffenders.sort(), []);

const lengthOffenders = all
  .filter((f) => !THEME_FILES.has(f.path) && LENGTH.test(f.code))
  .map((f) => f.path);

check('אין מידה מוחלטת מחוץ לקובץ הערכה', lengthOffenders.sort(), []);

// --- 2. מאפיין מותאם מוגדר בקובץ אחד ---

const DEFINITION = /(^|[;{]|\s)--[a-zA-Z0-9-]+\s*:/gm;

const definitionOffenders = all
  .filter((f) => !THEME_FILES.has(f.path) && new RegExp(DEFINITION).test(f.code))
  .map((f) => f.path);

check('אין הגדרת מאפיין מותאם מחוץ לקובץ הערכה', definitionOffenders.sort(), []);

const tokensFile = all.find((f) => f.path === TOKENS);
const defined = new Set(
  [...tokensFile.code.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]),
);

check('הערכה מגדירה מאפיינים', defined.size > 0, true);

// --- 3. כל שימוש מוצא הגדרה ---

const used = new Set();
for (const file of all) {
  for (const match of file.code.matchAll(/var\(\s*--([a-zA-Z0-9-]+)/g)) used.add(match[1]);
}

check(
  'כל מאפיין שנעשה בו שימוש מוגדר בקובץ הערכה',
  [...used].filter((name) => !defined.has(name)).sort(),
  [],
);

// --- 4. ערכת העיצוב עומדת בפני עצמה ---

// רכיב שמייבא מחוץ ל-design אינו ניתן להחלפה בלי לגרור את מה שייבא.
// היעד נפתר מול מיקום הקובץ, מפני שייבוא יחסי שיוצא מהתיקייה הוא
// בדיוק המקרה שהבדיקה נועדה לתפוס.
function resolveFrom(filePath, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const stack = filePath.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

const outward = [];
for (const file of designFiles) {
  for (const match of file.raw.matchAll(/@import\s+["']([^"']+)["']/g)) {
    const target = resolveFrom(file.path, match[1]);
    if (!target.startsWith(`${DESIGN_DIR}/`)) outward.push(`${file.path} -> ${match[1]}`);
  }
}

check('ערכת העיצוב אינה מייבאת מחוץ לעצמה', outward.sort(), []);

// --- 5. מסך אינו מגדיר עיצוב משלו ---
//
// בשלב הזה אין מסכים, ולכן שלוש הטענות הבאות עוברות בריק. הן מתחילות
// לאכוף ברגע שנכנס המסך הראשון במשימה 5, בלי לשנות שורה כאן.

const inlineStyle = screenFiles
  .filter((f) => /<style[\s>]|style\s*=\s*["']/.test(f.raw))
  .map((f) => f.path);

check('אין מסך עם עיצוב בתוך הקובץ', inlineStyle.sort(), []);

const ownSheet = screenFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.path);

check('אין מסך עם גיליון סגנון משלו', ownSheet.sort(), []);

const emptyPass = screenFiles.length === 0;
check('מצב השלב מדווח במפורש', emptyPass, true);

report(
  ` (${designFiles.length} קובצי עיצוב, ${defined.size} מאפיינים, ${used.size} בשימוש`
  + (emptyPass ? ', ועובר בריק על המסכים: אין מסכים במשימה 2)' : `, ${screenFiles.length} קובצי מסך)`),
);
