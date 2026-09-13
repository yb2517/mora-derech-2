// מבחן מבנה 05: "ערכים משתנים מטבלת ה-reference" (מפה 6.4, חוק ברזל 5, BL-12).
//
// זו בדיקת הקבלה של משימה 4 בתוכנית שלב 1, שהייתה עד כה ידנית.
// נוספה לאוטומציה בהכרעת בעלת הפרויקט.
//
// הבדיקה סורקת את המאגר בפועל ואינה מסתמכת על זיכרון השיחה.
//
//   node tests/structure/reference-values.test.js

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import referenceFile from '../../data/reference.json' with { type: 'json' };

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REFERENCE_FILE = 'data/reference.json';

// תיקיות שאינן קוד המערכת: המסמכים הם המקור ומצטטים את הערכים בכוונה,
// והבדיקות מחזיקות אותם כדי להצליב מול המפה.
const SKIP_DIRS = new Set(['.git', 'docs', 'tests', 'node_modules', '.claude']);
const CODE_EXTENSIONS = ['.js', '.mjs', '.json', '.css', '.html'];

// שדות תיעוד בקובצי הנתונים. הם מפנים לסעיפים במפה ("סעיף 4.2"), ואינם ערכים.
const DOC_FIELDS = new Set(['source', 'note', 'pending']);

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
  } else {
    failures.push(`${name}\n    ציפיתי: ${e}\n    קיבלתי: ${a}`);
  }
}

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

// הערה בקוד שמפנה ל"סעיף 4.5" אינה ערך בקוד. מסירים הערות לפני הסריקה,
// ומסירים את שדות התיעוד מקובצי הנתונים, מאותה סיבה בדיוק.
function scannableText(path, raw) {
  if (path.endsWith('.json')) {
    try {
      const parsed = JSON.parse(raw);
      for (const field of DOC_FIELDS) delete parsed[field];
      return JSON.stringify(parsed);
    } catch {
      return raw;
    }
  }
  return raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

const files = collectFiles(ROOT).map((full) => {
  const path = relative(ROOT, full).split('\\').join('/');
  return { path, text: scannableText(path, readFileSync(full, 'utf8')) };
});

check('הסריקה מצאה קובצי קוד', files.length > 0, true);

const numericValues = Object.entries(referenceFile.values)
  .filter(([, value]) => typeof value === 'number')
  .map(([key, value]) => ({ key, value }));

// ערך בן ספרה אחת אינו ניתן לזיהוי בסריקת טקסט: הספרה 5 מופיעה במזהה
// מודול, במספר סעיף ובכל אינדקס. הבדיקה אוכפת את הערכים הרב ספרתיים
// ואת השברים, ומונה את החד ספרתיים במפורש כדי שהגבול יהיה גלוי.
const enforceable = numericValues.filter(({ value }) => String(value).replace('.', '').length > 1);
const unenforceable = numericValues.filter(({ value }) => String(value).replace('.', '').length === 1);

check(
  'ארבעת הערכים של בדיקת הקבלה נאכפים',
  [40, 20, 0.28, 60].filter((v) => !enforceable.some((n) => n.value === v)),
  [],
);

function mentionsValue(text, value) {
  const literal = String(value).replace('.', '\\.');
  return new RegExp(`(^|[^0-9.])${literal}([^0-9]|$)`).test(text);
}

const offenders = [];
for (const { key, value } of enforceable) {
  for (const file of files) {
    if (file.path === REFERENCE_FILE) continue;
    if (mentionsValue(file.text, value)) offenders.push(`${key}=${value} ב-${file.path}`);
  }
}

check(
  'אף ערך מטבלת ה-reference אינו מופיע בקובץ קוד אחר',
  [...new Set(offenders)].sort(),
  [],
);

// הוודאות ההפוכה: הערכים באמת בקובץ הטבלה, כלומר הבדיקה אינה עוברת
// רק מפני שהיא סורקת את המקום הלא נכון.
const referenceText = files.find((f) => f.path === REFERENCE_FILE);
check('קובץ הטבלה נסרק', Boolean(referenceText), true);

check(
  'כל ערך נאכף אכן מופיע בקובץ הטבלה',
  enforceable.filter(({ value }) => !mentionsValue(referenceText.text, value)).map(({ key }) => key),
  [],
);

console.log(
  `מבחן מבנה 05: ${passed} עברו, ${failures.length} נכשלו `
  + `(${enforceable.length} ערכים נאכפים, ${unenforceable.length} חד ספרתיים שאינם ניתנים לאכיפה בסריקה, `
  + `${files.length} קובצי קוד)`,
);
if (unenforceable.length > 0) {
  console.log(`  לידיעה, חד ספרתיים: ${unenforceable.map((n) => `${n.key}=${n.value}`).join(', ')}`);
}
for (const failure of failures) {
  console.log(`  נכשל: ${failure}`);
}
if (failures.length > 0) {
  process.exitCode = 1;
}
