// מבחן מבנה 03: "כל מסך פונה לכתובת אחת ומצהיר מי הוא" (מפה 6.4).
//
// בשלב 1 המבחן עבר בריק ונכתב כדי להתחיל לאכוף ברגע שייכנס מסך.
// משימה 3 בשלב 2 הכניסה את הכתובת, ולכן המבחן מבחין עכשיו בין שני
// סוגי קבצים תחת screens/:
//
//   הכתובת (screens/endpoint.js) אינה מסך. היא אינה מצהירה מי היא,
//   מפני שהזהות באה מהמסך, והיא אינה מייבאת דבר.
//
//   מסך מצהיר מי הוא בשדה from, מקבל את הכתובת בהזרקה ואינו בונה
//   אותה בעצמו, ואינו מייבא את ה-Orchestrator, את שכבת הנתונים או
//   מודול כלשהו.
//
//   node tests/structure/screen-endpoint.test.js

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };

const { check, report } = createChecker('מבחן מבנה 03');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCREENS_DIR = 'screens';
const ADDRESS = 'screens/endpoint.js';

// מה שמסך אינו רשאי לגעת בו ישירות. הבדיקה על הטקסט הגולמי ולא על
// הייבואים בלבד, מפני שגם קריאה דינמית וגם נתיב שנבנה כמחרוזת הם
// נגיעה.
const FORBIDDEN = [
  'repository/', 'driver-browser', 'driver-cloud',
  'services/', 'connectors/', 'automation/', 'gateways/',
];

// מה שמסך כן רשאי לייבא: את הכתובת, את החוזה (CORE-01, שכל שכבה
// רשאית לייבא ממנו לפי מבחן 08), עזרי תצוגה משותפים תחת screens/,
// וקבצים בתוך תיקיית המסך עצמו.
//
// screens/view.js הוא תשתית מסך ולא מסך: הוא בונה אלמנטים עם
// מחלקות של DESIGN-01, ואינו שולח מעטפות. שלושה עותקים שלו היו
// שלושה מקומות שיכולים להיפרד.
const CONTRACT = ['core/contract.js', 'core/errors.js'];
const SHARED = ['screens/view.js'];

function collectScreenFiles(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collectScreenFiles(full));
    else if (/\.(js|mjs|html)$/.test(entry)) found.push(full);
  }
  return found;
}

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

const files = collectScreenFiles(join(ROOT, SCREENS_DIR)).map((full) => {
  const path = relative(ROOT, full).split('\\').join('/');
  const text = readFileSync(full, 'utf8');
  return {
    path,
    text,
    specifiers: [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
  };
});

// ארבעת שמות המסך של 4.1, מטבלת המודולים.
const screenCallers = modulesFile.modules
  .map((m) => m.caller)
  .filter((caller) => typeof caller === 'string' && caller.startsWith('screen-'));

check('ארבעה שמות מסך רשומים בנתונים', screenCallers.length, 4);

// --- הכתובת ---

const address = files.find((f) => f.path === ADDRESS);

check('הכתובת קיימת', Boolean(address), true);

// כתובת שמייבאת משהו גוררת אותו לכל מסך שפונה דרכה, ואז היא אינה
// כתובת אלא שכבה.
check('הכתובת אינה מייבאת דבר', address?.specifiers ?? null, []);

// --- המסכים ---

const screens = files.filter((f) => f.path !== ADDRESS && !SHARED.includes(f.path));
const code = screens.filter((f) => /\.(js|mjs)$/.test(f.path));

check(
  'אין מסך שנוגע בשכבת הנתונים או במודול ישירות',
  files.filter((f) => FORBIDDEN.some((token) => f.text.includes(token))).map((f) => f.path).sort(),
  [],
);

// היחידה הנבדקת היא מסך ולא קובץ: מסך הוא תיקייה תחת screens/,
// והוא רשאי להתפצל לקובץ תצוגה ולקובץ הרכבה. מה שנדרש הוא שהמסך
// כיחידה מצהיר מי הוא ופונה דרך הכתובת, ולא שכל קובץ בתוכו עושה
// זאת. הטענות שחלות על כל קובץ, בלי יוצא מן הכלל, הן שתיים: אין
// נגיעה בשכבת הנתונים, ואין דילוג על הכתובת.
const folders = [...new Set(
  screens.map((f) => f.path.split('/').slice(0, 2).join('/')),
)].sort();

const filesIn = (folder) => screens.filter((f) => f.path.startsWith(`${folder}/`));

check(
  'כל מסך מצהיר מי הוא, כלומר שולח from משלו',
  folders.filter((folder) => !filesIn(folder).some((f) => /from\s*:/.test(f.text))),
  [],
);

// מסך אינו מייבא את הכתובת אלא מקבל אותה בהזרקה, ולכן היא נבנית
// פעם אחת בנקודת הכניסה ומוזרקת לכולם. זו הצורה החזקה של "כתובת
// אחת": לא ארבע כתובות שנבנו מאותו קובץ, אלא אחת.
check(
  'אין מסך שבונה לעצמו כתובת',
  screens.filter((f) => f.specifiers.some((s) => resolveFrom(f.path, s) === ADDRESS))
    .map((f) => f.path).sort(),
  [],
);

// והצד השני של אותה טענה: הכתובת אכן נבנית, ובמקום אחד בלבד.
const CONSTRUCTOR = 'createEndpoint(';
const builders = [];
for (const entry of readdirSync(ROOT)) {
  if (!entry.endsWith('.html')) continue;
  const text = readFileSync(join(ROOT, entry), 'utf8');
  if (text.includes(CONSTRUCTOR)) builders.push(entry);
}
for (const file of screens) {
  if (file.text.includes(CONSTRUCTOR)) builders.push(file.path);
}

check('הכתובת נבנית במקום אחד, בנקודת הכניסה', builders.sort(), ['index.html']);

// הכתובת אחת, ולכן אין מסך שמדלג עליה אל ה-Orchestrator או אל כל
// יעד אחר שאינו הכתובת, החוזה, או קובץ בתוך תיקיית המסך עצמו.
const bypass = [];
for (const file of code) {
  const folder = file.path.split('/').slice(0, -1).join('/');
  for (const specifier of file.specifiers) {
    const target = resolveFrom(file.path, specifier);
    const allowed = target === ADDRESS
      || CONTRACT.includes(target)
      || SHARED.includes(target)
      || target.startsWith(`${folder}/`);
    if (!allowed) bypass.push(`${file.path} -> ${specifier}`);
  }
}

check('אין מסך שמדלג על הכתובת', bypass.sort(), []);

const emptyPass = screens.length === 0;

report(
  emptyPass
    ? ' (הכתובת נבדקה; אין עדיין מסכים, והם נכנסים במשימות 5 עד 7)'
    : ` (${folders.length} מסכים, ${screens.length} קבצים, כולם דרך כתובת אחת)`,
);
