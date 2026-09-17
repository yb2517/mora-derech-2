// מבחן מבנה 02: "קריאה לספק AI בקובץ אחד" (מפה 6.4). בדיקת הקבלה של
// שלב 6 (מפה 7; CLAUDE.md סעיף 6: "חיפוש קריאה לספק AI: קובץ אחד").
// משימה 4 בתוכנית שלב 6.
//
// התבנית היא של מבחן מבנה 01: סריקה של קובצי הקוד לפי רשימת מזהים,
// קובץ אחד מותר, ואימות הפוך שהקובץ אכן נושא את המזהים ואינו עובר
// מפני שהסריקה מסננת יותר מדי.
//
// מה מסמן "קריאה לספק AI" (הכרעה 6 בתוכנית): שם משתנה הסביבה של
// המפתח; המפתח model_tier, שמפה 2.4 קובעת שהקורא היחיד שלו הוא GW-01;
// שם החוזה של הציוד, adapters; ושמות ספקים ונקודות קצה מוכרים.
// הרשימה האחרונה מתרחבת כשייבחר ספק, בעריכת המערך הזה.
//
//   node tests/structure/ai-provider.test.js

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('מבחן מבנה 02');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// dist הוא פלט האריזה ולא מקור, כמו במבחן 01: לא נסרק.
const SKIP_DIRS = new Set(['.git', 'docs', 'tests', 'node_modules', '.claude', 'dist']);
const CODE_EXTENSIONS = ['.js', '.mjs', '.html'];
const MAP_FILE = 'docs/doc-module-map-v3.md';

const GATEWAY = 'gateways/ai.js';
const GATEWAY_DIR = 'gateways/';

// ארבע הקבוצות של הכרעה 6.
const ENV_TOKENS = ['AI_PROVIDER_KEY'];
const REFERENCE_TOKENS = ['model_tier'];
const CONTRACT_TOKENS = ['adapters'];
const PROVIDER_TOKENS = [
  'anthropic', 'openai', 'api.openai.com', 'generativelanguage', 'completions', 'messages/v1',
];

const AI_TOKENS = [...ENV_TOKENS, ...REFERENCE_TOKENS, ...CONTRACT_TOKENS, ...PROVIDER_TOKENS];

// "בלי פנייה החוצה" (CLAUDE.md סעיף 6): כל הדרכים שבהן קוד יוצא לרשת,
// וקריאת סוד מהסביבה. אף אחת מהן אינה בשער ב-v1.
const OUTBOUND_TOKENS = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'process.env', 'import('];

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

// הערה שמזכירה ספק אינה קריאה לספק. מסירים הערות, כמו במבחן 01.
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

const files = collectFiles(ROOT).map((full) => ({
  path: relative(ROOT, full).split('\\').join('/'),
  code: withoutComments(readFileSync(full, 'utf8')),
}));

check('הסריקה מצאה קובצי קוד', files.length > 0, true);

const carries = (file, tokens) => tokens.filter((token) => file.code.toLowerCase().includes(token.toLowerCase()));

const touching = files.filter((f) => carries(f, AI_TOKENS).length > 0).map((f) => f.path).sort();

check('קובץ אחד בלבד נושא סימן של קריאה לספק AI, והוא השער', touching, [GATEWAY]);
check('אין סימן כזה מחוץ ל-gateways', touching.filter((p) => !p.startsWith(GATEWAY_DIR)), []);

for (const [label, tokens] of [
  ['שם משתנה הסביבה', ENV_TOKENS],
  ['המפתח model_tier', REFERENCE_TOKENS],
  ['חוזה הציוד', CONTRACT_TOKENS],
  ['שמות ספקים', PROVIDER_TOKENS],
]) {
  check(
    `${label}: בקובץ השער בלבד, או באף קובץ`,
    files.filter((f) => carries(f, tokens).length > 0).map((f) => f.path).filter((p) => p !== GATEWAY),
    [],
  );
}

// --- הוודאות ההפוכה: הבדיקה באמת מזהה, והשער באמת ריק ---

const gateway = files.find((f) => f.path === GATEWAY);
check('קובץ השער נסרק', Boolean(gateway), true);
check('השער נושא את שם משתנה הסביבה, בשם בלבד', carries(gateway, ENV_TOKENS), ENV_TOKENS);
check('השער קורא את model_tier', carries(gateway, REFERENCE_TOKENS), REFERENCE_TOKENS);
check('השער מגדיר את חוזה הציוד', carries(gateway, CONTRACT_TOKENS), CONTRACT_TOKENS);
check('השער אינו מכיר ספק ב-v1', carries(gateway, PROVIDER_TOKENS), []);
check('השער אינו פונה החוצה ואינו קורא סוד ב-v1', carries(gateway, OUTBOUND_TOKENS), []);

// השער מייבא את החוזה בלבד: הרחבה של מבחן 08 לקובץ הזה.
const imports = [...gateway.code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]).sort();
check('השער מייבא את CORE-01 בלבד', imports, ['../core/contract.js', '../core/errors.js']);

// המפה 2.4 אומרת שהקורא היחיד של model_tier הוא GW-01. הבדיקה מצליבה
// זאת מול המסמך, כדי שרשימת המזהים כאן לא תסטה מהמפה בשקט.
const mapText = readFileSync(join(ROOT, MAP_FILE), 'utf8');
const tierRow = mapText.split('\n').find((line) => line.startsWith('| model_tier |'));
check('מפה 2.4 מונה את model_tier', Boolean(tierRow), true);
check('ומפה 2.4 קובעת שהקורא שלו הוא GW-01', tierRow?.split('|').map((c) => c.trim())[3], 'GW-01');

report(` (${files.length} קובצי קוד, ${touching.length} נושא סימן של ספק AI)`);
