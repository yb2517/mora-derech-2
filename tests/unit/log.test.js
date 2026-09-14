// Unit של BE-07, Interaction Log. נגזר מבדיקת הקבלה של משימה 9
// בתוכנית שלב 4, מ-usecase-f-09 (הזרימה הראשית וזרימות א עד ו),
// מ-BL-10, BL-16, BL-17 ו-BL-18, ומשורות BE-07 במפה 6.1
// ("initiated מ-module-delivery: E-LOG-TYPE-INVALID"; "סשנים עם 2,
// 3, 5 שאלות: M-01 = 3, עובר, גדול או שווה").
//
//   node tests/unit/log.test.js

import { create, median } from '../../services/log.js';
import { createChecker } from '../helpers/assert.js';
import referenceFile from '../../data/reference.json' with { type: 'json' };

const { check, checkThrows, report } = createChecker('BE-07 log');

const REFERENCE = {
  interaction_types: referenceFile.values.interaction_types,
  interaction_type_senders: referenceFile.values.interaction_type_senders,
  stale_session_minutes: 60,
  m01_threshold: 3,
  m02_threshold: 0.7,
  sample_min: 15,
  sample_max: 25,
};

// Repository מזויף בזיכרון, עם אותם שמות עסקיים.
function fakeRepository({ reference = REFERENCE, failWrites = 0, sessions = [], interactions = [] } = {}) {
  const data = {
    sessions: sessions.map((row) => ({ ...row })),
    interactions: interactions.map((row) => ({ ...row })),
    sites: [{ site_id: 's-1', stops: ['st-1', 'st-2', 'st-last'] }],
  };
  let remaining = failWrites;

  return {
    data,
    getRef: (key) => reference[key],
    getSite: (id) => data.sites.find((row) => row.site_id === id) ?? data.sites[0] ?? null,
    getSession: (id) => data.sessions.find((row) => row.session_id === id) ?? null,
    listSessions: ({ site_id: siteId, from, to } = {}) => data.sessions
      .filter((row) => siteId === undefined || row.site_id === siteId)
      .filter((row) => from === undefined || row.started_at >= from)
      .filter((row) => to === undefined || row.started_at <= to)
      .map((row) => ({ ...row })),
    appendSession: (record) => { data.sessions.push({ ...record }); return { ...record }; },
    updateSession: (id, patch) => {
      const row = data.sessions.find((session) => session.session_id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return { ...row };
    },
    appendInteraction: (record) => {
      if (remaining > 0) { remaining -= 1; throw new Error('הכתיבה נכשלה'); }
      data.interactions.push({ ...record });
      return { ...record };
    },
    listInteractions: ({ session_id: sessionId, type } = {}) => data.interactions
      .filter((row) => sessionId === undefined || row.session_id === sessionId)
      .filter((row) => type === undefined || row.type === type)
      .map((row) => ({ ...row })),
  };
}

let counter = 0;
let clockMinutes = 0;
const options = (repository) => ({
  repository,
  newId: () => { counter += 1; return String(counter).padStart(3, '0'); },
  now: () => new Date(Date.UTC(2026, 8, 14, 6, clockMinutes)).toISOString(),
});

const envelope = (action, payload = {}, from = 'screen-traveler') => ({
  from, module: 'BE-07', action, payload, lang: 'he',
});

// ---------------------------------------------------------------------
// חיי הסשן, usecase-f-09 צעדים 1, 2 ו-6
// ---------------------------------------------------------------------

{
  clockMinutes = 0;
  const repository = fakeRepository();
  const handle = create(options(repository));
  const response = handle(envelope('session_start', { site_id: 's-1', flags: [] }));

  check('הסשן נפתח', response.ok, true);
  check('עם מזהה', typeof response.data.session.session_id, 'string');
  check('פתוח', response.data.session.ended_at, null);
  check('ולא הושלם', response.data.session.completed, false);
  check('ובלי סשן קודם', response.data.session.previous_session_id, null);
  check('ואינו חידוש', response.data.resumed, false);

  // BL-18: אין שם, אין חשבון, ואין מזהה מכשיר.
  check('אין בשדות דבר שמזהה אדם',
    Object.keys(response.data.session).filter((key) => /name|user|device|email|phone/i.test(key)), []);
}

// הכרעה 2, וההכרעה הפתוחה 5 במפה: חידוש סשן אחרי טעינה.
{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const first = handle(envelope('session_start', { site_id: 's-1' })).data.session;

  const resumed = handle(envelope('session_start', { site_id: 's-1', session_id: first.session_id }));
  check('סשן פתוח ממשיך באותו מזהה', resumed.data.session.session_id, first.session_id);
  check('והחידוש מדווח', resumed.data.resumed, true);
  check('ולא נוצר סשן שני', repository.data.sessions.length, 1);

  // בלי מזהה כלל: הסשן הפתוח של המסלול נמצא מהנתונים, וזה מה
  // שהופך טעינת דף לאירוע שאינו קיים במודל (הכרעה 2).
  const blind = handle(envelope('session_start', { site_id: 's-1' }));
  check('בלי מזהה, הסשן הפתוח נמצא מהנתונים', blind.data.session.session_id, first.session_id);
  check('וגם הוא חידוש', blind.data.resumed, true);
  check('ועדיין סשן אחד', repository.data.sessions.length, 1);

  handle(envelope('session_end', { session_id: first.session_id }));
  const after = handle(envelope('session_start', { site_id: 's-1', session_id: first.session_id }));
  check('סשן שנסגר פותח סשן חדש', after.data.session.session_id !== first.session_id, true);
  check('והוא מצביע על הקודם', after.data.session.previous_session_id, first.session_id);
  check('ושניהם במאגר', repository.data.sessions.length, 2);

  // אחרי שהראשון נסגר, סשן חדש בלי מזהה מוצא את השני הפתוח.
  const third = handle(envelope('session_start', { site_id: 's-1' }));
  check('החידוש מוצא את הפתוח ולא את הסגור', third.data.session.session_id, after.data.session.session_id);
}

{
  // מסלול אחר אינו מחדש סשן של מסלול זה.
  const repository = fakeRepository();
  const handle = create(options(repository));
  const first = handle(envelope('session_start', { site_id: 's-1' })).data.session;
  const other = handle(envelope('session_start', { site_id: 's-2' })).data.session;
  check('סשן של מסלול אחר נפתח בנפרד', other.session_id !== first.session_id, true);
  check('ואינו חידוש', other.previous_session_id, null);
}

// הכרעה 7: completed נגזר מהגעה לתחנה האחרונה.
{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const session = handle(envelope('session_start', { site_id: 's-1' })).data.session;

  handle(envelope('log', { session_id: session.session_id, type: 'pushed', stop_id: 'st-1', item_id: 'i-1' }, 'module-delivery'));
  const early = handle(envelope('session_end', { session_id: session.session_id }));
  check('סיום לפני התחנה האחרונה אינו הושלם', early.data.completed, false);
  check('והסשן נסגר', typeof early.data.session.ended_at, 'string');
  check('והתחנה האחרונה שנרשמה נשמרה', early.data.session.last_stop_id, 'st-1');

  const again = handle(envelope('session_end', { session_id: session.session_id }));
  check('סיום חוזר אינו משנה דבר', again.data.already_closed, true);
}

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const session = handle(envelope('session_start', { site_id: 's-1' })).data.session;

  handle(envelope('log', { session_id: session.session_id, type: 'pushed', stop_id: 'st-last', item_id: 'i-9' }, 'module-delivery'));
  const done = handle(envelope('session_end', { session_id: session.session_id }));
  check('הגעה לתחנה האחרונה היא השלמה', done.data.completed, true);
}

{
  const handle = create(options(fakeRepository()));
  check('סיום סשן שאינו קיים נדחה',
    handle(envelope('session_end', { session_id: 'sess-none' })).error.code, 'E-SESSION-CLOSED');
}

// ---------------------------------------------------------------------
// BL-17: הסוג והשולח. **הבדיקה האדומה השלישית**
// ---------------------------------------------------------------------

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const session = handle(envelope('session_start', { site_id: 's-1' })).data.session;
  const log = (payload, from) => handle(envelope('log', { session_id: session.session_id, ...payload }, from));

  // שורת BE-07 במפה 6.1, והבדיקה האדומה של מפה 6.5.
  const smuggled = log({ type: 'initiated', question: 'שאלה' }, 'module-delivery');
  check('initiated מ-module-delivery נדחה', smuggled.error.code, 'E-LOG-TYPE-INVALID');
  check('והסיבה מדווחת', smuggled.error.data.reason, 'sender_not_allowed');
  check('והשולחים המורשים מדווחים', smuggled.error.data.allowed, ['module-dialogue']);
  check('ולא נכתבה שורה', repository.data.interactions.length, 0);

  check('initiation ממודול השיחה מתקבל',
    log({ type: 'initiated', question: 'שאלה' }, 'module-dialogue').ok, true);
  check('ונכתבה שורה אחת', repository.data.interactions.length, 1);

  const unknown = log({ type: 'סוג שהומצא' }, 'module-dialogue');
  check('סוג שאינו ברשימה הסגורה נדחה', unknown.error.code, 'E-LOG-TYPE-INVALID');
  check('והסיבה שונה', unknown.error.data.reason, 'unknown_type');

  check('pushed מ-FE-04 מתקבל', log({ type: 'pushed', stop_id: 'st-1' }, 'module-delivery').ok, true);
  check('pushed ממודול השיחה נדחה', log({ type: 'pushed' }, 'module-dialogue').error.code, 'E-LOG-TYPE-INVALID');
  check('attempt_failed ממסך המטייל מתקבל', log({ type: 'attempt_failed' }, 'screen-traveler').ok, true);
  check('abstained ממודול השליפה מתקבל', log({ type: 'abstained' }, 'module-retrieval').ok, true);
  check('abstained ממסך המטייל נדחה', log({ type: 'abstained' }, 'screen-traveler').error.code, 'E-LOG-TYPE-INVALID');
}

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const session = handle(envelope('session_start', { site_id: 's-1' })).data.session;
  handle(envelope('session_end', { session_id: session.session_id }));

  const closed = handle(envelope('log', { session_id: session.session_id, type: 'initiated' }, 'module-dialogue'));
  check('שורה לסשן סגור נדחית', closed.error.code, 'E-SESSION-CLOSED');
  check('ושורה לסשן שאינו קיים',
    handle(envelope('log', { session_id: 'sess-none', type: 'initiated' }, 'module-dialogue')).error.code,
    'E-SESSION-CLOSED');
}

// BL-18: מה שנכתב הוא שדות מפה 2.1 ואלה בלבד.
{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const session = handle(envelope('session_start', { site_id: 's-1' })).data.session;
  handle(envelope('log', {
    session_id: session.session_id, type: 'initiated', question: 'שאלה', stop_id: 'st-1',
    device_id: 'לא אמור להישמר', user_name: 'גם לא',
  }, 'module-dialogue'));

  const row = repository.data.interactions[0];
  check('השדות הם של מפה 2.1', Object.keys(row).sort(), [
    'accuracy', 'displayed_as_text', 'duration_ms', 'interaction_id', 'is_fallback',
    'item_id', 'question', 'session_id', 'source_item', 'stop_id', 'time', 'type',
  ]);
  check('שדה שנשלח ואינו במפה אינו נשמר', row.device_id, undefined);
  check('ושדה שאינו רלוונטי לסוג נשאר ריק', row.item_id, null);
}

// ---------------------------------------------------------------------
// BL-10 והכרעה 9: שלושה ניסיונות, ואז partial_log
// ---------------------------------------------------------------------

{
  const repository = fakeRepository({ failWrites: 2 });
  const handle = create(options(repository));
  const session = handle(envelope('session_start', { site_id: 's-1' })).data.session;
  const response = handle(envelope('log', { session_id: session.session_id, type: 'initiated' }, 'module-dialogue'));

  check('שני כשלים ואז הצלחה: השורה נכתבה', response.ok, true);
  check('והסשן אינו מסומן', repository.getSession(session.session_id).flags, []);
}

{
  const repository = fakeRepository({ failWrites: 99 });
  const handle = create(options(repository));
  const session = handle(envelope('session_start', { site_id: 's-1' })).data.session;
  const response = handle(envelope('log', { session_id: session.session_id, type: 'initiated' }, 'module-dialogue'));

  check('אחרי שלושה ניסיונות הכשל מדווח', response.error.code, 'E-LOG-WRITE-FAILED');
  check('ומספר הניסיונות מדווח', response.error.data.attempts, 3);
  check('והסשן מסומן partial_log', repository.getSession(session.session_id).flags, ['partial_log']);
}

// ---------------------------------------------------------------------
// close_stale, usecase-f-09 צעד 7 וזרימה ה
// ---------------------------------------------------------------------

{
  clockMinutes = 0;
  const repository = fakeRepository();
  const handle = create(options(repository));
  const fresh = handle(envelope('session_start', { site_id: 's-1' })).data.session;

  clockMinutes = 45;
  // זרימה ה: הפסקת קפה של 45 דקות אינה נשירה.
  const coffee = handle(envelope('close_stale', {}, 'system-timer'));
  check('45 דקות אינן סוגרות סשן', coffee.data.closed, []);
  check('והסשן עדיין פתוח', repository.getSession(fresh.session_id).ended_at, null);

  clockMinutes = 61;
  const stale = handle(envelope('close_stale', {}, 'system-timer'));
  check('61 דקות סוגרות', stale.data.closed, [fresh.session_id]);
  check('כלא הושלם', repository.getSession(fresh.session_id).completed, false);
  check('ועם זמן סיום', typeof repository.getSession(fresh.session_id).ended_at, 'string');

  const again = handle(envelope('close_stale', {}, 'system-timer'));
  check('סשן שכבר נסגר אינו נסגר שוב', again.data.closed, []);
}

{
  clockMinutes = 0;
  const repository = fakeRepository();
  const handle = create(options(repository));
  const session = handle(envelope('session_start', { site_id: 's-1' })).data.session;

  clockMinutes = 50;
  handle(envelope('log', { session_id: session.session_id, type: 'initiated' }, 'module-dialogue'));
  clockMinutes = 100;
  // האירוע האחרון היה בדקה 50, ולכן בדקה 100 עברו 50 דקות בלבד.
  check('הפרק נמדד מהאירוע האחרון ולא מהפתיחה',
    handle(envelope('close_stale', {}, 'system-timer')).data.closed, []);

  clockMinutes = 115;
  check('ואחרי הפרק הוא נסגר',
    handle(envelope('close_stale', {}, 'system-timer')).data.closed, [session.session_id]);
}

{
  const repository = fakeRepository({ reference: { ...REFERENCE, stale_session_minutes: null } });
  check('הפרק ריק מחזיר E-REF-EMPTY',
    create(options(repository))(envelope('close_stale', {}, 'system-timer')).error.code, 'E-REF-EMPTY');
}

// ---------------------------------------------------------------------
// compute_metrics, usecase-f-09 צעדים 9 ו-10
// ---------------------------------------------------------------------

// שורת BE-07 במפה 6.1: סשנים עם 2, 3 ו-5 שאלות. M-01 = 3, עובר.
{
  const sessions = [2, 3, 5].map((count, index) => ({
    session_id: `sess-${index}`, site_id: 's-1', started_at: '2026-09-05T06:00:00.000Z',
    ended_at: '2026-09-05T07:00:00.000Z', completed: true, last_stop_id: 'st-last',
    flags: [], previous_session_id: null, questions: count,
  }));
  const interactions = sessions.flatMap((session) => [
    { interaction_id: `p-${session.session_id}`, session_id: session.session_id, time: '2026-09-05T06:05:00.000Z', type: 'pushed', stop_id: 'st-1' },
    ...Array.from({ length: session.questions }, (unused, i) => ({
      interaction_id: `q-${session.session_id}-${i}`, session_id: session.session_id,
      time: '2026-09-05T06:10:00.000Z', type: 'initiated', is_fallback: false,
    })),
  ]);

  const repository = fakeRepository({ sessions, interactions });
  const response = create(options(repository))(envelope('compute_metrics', { site_id: 's-1' }, 'screen-owner'));

  check('החישוב מוצלח', response.ok, true);
  check('n הוא שלושה סשנים', response.data.n, 3);
  const m01 = response.data.metrics.find((row) => row.metric === 'M-01');
  check('**M-01 = 3**', m01.value, 3);
  check('והסף מטבלת ה-reference', m01.threshold, 3);
  check('**והוא עובר**, גדול או שווה', m01.passes, true);

  const m02 = response.data.metrics.find((row) => row.metric === 'M-02');
  check('M-02 = 1', m02.value, 1);
  check('ועובר', m02.passes, true);

  check('המדגם קטן מהסף ומסומן', response.data.sample_small, true);
  check('וסף המדגם מדווח', response.data.sample_min, 15);
}

// זרימה ד: חציון בדיוק 3 עובר, 2 אינו עובר.
{
  check('חציון של 2, 3, 5', median([2, 3, 5]), 3);
  check('חציון של מספר זוגי של סשנים', median([2, 4]), 3);
  check('חציון של מדגם ריק הוא null ולא אפס', median([]), null);
  check('חציון של אחד', median([7]), 7);
}

// BL-16 והכרעה 8: מה נכנס למדגם.
{
  const base = (id, flags, completed) => ({
    session_id: id, site_id: 's-1', started_at: '2026-09-05T06:00:00.000Z',
    ended_at: '2026-09-05T07:00:00.000Z', completed, last_stop_id: 'st-1',
    flags, previous_session_id: null,
  });
  const sessions = [
    base('sess-real', [], true),
    base('sess-sim', ['simulator'], true),
    base('sess-partial', ['partial_log'], true),
    base('sess-idle', [], false),
  ];
  const interactions = ['sess-real', 'sess-sim', 'sess-partial'].map((id) => ({
    interaction_id: `p-${id}`, session_id: id, time: '2026-09-05T06:05:00.000Z', type: 'pushed', stop_id: 'st-1',
  }));

  const repository = fakeRepository({ sessions, interactions });
  const response = create(options(repository))(envelope('compute_metrics', { site_id: 's-1' }, 'screen-owner'));

  check('רק סשן אחד נכנס למדגם', response.data.n, 1);
  check('סשן סימולטור נגרע', response.data.excluded.simulator, 1);
  check('סשן עם יומן חלקי נגרע', response.data.excluded.partial_log, 1);
  check('וסשן בלי אף הגעה נגרע', response.data.excluded.no_arrival, 1);
}

{
  const repository = fakeRepository({ sessions: [], interactions: [] });
  const response = create(options(repository))(envelope('compute_metrics', { site_id: 's-1' }, 'screen-owner'));
  check('מדגם ריק: n אפס', response.data.n, 0);
  check('ו-M-01 הוא null ולא אפס',
    response.data.metrics.find((row) => row.metric === 'M-01').value, null);
  check('ואינו עובר', response.data.metrics.find((row) => row.metric === 'M-01').passes, false);
}

{
  for (const key of ['m01_threshold', 'm02_threshold', 'sample_min', 'sample_max']) {
    const repository = fakeRepository({ reference: { ...REFERENCE, [key]: null } });
    check(`${key} ריק מחזיר E-REF-EMPTY`,
      create(options(repository))(envelope('compute_metrics', {}, 'screen-owner')).error.data.key, key);
  }
}

// ---------------------------------------------------------------------
// export, usecase-f-09 צעד 11, ופער 45
// ---------------------------------------------------------------------

{
  const sessions = [{
    session_id: 'sess-1', site_id: 's-1', started_at: '2026-09-05T06:00:00.000Z',
    ended_at: '2026-09-05T07:00:00.000Z', completed: true, last_stop_id: 'st-last',
    flags: [], previous_session_id: null,
  }];
  const interactions = [
    { interaction_id: 'p-1', session_id: 'sess-1', time: '2026-09-05T06:05:00.000Z', type: 'pushed', stop_id: 'st-1' },
    { interaction_id: 'q-1', session_id: 'sess-1', time: '2026-09-05T06:10:00.000Z', type: 'initiated', question: 'שאלה פרטית של המשפחה' },
  ];
  const repository = fakeRepository({ sessions, interactions });
  const response = create(options(repository))(envelope('export', { site_id: 's-1' }, 'screen-owner'));

  check('הייצוא מוצלח', response.ok, true);
  check('שורה לכל סשן', response.data.rows, 1);
  check('עם כותרת', response.data.csv.split('\n')[0].startsWith('session_id'), true);
  check('ומוני האינטראקציות בשורה', response.data.csv.includes(',1,1,'), true);

  // פער 45: הכרעת הפרטיות פתוחה, ולכן הטקסט אינו יוצא.
  check('טקסט השאלה אינו בייצוא', response.data.csv.includes('שאלה פרטית'), false);
  check('וההשמטה מוצהרת', response.data.includes_question_text, false);
  check('ונאמר מה הושמט', response.data.omitted, ['question']);

  check('והמדדים חוזרים מאותה קריאה', response.data.metrics.length, 2);
}

// ---------------------------------------------------------------------
// ההיקף
// ---------------------------------------------------------------------

{
  const handle = create(options(fakeRepository()));
  const notBuilt = ['session_start', 'session_end', 'log', 'close_stale', 'compute_metrics', 'export']
    .filter((action) => {
      try { handle(envelope(action, { session_id: 'x' }, 'screen-traveler')); return false; } catch { return true; }
    });
  check('שש הפעולות של 4.2 מיושמות', notBuilt, []);
  checkThrows('פעולה שאינה במפה נזרקת', () => handle(envelope('לא קיימת')));
}

checkThrows('בלי Repository אין מודול', () => create({}));

report();
