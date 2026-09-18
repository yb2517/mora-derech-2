// בדיקת הממשקים של הפונים האוטומטיים: המעטפה, רשימת המותר וקודי
// השגיאה (מפה 6.2), עבור module-geofence, system-timer ו-tool-simulator.
// משימה 11 בתוכנית שלב 5.
//
// המקור: doc-build-03-automation סעיפים 5 ו-6 ("arrive מ-screen-traveler:
// E-ALLOW-DENIED"), מפה 4.2 (שורות FE-04 ו-BE-07 לפונים האוטומטיים),
// מפה 4.3 (שורות tool-simulator: פיתוח בלבד), BL-11.
//
// הבדיקה שולחת מעטפות דרך ה-Orchestrator האמיתי אל מודול הדמה,
// ולכן היא בודקת את הניתוב ואת רשימת המותר ולא את המודולים.
//
//   node tests/interfaces/automation-callers.test.js

import { createBrowserDriver } from '../../repository/driver-browser.js';
import { createRepository } from '../../repository/index.js';
import { createOrchestrator } from '../../core/orchestrator.js';
import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };

const { check, report } = createChecker('ממשקים: הפונים האוטומטיים');

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

// שתי שורות tool-simulator של 4.2 הן שורות פיתוח: מפה 4.3 קובעת שאין
// להן שורה בייצור, ומשלב 7 הן אינן בקובץ. הבדיקה מצרפת אותן לזריעה
// שלה בלבד, כדי שהניתוב של הסימולטור ייבדק כפי ש-4.2 מתאר אותו.
const callerOf = (id) => modulesFile.modules.find((row) => row.id === id).caller;
const SIMULATOR_TEST_ROWS = ['arrive', 'leave'].map((action) => ({ from: callerOf('TOOL-01'), module: 'FE-04', action, allowed: true }));

const repository = createRepository(createBrowserDriver({
  storage: memoryStorage(),
  seed: {
    modules: modulesFile,
    allow_list: { ...allowFile, rows: [...allowFile.rows, ...SIMULATOR_TEST_ROWS] },
    reference: referenceFile.values,
  },
}));

// מודול דמה לכל נמען: מתעד מה הגיע אליו, ועונה בחיוב.
const received = [];
const echo = (id) => async (request) => {
  received.push([id, request.from, request.action]);
  return { ok: true, data: { echoed: id } };
};
const orchestrator = createOrchestrator({
  repository,
  handlers: { 'FE-04': echo('FE-04'), 'BE-07': echo('BE-07'), 'BE-05': echo('BE-05') },
});

const envelope = (from, module, action, payload = {}) => ({ from, module, action, payload, lang: 'he' });
const auditOf = (action, from) => repository.listAudit().filter((row) => row.action === action && row.from === from);

// --- מותר: הפונים האוטומטיים והפעולות שלהם ב-4.2 ---

const ALLOWED = [
  ['AUTO-01', 'FE-04', 'arrive'],
  ['AUTO-01', 'FE-04', 'leave'],
  ['AUTO-01', 'BE-05', 'listAnchors'],
  ['AUTO-01', 'BE-05', 'listExitPoints'],
  ['AUTO-02', 'FE-04', 'release'],
  ['AUTO-02', 'BE-07', 'close_stale'],
  ['TOOL-01', 'FE-04', 'arrive'],
  ['TOOL-01', 'FE-04', 'leave'],
];

for (const [moduleId, target, action] of ALLOWED) {
  const from = callerOf(moduleId);
  const response = await orchestrator.handle(envelope(from, target, action, { session_id: 's' }));
  check(`${from} רשאי לבקש ${action} מ-${target}`, [response.ok, response.data?.echoed], [true, target]);
  check(`והבקשה נרשמה ב-audit_log עם request_id`, auditOf(action, from).filter((row) => row.phase === 'request').every((row) => typeof row.request_id === 'string'), true);
}

check('כל הבקשות המותרות הגיעו לנמען עם שם הפונה', received.length, ALLOWED.length);

// --- אסור: אותן פעולות מפונה שאינו מורשה ---

const DENIED = [
  ['FE-05', 'FE-04', 'arrive'],
  ['FE-05', 'FE-04', 'release'],
  ['AUTO-01', 'FE-04', 'release'],
  ['AUTO-02', 'FE-04', 'arrive'],
  ['AUTO-01', 'BE-07', 'close_stale'],
  ['TOOL-01', 'FE-04', 'release'],
  ['TOOL-01', 'BE-05', 'listAnchors'],
  ['AUTO-02', 'BE-05', 'listAnchors'],
];

for (const [moduleId, target, action] of DENIED) {
  const from = callerOf(moduleId);
  const before = received.length;
  const response = await orchestrator.handle(envelope(from, target, action, { session_id: 's' }));
  check(`${from} אינו רשאי לבקש ${action} מ-${target}: E-ALLOW-DENIED`, [response.ok, response.error?.code], [false, 'E-ALLOW-DENIED']);
  check('הבקשה לא נותבה', received.length, before);
  check('והדחייה נרשמה', auditOf(action, from).some((row) => row.phase === 'response' && row.ok === false), true);
}

// --- פונה שאינו ברשימה הסגורה, ומעטפה חסרה ---

{
  const response = await orchestrator.handle(envelope('tool-unknown', 'FE-04', 'arrive'));
  check('פונה שאינו ברשימה הסגורה: E-FROM-UNKNOWN', response.error?.code, 'E-FROM-UNKNOWN');
}
{
  const response = await orchestrator.handle({ module: 'FE-04', action: 'arrive', payload: {}, lang: 'he' });
  check('מעטפה בלי from: E-FROM-MISSING', response.error?.code, 'E-FROM-MISSING');
}

// --- הסימולטור פועל בפיתוח בלבד: משלב 7 אין לו שורה בנתונים (מפה 4.3) ---

check(
  'ל-tool-simulator אין שורה ברשימת המותר שבמאגר',
  allowFile.rows.filter((row) => row.from === callerOf('TOOL-01')).map((row) => [row.module, row.action]),
  [],
);

// --- המתאמים אינם פונים ואינם נמענים (מפה 4.1 גרסה 3.8) ---

check(
  'ל-CONN-01 עד CONN-03 אין שם פונה, אין handler ואין פעולה',
  modulesFile.modules.filter((row) => row.id.startsWith('CONN-')).map((row) => [row.caller, row.handler, row.actions.length]),
  [[null, null, 0], [null, null, 0], [null, null, 0]],
);
check('ואין להם שורה ברשימת המותר', allowFile.rows.filter((row) => row.module.startsWith('CONN-')), []);

report(` (${ALLOWED.length} מותרות, ${DENIED.length} אסורות)`);
