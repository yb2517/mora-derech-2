// מבחן מבנה 08: "אף מודול אינו קורא למודול אחר ישירות" (מפה 6.4),
// וחוקי ברזל 2 ו-7 ("כיוון תלות אחד").
//
// המבחן אינו נדרש בשורה 8 בתוכנית, שמונה 01, 03, 04 ו-07. הוספתי
// אותו מפני שהוא ב-6.4, מפני שבדקתי אותו ביד בכל משימה עד כה, ומפני
// שהאוטומציה מייתרת את הבדיקה הידנית. הסרה שלו היא מחיקת קובץ.
//
//   node tests/structure/import-graph.test.js

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('מבחן מבנה 08');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SKIP_DIRS = new Set(['.git', 'docs', 'tests', 'node_modules', '.claude']);

// כיוון התלות של חוק ברזל 7, מהחוץ פנימה. שכבה רשאית לייבא משכבה
// שמתחתיה בלבד. CORE-01 הוא החוזה, ולכן כל שכבה רשאית לייבא ממנו.
const LAYERS = [
  { name: 'מסך', dirs: ['screens'] },
  { name: 'Orchestrator', dirs: ['core'], files: ['core/orchestrator.js'] },
  { name: 'מודול', dirs: ['services', 'connectors', 'automation', 'gateways', 'tools'] },
  { name: 'Repository', dirs: ['repository'] },
];

const CONTRACT_FILES = ['core/contract.js', 'core/errors.js'];

function collectFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) found.push(...collectFiles(full));
    } else if (/\.(js|mjs)$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

const files = collectFiles(ROOT).map((full) => {
  const path = relative(ROOT, full).split('\\').join('/');
  const text = readFileSync(full, 'utf8');
  const specifiers = [...text.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  return { path, specifiers };
});

check('נסרקו קובצי קוד', files.length > 0, true);

// --- חוק ברזל 2: אין ייבוא בין מודולי שירות ---

const MODULE_DIRS = ['services', 'connectors', 'automation', 'gateways', 'tools'];

const moduleToModule = [];
for (const file of files) {
  const isModule = MODULE_DIRS.some((dir) => file.path.startsWith(`${dir}/`));
  if (!isModule) continue;
  for (const specifier of file.specifiers) {
    if (MODULE_DIRS.some((dir) => specifier.includes(`${dir}/`))) {
      moduleToModule.push(`${file.path} -> ${specifier}`);
    }
  }
}

check('אף מודול אינו מייבא מודול אחר', moduleToModule.sort(), []);

// --- חוק ברזל 7: אין ייבוא כלפי חוץ ---

// Repository אינו מייבא מודול, Orchestrator או מסך.
const OUTWARD_FROM_REPOSITORY = [...MODULE_DIRS, 'screens', 'orchestrator'];
const repositoryOutward = [];
for (const file of files.filter((f) => f.path.startsWith('repository/'))) {
  for (const specifier of file.specifiers) {
    if (OUTWARD_FROM_REPOSITORY.some((token) => specifier.includes(token))) {
      repositoryOutward.push(`${file.path} -> ${specifier}`);
    }
  }
}
check('ה-Repository אינו מייבא כלפי חוץ', repositoryOutward.sort(), []);

// מודול אינו מייבא את ה-Orchestrator ואינו מייבא מסך.
const moduleOutward = [];
for (const file of files.filter((f) => MODULE_DIRS.some((d) => f.path.startsWith(`${d}/`)))) {
  for (const specifier of file.specifiers) {
    if (specifier.includes('orchestrator') || specifier.includes('screens/')) {
      moduleOutward.push(`${file.path} -> ${specifier}`);
    }
  }
}
check('אף מודול אינו מייבא את ה-Orchestrator או מסך', moduleOutward.sort(), []);

// --- אין מעגלים ---

const graph = new Map();
for (const file of files) {
  const resolved = file.specifiers
    .filter((s) => s.startsWith('.'))
    .map((s) => {
      const dir = file.path.split('/').slice(0, -1).join('/');
      const parts = `${dir}/${s}`.split('/');
      const stack = [];
      for (const part of parts) {
        if (part === '.' || part === '') continue;
        if (part === '..') stack.pop();
        else stack.push(part);
      }
      return stack.join('/');
    });
  graph.set(file.path, resolved);
}

const cycles = [];
for (const start of graph.keys()) {
  const seen = new Set();
  const walk = (node, trail) => {
    for (const next of graph.get(node) ?? []) {
      if (next === start) cycles.push([...trail, next].join(' -> '));
      else if (!seen.has(next)) {
        seen.add(next);
        walk(next, [...trail, next]);
      }
    }
  };
  walk(start, [start]);
}

check('גרף הייבוא חסר מעגלים', [...new Set(cycles)].sort(), []);

// --- CORE-01 הוא החוזה, ולכן אינו מייבא דבר מלבד עצמו ---

const contractOutward = [];
for (const file of files.filter((f) => CONTRACT_FILES.includes(f.path))) {
  for (const specifier of file.specifiers) {
    const target = specifier.replace(/^\.\//, 'core/');
    if (!CONTRACT_FILES.includes(target)) {
      contractOutward.push(`${file.path} -> ${specifier}`);
    }
  }
}
check('CORE-01 אינו מייבא דבר מחוץ ל-CORE-01', contractOutward.sort(), []);

const edges = [...graph.values()].reduce((sum, list) => sum + list.length, 0);
report(` (${files.length} קבצים, ${edges} קשתות ייבוא, ${LAYERS.length} שכבות)`);
