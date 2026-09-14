// ממשקים: כל פעולה בחוזה מקבלת תשובה. משימה 9 בתוכנית שלב 3.
//
// המקור: מפה 4.2 (הפעולות), מסמך הבנייה חוק 9, ומשימה 7 בתוכנית
// שלב 3 (ההחזרה לפי פעולה).
//
// למה הבדיקה הזאת נולדה בשלב 3: עד עכשיו ההדגמה עמדה במקום מודול
// שלם, ולכן די היה לשאול אם המודול קיים. משלב 3 מודול קיים ומממש
// מקצת הפעולות, והשאלה נעשתה מדויקת יותר: לכל צירוף מודול ופעולה
// שבחוזה, מי עונה. פעולה שאיש אינו עונה עליה תחזור מהמסך כ-
// E-MODULE-FAILED, וזה כשל שצריך להיתפס כאן ולא על המסך.
//
//   node tests/interfaces/action-coverage.test.js

import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import { DEMO_ACTIONS } from '../../tools/demo-modules.js';
import { ACTIONS as GOVERNANCE_ACTIONS } from '../../services/governance.js';
import { ACTIONS as GATE_ACTIONS } from '../../services/gate.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('ממשקים: כיסוי הפעולות');

// מה שנבנה בפועל, לפי הצהרת המודול עצמו. זו אותה רשימה שההרכבה
// קוראת, ולכן הבדיקה בודקת את מה שרץ ולא עותק שלו.
const BUILT = { 'BE-05': GOVERNANCE_ACTIONS, 'BE-06': GATE_ACTIONS };

const modules = modulesFile.modules.filter((row) => Array.isArray(row.actions) && row.actions.length > 0);
const contract = modules.filter((row) => row.id !== 'test-echo');

// --- 1. כל פעולה שפונה בנוי יכול לשלוח, נענית ---
//
// הפונים הבנויים היום הם ארבעת המסכים. הפונים שאינם בנויים הם
// המודולים האוטומטיים, module-dialogue, module-delivery,
// module-geofence, module-retrieval, system-timer ו-tool-simulator,
// והם נכנסים בשלבים 4 ו-5. פעולה שרק הם יכולים לשלוח אינה ניתנת
// לשליחה היום כלל, ולכן היעדר תשובה לה אינו חור אלא מצב בנייה,
// והוא נבדק בנפרד בטענה 4.

const rows = allowFile.rows ?? allowFile;
const answers = (id, action) => (BUILT[id] ?? []).includes(action)
  || (DEMO_ACTIONS[id] ?? []).includes(action);

const reachableFromScreen = rows.filter(
  (row) => row.allowed === true && row.from.startsWith('screen-') && row.module !== 'test-echo',
);

const unanswered = [...new Set(
  reachableFromScreen
    .filter((row) => !answers(row.module, row.action))
    .map((row) => `${row.module}.${row.action}`),
)];
check('כל פעולה שמסך רשאי לשלוח מקבלת תשובה', unanswered.sort(), []);
check('ונבדקו כל שורות המסכים ברשימת המותר', reachableFromScreen.length > 0, true);

// --- 2. ההדגמה אינה עונה על פעולה שאינה בחוזה ---

const invented = [];
for (const [id, actions] of Object.entries(DEMO_ACTIONS)) {
  const row = modulesFile.modules.find((m) => m.id === id);
  for (const action of actions) {
    if (!row?.actions?.includes(action)) invented.push(`${id}.${action}`);
  }
}
check('ההדגמה אינה ממציאה פעולה', invented.sort(), []);

// --- 3. מודול שנבנה אינו מצהיר על פעולה שאינה שלו בחוזה ---

const outside = [];
for (const [id, actions] of Object.entries(BUILT)) {
  const row = modulesFile.modules.find((m) => m.id === id);
  for (const action of actions) {
    if (!row?.actions?.includes(action)) outside.push(`${id}.${action}`);
  }
}
check('מודול שנבנה אינו מצהיר על פעולה שאינה בחוזה שלו', outside.sort(), []);

// --- 4. מצב הבנייה, נקוב במספרים ---
//
// הטענות האלה נופלות כשמשהו נבנה או יורד, וזה בדיוק תפקידן: הן
// מתעדכנות ביד בכל שלב, ולכן שינוי בהיקף אינו עובר בשקט.

const built = Object.values(BUILT).reduce((sum, list) => sum + list.length, 0);
const contractActions = contract.reduce((sum, row) => sum + row.actions.length, 0);

check('שלושים ושש פעולות בחוזה', contractActions, 36);
check('שלוש עשרה מהן נבנו בשלב 3', built, 13);

// שש הפעולות שאין להן תשובה, ואין להן גם פונה בנוי. הרשימה
// מפורשת כדי ששלב 4 יראה בדיוק מה הוא סוגר.
const noCallerYet = [];
for (const row of contract) {
  for (const action of row.actions) {
    if (answers(row.id, action)) continue;
    noCallerYet.push(`${row.id}.${action}`);
  }
}
check('שש פעולות ממתינות למודול שישלח אותן', noCallerYet.sort(), [
  'BE-04.retrieve', 'BE-05.listApprovedByStop', 'BE-07.close_stale',
  'FE-04.arrive', 'FE-04.leave', 'FE-04.release',
]);
check(
  'ואף מסך אינו רשאי לשלוח אף אחת מהן',
  rows.filter((r) => r.from.startsWith('screen-')
    && noCallerYet.includes(`${r.module}.${r.action}`)),
  [],
);
check(
  'ושתי הפעולות של BE-06 שלא נבנו הן של שלב 4',
  (modulesFile.modules.find((m) => m.id === 'BE-06').actions).filter((a) => !GATE_ACTIONS.includes(a)).sort(),
  ['get_lock_readiness', 'set_enforce'],
);
check(
  'ועשר הפעולות של BE-05 שלא נבנו הן של שלבים 4 ו-5',
  (modulesFile.modules.find((m) => m.id === 'BE-05').actions).filter((a) => !GOVERNANCE_ACTIONS.includes(a)).sort(),
  [
    'create_item', 'edit_item', 'listApprovedByStop', 'listExitPoints', 'lock_site',
    'nearestExitPoint', 'register_exit_point', 'register_institute', 'register_source', 'verify_anchor',
  ],
);

// --- 5. לכל פעולה שנבנתה יש שורה ברשימת המותר ---
//
// פעולה שנבנתה ואין לה שורה היא פעולה שאיש אינו רשאי לבקש, כלומר
// קוד מת מאחורי E-ALLOW-DENIED.

const orphan = [];
for (const [id, actions] of Object.entries(BUILT)) {
  for (const action of actions) {
    if (!rows.some((r) => r.module === id && r.action === action && r.allowed === true)) {
      orphan.push(`${id}.${action}`);
    }
  }
}
check('לכל פעולה שנבנתה יש פונה מורשה', orphan.sort(), []);

report(` (${contractActions} פעולות בחוזה, ${built} נבנו)`);
