// בדיקת ממשקים: טבלת המעברים שבליבה מול רשימת המותר. משימה 1
// בתוכנית שלב 3, ופער 36.
//
// למה היא קיימת: מפה 2.2 נושאת עמודה "מי רשאי (from)", ומפה 4.3
// קובעת ששם פונה הוא נתון ולא קוד. ההכרעה הייתה להשאיר את שם הפונה
// ברשימת המותר בלבד, ולכן עמודה אחת של המפה יושבת עכשיו בשני
// מקומות שונים: המצבים בליבה, וההרשאה בנתונים. הבדיקה הזאת היא מה
// שמונע מהם להיפרד.
//
//   node tests/interfaces/transitions.test.js

import { ITEM_TRANSITIONS, CALLER, SYSTEM } from '../../core/business-logic.js';
import allowList from '../../registry/allow-list.json' with { type: 'json' };
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('ממשקים: המעברים מול רשימת המותר');

// עמודת "מי רשאי (from)" של מפה 2.2, מועתקת לכאן ביד. זהו המקום
// היחיד במאגר שמחזיק אותה כלשונה, מלבד הנתונים עצמם.
const WHO_MAY_IN_MAP_2_2 = {
  create_item: ['screen-content'],
  submit: ['screen-veto'],
  approve: ['screen-veto'],
  reject: ['screen-veto'],
  return: ['screen-veto'],
  edit_item: ['screen-content'],
  // "BE-05 אוטומטית": אין לו פונה, ולכן אין לו שורה ברשימת המותר.
  revert: [],
};

const callerActions = [...new Set(
  ITEM_TRANSITIONS.filter((row) => row.source === CALLER).map((row) => row.action),
)].sort();

const systemActions = ITEM_TRANSITIONS
  .filter((row) => row.source === SYSTEM)
  .map((row) => row.action);

check('הפעולות שמגיעות במעטפה', callerActions, [
  'approve', 'create_item', 'edit_item', 'reject', 'return', 'submit',
]);

check('הפעולה האוטומטית היחידה של המפה', systemActions, ['revert']);

// --- לכל מעבר שמגיע במעטפה יש שורה ברשימת המותר ---

function allowedFromFor(action) {
  return allowList.rows
    .filter((row) => row.module === 'BE-05' && row.action === action && row.allowed === true)
    .map((row) => row.from)
    .sort();
}

const mismatched = callerActions
  .filter((action) => JSON.stringify(allowedFromFor(action))
    !== JSON.stringify([...WHO_MAY_IN_MAP_2_2[action]].sort()))
  .map((action) => `${action}: ברשימה ${allowedFromFor(action).join(',')}, במפה ${WHO_MAY_IN_MAP_2_2[action].join(',')}`);

check('"מי רשאי" ברשימת המותר זהה לעמודה שבמפה 2.2', mismatched, []);

// --- מעבר אוטומטי אינו זמין לאיש דרך מעטפה ---

const systemExposed = systemActions.filter((action) => allowedFromFor(action).length > 0);
check('למעבר האוטומטי אין שורה ברשימת המותר', systemExposed, []);

const systemRegistered = systemActions.filter(
  (action) => (modulesFile.modules.find((m) => m.id === 'BE-05')?.actions ?? []).includes(action),
);
check('המעבר האוטומטי אינו פעולה רשומה של BE-05', systemRegistered, []);

// --- הכיוון ההפוך: אין ברשימה שורת מעבר שאין לה שורה בטבלה ---

const TRANSITION_ACTIONS = new Set(ITEM_TRANSITIONS.map((row) => row.action));
const inListNotInTable = allowList.rows
  .filter((row) => row.module === 'BE-05' && WHO_MAY_IN_MAP_2_2[row.action] !== undefined)
  .filter((row) => !TRANSITION_ACTIONS.has(row.action))
  .map((row) => `${row.from} ${row.action}`);

check('כל פעולת מעבר ברשימת המותר קיימת בטבלה', inListNotInTable, []);

report(` (${ITEM_TRANSITIONS.length} מעברים, ${callerActions.length} פעולות במעטפה)`);
