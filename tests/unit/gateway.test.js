// Unit של GW-01, AI Gateway. נגזר מבדיקת הקבלה של משימה 2 בתוכנית
// שלב 6, מ-CLAUDE.md סעיף 6 ("קריאה עם model_tier ריק: E-REF-EMPTY,
// בלי פנייה החוצה"), ממפה 2.4 ו-3.4, ומהכרעות 1 עד 3 של התוכנית.
//
//   node tests/unit/gateway.test.js

import { create, MODEL_TIER_KEY, EXAMPLE_ACTION, ENV_NAMES } from '../../gateways/ai.js';
import { RESPONSE_FIELDS } from '../../core/contract.js';
import { ERROR_CODE_LIST } from '../../core/errors.js';
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, checkThrowsAsync, report } = createChecker('GW-01 gateway');

// "בלי פנייה החוצה": כל דרך שבה קוד בדפדפן או ב-Node פונה לרשת
// מוחלפת בספירה. אם השער יפנה, המונה יעלה והבדיקה תיפול.
let outbound = 0;
const trap = () => { outbound += 1; throw new Error('פנייה החוצה'); };
globalThis.fetch = trap;
globalThis.XMLHttpRequest = function XMLHttpRequest() { trap(); };
globalThis.WebSocket = function WebSocket() { trap(); };

function fakeRepository(reference = {}) {
  const calls = [];
  return {
    calls,
    getRef: (key) => { calls.push(key); return reference[key]; },
  };
}

const envelope = (payload = { input: 'טקסט לניסוח' }) => ({
  from: 'module-dialogue', module: 'GW-01', action: EXAMPLE_ACTION, payload, lang: 'he',
});

// --- model_tier ריק: E-REF-EMPTY ---

{
  const repository = fakeRepository({ [MODEL_TIER_KEY]: null });
  const response = await create({ repository })(envelope());

  check('model_tier ריק: ok false', response.ok, false);
  check('model_tier ריק: הקוד E-REF-EMPTY', response.error.code, 'E-REF-EMPTY');
  check('error.data מכיל את שם ההגדרה (מפה 4.5)', response.error.data, { key: MODEL_TIER_KEY });
  check('data ריק', response.data, null);
  check('התשובה היא מעטפת 4.1, שלושת השדות ואותם בלבד', Object.keys(response), [...RESPONSE_FIELDS]);
  check('השער קרא את model_tier, ואותו בלבד', repository.calls, [MODEL_TIER_KEY]);
}

{
  const repository = fakeRepository({});
  const response = await create({ repository })(envelope());
  check('מפתח שאינו בטבלה כלל: גם כן E-REF-EMPTY, לא המצאה', response.error.code, 'E-REF-EMPTY');
}

{
  const repository = fakeRepository({ [MODEL_TIER_KEY]: '' });
  const response = await create({ repository })(envelope());
  check('מחרוזת ריקה היא ערך ריק', response.error.code, 'E-REF-EMPTY');
}

check('E-REF-EMPTY הוא קוד מהרשימה הסגורה', ERROR_CODE_LIST.includes('E-REF-EMPTY'), true);

// --- model_tier מלא, עם Adapter: הציוד נקרא, השער אינו יודע ספק ---

{
  const seen = [];
  const adapters = {
    cheap: { call: async (args) => { seen.push(args); return { output: `ניסוח של: ${args.input}` }; } },
  };
  const repository = fakeRepository({ [MODEL_TIER_KEY]: 'cheap' });
  const response = await create({ repository, adapters })(envelope({ input: 'שלום' }));

  check('עם Adapter: ok true', response.ok, true);
  check('ה-Adapter נקרא פעם אחת', seen.length, 1);
  check('ה-Adapter קיבל את הקלט ואת השפה מהמעטפה', seen[0], { input: 'שלום', lang: 'he' });
  check('התשובה נושאת את הפלט ואת דרגת המודל', response.data, { output: 'ניסוח של: שלום', model_tier: 'cheap' });
  check('error ריק', response.error, null);
  check('מעטפת 4.1 גם בהצלחה', Object.keys(response), [...RESPONSE_FIELDS]);
}

// מבחן ההחלפה (תוכנית שלב 6 סעיף 5): החלפת הספק היא החלפת ה-Adapter
// המוזרק. אותו שער, אותה מעטפה, ציוד אחר, פלט אחר.
{
  const repository = fakeRepository({ [MODEL_TIER_KEY]: 'cheap' });
  const first = await create({ repository, adapters: { cheap: { call: async () => ({ output: 'א' }) } } })(envelope());
  const second = await create({ repository, adapters: { cheap: { call: async () => ({ output: 'ב' }) } } })(envelope());
  check('החלפת ה-Adapter מחליפה את הפלט בלי לגעת בשער', [first.data.output, second.data.output], ['א', 'ב']);
}

// --- model_tier מלא, בלי Adapter: זריקה (הכרעה 3) ---

{
  const repository = fakeRepository({ [MODEL_TIER_KEY]: 'cheap' });
  await checkThrowsAsync('דרגה בלי Adapter נופלת בזריקה, ולא ממציאה קוד', () => create({ repository })(envelope()));
}

{
  const repository = fakeRepository({ [MODEL_TIER_KEY]: 'cheap' });
  await checkThrowsAsync(
    'Adapter בלי call אינו Adapter',
    () => create({ repository, adapters: { cheap: {} } })(envelope()),
  );
}

// --- החוזה עצמו ---

checkThrows('פעולה שאינה הדוגמה נופלת בזריקה, כמו בכל מודול', () => {
  create({ repository: fakeRepository({}) })({ ...envelope(), action: 'other' });
});

checkThrows('בלי Repository אין שער', () => create({}));

check('הפעולה לדוגמה היא compose (הכרעה 2)', EXAMPLE_ACTION, 'compose');
check('השער מכיר שם משתנה סביבה אחד, בשם בלבד (הכרעה 4)', [...ENV_NAMES], ['AI_PROVIDER_KEY']);

// --- בלי פנייה החוצה, בכל הדרכים שלמעלה ---

check('אף קריאה לא יצאה החוצה', outbound, 0);

report();
