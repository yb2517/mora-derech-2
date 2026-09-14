// מבחן מבנה 04: "כל בקשה רשומה עם request_id" (מפה 6.4), ו-BL-09,
// שקובע שהכותב היחיד של audit_log הוא ה-Orchestrator.
//
//   node tests/structure/audit-writer.test.js

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOrchestrator } from '../../core/orchestrator.js';
import { createRepository } from '../../repository/index.js';
import { createBrowserDriver } from '../../repository/driver-browser.js';
import { handle as echoHandler } from '../helpers/echo-module.js';
import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };

const { check, checkThrows, report } = createChecker('מבחן מבנה 04');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// dist הוא פלט האריזה של משימה 9 ולא מקור: הוא עותק משורשר של
// אותם קבצים, והוא אינו במאגר. כלל מבני חל על המקום שאפשר
// לערוך, ולכן הוא נסרק כאן כמו node_modules, כלומר לא.
const SKIP_DIRS = new Set(['.git', 'docs', 'tests', 'node_modules', '.claude', 'dist']);

// --- BL-09: כותב אחד. רק ה-Orchestrator קורא ל-appendAudit ---

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

function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

const files = collectFiles(ROOT).map((full) => {
  const path = relative(ROOT, full).split('\\').join('/');
  return { path, code: withoutComments(readFileSync(full, 'utf8')) };
});

// repository/index.js מגדיר את הפעולה, ה-Orchestrator קורא לה.
const DEFINER = 'repository/index.js';
const WRITER = 'core/orchestrator.js';

const callers = files
  .filter((f) => f.path !== DEFINER && f.code.includes('appendAudit'))
  .map((f) => f.path)
  .sort();

check('הכותב היחיד ל-audit_log הוא ה-Orchestrator, לפי BL-09', callers, [WRITER]);
check('הפעולה מוגדרת ב-CORE-04', files.some((f) => f.path === DEFINER && f.code.includes('appendAudit')), true);

// --- כל בקשה מותירה שורות, וכולן עם request_id ---

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const repository = createRepository(createBrowserDriver({
  storage: memoryStorage(),
  seed: { modules: modulesFile, allow_list: allowFile, reference: referenceFile.values },
}));

let counter = 0;
const orchestrator = createOrchestrator({
  repository,
  handlers: { 'test-echo': echoHandler },
  newRequestId: () => `req-${++counter}`,
  now: () => '2026-09-14T00:00:00.000Z',
});

// בקשות מכל סוג: מוצלחת, פסולה, נדחית, וחסומה.
const requests = [
  { from: 'tool-simulator', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' },
  { module: 'test-echo', action: 'echo', payload: {}, lang: 'he' },
  { from: 'screen-nope', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' },
  { from: 'module-retrieval', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' },
  { from: 'screen-veto', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' },
  null,
];

for (const request of requests) await orchestrator.handle(request);

const rows = repository.listAudit();

check('כל בקשה הותירה שורות', rows.length, requests.length * 2);
check('אין שורה בלי request_id', rows.filter((row) => !row.request_id), []);

const byId = new Map();
for (const row of rows) {
  byId.set(row.request_id, (byId.get(row.request_id) ?? 0) + 1);
}

check('מזהה לכל בקשה, ולא יותר', byId.size, requests.length);
check(
  'שתי שורות לכל מזהה, בקשה ותשובה',
  [...new Set(byId.values())],
  [2],
);
check(
  'לכל מזהה שורת בקשה אחת ושורת תשובה אחת',
  [...byId.keys()].filter((id) => {
    const phases = rows.filter((r) => r.request_id === id).map((r) => r.phase);
    return JSON.stringify(phases) !== JSON.stringify(['request', 'response']);
  }),
  [],
);

// ה-Repository עצמו מסרב לשורה בלי מזהה, ולכן ההגנה אינה תלויה
// בכך שה-Orchestrator יזכור.
checkThrows('שורה בלי request_id נדחית ב-CORE-04', () => repository.appendAudit({ phase: 'request' }));

report(` (${rows.length} שורות, ${byId.size} בקשות, ${files.length} קובצי קוד)`);
