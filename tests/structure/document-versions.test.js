// מבחן מבנה נוסף: ההפניות בין המסמכים מצביעות על הגרסה שקיימת.
//
// המקור: מסמך הבנייה סעיף 1 ("doc-module-map הוא מסמך הייחוס"), כלל
// העל של מסמך הבנייה ("סתירה בין המסמך הזה למפה: המפה גוברת"),
// וסעיף 9.8 ("פער בין המסמך למאגר בפועל" עוצר את הבנייה).
//
// **למה הבדיקה הזאת נולדה**: אימות שנעשה ב-15.09.2026 מצא שטבלת
// המקורות במסמך הבנייה עדיין מפנה למפה "גרסה 3, מאושרת 12.09.2026",
// בעוד המפה כבר בגרסה 3.4. זו השורה היחידה שאומרת איזו גרסת מפה
// מחייבת, והיא פיגרה בארבע גרסאות מפני שאיש לא הצליב אותה. הצלבה
// שאדם צריך לזכור לעשות היא הצלבה שתישכח.
//
// מה נבדק כאן, ומה לא: נבדקים מספרי גרסה, תאריכים ושמות קבצים, וזה
// כל מה שניתן להצליב מכנית. תוכן ההכרעות עצמו אינו נבדק כאן, והוא
// של דוח השלב ושל בעלת הפרויקט.
//
//   node tests/structure/document-versions.test.js

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('מבנה: גרסאות המסמכים');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const BUILD_DOC = 'CLAUDE.md';
const MAP_DOC = 'docs/doc-module-map-v3.md';

const read = (path) => readFileSync(join(ROOT, path), 'utf8');

// שורת הסטטוס: "סטטוס: גרסה X, מאושרת DD.MM.YYYY".
function statusOf(text) {
  const match = text.match(/^סטטוס: גרסה ([\d.]+), מאושרת (\d{2}\.\d{2}\.\d{4})/m);
  return match ? { version: match[1], date: match[2] } : null;
}

// השורה הראשונה ביומן הגרסאות: "גרסה X, DD.MM.YYYY:".
function newestLogEntry(text) {
  const log = text.split(/^## \d+\. יומן גרסאות$/m)[1];
  if (!log) return null;
  const match = log.match(/^גרסה ([\d.]+), (\d{2}\.\d{2}\.\d{4}):/m);
  return match ? { version: match[1], date: match[2] } : null;
}

const build = read(BUILD_DOC);
const map = read(MAP_DOC);

// --- 1. כל מסמך מצהיר על הגרסה שכתובה בראש היומן שלו ---
//
// שורת סטטוס שאינה תואמת ליומן פירושה שאחת מהשתיים נשכחה, וזו
// בדיוק התקלה שגרסה 2.2 של מסמך הבנייה תיקנה ביד.

for (const [name, text] of [['מסמך הבנייה', build], ['מפת המודולים', map]]) {
  const status = statusOf(text);
  const newest = newestLogEntry(text);

  check(`${name}: יש שורת סטטוס עם גרסה ותאריך`, Boolean(status), true);
  check(`${name}: יש שורה ראשונה ביומן הגרסאות`, Boolean(newest), true);
  check(`${name}: הסטטוס והיומן מצהירים על אותה גרסה`, status?.version, newest?.version);
  check(`${name}: הסטטוס והיומן מצהירים על אותו תאריך`, status?.date, newest?.date);
}

// --- 2. טבלת המקורות מפנה לקובץ שקיים, ולגרסה שהוא באמת נושא ---

const sources = build.split(/^## 1\. המקורות המחייבים$/m)[1]?.split(/^## 2\./m)[0] ?? '';
const reference = sources.match(/\|\s*([\w.-]+\.md)\s*\(גרסה ([\d.]+), מאושרת (\d{2}\.\d{2}\.\d{4})\)/);

check('טבלת המקורות נקראה, ויש בה שורת מסמך ייחוס', Boolean(reference), true);

const cited = reference
  ? { file: reference[1], version: reference[2], date: reference[3] }
  : { file: null, version: null, date: null };

check(
  'הקובץ שטבלת המקורות מפנה אליו קיים במאגר',
  cited.file ? existsSync(join(ROOT, 'docs', cited.file)) || existsSync(join(ROOT, cited.file)) : false,
  true,
);

const mapStatus = statusOf(map);
check('טבלת המקורות נוקבת בגרסת המפה שקיימת', cited.version, mapStatus?.version);
check('ובתאריך האישור שלה', cited.date, mapStatus?.date);

report(` (2 מסמכים, גרסה ${mapStatus?.version} במפה)`);
