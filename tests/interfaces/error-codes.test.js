// בדיקת ממשקים: קודי השגיאה. מפה 6.2, "כל קוד בקוד קיים במפה ולהפך",
// בזווית ההתנהגותית: מה שיוצא בפועל מהמערכת.
// ההצלבה הטקסטואלית מול מסמך המפה היא מבחן מבנה 07, בקובץ נפרד.
//
//   node tests/interfaces/error-codes.test.js

import { createOrchestrator } from '../../core/orchestrator.js';
import { createRepository } from '../../repository/index.js';
import { createBrowserDriver } from '../../repository/driver-browser.js';
import { handle as echoHandler } from '../helpers/echo-module.js';
import { ERROR_CODE_LIST, error } from '../../core/errors.js';
import { validate } from '../../core/contract.js';
import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };

const { check, checkThrows, report } = createChecker('ממשקים, קודי השגיאה');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const seed = {
  modules: modulesFile, allow_list: allowFile, reference: referenceFile.values,
};

function build({ failAudit = false } = {}) {
  let counter = 0;
  const base = createRepository(createBrowserDriver({ storage: memoryStorage(), seed }));
  const repository = failAudit
    ? { ...base, appendAudit() { throw new Error('האחסון אינו זמין'); } }
    : base;
  return createOrchestrator({
    repository,
    handlers: { 'test-echo': echoHandler },
    newRequestId: () => `req-${++counter}`,
    now: () => '2026-09-14T00:00:00.000Z',
  });
}

// כל דרך כשל שהשלב מממש, והקוד שהיא אמורה להחזיר.
const expectedByPath = [
  ['בלי from', { module: 'test-echo', action: 'echo', payload: {}, lang: 'he' }, 'E-FROM-MISSING'],
  ['בלי module', { from: 'tool-simulator', action: 'echo', payload: {}, lang: 'he' }, 'E-ENVELOPE-INVALID'],
  ['בלי action', { from: 'tool-simulator', module: 'test-echo', payload: {}, lang: 'he' }, 'E-ENVELOPE-INVALID'],
  ['בלי payload', { from: 'tool-simulator', module: 'test-echo', action: 'echo', lang: 'he' }, 'E-ENVELOPE-INVALID'],
  ['בלי lang', { from: 'tool-simulator', module: 'test-echo', action: 'echo', payload: {} }, 'E-ENVELOPE-INVALID'],
  ['פונה לא מוכר', { from: 'screen-nope', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' }, 'E-FROM-UNKNOWN'],
  ['פונה מוכר בלי שורה', { from: 'module-retrieval', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' }, 'E-ALLOW-DENIED'],
  ['צירוף שאין לו שורה', { from: 'screen-veto', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' }, 'E-ALLOW-DENIED'],
];

const emitted = [];
for (const [label, request, expected] of expectedByPath) {
  const response = await build().handle(request);
  emitted.push(response.error?.code);
  check(`${label} מחזיר ${expected}`, response.error?.code, expected);
}

// כשל רישום, בדרייבר שנופל
{
  const response = await build({ failAudit: true }).handle({
    from: 'tool-simulator', module: 'test-echo', action: 'echo', payload: {}, lang: 'he',
  });
  emitted.push(response.error?.code);
  check('כשל רישום מחזיר E-AUDIT-WRITE-FAILED', response.error?.code, 'E-AUDIT-WRITE-FAILED');
}

// כל קוד שיצא בפועל הוא מהרשימה הסגורה. חוק ברזל 8.
check(
  'כל קוד שיצא מהמערכת נמצא ברשימה הסגורה',
  [...new Set(emitted)].filter((code) => !ERROR_CODE_LIST.includes(code)),
  [],
);

check(
  'חמישה קודים שונים יצאו בשלב הזה',
  [...new Set(emitted)].sort(),
  ['E-ALLOW-DENIED', 'E-AUDIT-WRITE-FAILED', 'E-ENVELOPE-INVALID', 'E-FROM-MISSING', 'E-FROM-UNKNOWN'],
);

// הקודים שהשלב אינו מממש עדיין. רשומים במפורש כדי שהפער יהיה גלוי,
// ולא ייראה כאילו כל 22 הקודים נבדקו.
check(
  'שבעה עשר הקודים האחרים אינם מיושמים בשלב הזה',
  ERROR_CODE_LIST.filter((code) => !emitted.includes(code)).length,
  17,
);

// הכיוון ההפוך: קוד שאינו ברשימה אינו יכול להיווצר בכלל.
checkThrows('error עם קוד שאינו ברשימה נזרק', () => error('E-INVENTED'));

check(
  'validate מחזיר קודים מהרשימה הסגורה בלבד',
  [
    validate(null).code,
    validate({}).code,
    validate({ from: 'x', module: 'y', action: 'z', payload: {} }).code,
  ].filter((code) => !ERROR_CODE_LIST.includes(code)),
  [],
);

report();
