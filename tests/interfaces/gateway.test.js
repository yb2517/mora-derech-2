// בדיקת ממשקים: GW-01 מול המעטפה, רשימת המותר וקודי השגיאה. מפה 6.2,
// שלוש הבדיקות לכל שלב, בזווית של שלב 6: השער קיים, ואיש אינו רשאי
// לקרוא לו. משימה 3 בתוכנית שלב 6.
//
// רשימת המותר האמיתית: כל פונה ברשימה הסגורה שמבקש מ-GW-01 נדחה
// ב-E-ALLOW-DENIED ונרשם. זו האכיפה של "אין ב-v1" (מפה 3.4), והיא
// יושבת בנתונים ולא בקוד (מפה 4.3).
//
// הניתוב: עם שורה מותרת שקיימת בבדיקה הזאת בלבד, CORE-02 מנתב לשער,
// והשער מחזיר E-REF-EMPTY; על זריקה (הכרעה 3) CORE-02 מחזיר
// E-MODULE-FAILED. שני הקודים מהרשימה הסגורה.
//
//   node tests/interfaces/gateway.test.js

import { createOrchestrator } from '../../core/orchestrator.js';
import { createRepository } from '../../repository/index.js';
import { createBrowserDriver } from '../../repository/driver-browser.js';
import { RESPONSE_FIELDS } from '../../core/contract.js';
import { ERROR_CODE_LIST } from '../../core/errors.js';
import { create as createGateway, EXAMPLE_ACTION, MODEL_TIER_KEY } from '../../gateways/ai.js';
import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };

const { check, report } = createChecker('ממשקים: GW-01 מול רשימת המותר');

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

function build(allowList, { adapters } = {}) {
  const repository = createRepository(createBrowserDriver({
    storage: memoryStorage(),
    seed: { modules: modulesFile, allow_list: allowList, reference: referenceFile.values },
  }));
  let counter = 0;
  const orchestrator = createOrchestrator({
    repository,
    handlers: { 'GW-01': createGateway({ repository, adapters }) },
    newRequestId: () => `gw-${++counter}`,
    now: () => '2026-09-17T00:00:00.000Z',
  });
  return { repository, orchestrator };
}

const request = (from) => ({
  from, module: 'GW-01', action: EXAMPLE_ACTION, payload: { input: 'טקסט' }, lang: 'he',
});

// --- הנתונים במאגר: אין שורה ל-GW-01 ---

check('רשימת המותר במאגר: 49 שורות, כפי שהיו', allowFile.rows.length, 49);
check('אף שורה ברשימת המותר אינה מכוונת ל-GW-01', allowFile.rows.filter((r) => r.module === 'GW-01'), []);
check(
  'שורת GW-01 בטבלת המודולים נשארה ריקה (הכרעה 5)',
  modulesFile.modules.find((m) => m.id === 'GW-01'),
  { id: 'GW-01', caller: null, handler: null, actions: [] },
);
check('model_tier ריק בטבלת ה-reference', referenceFile.values[MODEL_TIER_KEY], null);

// --- רשימת המותר האמיתית: כל פונה נדחה ונרשם ---

{
  const { repository, orchestrator } = build(allowFile);
  const callers = repository.listCallers();
  check('הרשימה הסגורה של הפונים נקראה', callers.length > 0, true);

  const outcomes = [];
  for (const from of callers) {
    const response = await orchestrator.handle(request(from));
    const rows = repository.listAudit().filter((row) => row.from === from && row.module === 'GW-01');
    outcomes.push({
      from,
      code: response.error?.code ?? null,
      keys: Object.keys(response),
      audit: rows.map((row) => [row.phase, row.rejected_with ?? row.error_code]),
      one_id: new Set(rows.map((row) => row.request_id)).size,
    });
  }

  check(
    'כל פונה ברשימה הסגורה נדחה ב-E-ALLOW-DENIED',
    outcomes.map((o) => [o.from, o.code]),
    callers.map((from) => [from, 'E-ALLOW-DENIED']),
  );
  check(
    'כל דחייה היא מעטפת 4.1',
    outcomes.filter((o) => JSON.stringify(o.keys) !== JSON.stringify([...RESPONSE_FIELDS])).map((o) => o.from),
    [],
  );
  check(
    'כל דחייה מותירה שתי שורות audit_log עם אותו request_id (מבחן מבנה 04)',
    outcomes.map((o) => [o.audit, o.one_id]),
    callers.map(() => [[['request', 'E-ALLOW-DENIED'], ['response', 'E-ALLOW-DENIED']], 1]),
  );
}

// --- הניתוב, עם שורה שקיימת כאן בלבד ---

const TEST_ONLY_ROW = { from: 'module-dialogue', module: 'GW-01', action: EXAMPLE_ACTION, allowed: true, is_demo: true };
const withRow = { ...allowFile, rows: [...allowFile.rows, TEST_ONLY_ROW] };

{
  const { repository, orchestrator } = build(withRow);
  const response = await orchestrator.handle(request('module-dialogue'));
  const rows = repository.listAudit({ request_id: 'gw-1' });

  check('עם שורה מותרת: הבקשה מנותבת, והשער מחזיר E-REF-EMPTY', response.error?.code, 'E-REF-EMPTY');
  check('error.data מכיל את שם ההגדרה', response.error?.data, { key: MODEL_TIER_KEY });
  check('התשובה היא מעטפת 4.1', Object.keys(response), [...RESPONSE_FIELDS]);
  check(
    'שתי שורות ביומן: הבקשה התקבלה והתשובה נושאת את הקוד',
    rows.map((row) => [row.phase, row.rejected_with ?? null, row.error_code ?? null]),
    [['request', null, null], ['response', null, 'E-REF-EMPTY']],
  );
}

{
  const { repository, orchestrator } = build(withRow);
  repository.setRef(MODEL_TIER_KEY, 'cheap');
  const response = await orchestrator.handle(request('module-dialogue'));
  check('דרגה בלי Adapter: הזריקה חוזרת דרך CORE-02 כ-E-MODULE-FAILED', response.error?.code, 'E-MODULE-FAILED');
  check('והסיבה היא threw', response.error?.data, { module: 'GW-01', reason: 'threw' });
}

{
  const adapters = { cheap: { call: async ({ input }) => ({ output: `[${input}]` }) } };
  const { repository, orchestrator } = build(withRow, { adapters });
  repository.setRef(MODEL_TIER_KEY, 'cheap');
  const response = await orchestrator.handle(request('module-dialogue'));
  check('דרגה עם Adapter: התשובה חוזרת במעטפה דרך CORE-02', response, {
    ok: true, data: { output: '[טקסט]', model_tier: 'cheap' }, error: null,
  });
}

// --- קודי השגיאה: כל קוד שהשער והניתוב שלו מחזירים קיים במפה ---

check(
  'שלושת הקודים של הזרימה הזאת ברשימה הסגורה',
  ['E-ALLOW-DENIED', 'E-REF-EMPTY', 'E-MODULE-FAILED'].filter((code) => !ERROR_CODE_LIST.includes(code)),
  [],
);

report(` (${allowFile.rows.length} שורות ברשימת המותר, אפס ל-GW-01)`);
