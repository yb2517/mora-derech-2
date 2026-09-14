// מבחן מבנה 06: "הוספת מסך יוצרת שורה ברשימת המותר" (מפה 6.4, 4.3).
//
// מפה 4.3 קובעת "הוספת מסך או פונה: שורה, לא קוד". הבדיקה סורקת את
// קוד המערכת ומוודאת שאין בו שם פונה: הרשימה הסגורה של 4.1 נגזרת
// מטבלת המודולים, ולכן מסך חדש נכנס בשורת נתונים.
//
//   node tests/structure/caller-list.test.js

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import modulesFile from '../../registry/modules.json' with { type: 'json' };
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('מבחן מבנה 06');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SKIP_DIRS = new Set(['.git', 'docs', 'tests', 'node_modules', '.claude']);

// הנתונים הם המקום היחיד שבו שם פונה מותר.
const DATA_FILES = new Set([
  'registry/modules.json',
  'registry/allow-list.json',
  // interaction_type_senders מחזיק שמות פונים, וזה בדיוק העיקרון:
  // הרשאה היא תא בטבלה ולא שורה בקוד (פער 14, BL-12).
  'data/reference.json',
]);

function collectFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) found.push(...collectFiles(full));
    } else if (/\.(js|mjs|json|html)$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

const callers = modulesFile.modules.map((m) => m.caller).filter(Boolean);

check('עשרה פונים בטבלת המודולים', callers.length, 10);

const files = collectFiles(ROOT)
  .map((full) => {
    const path = relative(ROOT, full).split('\\').join('/');
    return { path, code: withoutComments(readFileSync(full, 'utf8')) };
  })
  .filter((f) => !DATA_FILES.has(f.path));

check('הסריקה מצאה קובצי קוד מחוץ לנתונים', files.length > 0, true);

const offenders = [];
for (const caller of callers) {
  for (const file of files) {
    if (file.code.includes(caller)) offenders.push(`${caller} ב-${file.path}`);
  }
}

check('אין שם פונה בקוד המערכת', [...new Set(offenders)].sort(), []);

// הוודאות ההפוכה: שמות הפונים אכן נמצאים בקובץ הנתונים, כלומר
// הבדיקה אינה עוברת מפני שהיא מסננת את כל מה שרלוונטי.
const modulesText = readFileSync(join(ROOT, 'registry/modules.json'), 'utf8');
check(
  'כל שם פונה נמצא בטבלת המודולים',
  callers.filter((caller) => !modulesText.includes(caller)),
  [],
);

report(` (${callers.length} פונים, ${files.length} קובצי קוד)`);
