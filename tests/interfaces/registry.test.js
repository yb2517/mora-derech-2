// בדיקת הממשקים של CORE-03: טבלת המודולים ורשימת המותר.
// נגזר מבדיקת הקבלה של משימה 3 בתוכנית שלב 1, ממפה 4.2, 4.3 ו-4.4,
// וממפה 6.2 ("רשימת המותר: כל צירוף מותר עובר, כל צירוף אחר נדחה").
// נכתב יחד עם הנתונים (חוק ברזל 9).
//
//   node tests/interfaces/registry.test.js

import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, checkThrowsAsync, report } = createChecker('CORE-03 registry');

// עד שלב 7 היו כאן שלוש קבוצות שורות: כל הקובץ, שורות 4.2, ושורות
// הייצור בלי is_demo. משלב 7 הקבוצות זהות: מודול הדמה של משימה 7
// בשלב 1 ושתי שורות tool-simulator (פער 13) הוסרו מהנתונים, ומפה 4.3
// מתקיימת כלשונה: בייצור אין להן שורה כלל. השמות נשמרים כדי שכל
// טענה תמשיך לומר על איזו קבוצה היא מדברת.
const allModules = modulesFile.modules;
const allRows = allowFile.rows;
const modules = allModules;
const mapRows = allRows;
const rows = mapRows;
const productionRows = allRows;

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

// מפה 4.1 ו-3.3: שם הפונה של כל מודול שהוא פונה
const CALLER_OF_MODULE = {
  'BE-03': 'module-dialogue',
  'FE-04': 'module-delivery',
  'BE-04': 'module-retrieval',
  'AUTO-01': 'module-geofence',
  'AUTO-02': 'system-timer',
  'TOOL-01': 'tool-simulator',
  'FE-06': 'screen-veto',
  'FE-05': 'screen-traveler',
  'FE-07': 'screen-content',
  'FE-08': 'screen-owner',
};

// מפה 4.2, הפעולה לכל מודול
const ACTIONS_IN_MAP = {
  'BE-05': [
    'submit', 'approve', 'reject', 'return',
    'register_mou', 'register_institute', 'register_source',
    'create_item', 'edit_item', 'verify_anchor',
    'register_exit_point', 'lock_site',
    'listApprovedByStop', 'nearestExitPoint',
    // שמונה פעולות הקריאה, פער 30, מפה גרסה 3.2
    'listItems', 'getItem', 'listApprovals', 'getSite',
    'listSources', 'listInstitutes', 'listMou', 'listExitPoints',
    // פער B-35, מפה גרסה 3.8
    'listAnchors',
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

// מפה 4.2 יחד עם 4.4, צירוף אחרי צירוף. ארבעים ושש שורות.
// שתי שורות הפיתוח של 4.2: "FE-04 arrive, leave: module-geofence,
// tool-simulator (פיתוח)". מפה 4.3 קובעת להן allowed=false בייצור,
// כלומר אין שורה, ולכן הן מוקלדות כאן בנפרד ואינן מצופות בקובץ.
const DEVELOPMENT_ROWS_IN_MAP = [
  ['tool-simulator', 'FE-04', 'arrive'],
  ['tool-simulator', 'FE-04', 'leave'],
];

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
  // פער 30: שתים עשרה שורות הקריאה, מפה 4.2 יחד עם 4.4
  ['screen-veto', 'BE-05', 'listItems'],
  ['screen-content', 'BE-05', 'listItems'],
  ['screen-veto', 'BE-05', 'getItem'],
  ['screen-content', 'BE-05', 'getItem'],
  ['screen-veto', 'BE-05', 'listApprovals'],
  ['screen-content', 'BE-05', 'getSite'],
  ['screen-owner', 'BE-05', 'getSite'],
  ['screen-content', 'BE-05', 'listSources'],
  ['screen-owner', 'BE-05', 'listSources'],
  ['screen-owner', 'BE-05', 'listInstitutes'],
  ['screen-owner', 'BE-05', 'listMou'],
  ['screen-content', 'BE-05', 'listExitPoints'],
  // פער B-35: AUTO-01 מודד מרחק לעוגני המסלול ולנקודות היציאה
  ['module-geofence', 'BE-05', 'listAnchors'],
  ['module-geofence', 'BE-05', 'listExitPoints'],
  ['screen-veto', 'BE-06', 'get_gate'],
  ['screen-traveler', 'BE-06', 'get_gate'],
  ['screen-owner', 'BE-06', 'get_lock_readiness'],
  ['screen-owner', 'BE-06', 'set_enforce'],
  ['module-dialogue', 'BE-04', 'retrieve'],
  ['screen-traveler', 'BE-03', 'ask'],
  ['module-geofence', 'FE-04', 'arrive'],
  ['module-geofence', 'FE-04', 'leave'],
  ['system-timer', 'FE-04', 'release'],
  ['screen-traveler', 'BE-07', 'session_start'],
  ['screen-traveler', 'BE-07', 'session_end'],
  ['module-dialogue', 'BE-07', 'log'],
  ['module-delivery', 'BE-07', 'log'],
  ['screen-traveler', 'BE-07', 'log'],
  // נוספה בהכרעת בעלת הפרויקט 14.09.2026, פער 11: מפה 3.2 כותבת על
  // BE-04 "שולח log ל-BE-07", ולא הייתה לו שורה.
  ['module-retrieval', 'BE-07', 'log'],
  ['system-timer', 'BE-07', 'close_stale'],
  ['screen-owner', 'BE-07', 'compute_metrics'],
  ['screen-owner', 'BE-07', 'export'],
];

// ---------------------------------------------------------------
// modules.json מול מפה 3
// ---------------------------------------------------------------

check('המפה מונה עשרים ושניים מודולים', MODULE_IDS_IN_MAP.length, 22);
check('הקובץ מונה עשרים ושניים מודולים שאינם הדגמה', modules.length, 22);

const idsInFile = modules.map((m) => m.id);
check('המזהים והסדר זהים למפה', idsInFile, MODULE_IDS_IN_MAP);
check('אין מזהה כפול', idsInFile.length - new Set(idsInFile).size, 0);

// עמודת file, הכרעה 6 בתוכנית שלב 5: מודול שנטען בהרכבה ואינו
// מנותב. שלושה כאלה, ולהם חמישה שדות; לכל השאר ארבעה.
const LOADED_NOT_ROUTED = ['AUTO-01', 'AUTO-02', 'TOOL-01'];

check(
  'לכל מודול ארבעה שדות: id, caller, handler, actions, ולנטען בהרכבה גם file',
  modules
    .filter((m) => {
      const keys = JSON.stringify(Object.keys(m));
      return LOADED_NOT_ROUTED.includes(m.id)
        ? keys !== JSON.stringify(['id', 'caller', 'handler', 'actions', 'file'])
        : keys !== JSON.stringify(['id', 'caller', 'handler', 'actions']);
    })
    .map((m) => m.id),
  [],
);

check(
  'מודול עם file הוא פונה בלי handler ובלי פעולות',
  modules.filter((m) => 'file' in m && !(m.caller && m.handler === null && m.actions.length === 0)).map((m) => m.id),
  [],
);

check(
  'קובץ המודול הנטען יושב בתיקייה שמסמך הבנייה סעיף 5 קובע',
  modules.filter((m) => 'file' in m).map((m) => [m.id, m.file]),
  [['AUTO-01', 'automation/geofence.js'], ['AUTO-02', 'automation/timer.js'], ['TOOL-01', 'tools/simulator.js']],
);

// --- שמות הפונים, מפה 4.1 ---

check(
  'עשרה פונים, כמספר הרשימה הסגורה של 4.1',
  modules.filter((m) => m.caller !== null).length,
  10,
);

check(
  'שם הפונה של כל מודול זהה למפה',
  Object.entries(CALLER_OF_MODULE)
    .filter(([id, caller]) => modules.find((m) => m.id === id)?.caller !== caller)
    .map(([id]) => id),
  [],
);

check(
  'מודול שאינו פונה במפה מגיע עם caller ריק',
  modules.filter((m) => !(m.id in CALLER_OF_MODULE) && m.caller !== null).map((m) => m.id),
  [],
);

check(
  'אין שם פונה כפול',
  (() => {
    const names = modules.map((m) => m.caller).filter(Boolean);
    return names.length - new Set(names).size;
  })(),
  0,
);

// כל from ברשימת המותר הוא caller של מודול רשום. זה מה שמאפשר
// ל-CORE-02 לגזור את הרשימה הסגורה מהנתונים ולא מהקוד.
// אחרי פער 11, לכל פונה של 4.1 יש לפחות שורה אחת, מלבד tool-simulator:
// שורותיו הן פיתוח בלבד ואינן בקובץ (מפה 4.3, שלב 7). הוא נשאר
// ברשימה הסגורה מפני שהוא פונה במפה, והבדיקות מצרפות את שורותיו.
const developmentCallers = [...new Set(DEVELOPMENT_ROWS_IN_MAP.map(([from]) => from))];
check(
  'אין פונה ברשימה הסגורה בלי אף שורה, מלבד פונה הפיתוח',
  modules
    .map((m) => m.caller)
    .filter(Boolean)
    .filter((caller) => !developmentCallers.includes(caller))
    .filter((caller) => !allRows.some((r) => r.from === caller)),
  [],
);

check(
  'כל from ברשימת המותר הוא caller של מודול',
  [...new Set(rows.map((r) => r.from))]
    .filter((from) => !modules.some((m) => m.caller === from)),
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
  'ספירת שורות המפה שווה לספירת צירופי הייצור ב-4.2, אחרי פערים 11 ו-30',
  mapRows.length,
  ROWS_IN_MAP.length,
);

check('ארבעים ושמונה צירופים ב-4.2, אחרי פערים 11, 30 ו-B-35, מהם שניים לפיתוח', ROWS_IN_MAP.length + DEVELOPMENT_ROWS_IN_MAP.length, 48);

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

// פער 13 ושלב 7: בייצור אין לסימולטור שורה, והתוצאה היא
// E-ALLOW-DENIED, כמו שמפה 4.3 מתכוונת. בדיקות ההליכה בסימולטור
// מצרפות את שתי השורות לזריעה שלהן בלבד.
check(
  'בייצור אין ולו שורת סימולטור אחת',
  productionRows.filter((r) => r.from === 'tool-simulator'),
  [],
);

check(
  'כל שורה בקובץ עם allowed=true',
  allRows.filter((r) => r.allowed !== true).map(keyOf),
  [],
);

check(
  'לכל שורה ארבעה שדות בדיוק',
  allRows
    .filter((r) => JSON.stringify(Object.keys(r)) !== JSON.stringify(['from', 'module', 'action', 'allowed']))
    .map(keyOf),
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

// ---------------------------------------------------------------
// אחרי שלב 7: שאילתה על is_demo מחזירה אפס (מסמך הבנייה סעיף 7)
// ---------------------------------------------------------------

check(
  'אף מודול אינו מסומן is_demo',
  allModules.filter((m) => 'is_demo' in m).map((m) => m.id),
  [],
);

check(
  'אף שורה אינה מסומנת is_demo',
  allRows.filter((r) => 'is_demo' in r).map(keyOf),
  [],
);

check('מודול הדמה של שלב 1 אינו בטבלת המודולים', allModules.some((m) => m.id === 'test-echo'), false);

check(
  'המצב שאחרי ההסרה: 22 מודולים ו-46 שורות, כפי שהבדיקה קבעה לפני השלב',
  [allModules.length, productionRows.length],
  [22, 46],
);

// --- סיכום ---

report();
