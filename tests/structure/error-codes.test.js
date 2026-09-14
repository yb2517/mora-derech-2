// מבחן מבנה 07: "קודי השגיאה זהים בקוד ובמפה" (מפה 6.4).
//
// ההצלבה כאן היא מול מסמך המפה עצמו, סעיף 4.5, ולא מול רשימה שמוקלדת
// בבדיקה. זה מה שהופך אותה למבחן מבנה: היא מגלה שינוי במפה שלא נקלט
// בקוד, ושינוי בקוד שאין לו כיסוי במפה.
//
//   node tests/structure/error-codes.test.js

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ERROR_CODES, ERROR_CODE_LIST } from '../../core/errors.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('מבחן מבנה 07');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MAP_FILE = 'docs/doc-module-map-v3.md';
const SKIP_DIRS = new Set(['.git', 'docs', 'tests', 'node_modules', '.claude']);

// --- הרשימה שבמפה, נקראת מהמסמך ---

const mapText = readFileSync(join(ROOT, MAP_FILE), 'utf8');
const section = mapText.split('### 4.5')[1].split('## 5.')[0];
const inMap = section
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('| E-'))
  .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()))
  .map(([code, developerText]) => ({ code, developerText }));

check('סעיף 4.5 נקרא מהמסמך', inMap.length > 0, true);
check('המפה מונה עשרים ושניים קודים', inMap.length, 22);

// --- זהים, לשני הכיוונים ---

check(
  'אין קוד במפה שחסר בקוד',
  inMap.filter((row) => !(row.code in ERROR_CODES)).map((row) => row.code),
  [],
);

check(
  'אין קוד בקוד שאינו במפה',
  ERROR_CODE_LIST.filter((code) => !inMap.some((row) => row.code === code)),
  [],
);

check(
  'ההסבר למפתח זהה לנוסח שבמפה, מילה במילה',
  inMap.filter((row) => ERROR_CODES[row.code] !== row.developerText).map((row) => row.code),
  [],
);

check(
  'הסדר בקוד הוא הסדר במפה',
  [...ERROR_CODE_LIST],
  inMap.map((row) => row.code),
);

// --- אין קוד מומצא בשום מקום בקוד המערכת ---

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

const files = collectFiles(ROOT).map((full) => ({
  path: relative(ROOT, full).split('\\').join('/'),
  text: readFileSync(full, 'utf8'),
}));

const literals = new Set();
for (const file of files) {
  for (const match of file.text.matchAll(/\bE-[A-Z][A-Z-]*\b/g)) {
    literals.add(match[0]);
  }
}

check(
  'כל מחרוזת קוד שמופיעה בקוד המערכת נמצאת ברשימה הסגורה',
  [...literals].filter((code) => !ERROR_CODE_LIST.includes(code)).sort(),
  [],
);

check('נסרקו קובצי קוד', files.length > 0, true);
check('ונמצאו בהם מחרוזות קוד', literals.size > 0, true);

report(` (${inMap.length} במפה, ${ERROR_CODE_LIST.length} בקוד, ${literals.size} מחרוזות ב-${files.length} קבצים)`);
