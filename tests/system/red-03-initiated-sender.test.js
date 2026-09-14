// הבדיקה האדומה השלישית, מפה 6.5 ו-usecase-f-09 זרימה ב.
//
// "שורת initiated שנשלחה שלא ממודול השיחה נספרת ב-M-01 (F-09)."
//
// כשל אמיתי בה **חוסם שחרור**: M-01 הוא המדד שמכריע את שער A, ואם
// מודול לא מורשה יכול לייצר שורת יזימה, המספר שמכריע Go או No-Go
// נמדד על נתון שהמערכת ייצרה לעצמה.
//
// היא רצה מקצה לקצה, מפני שההגנה מורכבת משתי שכבות שצריכות להחזיק
// יחד: רשימת המותר יודעת שמודול רשאי לשלוח log, ואינה יודעת איזה
// **סוג**, ולכן BL-17 נאכף ב-BE-07 מול interaction_type_senders
// בטבלת ה-reference. הבדיקה מוודאת ששתיהן שם.
//
//   node tests/system/red-03-initiated-sender.test.js

import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('אדומה F-09: initiated ממודול לא מורשה');

const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { create: createLog } = await import('../../services/log.js');

const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
const referenceFile = (await import('../../data/reference.json', { with: { type: 'json' } })).default;

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

const seed = {
  modules: modulesFile,
  allow_list: allowFile,
  reference: referenceFile.values,
  sites: [{ site_id: 'site-red', name: 'מסלול', stops: ['stop-1', 'stop-last'] }],
};

const repository = createRepository(createBrowserDriver({ storage: memoryStorage(), seed }));
const orchestrator = createOrchestrator({
  repository,
  handlers: { 'BE-07': createLog({ repository }) },
});
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

const open = await send({
  from: 'screen-traveler', module: 'BE-07', action: 'session_start', payload: { site_id: 'site-red' },
});
const sessionId = open.data.session.session_id;

const log = (from, payload) => send({ from, module: 'BE-07', action: 'log', payload: { session_id: sessionId, ...payload } });

// --- ההגנה: initiated מכל פונה שאינו מודול השיחה ---

{
  // הרשימה נגזרת מהנתונים: כל פונה שרשאי לשלוח log לפי רשימת
  // המותר, ואינו ברשימת השולחים של initiated בטבלת ה-reference.
  const mayLog = allowFile.rows
    .filter((row) => row.module === 'BE-07' && row.action === 'log' && row.allowed === true)
    .map((row) => row.from);
  const mayInitiate = referenceFile.values.interaction_type_senders.initiated;
  const impostors = mayLog.filter((from) => !mayInitiate.includes(from));

  check('יש פונים שרשאים לשלוח log ואינם רשאים לשלוח initiated', impostors.length > 0, true);
  check('ומודול השיחה אינו ביניהם', impostors.includes('module-dialogue'), false);

  for (const from of impostors) {
    const response = await log(from, { type: 'initiated', question: 'שאלה שהוזרקה' });
    check(`initiated מ-${from} נדחה`, response.error.code, 'E-LOG-TYPE-INVALID');
    check(`והסיבה היא השולח, ולא הסוג (${from})`, response.error.data.reason, 'sender_not_allowed');
  }

  check('ולא נכתבה אף שורה', repository.listInteractions({ session_id: sessionId }).length, 0);
}

// --- הדחייה נרשמת ב-audit_log ולא ב-INTERACTIONS ---

{
  // usecase-f-09 זרימה ב2: "נדחית בקוד ייעודי, נרשמת ב-Audit Log,
  // לא ב-INTERACTIONS". זו ההבחנה שמונעת מ-M-01 להתנפח.
  // הדחייה כאן היא של המודול ולא של המעטפה, ולכן היא יושבת בשורת
  // התשובה בשדה error_code, ולא ב-rejected_with של שורת הבקשה.
  const rejected = repository.listAudit()
    .filter((row) => row.error_code === 'E-LOG-TYPE-INVALID');
  check('הדחיות נרשמו ביומן הבקשות', rejected.length, 3);
  check('ולכל אחת יש שורת בקשה תואמת', rejected.every(
    (row) => repository.listAudit({ request_id: row.request_id }).length === 2,
  ), true);
  check('ו-INTERACTIONS נשאר ריק', repository.listInteractions({ session_id: sessionId }).length, 0);
}

// --- הבדיקה ספציפית: מודול השיחה כן נספר ---

{
  // אם ההגנה חוסמת את כולם, היא אינה מודדת דבר.
  const allowed = await log('module-dialogue', { type: 'initiated', question: 'שאלה אמיתית' });
  check('initiated ממודול השיחה מתקבל', allowed.ok, true);
  check('ונכתבה שורה אחת', repository.listInteractions({ session_id: sessionId }).length, 1);
  check('והיא מסוג initiated', repository.listInteractions({ session_id: sessionId })[0].type, 'initiated');
}

// --- וההשפעה על M-01 עצמו ---

{
  // הנקודה כולה: M-01 סופר את מה שנכתב. שלוש הזרקות ושורה אחת
  // אמיתית חייבות לתת 1, ולא 4.
  await log('module-delivery', { type: 'pushed', stop_id: 'stop-1', item_id: 'i-1' });
  await send({ from: 'screen-traveler', module: 'BE-07', action: 'session_end', payload: { session_id: sessionId } });

  const metrics = await send({
    from: 'screen-owner', module: 'BE-07', action: 'compute_metrics', payload: { site_id: 'site-red' },
  });
  const m01 = metrics.data.metrics.find((row) => row.metric === 'M-01');

  check('הסשן נכנס למדגם', metrics.data.n, 1);
  check('**M-01 סופר את השורה האמיתית בלבד**', m01.value, 1);
  check('ואינו סופר את ההזרקות', m01.value !== 4, true);
  check('והוא אינו עובר את הסף', m01.passes, false);
}

report();
