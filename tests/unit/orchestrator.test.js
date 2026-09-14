// Unit של CORE-02. נגזר מבדיקת הקבלה של משימות 6 ו-7 בתוכנית שלב 1,
// מ-BL-11, ממפה 6.1 (שורת CORE-02) וממבחן מבנה 04.
//
//   node tests/unit/orchestrator.test.js

import { createOrchestrator } from '../../core/orchestrator.js';
import { createRepository } from '../../repository/index.js';
import { createBrowserDriver } from '../../repository/driver-browser.js';
import { handle as echoHandler } from '../helpers/echo-module.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, checkThrowsAsync, report } = createChecker('CORE-02 orchestrator');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const seed = {
  modules: modulesFile,
  allow_list: allowFile,
  reference: referenceFile.values,
};

// מזהה בקשה וחותמת זמן מוזרקים, כדי שהבדיקה תהיה דטרמיניסטית.
function build({ handlers, repository: injected, failAudit = false } = {}) {
  let counter = 0;
  const repository = injected ?? createRepository(
    createBrowserDriver({ storage: memoryStorage(), seed }),
  );
  const wrapped = failAudit
    ? { ...repository, appendAudit() { throw new Error('האחסון אינו זמין'); } }
    : repository;

  const orchestrator = createOrchestrator({
    repository: wrapped,
    handlers: handlers ?? { 'test-echo': echoHandler },
    newRequestId: () => `req-${++counter}`,
    now: () => '2026-09-13T00:00:00.000Z',
  });
  return { orchestrator, repository };
}

const echoRequest = {
  from: 'tool-simulator',
  module: 'test-echo',
  action: 'echo',
  payload: { item_id: 'item-001' },
  lang: 'he',
};

// =============================================================
// בדיקת הקבלה, שורה 1: בקשה מותרת למודול דמה,
// שתי שורות audit_log עם אותו request_id
// =============================================================
{
  const { orchestrator, repository } = build();
  const response = await orchestrator.handle(echoRequest);

  check('הבקשה המותרת מוחזרת בהצלחה', response.ok, true);
  check('התשובה היא של מודול הדמה', response.data, { echo: { item_id: 'item-001' } });

  const rows = repository.listAudit();
  check('נרשמו שתי שורות', rows.length, 2);
  check('שתיהן תחת אותו request_id', [...new Set(rows.map((r) => r.request_id))], ['req-1']);
  check('האחת בקשה והשנייה תשובה', rows.map((r) => r.phase), ['request', 'response']);
  check('שורת הבקשה מתעדת את הפונה', [rows[0].from, rows[0].module, rows[0].action],
    ['tool-simulator', 'test-echo', 'echo']);
  check('שורת התשובה מתעדת הצלחה', [rows[1].ok, rows[1].error_code], [true, null]);

  // BL-18: אין זיהוי אישי בנתונים. ה-payload אינו נכנס ליומן.
  check(
    'ה-payload אינו נרשם ביומן',
    rows.filter((r) => JSON.stringify(r).includes('item-001')),
    [],
  );
}

// =============================================================
// בדיקת הקבלה, שורה 2: approve מ-screen-traveler
// E-ALLOW-DENIED ושורה ביומן
// =============================================================
{
  const { orchestrator, repository } = build();
  const response = await orchestrator.handle({
    from: 'screen-traveler', module: 'BE-05', action: 'approve', payload: {}, lang: 'he',
  });

  check('approve מ-screen-traveler נדחית', response.ok, false);
  check('הקוד הוא E-ALLOW-DENIED', response.error?.code, 'E-ALLOW-DENIED');
  check('הדחייה נרשמה ביומן', repository.listAudit().length > 0, true);
  check(
    'שורת הבקשה מתעדת במה נדחתה',
    repository.listAudit()[0].rejected_with,
    'E-ALLOW-DENIED',
  );
  check(
    'שורת התשובה נושאת את הקוד',
    repository.listAudit().at(-1).error_code,
    'E-ALLOW-DENIED',
  );
}

// שורה שקיימת ברשימה ו-allowed שלה false נדחית. אחרי הכרעת פער 13
// אין עוד שורה כזאת בנתונים, ולכן השורה מוזרקת: הכלל הוא חלק מהחוזה
// לפי 4.3, והוא נבדק בלי להיות תלוי בתוכן הנתונים.
//
// המודול המוזרק הוא test-echo, שיש לו handler. לכן אם בדיקת allowed
// תוסר, הבקשה תעבור בשקט ותחזיר ok, והטענה תאדים. בגרסה הקודמת
// המודול היה FE-04 שאין לו handler, ולכן ההסרה גרמה לזריקה במקום
// לטענה אדומה, וזה כיסוי חלש יותר.
{
  const blocked = {
    ...allowFile,
    rows: [...allowFile.rows, {
      from: 'screen-veto', module: 'test-echo', action: 'echo', allowed: false,
    }],
  };
  const repository = createRepository(createBrowserDriver({
    storage: memoryStorage(),
    seed: { ...seed, allow_list: blocked },
  }));
  const orchestrator = createOrchestrator({
    repository,
    handlers: { 'test-echo': echoHandler },
    newRequestId: () => 'req-blocked',
    now: () => '2026-09-14T00:00:00.000Z',
  });
  const response = await orchestrator.handle({
    from: 'screen-veto', module: 'test-echo', action: 'echo', payload: {}, lang: 'he',
  });

  check('שורה עם allowed=false נדחית', response.ok, false);
  check('הקוד הוא E-ALLOW-DENIED', response.error?.code, 'E-ALLOW-DENIED');
  check('הדחייה נרשמה', repository.listAudit()[0].rejected_with, 'E-ALLOW-DENIED');
}

// אותה פעולה מהמסך המורשה כן עוברת את בדיקת רשימת המותר
{
  const { orchestrator } = build({ handlers: { 'BE-05': () => ({ ok: true, data: null, error: null }) } });
  const response = await orchestrator.handle({
    from: 'screen-veto', module: 'BE-05', action: 'approve', payload: { item_id: 'x' }, lang: 'he',
  });
  check('approve מ-screen-veto עוברת', response.ok, true);
}

// =============================================================
// בדיקת הקבלה, שורה 3: from שאינו ברשימה הסגורה
// =============================================================
{
  const { orchestrator, repository } = build();
  const response = await orchestrator.handle({
    from: 'screen-unknown', module: 'test-echo', action: 'echo', payload: {}, lang: 'he',
  });

  check('הקוד הוא E-FROM-UNKNOWN', response.error?.code, 'E-FROM-UNKNOWN');
  check('גם היא נרשמה', repository.listAudit().length, 2);

  // "אסור" ו"אינו מוכר" הם שני קודים שונים, לפי ההערה בסוף 4.5
  check(
    'פונה מוכר בלי שורה מקבל קוד אחר',
    (await build().orchestrator.handle({
      from: 'module-retrieval', module: 'test-echo', action: 'echo', payload: {}, lang: 'he',
    })).error?.code,
    'E-ALLOW-DENIED',
  );
}

// =============================================================
// בדיקת הקבלה, שורה 4: כשל רישום, הבקשה אינה מנותבת
// =============================================================
{
  let routed = false;
  const { orchestrator } = build({
    failAudit: true,
    handlers: { 'test-echo': (r) => { routed = true; return echoHandler(r); } },
  });
  const response = await orchestrator.handle(echoRequest);

  check('הקוד הוא E-AUDIT-WRITE-FAILED', response.error?.code, 'E-AUDIT-WRITE-FAILED');
  check('הבקשה לא נותבה', routed, false);
  check('התשובה היא מעטפה ולא זריקה', response.ok, false);
}

// =============================================================
// סדר חמשת הצעדים, BL-11
// =============================================================
{
  // מעטפה פסולה נדחית לפני בדיקת הפונה
  const { orchestrator } = build();
  const noFrom = { module: 'test-echo', action: 'echo', payload: {}, lang: 'he' };
  check('מעטפה בלי from מחזירה E-FROM-MISSING', (await orchestrator.handle(noFrom)).error?.code, 'E-FROM-MISSING');

  const noAction = { from: 'tool-simulator', module: 'test-echo', payload: {}, lang: 'he' };
  check('מעטפה בלי action מחזירה E-ENVELOPE-INVALID', (await orchestrator.handle(noAction)).error?.code, 'E-ENVELOPE-INVALID');

  // פונה שאינו מוכר נדחה לפני רשימת המותר
  const unknownAndDenied = { from: 'screen-nope', module: 'BE-05', action: 'approve', payload: {}, lang: 'he' };
  check('פונה לא מוכר קודם לרשימת המותר', (await orchestrator.handle(unknownAndDenied)).error?.code, 'E-FROM-UNKNOWN');
}

// =============================================================
// מבחן מבנה 04: כל בקשה מותירה שורות עם מזהה משותף
// =============================================================
{
  const { orchestrator, repository } = build();
  await orchestrator.handle(echoRequest);
  await orchestrator.handle({ ...echoRequest, action: 'nope' });
  await orchestrator.handle({ from: 'screen-nope', module: 'x', action: 'y', payload: {}, lang: 'he' });

  const rows = repository.listAudit();
  check('שלוש בקשות, שש שורות', rows.length, 6);
  check(
    'לכל בקשה מזהה משלה, ולכל מזהה שתי שורות',
    [...new Set(rows.map((r) => r.request_id))].map(
      (id) => rows.filter((r) => r.request_id === id).length,
    ),
    [2, 2, 2],
  );
  check('אין שורה בלי מזהה', rows.filter((r) => !r.request_id), []);
}

// =============================================================
// משימה 7: הבקשה מנותבת דרך ה-Orchestrator, לא ישירות
// =============================================================
{
  const calls = [];
  const { orchestrator } = build({
    handlers: { 'test-echo': (r) => { calls.push(r); return echoHandler(r); } },
  });
  await orchestrator.handle(echoRequest);

  check('ה-handler נקרא פעם אחת', calls.length, 1);
  check('הוא קיבל את מעטפת הבקשה עצמה', calls[0].action, 'echo');
  check('מודול הדמה מסומן is_demo ב-modules.json',
    modulesFile.modules.find((m) => m.id === 'test-echo').is_demo, true);
  check('יש לו שורה אחת ברשימת המותר',
    allowFile.rows.filter((r) => r.module === 'test-echo').length, 1);
  check('השורה מסומנת is_demo',
    allowFile.rows.find((r) => r.module === 'test-echo').is_demo, true);

  // חוק ברזל 2: המודול אינו קורא למודול אחר. ה-handler מקבל מעטפה
  // ומחזיר מעטפה, ואינו מקבל את ה-Repository ולא את ה-Orchestrator.
  check('ה-handler קיבל ארגומנט אחד בלבד', echoHandler.length, 1);
}

// =============================================================
// מודול שאינו מגיב: E-MODULE-FAILED, קוד עשרים ושלושה
// =============================================================
{
  const { orchestrator, repository } = build({ handlers: {} });
  const response = await orchestrator.handle(echoRequest);

  check('מודול מותר בלי handler מחזיר מעטפה ולא קורס', response.ok, false);
  check('הקוד הוא E-MODULE-FAILED', response.error?.code, 'E-MODULE-FAILED');
  check('הפירוט נוקב בסיבה', response.error?.data.reason, 'no-handler');
  check('שתי שורות נרשמו, כמו לכל בקשה', repository.listAudit().length, 2);
  check('שורת התשובה נושאת את הקוד', repository.listAudit().at(-1).error_code, 'E-MODULE-FAILED');
}

{
  const { orchestrator, repository } = build({
    handlers: { 'test-echo': () => { throw new Error('המודול נפל'); } },
  });
  const response = await orchestrator.handle(echoRequest);

  check('handler שנופל מחזיר מעטפה ולא קורס', response.ok, false);
  check('הקוד הוא E-MODULE-FAILED', response.error?.code, 'E-MODULE-FAILED');
  check('הפירוט מבחין בין שתי הסיבות', response.error?.data.reason, 'threw');
  check('גם כאן שתי שורות', repository.listAudit().length, 2);
}

await checkThrowsAsync('בלי Repository נדחה בהרכבה', async () => createOrchestrator({}));

// =============================================================
// חוק ברזל 8: רק קודים מהרשימה הסגורה יוצאים מכאן
// =============================================================
{
  const { orchestrator } = build();
  const codes = [];
  for (const request of [
    { module: 'test-echo', action: 'echo', payload: {}, lang: 'he' },
    { from: 'tool-simulator', module: 'test-echo', payload: {}, lang: 'he' },
    { from: 'screen-nope', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' },
    { from: 'module-retrieval', module: 'test-echo', action: 'echo', payload: {}, lang: 'he' },
  ]) {
    const response = await orchestrator.handle(request);
    if (response.error) codes.push(response.error?.code);
  }
  check('הקודים שיצאו', [...new Set(codes)].sort(), [
    'E-ALLOW-DENIED', 'E-ENVELOPE-INVALID', 'E-FROM-MISSING', 'E-FROM-UNKNOWN',
  ]);
}

// =============================================================
// הרשימה הסגורה נגזרת מנתונים, לא מקוד
// =============================================================
{
  const { repository } = build();
  check('עשרה פונים, לפי 4.1', repository.listCallers().length, 10);
  check(
    'הם בדיוק הרשימה הסגורה של 4.1',
    [...repository.listCallers()].sort(),
    ['module-delivery', 'module-dialogue', 'module-geofence', 'module-retrieval',
      'screen-content', 'screen-owner', 'screen-traveler', 'screen-veto',
      'system-timer', 'tool-simulator'],
  );
}

// מסך חדש נכנס בשורת נתונים, בלי שינוי קוד. מבחן מבנה 06.
{
  const extendedModules = {
    ...modulesFile,
    modules: [...modulesFile.modules, { id: 'FE-99', caller: 'screen-new', handler: null, actions: [] }],
  };
  const extendedAllow = {
    ...allowFile,
    rows: [...allowFile.rows, { from: 'screen-new', module: 'test-echo', action: 'echo', allowed: true }],
  };
  const repository = createRepository(createBrowserDriver({
    storage: memoryStorage(),
    seed: { ...seed, modules: extendedModules, allow_list: extendedAllow },
  }));
  const orchestrator = createOrchestrator({
    repository,
    handlers: { 'test-echo': echoHandler },
    newRequestId: () => 'req-new',
    now: () => '2026-09-13T00:00:00.000Z',
  });
  const response = await orchestrator.handle({
    from: 'screen-new', module: 'test-echo', action: 'echo', payload: { a: 1 }, lang: 'he',
  });
  check('מסך חדש עובד אחרי שתי שורות נתונים, בלי שינוי קוד', response.ok, true);
}

// --- סיכום ---

report();
