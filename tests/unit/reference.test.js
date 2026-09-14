// Unit של טבלת ה-reference. נגזר מבדיקת הקבלה של משימה 4 בתוכנית שלב 1,
// ממפה 2.4, מ-BL-12, ומ-doc-error-human-text. נכתב יחד עם הנתונים.
//
//   node tests/unit/reference.test.js

import referenceFile from '../../data/reference.json' with { type: 'json' };
import { ERROR_CODES, ERROR_CODE_LIST } from '../../core/errors.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, checkThrowsAsync, report } = createChecker('reference table');

const values = referenceFile.values;
const pending = referenceFile.pending;

// כל מפתחות מפה 2.4, בסדר שבו הם מופיעים שם. מוקלד ביד.
const KEYS_IN_MAP_2_4 = [
  'geofence_radius_m', 'exit_margin_m', 'accuracy_threshold_m',
  'location_sample_interval_s', 'delivery_gap_s', 'pushed_item_max_words',
  'relevance_threshold', 'answer_max_words', 'question_max_chars',
  // מפה גרסה 3.4, פער 38: לאורך ההערה של usecase-f-07 צעד 6 לא היה
  // מפתח, ו-BL-12 אוסר ערך משתנה בקוד.
  'note_max_chars',
  'fallback_text', 'unavailable_text', 'voice_id', 'voice_rate',
  'stale_session_minutes', 'interaction_types',
  'm01_threshold', 'm02_threshold', 'sample_min', 'sample_max',
  'enforce_gate_b', 'error_human_text', 'crossing_clear_seconds',
  'battery_warn_percent', 'battery_block_percent', 'battery_resume_percent',
  'battery_block_text', 'safety_opening_text',
  // פער 31, בהכרעת בעלת הפרויקט 14.09.2026: משפט הפרטיות של
  // PRD סעיף 25, שקורא אותו FE-05.
  'privacy_opening_text',
  'model_tier',
];

// מפתח שנוסף בהכרעת בעלת הפרויקט 14.09.2026, פער 14, כדי לאכוף את
// BL-17: type ברשימה הסגורה, ו-from מורשה לסוג. הערכים מהסוגריים
// בשורת log במפה 4.2.
const KEYS_ADDED_BY_DECISION = ['interaction_type_senders'];

// הסדר בקובץ: מפתחות 2.4, ו-interaction_type_senders מיד אחרי
// interaction_types, כדי ששני המפתחות של BL-17 יישבו יחד.
const EXPECTED_ORDER = KEYS_IN_MAP_2_4.flatMap(
  (key) => (key === 'interaction_types' ? [key, 'interaction_type_senders'] : [key]),
);

// הערכים שמפה 2.4 קובעת במפורש.
const DECIDED_IN_MAP = {
  geofence_radius_m: 40,
  exit_margin_m: 10,
  accuracy_threshold_m: 40,
  location_sample_interval_s: 5,
  delivery_gap_s: 20,
  pushed_item_max_words: 150,
  relevance_threshold: 0.28,
  answer_max_words: 60,
  question_max_chars: 200,
  note_max_chars: 200,
  stale_session_minutes: 60,
  m01_threshold: 3,
  m02_threshold: 0.70,
  sample_min: 15,
  sample_max: 25,
  enforce_gate_b: false,
  crossing_clear_seconds: 15,
  battery_warn_percent: 20,
  battery_block_percent: 5,
  battery_resume_percent: 20,
};

// מפתחות שאין להם ערך מוכרע במסמך מאושר.
const EXPECTED_EMPTY = ['voice_id', 'voice_rate', 'privacy_opening_text', 'model_tier'];

// --- המפתחות מול 2.4 ---

check('2.4 מונה שלושים מפתחות', KEYS_IN_MAP_2_4.length, 30);
check('מפתח אחד נוסף בהכרעה', KEYS_ADDED_BY_DECISION.length, 1);
check('הטבלה מונה שלושים ואחד מפתחות', Object.keys(values).length, 31);
check('המפתחות והסדר כמצופה', Object.keys(values), EXPECTED_ORDER);

check(
  'אין בטבלה מפתח שאינו מ-2.4 ואינו מהכרעה',
  Object.keys(values).filter(
    (key) => !KEYS_IN_MAP_2_4.includes(key) && !KEYS_ADDED_BY_DECISION.includes(key),
  ),
  [],
);

// --- הערכים המוכרעים ---

for (const [key, expected] of Object.entries(DECIDED_IN_MAP)) {
  check(`${key} זהה לערך שב-2.4`, values[key], expected);
}

// שמונה סוגים: שבעה מ-2.4, ו-abstained שנוסף בהכרעת בעלת הפרויקט
// 14.09.2026 כדי שלמודול השליפה יהיה סוג שהוא מורשה לשלוח (BL-17).
check('interaction_types, שמונת הסוגים', values.interaction_types, [
  'initiated', 'pushed', 'arrived_no_content',
  'attempt_failed', 'replay', 'session_start', 'session_end', 'abstained',
]);

check('abstained הוא של מודול השליפה', values.interaction_type_senders.abstained, ['module-retrieval']);

// --- הנוסחים מ-doc-error-human-text ---

check(
  'fallback_text כנוסח המאושר',
  values.fallback_text,
  'אין לי מידע מאומת על זה במסלול הזה.',
);

check(
  'unavailable_text כנוסח המאושר',
  values.unavailable_text,
  'המערכת אינה זמינה כרגע. נסו שוב בעוד רגע.',
);

check(
  'fallback_text ו-unavailable_text אינם זהים: שני מצבים, שני נוסחים (BL-14)',
  values.fallback_text === values.unavailable_text,
  false,
);

// --- error_human_text: כל עשרים ושניים הקודים ---

const humanCodes = Object.keys(values.error_human_text);

check('error_human_text מונה עשרים ושלושה קודים', humanCodes.length, 23);

check(
  'אין קוד ברשימה הסגורה שחסר לו נוסח לאדם',
  ERROR_CODE_LIST.filter((code) => !humanCodes.includes(code)),
  [],
);

check(
  'אין נוסח לאדם לקוד שאינו ברשימה הסגורה',
  humanCodes.filter((code) => !ERROR_CODE_LIST.includes(code)),
  [],
);

check(
  'כל נוסח לאדם אינו ריק',
  humanCodes.filter((code) => {
    const text = values.error_human_text[code];
    return typeof text !== 'string' || text.trim() === '';
  }),
  [],
);

// הנוסח לאדם והנוסח למפתח הם שני דברים. אם הם זהים, אחד מהם במקום הלא נכון.
check(
  'אף נוסח לאדם אינו זהה להסבר למפתח',
  humanCodes.filter((code) => values.error_human_text[code] === ERROR_CODES[code]),
  [],
);

check(
  'שני הנוסחים עם תבנית שומרים על המשתנה שלהם',
  [
    values.error_human_text['E-ITEM-INCOMPLETE'].includes('[שם השדה]'),
    values.error_human_text['E-REF-EMPTY'].includes('[שם ההגדרה]'),
  ],
  [true, true],
);

// --- מפתח בלי ערך מוכרע נשאר ריק במפורש ---

check(
  'המפתחות הריקים הם בדיוק אלה שאין להם הכרעה',
  Object.keys(values).filter((k) => values[k] === null),
  EXPECTED_EMPTY,
);

check(
  'לכל מפתח ריק יש שורה ב-pending שמסבירה למה',
  EXPECTED_EMPTY.filter((k) => !(k in pending) || !pending[k]),
  [],
);

check(
  'אין ב-pending מפתח שיש לו ערך',
  Object.keys(pending).filter((k) => values[k] !== null),
  [],
);

// model_tier ריק בכוונה, וזה מה שמאפשר את בדיקת הקבלה של שלב 6
check('model_tier ריק, לפי 2.4: אין AI ב-v1', values.model_tier, null);

// --- interaction_type_senders, פער 14, BL-17 ---

check('שמונה סוגים, כמספר interaction_types', Object.keys(values.interaction_type_senders).length, 8);

check(
  'הסוגים זהים ל-interaction_types, לשני הכיוונים',
  [
    Object.keys(values.interaction_type_senders)
      .filter((type) => !values.interaction_types.includes(type)),
    values.interaction_types
      .filter((type) => !(type in values.interaction_type_senders)),
  ],
  [[], []],
);

check(
  'לכל סוג לפחות פונה אחד',
  Object.entries(values.interaction_type_senders)
    .filter(([, senders]) => !Array.isArray(senders) || senders.length === 0)
    .map(([type]) => type),
  [],
);

// כל פונה שמופיע כאן הוא caller של מודול רשום. בלי זה אפשר לכתוב
// בטבלה שם שאינו קיים, ו-BL-17 היה דוחה הכול בשקט.
check(
  'כל פונה בטבלה הוא caller של מודול רשום',
  [...new Set(Object.values(values.interaction_type_senders).flat())]
    .filter((sender) => !modulesFile.modules.some((m) => m.caller === sender)),
  [],
);

// הערכים מהסוגריים בשורת log ב-4.2, מוקלדים כאן ביד.
check('initiated הוא של מודול השיחה בלבד, לפי הבדיקה האדומה השלישית',
  values.interaction_type_senders.initiated, ['module-dialogue']);
check('pushed ו-arrived_no_content של מודול המסירה',
  [values.interaction_type_senders.pushed, values.interaction_type_senders.arrived_no_content],
  [['module-delivery'], ['module-delivery']]);
check('attempt_failed ו-replay של מסך המטייל',
  [values.interaction_type_senders.attempt_failed, values.interaction_type_senders.replay],
  [['screen-traveler'], ['screen-traveler']]);

// --- שני הנוסחים שנקלטו מהמסמכים ---

check(
  'safety_opening_text כנוסח של usecase-f-13 סעיף 3',
  values.safety_opening_text,
  'הליכה בטוחה קודמת לתוכן. באזורי חצייה וצמתים המערכת תשתוק. '
    + 'המערכת אינה מזהה סכנה ואינה מחליפה השגחה.',
);

check(
  'safety_opening_text מצהיר במפורש שהמערכת אינה מזהה סכנה, לפי קריטריון הקבלה של F-13',
  values.safety_opening_text.includes('אינה מזהה סכנה'),
  true,
);

check(
  'battery_block_text כתבנית של תיקון 1, עם שלושת המשתנים',
  [
    values.battery_block_text.includes('[נקודת ציון]'),
    values.battery_block_text.includes('[מטרים]'),
    values.battery_block_text.includes('[רוח השמיים]'),
  ],
  [true, true, true],
);

// BL-20: החסימה ב-battery_block_percent, החידוש מעל battery_resume_percent
check(
  'סף החסימה נמוך מסף החידוש, לפי BL-20',
  values.battery_block_percent < values.battery_resume_percent,
  true,
);

// --- סיכום ---

report();
