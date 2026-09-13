// בדיקת הממשקים של CORE-03: טבלת המודולים ורשימת המותר.
// נגזר מבדיקת הקבלה של משימה 3 בתוכנית שלב 1, ממפה 4.2, 4.3 ו-4.4,
// וממפה 6.2 ("רשימת המותר: כל צירוף מותר עובר, כל צירוף אחר נדחה").
// נכתב יחד עם הנתונים (חוק ברזל 9).
//
//   node tests/interfaces/registry.test.js

import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
  } else {
    failures.push(`${name}\n    ציפיתי: ${e}\n    קיבלתי: ${a}`);
  }
}

const modules = modulesFile.modules;
const rows = allowFile.rows;

// ---------------------------------------------------------------
// הנתונים שמולם מצליבים, מוקלדים כאן ביד מתוך המפה.
// רשימה שנגזרת מהקובץ הנבדק אינה בודקת אותו.
// ---------------------------------------------------------------

// מפה 3.1, 3.2, 3.3
const MODULE_IDS_IN_MAP = [
  'CORE-01', 'CORE-02', 'CORE-03', 'CORE-04',
  'BE-05', 'BE-06', 'BE-04', 'BE-03', 'FE-04', 'BE-07',
  'FE-06', 'FE-05', 'FE-07', 'FE-08',
  'CONN-01', 'CONN-02', 'CONN-03',
  'AUTO-01', 'AUTO-02', 'GW-01', 'TOOL-01', 'DESIGN-01',
];

// מפה 4.1, הרשימה הסגורה של הפונים
const FROM_LIST_IN_MAP = [
  'screen-veto', 'screen-traveler', 'screen-content', 'screen-owner',
  'module-dialogue', 'module-delivery', 'module-retrieval',
  'module-geofence', 'system-timer', 'tool-simulator',
];

// מפה 4.2, הפעולה לכל מודול
const ACTIONS_IN_MAP = {
  'BE-05': [
    'submit', 'approve', 'reject', 'return',
    'register_mou', 'register_institute', 'register_source',
    'create_item', 'edit_item', 'verify_anchor',
    'register_exit_point', 'lock_site',
    'listApprovedByStop', 'nearestExitPoint',
  ],
  'BE-06': ['get_gate', 'get_lock_readiness', 'set_enforce'],
  'BE-04': ['retrieve'],
  'BE-03': ['ask'],
  'FE-04': ['arrive', 'leave', 'release'],
  'BE-07': [
    'session_start', 'session_end', 'log',
    'close_stale', 'compute_metrics', 'export',
  ],
};

// מפה 4.2 יחד עם 4.4, צירוף אחרי צירוף. שלושים ושלוש שורות.
const ROWS_IN_MAP = [
  ['screen-veto', 'BE-05', 'submit'],
  ['screen-veto', 'BE-05', 'approve'],
  ['screen-veto', 'BE-05', 'reject'],
  ['screen-veto', 'BE-05', 'return'],
  ['screen-owner', 'BE-05', 'register_mou'],
  ['screen-owner', 'BE-05', 'register_institute'],
  ['screen-content', 'BE-05', 'register_source'],
  ['screen-content', 'BE-05', 'create_item'],
  ['screen-content', 'BE-05', 'edit_item'],
  ['screen-content', 'BE-05', 'verify_anchor'],
  ['screen-content', 'BE-05', 'register_exit_point'],
  ['screen-owner', 'BE-05', 'lock_site'],
  ['module-delivery', 'BE-05', 'listApprovedByStop'],
  ['screen-traveler', 'BE-05', 'nearestExitPoint'],
  ['screen-veto', 'BE-06', 'get_gate'],
  ['screen-traveler', 'BE-06', 'get_gate'],
  ['screen-owner', 'BE-06', 'get_lock_readiness'],
  ['screen-owner', 'BE-06', 'set_enforce'],
  ['module-dialogue', 'BE-04', 'retrieve'],
  ['screen-traveler', 'BE-03', 'ask'],
  ['module-geofence', 'FE-04', 'arrive'],
  ['module-geofence', 'FE-04', 'leave'],
  ['tool-simulator', 'FE-04', 'arrive'],
  ['tool-simulator', 'FE-04', 'leave'],
  ['system-timer', 'FE-04', 'release'],
  ['screen-traveler', 'BE-07', 'session_start'],
  ['screen-traveler', 'BE-07', 'session_end'],
  ['module-dialogue', 'BE-07', 'log'],
  ['module-delivery', 'BE-07', 'log'],
  ['screen-traveler', 'BE-07', 'log'],
  ['system-timer', 'BE-07', 'close_stale'],
  ['screen-owner', 'BE-07', 'compute_metrics'],
  ['screen-owner', 'BE-07', 'export'],
];

// ---------------------------------------------------------------
// modules.json מול מפה 3
// ---------------------------------------------------------------

check('המפה מונה עשרים ושניים מודולים', MODULE_IDS_IN_MAP.length, 22);
check('הקובץ מונה עשרים ושניים מודולים', modules.length, 22);

const idsInFile = modules.map((m) => m.id);
check('המזהים והסדר זהים למפה', idsInFile, MODULE_IDS_IN_MAP);
check('אין מזהה כפול', idsInFile.length - new Set(idsInFile).size, 0);

check(
  'לכל מודול שלושה שדות בלבד: id, handler, actions',
  modules.filter((m) => JSON.stringify(Object.keys(m)) !== JSON.stringify(['id', 'handler', 'actions'])),
  [],
);

for (const [id, actions] of Object.entries(ACTIONS_IN_MAP)) {
  const found = modules.find((m) => m.id === id);
  check(`הפעולות של ${id} זהות ל-4.2`, found.actions, actions);
}

check(
  'מודול שאין לו פעולות ב-4.2 מגיע עם רשימה ריקה',
  modules.filter((m) => !(m.id in ACTIONS_IN_MAP) && m.actions.length > 0).map((m) => m.id),
  [],
);

check(
  'למודול עם פעולות יש handler, ולמודול בלי פעולות אין',
  modules.filter((m) => (m.actions.length > 0) !== (m.handler !== null)).map((m) => m.id),
  [],
);

// ---------------------------------------------------------------
// בדיקת הקבלה של משימה 3
// ---------------------------------------------------------------

check(
  'ספירת השורות ברשימת המותר שווה לספירת הצירופים ב-4.2',
  rows.length,
  ROWS_IN_MAP.length,
);

const keyOf = (r) => `${r.from}|${r.module}|${r.action}`;
const keysInFile = rows.map(keyOf).sort();
const keysInMap = ROWS_IN_MAP.map(([f, m, a]) => `${f}|${m}|${a}`).sort();

check(
  'אין שורה בקובץ שאינה במפה',
  keysInFile.filter((k) => !keysInMap.includes(k)),
  [],
);

check(
  'אין שורה במפה שחסרה בקובץ',
  keysInMap.filter((k) => !keysInFile.includes(k)),
  [],
);

check('אין שורה כפולה', keysInFile.length - new Set(keysInFile).size, 0);

// ---------------------------------------------------------------
// שלמות מול שאר המפה
// ---------------------------------------------------------------

check(
  'כל from ברשימת המותר נמצא ברשימה הסגורה של 4.1',
  [...new Set(rows.map((r) => r.from))].filter((f) => !FROM_LIST_IN_MAP.includes(f)),
  [],
);

check(
  'כל module ברשימת המותר קיים ב-modules.json',
  [...new Set(rows.map((r) => r.module))].filter((m) => !idsInFile.includes(m)),
  [],
);

check(
  'כל action ברשימת המותר רשום אצל המודול שלו',
  rows.filter((r) => {
    const mod = modules.find((m) => m.id === r.module);
    return !mod || !mod.actions.includes(r.action);
  }).map(keyOf),
  [],
);

check(
  'לכל פעולה ב-modules.json יש לפחות פונה אחד',
  modules.flatMap((m) => m.actions
    .filter((a) => !rows.some((r) => r.module === m.id && r.action === a))
    .map((a) => `${m.id}.${a}`)),
  [],
);

// ---------------------------------------------------------------
// tool-simulator, מפה 4.3
// ---------------------------------------------------------------

check(
  'שורות tool-simulator עם allowed=false',
  rows.filter((r) => r.from === 'tool-simulator').map((r) => `${r.action}=${r.allowed}`),
  ['arrive=false', 'leave=false'],
);

check(
  'כל שורה שאינה tool-simulator עם allowed=true',
  rows.filter((r) => r.from !== 'tool-simulator' && r.allowed !== true).map(keyOf),
  [],
);

check(
  'לכל שורה ארבעה שדות בלבד',
  rows.filter((r) => JSON.stringify(Object.keys(r)) !== JSON.stringify(['from', 'module', 'action', 'allowed'])),
  [],
);

// ---------------------------------------------------------------
// מבחן מבנה 06: הוספת מסך היא שורה, לא קוד
// ---------------------------------------------------------------

check(
  'הוספת שורה למסך חדש אינה דורשת שדה שאינו קיים',
  Object.keys({ from: 'screen-new', module: 'BE-06', action: 'get_gate', allowed: true }),
  ['from', 'module', 'action', 'allowed'],
);

// --- סיכום ---

console.log(`CORE-03 registry: ${passed} עברו, ${failures.length} נכשלו`);
for (const failure of failures) {
  console.log(`  נכשל: ${failure}`);
}
if (failures.length > 0) {
  process.exitCode = 1;
}
