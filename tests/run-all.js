// המריץ האחד של מערך הבדיקות, משימה 8 בתוכנית שלב 1.
//
// פקודה אחת מריצה הכל:
//   node tests/run-all.js
//
// המקור: מסמך הבנייה חוק 9 ("בדיקה נכתבת יחד עם הקוד"), מפה 6.1, 6.2
// ו-6.4, ופרומפט 3 במנגנון הבנייה ("הרץ את מערך הבדיקות המלא לפי
// פרק ז במתודולוגיה: Unit לכל מודול, בדיקות הממשקים, ו-System").
//
// כל קובץ רץ בתהליך משלו, ולכן קובץ שנופל אינו עוצר את השאר: דוח
// חלקי אינו דוח. קוד היציאה אינו אפס אם משהו נכשל.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// שלוש הרמות של פרק ז, בסדר שבו הן רצות: מהיחידה כלפי חוץ.
const LEVELS = [
  { dir: 'tests/unit', title: 'Unit, למודול (מפה 6.1)' },
  { dir: 'tests/interfaces', title: 'ממשקים: המעטפה, רשימת המותר, קודי השגיאה (מפה 6.2)' },
  { dir: 'tests/structure', title: 'מבחני המבנה (מפה 6.4)' },
  { dir: 'tests/system', title: 'System, לפי מקרי השימוש (מפה 6.3)' },
];

// שמונת מבחני המבנה של 6.4, ומה מכסה כל אחד.
const STRUCTURE_TESTS = [
  ['01', 'חיבור לנתונים בקובץ אחד', 'tests/structure/storage-access.test.js'],
  ['02', 'קריאה לספק AI בקובץ אחד', 'tests/structure/ai-provider.test.js'],
  ['03', 'כל מסך פונה לכתובת אחת ומצהיר מי הוא', 'tests/structure/screen-endpoint.test.js'],
  ['04', 'כל בקשה רשומה עם request_id', 'tests/structure/audit-writer.test.js'],
  ['05', 'ערכים משתנים מטבלת ה-reference', 'tests/structure/reference-values.test.js'],
  ['06', 'הוספת מסך יוצרת שורה ברשימת המותר', 'tests/structure/caller-list.test.js'],
  ['07', 'קודי השגיאה זהים בקוד ובמפה', 'tests/structure/error-codes.test.js'],
  ['08', 'אף מודול אינו קורא למודול אחר ישירות', 'tests/structure/import-graph.test.js'],
];

// מבחן שטרם ניתן להרצה מפני שהמודול שלו טרם נבנה. הרשימה התרוקנה
// בשלב 6: מבחן 02 קיבל את GW-01, ושמונת המבחנים רצים.
const NOT_YET = {};

// שלוש הבדיקות האדומות של מפה 6.5. כל אחת שומרת על הגנה במודול
// שירות, ולכן אף אחת מהן לא הייתה ניתנת לכתיבה לפני שהמודול קיים.
// הן נכתבו במשימות 6, 4 ו-9 של שלב 4, כל אחת מיד אחרי המודול שהיא
// שומרת עליו.
//
// **כשל אמיתי באחת מהן חוסם שחרור** (CLAUDE.md סעיף 8), ולכן הן
// מדווחות בנפרד ולא נבלעות בסיכום של רמת ה-System.
const RED_TESTS = [
  ['F-05', 'פריט pending במאגר המועמדים', 'tests/system/red-01-pending-candidate.test.js'],
  ['F-08', 'פריט approved בלי רשומת APPROVALS עובר את L1', 'tests/system/red-02-approved-without-record.test.js'],
  ['F-09', 'שורת initiated שלא ממודול השיחה נספרת', 'tests/system/red-03-initiated-sender.test.js'],
];

function testFilesIn(dir) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((name) => name.endsWith('.test.js'))
    .sort()
    .map((name) => `${dir}/${name}`);
}

const results = [];
let failedFiles = 0;

for (const level of LEVELS) {
  const files = testFilesIn(level.dir);
  console.log(`\n${'='.repeat(72)}`);
  console.log(level.title);
  if (files.length === 0) {
    console.log('  אין קובצי בדיקה ברמה הזאת בשלב הנוכחי.');
    continue;
  }
  console.log('='.repeat(72));

  for (const file of files) {
    const run = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8' });
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trimEnd();
    const summary = output.split('\n').find((line) => /עברו,/.test(line)) ?? '';
    const counts = summary.match(/(\d+) עברו, (\d+) נכשלו/);

    const passed = counts ? Number(counts[1]) : 0;
    const failed = counts ? Number(counts[2]) : 0;
    const crashed = run.status !== 0 && !counts;

    results.push({ file, passed, failed, crashed });
    if (run.status !== 0) failedFiles += 1;

    console.log(output ? output.split('\n').map((l) => `  ${l}`).join('\n') : `  ${file}: אין פלט`);
    if (crashed) console.log(`  ${file}: נפל בלי שורת סיכום, קוד יציאה ${run.status}`);
  }
}

// --- שמונת מבחני המבנה ---

console.log(`\n${'='.repeat(72)}`);
console.log('שמונת מבחני המבנה של 6.4');
console.log('='.repeat(72));

const ran = new Map(results.map((r) => [r.file, r]));
let structureReady = 0;

for (const [number, title, file] of STRUCTURE_TESTS) {
  let status;
  if (!file) {
    status = `אינו ניתן להרצה: ${NOT_YET[number] ?? 'טרם נבנה'}`;
  } else if (!ran.has(file)) {
    status = 'אינו מיושם';
  } else {
    const result = ran.get(file);
    const green = result.failed === 0 && !result.crashed;
    status = green ? `עובר, ${result.passed} טענות` : `נכשל, ${result.failed} טענות`;
    if (green) structureReady += 1;
  }
  console.log(`  ${number}  ${title.padEnd(42, '.')} ${status}`);
}

// --- שלוש הבדיקות האדומות של 6.5 ---

console.log(`\n${'='.repeat(72)}`);
console.log('שלוש הבדיקות האדומות של 6.5');
console.log('='.repeat(72));

let redBroken = 0;

for (const [useCase, title, file] of RED_TESTS) {
  let status;
  if (!ran.has(file)) {
    status = 'אינה מיושמת';
    redBroken += 1;
  } else {
    const result = ran.get(file);
    const green = result.failed === 0 && !result.crashed;
    status = green
      ? `ההגנה מחזיקה, ${result.passed} טענות`
      : `**נכשלה, ${result.failed} טענות. חוסם שחרור**`;
    if (!green) redBroken += 1;
  }
  console.log(`  ${useCase}  ${title.padEnd(46, '.')} ${status}`);
}

if (redBroken > 0) {
  console.log(`\n  ${redBroken} מתוך 3 הבדיקות האדומות אינן מחזיקות. לפי CLAUDE.md סעיף 8, זה חוסם שחרור.`);
}

// --- סיכום ---

const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

console.log(`\n${'='.repeat(72)}`);
console.log(
  `סיכום: ${results.length} קובצי בדיקה, ${totalPassed} טענות עברו, ${totalFailed} נכשלו. `
  + `${structureReady} מתוך 8 מבחני המבנה עוברים.`,
);

if (failedFiles === 0 && totalFailed === 0) {
  console.log('המערך ירוק.');
} else {
  console.log(`המערך אדום: ${failedFiles} קבצים נכשלו.`);
  process.exitCode = 1;
}
console.log('='.repeat(72));
