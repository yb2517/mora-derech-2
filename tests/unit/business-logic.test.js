// Unit של הליבה, החוקים העסקיים. נגזר מבדיקת הקבלה של משימה 1
// בתוכנית שלב 3, ממפה 2.2, ומ-BL-01, BL-02 ו-BL-08. נכתב יחד עם
// הקוד (חוק ברזל 9).
//
//   node tests/unit/business-logic.test.js

import {
  ITEM_STATUSES,
  ITEM_TRANSITIONS,
  NO_STATUS,
  CALLER,
  SYSTEM,
  canTransition,
  allowedActions,
  buildApprovalRecord,
  APPROVAL_FIELDS,
  gateB,
} from '../../core/business-logic.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('הליבה: החוקים העסקיים');

// --- טבלת המעברים מול מפה 2.2 ---

// שמונה השורות של הטבלה במפה, מועתקות לכאן ביד. בדיקת הקבלה דורשת
// הצלבה מול רשימה שיושבת בבדיקה עצמה: רשימה שנגזרת מהקוד הנבדק
// אינה בודקת אותו.
//
// עמודת "מי רשאי (from)" של המפה נשמרת כאן כלשונה, ובקוד היא אינה
// יושבת (פער 36): שם הפונה הוא נתון ברשימת המותר, לפי מפה 4.3
// ומבחן מבנה 06. הבדיקה מצליבה את שתי העמודות: את המצבים מול
// הטבלה שבליבה, ואת "מי רשאי" מול רשימת המותר, בבדיקת הממשקים
// tests/interfaces/transitions.test.js.
const TRANSITIONS_IN_MAP_2_2 = [
  { from: null, to: 'draft', action: 'create_item', source: CALLER },
  { from: 'draft', to: 'pending', action: 'submit', source: CALLER },
  { from: 'pending', to: 'approved', action: 'approve', source: CALLER },
  { from: 'pending', to: 'rejected', action: 'reject', source: CALLER },
  { from: 'approved', to: 'pending', action: 'return', source: CALLER },
  { from: 'rejected', to: 'pending', action: 'return', source: CALLER },
  // "BE-05 אוטומטית" במפה: אין לו פונה, ולכן source הוא system.
  { from: 'approved', to: 'draft', action: 'revert', source: SYSTEM },
  { from: 'rejected', to: 'draft', action: 'edit_item', source: CALLER },
];

check(
  'שמונה שורות הטבלה זהות למפה 2.2, לא חסר ולא עודף',
  ITEM_TRANSITIONS.map(({ from, to, action, source }) => ({ from, to, action, source })),
  TRANSITIONS_IN_MAP_2_2,
);

check(
  'אין שם פונה בטבלה שבליבה',
  ITEM_TRANSITIONS.filter((row) => String(row.source).startsWith('screen-')),
  [],
);

check('ארבעת מצבי הפריט, מפה 2.1', ITEM_STATUSES, ['draft', 'pending', 'approved', 'rejected']);
check('לכל שורה יש תנאי כלשונו במפה', ITEM_TRANSITIONS.every((r) => typeof r.condition === 'string'), true);

// --- BL-02: מעבר לפי הטבלה בלבד ---

check('approve על pending מותר, והיעד approved', canTransition({
  status: 'pending', action: 'approve',
}).to, 'approved');

check('submit על draft מותר, והיעד pending', canTransition({
  status: 'draft', action: 'submit',
}).to, 'pending');

check('reject על pending מותר, והיעד rejected', canTransition({
  status: 'pending', action: 'reject',
}).to, 'rejected');

check('return משני המצבים המוכרעים מחזיר ל-pending', [
  canTransition({ status: 'approved', action: 'return' }).to,
  canTransition({ status: 'rejected', action: 'return' }).to,
], ['pending', 'pending']);

// בדיקת הקבלה של המשימה, ושורת BE-05 במפה 6.1.
check('approve על פריט approved נדחה', canTransition({
  status: 'approved', action: 'approve',
}), {
  allowed: false,
  code: 'E-TRANSITION-DENIED',
  data: { status: 'approved', action: 'approve', source: CALLER },
});

check('submit על פריט rejected נדחה', canTransition({
  status: 'rejected', action: 'submit',
}).code, 'E-TRANSITION-DENIED');

// מעבר שהמערכת מבצעת מעצמה אינו זמין למעטפה, גם כשהמצב מתאים.
check('revert אינו זמין לפונה', canTransition({
  status: 'approved', action: 'revert',
}).code, 'E-TRANSITION-DENIED');

check('revert זמין למערכת', canTransition({
  status: 'approved', action: 'revert', source: SYSTEM,
}).to, 'draft');

check('approve אינו זמין למערכת: הוא נקודת האישור האנושי', canTransition({
  status: 'pending', action: 'approve', source: SYSTEM,
}).code, 'E-TRANSITION-DENIED');

check('יצירה היא מעבר מ-NO_STATUS', canTransition({
  status: NO_STATUS, action: 'create_item',
}).to, 'draft');

check('פעולה שאינה בטבלה כלל נדחית', canTransition({
  status: 'pending', action: 'lock_site',
}).code, 'E-TRANSITION-DENIED');

check('הפעולות החוקיות ממצב pending', allowedActions({ status: 'pending' }), ['approve', 'reject']);

check('ממצב draft יש פעולה אחת', allowedActions({ status: 'draft' }), ['submit']);

// --- BL-01: צורת רשומת APPROVALS ---

check('שדות הרשומה, מפה 2.1', APPROVAL_FIELDS, [
  'approval_id', 'time', 'who', 'target', 'action', 'from_status', 'to_status', 'note',
]);

const record = buildApprovalRecord({
  approval_id: 'appr-1',
  time: '2026-09-14T10:00:00.000Z',
  who: 'screen-veto',
  target: 'item-1',
  action: 'approve',
  from_status: 'pending',
  to_status: 'approved',
  note: 'מדויק',
});

check('הרשומה נושאת את שמונת השדות ואותם בלבד', Object.keys(record), APPROVAL_FIELDS.slice());
check('הרשומה נושאת את הערכים שהתקבלו', record, {
  approval_id: 'appr-1',
  time: '2026-09-14T10:00:00.000Z',
  who: 'screen-veto',
  target: 'item-1',
  action: 'approve',
  from_status: 'pending',
  to_status: 'approved',
  note: 'מדויק',
});

// ההערה רשות בכל מעבר, והרשומה נכתבת גם כשהיא ריקה (הוכרע 10.09.2026).
check('הערה שלא נמסרה היא מחרוזת ריקה ולא היעדר', buildApprovalRecord({
  approval_id: 'appr-2',
  time: '2026-09-14T10:01:00.000Z',
  who: 'screen-veto',
  target: 'item-1',
  action: 'reject',
  from_status: 'pending',
  to_status: 'rejected',
}).note, '');

// --- BL-08: שער B ---

check('מסלול נעול ו-M-06 = 1: השער פתוח', gateB({
  site_status: 'locked', m06: 1, enforce: true,
}), {
  open: true, m06: 1, site_status: 'locked', enforced: true, blocking: false, reasons: [],
});

check('מסלול פתוח, גם כש-M-06 = 1: השער חסום', gateB({
  site_status: 'open', m06: 1, enforce: true,
}).reasons, ['site_not_locked']);

// שורת BE-06 במפה 6.1: M-06 = 0 ואכיפה דולקת, השער חסום.
check('M-06 = 0 ואכיפה דולקת: חוסם', gateB({
  site_status: 'locked', m06: 0, enforce: true,
}), {
  open: false, m06: 0, site_status: 'locked', enforced: true, blocking: true, reasons: ['m06_zero'],
});

check('שני התנאים חסרים: שתי הסיבות', gateB({
  site_status: 'open', m06: 0, enforce: true,
}).reasons, ['site_not_locked', 'm06_zero']);

// זרימה ו3 של usecase-f-07: אכיפה כבויה, המצב מוצג ואינו נאכף.
check('אכיפה כבויה: השער חסום ואינו חוסם', gateB({
  site_status: 'open', m06: 0, enforce: false,
}), {
  open: false,
  m06: 0,
  site_status: 'open',
  enforced: false,
  blocking: false,
  reasons: ['site_not_locked', 'm06_zero'],
});

check('M-06 גדול מ-1 מקיים את התנאי', gateB({
  site_status: 'locked', m06: 3, enforce: true,
}).open, true);

report(` (${ITEM_TRANSITIONS.length} מעברים)`);
