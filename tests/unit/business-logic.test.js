// Unit של הליבה, החוקים העסקיים. נגזר ממפה 2.2 ו-2.3, מבדיקת הקבלה
// של משימה 2 בתוכנית שלב 3, ומ-usecase-f-07 סעיף 8. נכתב יחד עם הקוד.
//
//   node tests/unit/business-logic.test.js

import {
  ITEM_STATUSES,
  TRANSITIONS,
  REQUIRED_ITEM_FIELDS,
  findTransition,
  missingItemFields,
  APPROVAL_BEFORE_STATUS,
} from '../../core/business-logic.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('הליבה: החוקים העסקיים');

// --- טבלה 2.2, שורה לשורה מול המפה ---
//
// הטבלה כאן היא העתק של מפה 2.2. הבדיקה מחזיקה את הטבלה השנייה
// בעצמה, ולכן שינוי בקוד בלי שינוי במפה נתפס, וזה כל תפקידה.

const FROM_MAP = [
  ['create_item', null, 'draft'],
  ['submit', 'draft', 'pending'],
  ['approve', 'pending', 'approved'],
  ['reject', 'pending', 'rejected'],
  ['return', 'approved', 'pending'],
  ['return', 'rejected', 'pending'],
  ['revert', 'approved', 'draft'],
  ['edit_item', 'rejected', 'draft'],
];

check('ארבעת המצבים הקנוניים, ואין חמישי', [...ITEM_STATUSES], ['draft', 'pending', 'approved', 'rejected']);
check('שמונה שורות בטבלה, כמו במפה 2.2', TRANSITIONS.length, FROM_MAP.length);
check(
  'כל שורה זהה למפה: פעולה, מצב קודם, מצב חדש',
  TRANSITIONS.map((r) => [r.action, r.from_status, r.to_status]),
  FROM_MAP,
);
// מבחן מבנה 06 תפס את עמודת "מי רשאי" כשהיא הייתה כאן. הטענה
// שומרת עליה בחוץ: האכיפה היא ברשימת המותר, ולא בקוד הליבה.
check(
  'אין שם פונה בשורות הטבלה',
  TRANSITIONS.filter((r) => 'caller' in r),
  [],
);
check(
  'כל מצב יעד הוא אחד מארבעת המצבים',
  TRANSITIONS.filter((r) => !ITEM_STATUSES.includes(r.to_status)),
  [],
);
check(
  'הצירוף פעולה ומצב קודם הוא מפתח יחיד',
  new Set(TRANSITIONS.map((r) => `${r.action}/${r.from_status}`)).size,
  TRANSITIONS.length,
);
check('הטבלה קפואה ואינה ניתנת לשינוי בזמן ריצה', Object.isFrozen(TRANSITIONS), true);

// --- BL-02: מעבר לפי הטבלה בלבד ---

check('submit מ-draft', findTransition('submit', 'draft').to_status, 'pending');
check('approve מ-pending', findTransition('approve', 'pending').to_status, 'approved');
check('reject מ-pending', findTransition('reject', 'pending').to_status, 'rejected');
check('return מ-approved', findTransition('return', 'approved').to_status, 'pending');
check('return מ-rejected', findTransition('return', 'rejected').to_status, 'pending');
check('create_item מפריט חדש', findTransition('create_item', null).to_status, 'draft');
check('create_item גם כשהמצב אינו מוגדר', findTransition('create_item', undefined).to_status, 'draft');

check('approve על פריט approved אינו בטבלה', findTransition('approve', 'approved'), undefined);
check('approve על פריט draft אינו בטבלה', findTransition('approve', 'draft'), undefined);
check('submit על פריט rejected אינו בטבלה', findTransition('submit', 'rejected'), undefined);
check('submit על פריט pending אינו בטבלה', findTransition('submit', 'pending'), undefined);
check('return על פריט pending אינו בטבלה', findTransition('return', 'pending'), undefined);
check('פעולה שאינה מעבר כלל', findTransition('register_mou', 'pending'), undefined);

// --- תנאי השלמות ---

const full = { text: 'טקסט', page: 7, stop_id: 'st-1', source_id: 'src-1' };
const anchor = { lat: 31.78, lng: 35.21 };

check('ארבעת השדות של תנאי השלמות', [...REQUIRED_ITEM_FIELDS], ['text', 'page', 'stop_id', 'source_id']);
check('פריט שלם עם עוגן', missingItemFields(full, anchor), []);
check('פריט בלי עמוד', missingItemFields({ ...full, page: undefined }, anchor), ['page']);
check('עמוד ריק נחשב חסר', missingItemFields({ ...full, page: '' }, anchor), ['page']);
check('עמוד 0 אינו חסר', missingItemFields({ ...full, page: 0 }, anchor), []);
check('פריט בלי מקור', missingItemFields({ ...full, source_id: null }, anchor), ['source_id']);
check('פריט בלי עוגן', missingItemFields(full, null), ['anchor']);
check('עוגן בלי קואורדינטות', missingItemFields(full, { lat: 31.78 }), ['anchor']);
check('שני חסרים מדווחים שניהם', missingItemFields({ text: 'טקסט', stop_id: 'st-1' }, null), ['page', 'source_id', 'anchor']);

// --- BL-01: הסדר נקוב בשם ---

check('הרשומה נכתבת לפני המצב', [...APPROVAL_BEFORE_STATUS.order], ['appendApproval', 'setItemStatus']);
check('והחוק נקוב במספרו', APPROVAL_BEFORE_STATUS.rule, 'BL-01');

report(` (${TRANSITIONS.length} מעברים)`);
