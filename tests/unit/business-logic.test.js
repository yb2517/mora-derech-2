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
  lockReadiness,
  mouCoverage,
  mouInEffect,
  nextCorpusVersion,
  siteReopensOn,
  SITE_REOPENING_ACTIONS,
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

// ---------------------------------------------------------------------
// תנאי הנעילה L1 עד L6. משימה 2 בתוכנית שלב 4, usecase-f-08 סעיף 4.
// ---------------------------------------------------------------------

const AT = '2026-09-14T12:00:00.000Z';

const MOU = {
  mou_id: 'mou-1', institute_id: 'inst-1', scope: ['src-1'],
  signed_at: '2026-09-01T00:00:00.000Z', valid_until: '2027-09-01T00:00:00.000Z',
};

// מסלול שכל ארבעת התנאים מתקיימים בו: שתי תחנות, פריט מאושר לכל
// אחת, עוגן מאומת לכל פריט, רשומת אישור לכל פריט, והסכם בתוקף.
function readySite(overrides = {}) {
  return lockReadiness({
    site: { site_id: 'site-1', stops: ['stop-a', 'stop-b'], status: 'open', corpus_version: null },
    items: [
      { item_id: 'item-1', site_id: 'site-1', stop_id: 'stop-a', status: 'approved', text: 'טקסט', page: 7, source_id: 'src-1' },
      { item_id: 'item-2', site_id: 'site-1', stop_id: 'stop-b', status: 'approved', text: 'טקסט', page: 9, source_id: 'src-1' },
    ],
    anchors: [
      { anchor_id: 'anch-1', item_id: 'item-1', verified: true, is_crossing: false },
      { anchor_id: 'anch-2', item_id: 'item-2', verified: true, is_crossing: false },
    ],
    approvals: [
      { approval_id: 'appr-1', target: 'item-1', action: 'approve', to_status: 'approved' },
      { approval_id: 'appr-2', target: 'item-2', action: 'approve', to_status: 'approved' },
    ],
    sources: [{ source_id: 'src-1' }],
    mou: [MOU],
    at: AT,
    ...overrides,
  });
}

const conditionOf = (result, id) => result.conditions.find((row) => row.id === id);

// --- בדיקת הקבלה: מסלול שכל תנאיו מתקיימים ---

{
  const result = readySite();
  check('ארבעת התנאים מוחזרים בסדר', result.conditions.map((row) => row.id), ['L1', 'L2', 'L3', 'L4']);
  check('כל תנאי עובר', result.conditions.map((row) => row.passes), [true, true, true, true]);
  check('המסלול מוכן לנעילה', result.ready, true);
  check('אין תנאי שנכשל', result.failed, []);
}

// --- L1: כל פריט הוכרע ---

{
  const result = readySite({
    items: [
      { item_id: 'item-1', site_id: 'site-1', stop_id: 'stop-a', status: 'approved', text: 'טקסט', page: 7, source_id: 'src-1' },
      { item_id: 'item-2', site_id: 'site-1', stop_id: 'stop-b', status: 'approved', text: 'טקסט', page: 9, source_id: 'src-1' },
      { item_id: 'item-3', site_id: 'site-1', stop_id: 'stop-a', status: 'pending', text: 'טקסט', page: 3, source_id: 'src-1' },
    ],
  });
  check('פריט pending מכשיל את L1', conditionOf(result, 'L1').passes, false);
  check('והפריט חוזר בשמו', conditionOf(result, 'L1').failing, ['item-3']);
  check('המסלול אינו מוכן', result.ready, false);
  check('רשימת הכשלים נושאת את L1', result.failed, ['L1']);
}

{
  const result = readySite({
    items: [
      { item_id: 'item-1', site_id: 'site-1', stop_id: 'stop-a', status: 'draft', text: 'טקסט', page: 7, source_id: 'src-1' },
      { item_id: 'item-2', site_id: 'site-1', stop_id: 'stop-b', status: 'approved', text: 'טקסט', page: 9, source_id: 'src-1' },
    ],
  });
  check('פריט draft מכשיל את L1', conditionOf(result, 'L1').failing, ['item-1']);
}

{
  // פריט rejected הוכרע, ולכן אינו מכשיל את L1. הוא כן מוריד את
  // כיסוי התחנה שלו, וזה L2.
  const result = readySite({
    items: [
      { item_id: 'item-1', site_id: 'site-1', stop_id: 'stop-a', status: 'approved', text: 'טקסט', page: 7, source_id: 'src-1' },
      { item_id: 'item-2', site_id: 'site-1', stop_id: 'stop-b', status: 'approved', text: 'טקסט', page: 9, source_id: 'src-1' },
      { item_id: 'item-3', site_id: 'site-1', stop_id: 'stop-a', status: 'rejected', text: 'טקסט', page: 3, source_id: 'src-1' },
    ],
  });
  check('פריט rejected אינו מכשיל את L1', conditionOf(result, 'L1').passes, true);
  check('והתחנה שלו מכוסה בפריט אחר, ולכן L2 עובר', conditionOf(result, 'L2').passes, true);
}

// --- ההגנה של הבדיקה האדומה השנייה (מפה 6.5) ---

{
  // פריט approved שהוזרק ישירות למאגר, בלי שעבר את הווטו.
  const result = readySite({ approvals: [
    { approval_id: 'appr-1', target: 'item-1', action: 'approve', to_status: 'approved' },
  ] });
  check('פריט approved בלי רשומת APPROVALS מכשיל את L1', conditionOf(result, 'L1').passes, false);
  check('והפריט חוזר בשמו', conditionOf(result, 'L1').failing, ['item-2']);
}

{
  // רשומה קיימת שאינה אישור אינה מספיקה: "נוצר" אינו "אושר".
  const result = readySite({ approvals: [
    { approval_id: 'appr-1', target: 'item-1', action: 'approve', to_status: 'approved' },
    { approval_id: 'appr-2', target: 'item-2', action: 'create_item', to_status: 'draft' },
  ] });
  check('רשומת יצירה אינה נחשבת אישור', conditionOf(result, 'L1').failing, ['item-2']);
}

// --- L2: כיסוי לפי תחנות ---

{
  const result = readySite({
    site: { site_id: 'site-1', stops: ['stop-a', 'stop-b', 'stop-c'], status: 'open', corpus_version: null },
  });
  check('תחנה בלי פריט מאושר מכשילה את L2', conditionOf(result, 'L2').passes, false);
  check('והתחנה חוזרת בשמה', conditionOf(result, 'L2').failing, ['stop-c']);
}

{
  const result = readySite({ site: { site_id: 'site-1', stops: [], status: 'open' } });
  check('מסלול בלי תחנות אינו נעיל', conditionOf(result, 'L2').passes, false);
}

// --- L3: טקסט, עמוד, מקור ועוגן מאומת ---

{
  const result = readySite({ anchors: [
    { anchor_id: 'anch-1', item_id: 'item-1', verified: true },
    { anchor_id: 'anch-2', item_id: 'item-2', verified: false },
  ] });
  check('עוגן שלא אומת בשטח מכשיל את L3', conditionOf(result, 'L3').passes, false);
  check('והפריט חוזר בשמו', conditionOf(result, 'L3').failing, ['item-2']);
}

{
  const result = readySite({ anchors: [
    { anchor_id: 'anch-1', item_id: 'item-1', verified: true },
  ] });
  check('פריט בלי עוגן כלל מכשיל את L3', conditionOf(result, 'L3').failing, ['item-2']);
}

{
  const result = readySite({ items: [
    { item_id: 'item-1', site_id: 'site-1', stop_id: 'stop-a', status: 'approved', text: '   ', page: 7, source_id: 'src-1' },
    { item_id: 'item-2', site_id: 'site-1', stop_id: 'stop-b', status: 'approved', text: 'טקסט', page: null, source_id: 'src-1' },
  ] });
  check('טקסט ריק ועמוד חסר מכשילים את L3', conditionOf(result, 'L3').failing, ['item-1', 'item-2']);
}

{
  const result = readySite({ sources: [] });
  check('מקור שאינו רשום מכשיל את L3', conditionOf(result, 'L3').passes, false);
}

// --- L4: הסכם בתוקף לכל מקור, ו-M-06 אחד לפחות ---

{
  const result = readySite({ mou: [] });
  check('בלי הסכם כלל L4 נכשל', conditionOf(result, 'L4').passes, false);
  check('והמקור הלא מכוסה חוזר בשמו', conditionOf(result, 'L4').failing, ['src-1']);
  check('M-06 מוחזר עם התנאי', conditionOf(result, 'L4').m06, 0);
}

{
  const expired = { ...MOU, valid_until: '2026-01-01T00:00:00.000Z' };
  check('הסכם שפג אינו מכסה', conditionOf(readySite({ mou: [expired] }), 'L4').passes, false);
}

{
  // שני מקורות, שני הסכמים, וכל אחד מכסה אחד: אין מקור לא מכוסה,
  // ובכל זאת אין מכון יחיד שמכסה 100%, ולכן M-06 = 0 ו-L4 נכשל.
  const result = readySite({
    items: [
      { item_id: 'item-1', site_id: 'site-1', stop_id: 'stop-a', status: 'approved', text: 'טקסט', page: 7, source_id: 'src-1' },
      { item_id: 'item-2', site_id: 'site-1', stop_id: 'stop-b', status: 'approved', text: 'טקסט', page: 9, source_id: 'src-2' },
    ],
    sources: [{ source_id: 'src-1' }, { source_id: 'src-2' }],
    mou: [MOU, { ...MOU, mou_id: 'mou-2', institute_id: 'inst-2', scope: ['src-2'] }],
  });
  check('אין מקור לא מכוסה', conditionOf(result, 'L4').failing, []);
  check('ובכל זאת M-06 = 0', conditionOf(result, 'L4').m06, 0);
  check('ולכן L4 נכשל', conditionOf(result, 'L4').passes, false);
}

// --- מספר תנאים שנכשלים יחד ---

{
  const result = lockReadiness({ site: { site_id: 'site-1', stops: ['stop-a'] }, at: AT });
  check('מסלול ריק מכשיל את L2 ואת L4', result.failed, ['L2', 'L4']);
  check('L1 עובר על מסלול בלי פריטים', conditionOf(result, 'L1').passes, true);
  check('ו-L3 עובר גם הוא', conditionOf(result, 'L3').passes, true);
}

// --- mouInEffect ו-mouCoverage כפונקציות בפני עצמן ---

{
  check('הסכם בתוקף', mouInEffect(MOU, AT), true);
  check('הסכם בלי תאריך אינו בתוקף', mouInEffect({ ...MOU, valid_until: null }, AT), false);
  check('הסכם עם תאריך שאינו נקרא אינו בתוקף', mouInEffect({ ...MOU, valid_until: 'מחר' }, AT), false);
  check('הסכם שפג אינו בתוקף', mouInEffect({ ...MOU, valid_until: '2026-01-01T00:00:00.000Z' }, AT), false);
  check('בלי רשומה כלל', mouInEffect(undefined, AT), false);
}

{
  check('כיסוי בלי נתונים', mouCoverage({ at: AT }), {
    required: [], institutes: [], m06: 0, mou_in_effect: 0, uncovered: [],
  });
}

// --- L5: מונה גרסת הקורפוס ---

{
  check('מסלול שלא ננעל מעולם מתחיל ב-1', nextCorpusVersion({ corpus_version: null }), 1);
  check('בלי רשומה כלל', nextCorpusVersion(undefined), 1);
  check('נעילה שנייה', nextCorpusVersion({ corpus_version: 1 }), 2);
  check('נעילה עשירית', nextCorpusVersion({ corpus_version: 9 }), 10);
  check('ערך שאינו מספר מתחיל מחדש', nextCorpusVersion({ corpus_version: 'שתיים' }), 1);
}

// --- L6 ו-BL-07: מה שמחזיר מסלול נעול ל-open ---

{
  check('שתי הפעולות ואלה בלבד', [...SITE_REOPENING_ACTIONS], ['create_item', 'edit_item']);
  check('עריכה במסלול נעול פותחת אותו', siteReopensOn({ site_status: 'locked', action: 'edit_item' }), true);
  check('יצירה במסלול נעול פותחת אותו', siteReopensOn({ site_status: 'locked', action: 'create_item' }), true);
  check('עריכה במסלול פתוח אינה משנה דבר', siteReopensOn({ site_status: 'open', action: 'edit_item' }), false);
  check('אימות עוגן אינו פותח מסלול נעול', siteReopensOn({ site_status: 'locked', action: 'verify_anchor' }), false);
  check('אישור אינו פותח מסלול נעול', siteReopensOn({ site_status: 'locked', action: 'approve' }), false);
  check('בלי ארגומנטים', siteReopensOn(), false);
}

report(` (${ITEM_TRANSITIONS.length} מעברים, 4 תנאי נעילה)`);
