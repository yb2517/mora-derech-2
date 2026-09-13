// Unit של CORE-01, קודי השגיאה. נגזר מבדיקת הקבלה של משימה 2 בתוכנית
// שלב 1, ממפה 4.5, וממבחן מבנה 07. נכתב יחד עם הקוד (חוק ברזל 9).
//
// המריץ האחד של השלב נבנה במשימה 8; עד אז:
//   node tests/unit/errors.test.js

import { ERROR_CODES, ERROR_CODE_LIST, error } from '../../core/errors.js';

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

function checkThrows(name, fn) {
  try {
    fn();
    failures.push(`${name}\n    ציפיתי לזריקה, והקריאה חזרה בשלום`);
  } catch (thrown) {
    if (thrown instanceof Error) {
      passed += 1;
    } else {
      failures.push(`${name}\n    נזרק משהו שאינו Error: ${String(thrown)}`);
    }
  }
}

// עשרים ושניים הקודים של מפה 4.5, מועתקים לכאן ביד.
// בדיקת הקבלה של משימה 2 דורשת במפורש הצלבה מול רשימה שיושבת בבדיקה
// עצמה, ולא מול הקובץ הנבדק: רשימה שנגזרת מהקוד אינה בודקת אותו.
const CODES_IN_MAP_4_5 = [
  'E-FROM-MISSING',
  'E-FROM-UNKNOWN',
  'E-ALLOW-DENIED',
  'E-ENVELOPE-INVALID',
  'E-AUDIT-WRITE-FAILED',
  'E-TRANSITION-DENIED',
  'E-ITEM-INCOMPLETE',
  'E-ANCHOR-OUT-OF-BOUNDS',
  'E-APPROVAL-WRITE-FAILED',
  'E-LOCK-REFUSED',
  'E-GATE-CLOSED',
  'E-QUESTION-INVALID',
  'E-RETRIEVAL-FAILED',
  'E-REF-EMPTY',
  'E-SESSION-CLOSED',
  'E-LOG-TYPE-INVALID',
  'E-LOG-WRITE-FAILED',
  'E-NO-HEBREW-VOICE',
  'E-SPEECH-NOT-RECOGNIZED',
  'E-MIC-NOT-ALLOWED',
  'E-LOCATION-NOT-ALLOWED',
  'E-NO-EXIT-POINT',
];

// --- מבחן מבנה 07: זהים, לא חסר, לא עודף ---

check('הרשימה במפה מונה עשרים ושניים קודים', CODES_IN_MAP_4_5.length, 22);

check('הקובץ מונה עשרים ושניים קודים', ERROR_CODE_LIST.length, 22);

const inCode = [...ERROR_CODE_LIST].sort();
const inMap = [...CODES_IN_MAP_4_5].sort();

check(
  'אין קוד במפה שחסר בקוד',
  inMap.filter((code) => !inCode.includes(code)),
  [],
);

check(
  'אין קוד בקוד שאינו במפה',
  inCode.filter((code) => !inMap.includes(code)),
  [],
);

check('הרשימות זהות', inCode, inMap);

check(
  'הסדר בקובץ הוא הסדר של 4.5',
  [...ERROR_CODE_LIST],
  CODES_IN_MAP_4_5,
);

// --- לכל קוד יש הסבר למפתח ---

check(
  'לכל קוד יש הסבר למפתח שאינו ריק',
  ERROR_CODE_LIST.filter((code) => {
    const text = ERROR_CODES[code];
    return typeof text !== 'string' || text.trim() === '';
  }),
  [],
);

check(
  'אין שני קודים עם אותו הסבר',
  ERROR_CODE_LIST.length - new Set(Object.values(ERROR_CODES)).size,
  0,
);

// ההסבר למפתח אינו הנוסח לבני אדם. הנוסח לבני אדם יושב בטבלת ה-reference
// תחת error_human_text (משימה 4), ואסור שיופיע כאן.
check(
  'ההסבר למפתח אינו מנוסח כפנייה למשתמש',
  ERROR_CODE_LIST.filter((code) => /נסו שוב|פנו למנהל|רעננו/.test(ERROR_CODES[code])),
  [],
);

// --- הרשימה סגורה ---

check('ERROR_CODES קפוא', Object.isFrozen(ERROR_CODES), true);
check('ERROR_CODE_LIST קפוא', Object.isFrozen(ERROR_CODE_LIST), true);

// --- error(code, data) ---

check(
  'error מחזיר את הקוד ואת הפירוט',
  error('E-ITEM-INCOMPLETE', { field: 'page' }),
  { code: 'E-ITEM-INCOMPLETE', data: { field: 'page' } },
);

check(
  'error בלי data מחזיר data ריק',
  error('E-REF-EMPTY'),
  { code: 'E-REF-EMPTY', data: null },
);

check(
  'error נושא רשימה, כפי ש-4.5 מבקש ל-E-LOCK-REFUSED',
  error('E-LOCK-REFUSED', { failures: ['stop-07'] }),
  { code: 'E-LOCK-REFUSED', data: { failures: ['stop-07'] } },
);

check(
  'כל אחד מעשרים ושניים הקודים עובר ב-error',
  CODES_IN_MAP_4_5.filter((code) => error(code).code !== code),
  [],
);

// --- קוד שאינו ברשימה: זריקה ---

checkThrows('קוד שאינו ברשימה נזרק', () => error('E-NOT-A-REAL-CODE'));
checkThrows('קוד בכתיב שגוי נזרק', () => error('E-FROM-MISING'));
checkThrows('מחרוזת ריקה נזרקת', () => error(''));
checkThrows('undefined נזרק', () => error(undefined));
checkThrows('קוד מטבלת הנוסחים לבני אדם שאינו שגיאה נזרק', () => error('fallback_text'));

// ירושה מ-Object אינה קוד שגיאה
checkThrows('toString אינו קוד שגיאה', () => error('toString'));
checkThrows('constructor אינו קוד שגיאה', () => error('constructor'));

// הזריקה היא Error רגיל ואינה ערך שגיאה עם קוד, כדי שלא ייווצר
// קוד מחוץ לרשימה הסגורה (חוק ברזל 8).
try {
  error('E-INVENTED');
  failures.push('הזריקה לא קרתה');
} catch (thrown) {
  check('הזריקה אינה נושאת קוד שגיאה משלה', thrown.code, undefined);
  check(
    'הודעת הזריקה נוקבת בקוד שנדחה',
    thrown.message.includes('E-INVENTED'),
    true,
  );
}

// --- סיכום ---

console.log(`CORE-01 errors: ${passed} עברו, ${failures.length} נכשלו`);
for (const failure of failures) {
  console.log(`  נכשל: ${failure}`);
}
if (failures.length > 0) {
  process.exitCode = 1;
}
