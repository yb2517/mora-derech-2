// מבחן מבנה 03: "כל מסך פונה לכתובת אחת ומצהיר מי הוא" (מפה 6.4).
//
// בשלב 1 המבחן עבר בריק ונכתב כדי להתחיל לאכוף ברגע שייכנס מסך.
// משימה 3 בשלב 2 הכניסה את הכתובת, ולכן המבחן מבחין עכשיו בין שני
// סוגי קבצים תחת screens/:
//
//   הכתובת (screens/endpoint.js) אינה מסך. היא אינה מצהירה מי היא,
//   מפני שהזהות באה מהמסך, והיא אינה מייבאת דבר.
//
//   מסך מצהיר מי הוא בשדה from, פונה דרך הכתובת, ואינו מייבא את
//   ה-Orchestrator, את שכבת הנתונים או מודול כלשהו.
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
// רשאית לייבא ממנו לפי מבחן 08), וקבצים בתוך תיקיית המסך עצמו.
const CONTRACT = ['core/contract.js', 'core/errors.js'];

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

const screens = files.filter((f) => f.path !== ADDRESS);
const code = screens.filter((f) => /\.(js|mjs)$/.test(f.path));

check(
  'אין מסך שנוגע בשכבת הנתונים או במודול ישירות',
  files.filter((f) => FORBIDDEN.some((token) => f.text.includes(token))).map((f) => f.path).sort(),
  [],
);

check(
  'כל מסך מצהיר מי הוא, כלומר שולח from משלו',
  screens.filter((f) => !/from\s*:/.test(f.text)).map((f) => f.path).sort(),
  [],
);

check(
  'כל מסך פונה דרך הכתובת',
  code.filter((f) => !f.specifiers.some((s) => resolveFrom(f.path, s) === ADDRESS))
    .map((f) => f.path).sort(),
  [],
);

// הכתובת אחת, ולכן אין מסך שמדלג עליה אל ה-Orchestrator או אל כל
// יעד אחר שאינו הכתובת, החוזה, או קובץ בתוך תיקיית המסך עצמו.
const bypass = [];
for (const file of code) {
  const folder = file.path.split('/').slice(0, -1).join('/');
  for (const specifier of file.specifiers) {
    const target = resolveFrom(file.path, specifier);
    const allowed = target === ADDRESS
      || CONTRACT.includes(target)
      || target.startsWith(`${folder}/`);
    if (!allowed) bypass.push(`${file.path} -> ${specifier}`);
  }
}

check('אין מסך שמדלג על הכתובת', bypass.sort(), []);

const emptyPass = screens.length === 0;

report(
  emptyPass
    ? ' (הכתובת נבדקה; אין עדיין מסכים, והם נכנסים במשימות 5 עד 7)'
    : ` (${screens.length} קובצי מסך, כולם דרך כתובת אחת)`,
);
