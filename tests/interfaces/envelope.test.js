// בדיקת ממשקים: המעטפה. מפה 6.2, "כל מודול מקבל ומחזיר את שתי
// המעטפות בלבד", וחוק ברזל 1.
//
//   node tests/interfaces/envelope.test.js

import { createOrchestrator } from '../../core/orchestrator.js';
import { createRepository } from '../../repository/index.js';
import { createBrowserDriver } from '../../repository/driver-browser.js';
import { handle as echoHandler, withTestModule } from '../helpers/echo-module.js';
import { RESPONSE_FIELDS, REQUEST_FIELDS } from '../../core/contract.js';
import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };

const { check, report } = createChecker('ממשקים, המעטפה');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const repository = createRepository(createBrowserDriver({
  storage: memoryStorage(),
  seed: { ...withTestModule({ modules: modulesFile, allow_list: allowFile }), reference: referenceFile.values },
}));

let counter = 0;
const orchestrator = createOrchestrator({
  repository,
  handlers: { 'test-echo': echoHandler },
  newRequestId: () => `req-${++counter}`,
  now: () => '2026-09-14T00:00:00.000Z',
});

// כל הדרכים שבהן בקשה יכולה להיגמר בשלב הזה, מוצלחות וכושלות.
const everyPath = [
  { label: 'בקשה מותרת', request: { from: 'tool-simulator', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' } },
  { label: 'בלי from', request: { module: 'test-echo', action: 'echo', payload: {}, lang: 'he' } },
  { label: 'בלי action', request: { from: 'tool-simulator', module: 'test-echo', payload: {}, lang: 'he' } },
  { label: 'בלי module', request: { from: 'tool-simulator', action: 'echo', payload: {}, lang: 'he' } },
  { label: 'בלי payload', request: { from: 'tool-simulator', module: 'test-echo', action: 'echo', lang: 'he' } },
  { label: 'בלי lang', request: { from: 'tool-simulator', module: 'test-echo', action: 'echo', payload: {} } },
  { label: 'payload פסול', request: { from: 'tool-simulator', module: 'test-echo', action: 'echo', payload: [], lang: 'he' } },
  { label: 'פונה לא מוכר', request: { from: 'screen-nope', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' } },
  { label: 'פונה מוכר בלי שורה', request: { from: 'module-retrieval', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' } },
  { label: 'צירוף שאין לו שורה', request: { from: 'screen-veto', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' } },
  { label: 'מעטפה שאינה אובייקט', request: null },
];

// כל תשובה, בכל דרך, היא מעטפת התשובה של 4.1 ואינה משהו אחר.
const shapes = [];
for (const { label, request } of everyPath) {
  const response = await orchestrator.handle(request);
  shapes.push({ label, keys: Object.keys(response) });
}

check(
  'לכל תשובה בכל דרך יש בדיוק ok, data, error',
  shapes.filter((s) => JSON.stringify(s.keys) !== JSON.stringify(['ok', 'data', 'error']))
    .map((s) => `${s.label}: ${s.keys.join(',')}`),
  [],
);

check('נבדקו כל הדרכים של השלב', shapes.length, everyPath.length);

check(
  'שדות מעטפת התשובה זהים לרשימה של CORE-01',
  [...RESPONSE_FIELDS],
  ['ok', 'data', 'error'],
);

// מודול מקבל את מעטפת הבקשה ומחזיר את מעטפת התשובה, ואינו מגדיר
// מעטפה משלו. בשלב הזה המודול היחיד הוא מודול הדמה.
{
  const request = {
    from: 'tool-simulator', module: 'test-echo', action: 'echo',
    payload: { item_id: 'item-001' }, lang: 'he',
  };
  const direct = echoHandler(request);

  check('המודול מחזיר את שלושת שדות מעטפת התשובה, או תת קבוצה שלהם',
    Object.keys(direct).filter((k) => !RESPONSE_FIELDS.includes(k)), []);
  check('המודול מחזיר ok', direct.ok, true);
  check('המודול מקבל ארגומנט אחד: המעטפה', echoHandler.length, 1);
  check(
    'המודול קורא רק שדות של מעטפת הבקשה',
    ['payload'].filter((field) => !REQUEST_FIELDS.includes(field)),
    [],
  );
}

// המודול אינו מגדיר מעטפה משלו: ה-Orchestrator הוא שמשלים אותה.
{
  const response = await orchestrator.handle({
    from: 'tool-simulator', module: 'test-echo', action: 'echo',
    payload: { item_id: 'item-002' }, lang: 'he',
  });
  check('התשובה שיצאה מה-Orchestrator שלמה', Object.keys(response), ['ok', 'data', 'error']);
  check('ותוכנה הוא מה שהמודול החזיר', response.data, { echo: { item_id: 'item-002' } });
}

report();
