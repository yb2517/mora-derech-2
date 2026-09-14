// מבחן מבנה 03: "כל מסך פונה לכתובת אחת ומצהיר מי הוא" (מפה 6.4).
//
// **בשלב 1 המבחן עובר בריק: אין מסכים.** זה מצוין במפורש בשורת
// הסיכום, כדי שהירוק לא ייראה כהוכחה. שורה 8 בתוכנית שלב 1 דורשת
// בדיוק את זה.
//
// הבדיקה כתובה כך שברגע שייכנס מסך ראשון בשלב 2 היא תתחיל לאכוף:
// מסך שולח מעטפות בלבד, מצהיר from, ואינו קורא ל-Repository או
// למודול שירות ישירות (חוקי ברזל 2 ו-7).
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

// מה שמסך אינו רשאי לגעת בו ישירות.
const FORBIDDEN_IMPORTS = [
  'repository/', 'driver-browser', 'driver-cloud',
  'services/', 'connectors/', 'automation/', 'gateways/',
];

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

const screenFiles = collectScreenFiles(join(ROOT, SCREENS_DIR)).map((full) => ({
  path: relative(ROOT, full).split('\\').join('/'),
  text: readFileSync(full, 'utf8'),
}));

// ארבעת שמות המסכים של 4.1, מטבלת המודולים.
const screenCallers = modulesFile.modules
  .map((m) => m.caller)
  .filter((caller) => typeof caller === 'string' && caller.startsWith('screen-'));

check('ארבעה שמות מסך רשומים בנתונים', screenCallers.length, 4);

// בשלב הזה אין מסכים, ולכן הרשימה ריקה. בשלב 2 שתי הטענות הבאות
// יתחילו לאכוף בפועל, בלי לשנות שורה כאן.
check(
  'אין מסך שמייבא את ה-Repository או מודול שירות ישירות',
  screenFiles
    .filter((f) => FORBIDDEN_IMPORTS.some((token) => f.text.includes(token)))
    .map((f) => f.path),
  [],
);

check(
  'כל מסך מצהיר מי הוא, כלומר שולח from משלו',
  screenFiles.filter((f) => !/from\s*:/.test(f.text)).map((f) => f.path),
  [],
);

const emptyPass = screenFiles.length === 0;
check('מצב השלב: אין מסכים, והמבחן עובר בריק', emptyPass, true);

report(
  emptyPass
    ? ' (עובר בריק: אין מסכים בשלב 1, והאכיפה מתחילה בשלב 2)'
    : ` (${screenFiles.length} קובצי מסך נבדקו)`,
);
