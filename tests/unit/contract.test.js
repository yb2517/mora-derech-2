// Unit של CORE-01, נגזר ממפה 6.1 (שורת CORE-01) ומבדיקת הקבלה של משימה 1
// בתוכנית שלב 1. נכתב יחד עם הקוד, לא אחריו (חוק ברזל 9).
//
// המריץ האחד של השלב נבנה במשימה 8; עד אז הקובץ רץ לבדו:
//   node tests/unit/contract.test.js

import {
  validate,
  okResponse,
  errorResponse,
  REQUEST_FIELDS,
  RESPONSE_FIELDS,
} from '../../core/contract.js';
import * as contractModule from '../../core/contract.js';
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, checkThrowsAsync, report } = createChecker('CORE-01 contract');

// מעטפה תקינה לפי 4.1, בנוסח שמופיע ב-usecase-f-07 צעד 1.
function validEnvelope(overrides = {}) {
  return {
    from: 'screen-veto',
    module: 'BE-05',
    action: 'submit',
    payload: { item_id: 'item-001' },
    lang: 'he',
    ...overrides,
  };
}

function without(field) {
  const envelope = validEnvelope();
  delete envelope[field];
  return envelope;
}

// --- בדיקת הקבלה של משימה 1, שלוש השורות כלשונן ---

check('מעטפה תקינה מחזירה תקין', validate(validEnvelope()), { valid: true });

check(
  'מעטפה בלי from מחזירה E-FROM-MISSING',
  validate(without('from')),
  { valid: false, code: 'E-FROM-MISSING', data: { field: 'from' } },
);

check(
  'מעטפה בלי action מחזירה E-ENVELOPE-INVALID',
  validate(without('action')),
  { valid: false, code: 'E-ENVELOPE-INVALID', data: { field: 'action' } },
);

// --- שאר שדות החובה של סעיף 4.1 ---

check(
  'מעטפה בלי module מחזירה E-ENVELOPE-INVALID עם שם השדה',
  validate(without('module')),
  { valid: false, code: 'E-ENVELOPE-INVALID', data: { field: 'module' } },
);

check(
  'מעטפה בלי payload מחזירה E-ENVELOPE-INVALID עם שם השדה',
  validate(without('payload')),
  { valid: false, code: 'E-ENVELOPE-INVALID', data: { field: 'payload' } },
);

check(
  'מעטפה בלי lang מחזירה E-ENVELOPE-INVALID עם שם השדה',
  validate(without('lang')),
  { valid: false, code: 'E-ENVELOPE-INVALID', data: { field: 'lang' } },
);

// --- "payload לא תקין", המקרה השני של E-ENVELOPE-INVALID ב-4.5 ---

check(
  'payload שהוא מערך אינו תקין',
  validate(validEnvelope({ payload: [] })),
  { valid: false, code: 'E-ENVELOPE-INVALID', data: { field: 'payload' } },
);

check(
  'payload שהוא null אינו תקין',
  validate(validEnvelope({ payload: null })),
  { valid: false, code: 'E-ENVELOPE-INVALID', data: { field: 'payload' } },
);

check(
  'payload ריק הוא תקין: פעולות בלי ארגומנטים קיימות ב-4.2',
  validate(validEnvelope({ payload: {} })),
  { valid: true },
);

// --- שדה ריק נחשב שדה חסר ---

check(
  'from כמחרוזת ריקה נחשב חסר',
  validate(validEnvelope({ from: '   ' })),
  { valid: false, code: 'E-FROM-MISSING', data: { field: 'from' } },
);

check(
  'מעטפה שאינה אובייקט מחזירה E-ENVELOPE-INVALID',
  validate(null),
  { valid: false, code: 'E-ENVELOPE-INVALID', data: { field: 'envelope' } },
);

// --- סדר הבדיקה של BL-11: from קודם לכל ---

// כל שדה חובה אחר, כשהוא חסר יחד עם from, חייב לאבד ל-from.
// בלי הכיסוי הזה אפשר להחליף את סדר הבדיקות בלי שאף בדיקה תאדים.
for (const field of ['module', 'action', 'payload', 'lang']) {
  const missingBoth = without('from');
  delete missingBoth[field];

  check(
    `חסרים גם from וגם ${field}: from מוחזר ראשון, לפי BL-11`,
    validate(missingBoth),
    { valid: false, code: 'E-FROM-MISSING', data: { field: 'from' } },
  );
}

// מעטפה ריקה לגמרי: אין בה דבר, וגם אז from הוא הראשון שנופל.
check(
  'מעטפה ריקה מחזירה E-FROM-MISSING, לפי BL-11',
  validate({}),
  { valid: false, code: 'E-FROM-MISSING', data: { field: 'from' } },
);

// --- גבול האחריות: מי שאינו ברשימה הסגורה אינו עניינו של CORE-01 ---

check(
  'from שאינו ברשימה הסגורה עובר את validate: E-FROM-UNKNOWN הוא של CORE-02 לפי 4.5',
  validate(validEnvelope({ from: 'screen-unknown' })),
  { valid: true },
);

// --- מעטפת התשובה, 4.1 ---

check('okResponse מחזיר ok, data, error', okResponse({ item_id: 'item-001' }), {
  ok: true,
  data: { item_id: 'item-001' },
  error: null,
});

check('okResponse בלי data', okResponse(), { ok: true, data: null, error: null });

check(
  'errorResponse נושא את ערך השגיאה שמגיע מ-errors.js',
  errorResponse({ code: 'E-ENVELOPE-INVALID' }),
  { ok: false, data: null, error: { code: 'E-ENVELOPE-INVALID' } },
);

check(
  'שדות מעטפת התשובה זהים ל-4.1',
  Object.keys(okResponse()),
  ['ok', 'data', 'error'],
);

// --- המעטפות מול נוסח 4.1 ---

check('שדות מעטפת הבקשה זהים ל-4.1', [...REQUEST_FIELDS], [
  'from',
  'module',
  'action',
  'payload',
  'lang',
]);

check('שדות מעטפת התשובה זהים ל-4.1', [...RESPONSE_FIELDS], ['ok', 'data', 'error']);

// מבחן מבנה 06 ומפה 4.3: הוספת פונה היא שורה בנתונים, לא שינוי קוד.
// לכן אסור ש-CORE-01 יחזיק רשימת פונים כלשהי.
check(
  'CORE-01 אינו מחזיק רשימת פונים בקוד, לפי מפה 4.3 ומבחן מבנה 06',
  Object.keys(contractModule).filter((name) => /FROM_LIST|CALLERS|SCREENS/.test(name)),
  [],
);

// --- CORE-01 אינו מייצר קוד שאינו ברשימה הסגורה (חוק ברזל 8) ---

const CODES_CORE_01_MAY_RETURN = ['E-FROM-MISSING', 'E-ENVELOPE-INVALID'];
const producedCodes = [
  validate(null),
  validate(without('from')),
  validate(without('module')),
  validate(without('action')),
  validate(without('payload')),
  validate(without('lang')),
  validate(validEnvelope({ payload: 7 })),
]
  .map((result) => result.code)
  .filter((code, index, all) => all.indexOf(code) === index)
  .sort();

check(
  'CORE-01 מחזיר רק קודים מהרשימה הסגורה של 4.5',
  producedCodes,
  [...CODES_CORE_01_MAY_RETURN].sort(),
);

// --- סיכום ---

report();
