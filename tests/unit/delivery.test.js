// Unit של FE-04, Delivery and Dosage. נגזר מבדיקת הקבלה של משימה 8
// בתוכנית שלב 4, מ-usecase-f-01-f-03 (צעדים 5 עד 11 וזרימות א, ג,
// ז), מ-usecase-f-13 (צעדים 3 עד 6 וזרימות א, ג), מ-BL-19, ומשורות
// FE-04 במפה 6.1 ("הגעה לעוגן עם is_crossing = true: אין מסירה,
// הפריט מוחזק"; "שתי הגעות בהפרש 5 שניות: השנייה מוחזקת 15 שניות").
//
//   node tests/unit/delivery.test.js

import { create } from '../../services/delivery.js';
import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };

const { check, checkThrows, report } = createChecker('FE-04 delivery');

const CALLER = modulesFile.modules.find((row) => row.id === 'FE-04').caller;

const REFERENCE = { delivery_gap_s: 20, pushed_item_max_words: 150 };

const item = (id, stopId, text = 'טקסט הפריט של הנקודה.') => ({
  item_id: id, site_id: 's-1', stop_id: stopId, status: 'approved',
  source_id: 'src-1', page: 3, audience: 'כולם', name: id, text,
});

const anchor = (itemId, isCrossing = false) => ({
  anchor_id: `anch-${itemId}`, item_id: itemId, lat: 31.781, lng: 35.219,
  verified: true, verified_at: 'T', is_crossing: isCrossing,
});

// שעון מוזרק: "חמש שניות אחרי" נבדק בלי להמתין חמש שניות.
function fakeClock(start = 0) {
  let value = start;
  const clock = () => value;
  clock.advance = (seconds) => { value += seconds * 1000; };
  return clock;
}

/**
 * ה-Orchestrator המזויף. הוא עונה על listApprovedByStop לפי מפה של
 * תחנות, ומתעד כל מעטפה, ולכן נראה מבחוץ ש-FE-04 אינו נוגע
 * בישויות בעצמו.
 */
function fakeSend({ stops = {}, anchors = [], logOk = true } = {}) {
  const sent = [];
  const send = async (request) => {
    sent.push(request);
    if (request.module === 'BE-05' && request.action === 'listApprovedByStop') {
      const items = stops[request.payload.stop_id] ?? [];
      return {
        ok: true,
        data: { items, anchors: anchors.filter((row) => items.some((i) => i.item_id === row.item_id)) },
      };
    }
    if (request.module === 'BE-07') return logOk ? { ok: true, data: {} } : { ok: false, error: {} };
    return { ok: false, error: { code: 'E-MODULE-FAILED' } };
  };
  send.sent = sent;
  return send;
}

const repository = (reference = REFERENCE) => ({ getRef: (key) => reference[key] });

function build({ stops, anchors, clock = fakeClock(), reference, logOk } = {}) {
  const send = fakeSend({ stops, anchors, logOk });
  const handle = create({ repository: repository(reference), send, caller: CALLER, clock });
  const call = (action, payload) => handle({
    from: 'module-geofence', module: 'FE-04', action, payload, lang: 'he',
  });
  return { handle, send, call, clock };
}

const SESSION = 'sess-1';

// ---------------------------------------------------------------------
// המסירה הרגילה, usecase-f-01-f-03 צעדים 5 עד 10
// ---------------------------------------------------------------------

{
  const { call, send } = build({
    stops: { 'st-1': [item('i-1', 'st-1')] },
    anchors: [anchor('i-1')],
  });
  const response = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1', accuracy: 12 });

  check('ההגעה מוצלחת', response.ok, true);
  check('הפריט נמסר', response.data.delivered.item_id, 'i-1');
  check('ואין פריט מוחזק', response.data.held, null);
  check('ולא חרג מהמכסה', response.data.over_limit, false);

  check('הפריטים נקראו דרך BE-05', send.sent[0].module, 'BE-05');
  check('בפעולה listApprovedByStop', send.sent[0].action, 'listApprovedByStop');
  check('בשם הפונה שבטבלת המודולים', send.sent[0].from, CALLER);
  check('והשם הזה הוא module-delivery', CALLER, 'module-delivery');

  const log = send.sent[1];
  check('נשלחה שורת יומן ל-BE-07', log.module, 'BE-07');
  check('מסוג pushed', log.payload.type, 'pushed');
  check('עם הנקודה והפריט', [log.payload.stop_id, log.payload.item_id], ['st-1', 'i-1']);
  check('ועם דיוק המיקום בעת הכניסה', log.payload.accuracy, 12);
}

// ---------------------------------------------------------------------
// בדיקת הקבלה של השלב: שתי הגעות בהפרש 5 שניות
// ---------------------------------------------------------------------

{
  const clock = fakeClock();
  const { call } = build({
    stops: { 'st-1': [item('i-1', 'st-1')], 'st-2': [item('i-2', 'st-2')] },
    anchors: [anchor('i-1'), anchor('i-2')],
    clock,
  });

  const first = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  check('הראשונה נמסרת מיד', first.data.delivered.item_id, 'i-1');

  clock.advance(5);
  const second = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-2' });

  check('השנייה אינה נמסרת', second.data.delivered, null);
  check('אלא מוחזקת', second.data.held.item_id, 'i-2');
  check('**והיא מוחזקת 15 שניות**', second.data.hold_for_s, 15);
  check('וטיימר נדרך', second.data.timer_armed, true);
  check('והסיבה היא המינון', second.data.reason, 'gap');
}

{
  // אותה הגעה אחרי שהמרווח חלף: נמסרת מיד.
  const clock = fakeClock();
  const { call } = build({
    stops: { 'st-1': [item('i-1', 'st-1')], 'st-2': [item('i-2', 'st-2')] },
    anchors: [anchor('i-1'), anchor('i-2')],
    clock,
  });
  await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  clock.advance(21);
  const second = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-2' });
  check('אחרי המרווח הפריט נמסר מיד', second.data.delivered.item_id, 'i-2');
}

{
  // הסף נקרא מטבלת ה-reference ולא מהקוד.
  const clock = fakeClock();
  const { call } = build({
    stops: { 'st-1': [item('i-1', 'st-1')], 'st-2': [item('i-2', 'st-2')] },
    anchors: [anchor('i-1'), anchor('i-2')],
    clock,
    reference: { ...REFERENCE, delivery_gap_s: 60 },
  });
  await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  clock.advance(5);
  const second = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-2' });
  check('מרווח אחר בטבלה משנה את ההחזקה', second.data.hold_for_s, 55);
}

// ---------------------------------------------------------------------
// release: מפעיל הזמן, usecase-f-01-f-03 צעד 7
// ---------------------------------------------------------------------

{
  const clock = fakeClock();
  const { call, handle } = build({
    stops: { 'st-1': [item('i-1', 'st-1')], 'st-2': [item('i-2', 'st-2')] },
    anchors: [anchor('i-1'), anchor('i-2')],
    clock,
  });
  await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  clock.advance(5);
  await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-2' });

  const early = await call('release', { session_id: SESSION });
  check('release לפני שהמרווח חלף אינו מוסר', early.data.delivered, null);
  check('והפריט נשאר מוחזק', early.data.held.item_id, 'i-2');
  check('ונותרו 15 שניות', early.data.hold_for_s, 15);

  clock.advance(15);
  const released = await call('release', { session_id: SESSION });
  check('release אחרי המרווח מוסר', released.data.delivered.item_id, 'i-2');
  check('ואין יותר פריט מוחזק', handle.stateOf(SESSION).held, null);
}

{
  const { call } = build({ stops: {}, anchors: [] });
  const response = await call('release', { session_id: SESSION });
  check('release בלי פריט מוחזק אינו עושה דבר', response.data.reason, 'nothing_held');
}

// ---------------------------------------------------------------------
// BL-19: is_crossing, לפני בדיקת המינון
// ---------------------------------------------------------------------

{
  const { call, send, handle } = build({
    stops: { 'st-cross': [item('i-cross', 'st-cross')] },
    anchors: [anchor('i-cross', true)],
  });
  const response = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-cross' });

  check('אין מסירה', response.data.delivered, null);
  check('הפריט מוחזק', response.data.held.item_id, 'i-cross');
  check('הסיבה היא חצייה', response.data.held.reason, 'crossing');
  check('**ואין טיימר דרוך**', response.data.timer_armed, false);
  check('ולא נשלחה שורת יומן על מסירה',
    send.sent.some((request) => request.payload?.type === 'pushed'), false);
  check('והמצב נשמר', handle.stateOf(SESSION).held.reason, 'crossing');
}

{
  // הבדיקה קודמת למינון: גם כשהמרווח כבר חלף, עוגן חצייה מחזיק.
  const clock = fakeClock();
  const { call } = build({
    stops: { 'st-1': [item('i-1', 'st-1')], 'st-cross': [item('i-cross', 'st-cross')] },
    anchors: [anchor('i-1'), anchor('i-cross', true)],
    clock,
  });
  await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  clock.advance(60);
  const response = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-cross' });
  check('החצייה גוברת על המינון', response.data.reason, 'crossing');
  check('ואין מסירה', response.data.delivered, null);
}

// usecase-f-13 זרימה א: השחרור נמדד לפי מיקום ולא לפי זמן.
{
  const clock = fakeClock();
  const { call } = build({
    stops: { 'st-cross': [item('i-cross', 'st-cross')] },
    anchors: [anchor('i-cross', true)],
    clock,
  });
  await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-cross' });
  clock.advance(120);
  const response = await call('release', { session_id: SESSION });
  check('שתי דקות בצומת אינן משחררות', response.data.delivered, null);
  check('והפריט נשאר מוחזק', response.data.held.reason, 'crossing');
}

// usecase-f-13 צעדים 5 ו-6, וזרימה ג: leave הוא האירוע המשחרר.
{
  const { call, handle } = build({
    stops: { 'st-cross': [item('i-cross', 'st-cross')] },
    anchors: [anchor('i-cross', true)],
  });
  await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-cross' });
  const response = await call('leave', { session_id: SESSION, site_id: 's-1', stop_id: 'st-cross' });

  check('היציאה מהחצייה משחררת', response.data.released, true);
  check('והפריט נמסר', response.data.delivered.item_id, 'i-cross');
  check('ואין יותר מוחזק', handle.stateOf(SESSION).held, null);
}

// ---------------------------------------------------------------------
// leave: פריט שהוחזק בגלל מינון נזנח (הכרעה 12)
// ---------------------------------------------------------------------

{
  const clock = fakeClock();
  const { call, handle } = build({
    stops: { 'st-1': [item('i-1', 'st-1')], 'st-2': [item('i-2', 'st-2')] },
    anchors: [anchor('i-1'), anchor('i-2')],
    clock,
  });
  await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  clock.advance(5);
  await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-2' });

  const response = await call('leave', { session_id: SESSION, site_id: 's-1', stop_id: 'st-2' });
  check('הפריט המוחזק נזנח', response.data.abandoned, 'i-2');
  check('ולא נמסר', response.data.delivered, null);
  check('והמצב התנקה', handle.stateOf(SESSION).held, null);
}

{
  const { call } = build({ stops: {}, anchors: [] });
  const response = await call('leave', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  check('leave בלי פריט מוחזק אינו עושה דבר', response.data.released, false);
}

// ---------------------------------------------------------------------
// צעד 6 והכרעה 13: תחנה בלי פריט מאושר, שתיקה
// ---------------------------------------------------------------------

{
  const { call, send } = build({ stops: { 'st-empty': [] }, anchors: [] });
  const response = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-empty', accuracy: 9 });

  check('אין מסירה', response.data.delivered, null);
  check('והמערכת שותקת', response.data.silent, true);
  check('ולא מחפשת פריט קרוב אחר', response.data.held, null);

  const log = send.sent[1];
  check('נרשמה הגעה בלי תוכן', log.payload.type, 'arrived_no_content');
  check('עם התחנה', log.payload.stop_id, 'st-empty');
  check('ובלי פריט', log.payload.item_id, undefined);
}

// ---------------------------------------------------------------------
// צעד 9: פריט שני של אותה נקודה, אחרי מרווח המינון
// ---------------------------------------------------------------------

{
  const clock = fakeClock();
  const { call } = build({
    stops: { 'st-1': [item('i-1', 'st-1'), item('i-2', 'st-1')] },
    anchors: [anchor('i-1'), anchor('i-2')],
    clock,
  });

  const first = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  check('הפריט הראשון נמסר', first.data.delivered.item_id, 'i-1');
  check('והשני נכנס להחזקה', first.data.held.item_id, 'i-2');

  clock.advance(20);
  const second = await call('release', { session_id: SESSION });
  check('ואחרי המרווח הוא נמסר', second.data.delivered.item_id, 'i-2');
  check('ואין שלישי', second.data.held, null);
}

// זרימה ז והכרעה 12: כניסה חוזרת אינה משמיעה שוב.
{
  const clock = fakeClock();
  const { call } = build({
    stops: { 'st-1': [item('i-1', 'st-1')] },
    anchors: [anchor('i-1')],
    clock,
  });
  await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  await call('leave', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  clock.advance(60);
  const again = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });

  check('כניסה חוזרת שותקת', again.data.silent, true);
  check('והסיבה מדווחת', again.data.reason, 'already_delivered');
  check('ואין מסירה', again.data.delivered, null);
}

// ---------------------------------------------------------------------
// הכרעה 14: פריט שחורג מהמכסה נמסר במלואו, והחריגה מדווחת
// ---------------------------------------------------------------------

{
  const long = item('i-long', 'st-1', 'מילה '.repeat(200).trim());
  const { call } = build({
    stops: { 'st-1': [long] },
    anchors: [anchor('i-long')],
  });
  const response = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });

  check('הפריט נמסר במלואו', response.data.delivered.text, long.text);
  check('ומספר המילים מדווח', response.data.words, 200);
  check('והחריגה מדווחת', response.data.over_limit, true);
}

// ---------------------------------------------------------------------
// שני סשנים אינם מתערבבים
// ---------------------------------------------------------------------

{
  const clock = fakeClock();
  const { call, handle } = build({
    stops: { 'st-1': [item('i-1', 'st-1')], 'st-2': [item('i-2', 'st-2')] },
    anchors: [anchor('i-1'), anchor('i-2')],
    clock,
  });
  await call('arrive', { session_id: 'sess-a', site_id: 's-1', stop_id: 'st-1' });
  clock.advance(5);
  const other = await call('arrive', { session_id: 'sess-b', site_id: 's-1', stop_id: 'st-2' });

  check('סשן אחר אינו מוחזק בגלל המסירה של הראשון', other.data.delivered.item_id, 'i-2');
  check('ולכל סשן מצב משלו', handle.stateOf('sess-a').current_stop, 'st-1');
  check('ובאמת שניים', handle.stateOf('sess-b').current_stop, 'st-2');
  check('סשן שלא נראה מעולם מחזיר null', handle.stateOf('sess-none'), null);
}

// ---------------------------------------------------------------------
// חוק ברזל 5, BL-10, ומה שהמודול אינו עושה
// ---------------------------------------------------------------------

{
  for (const key of ['delivery_gap_s', 'pushed_item_max_words']) {
    const reference = { ...REFERENCE, [key]: null };
    const { call } = build({ stops: { 'st-1': [item('i-1', 'st-1')] }, anchors: [anchor('i-1')], reference });
    const response = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
    check(`${key} ריק מחזיר E-REF-EMPTY`, response.error.code, 'E-REF-EMPTY');
    check(`ו-error.data נושא את שם ההגדרה ${key}`, response.error.data.key, key);
  }
}

{
  const { call } = build({
    stops: { 'st-1': [item('i-1', 'st-1')] }, anchors: [anchor('i-1')], logOk: false,
  });
  const response = await call('arrive', { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' });
  check('כשל יומן אינו מונע את המסירה', response.data.delivered.item_id, 'i-1');
  check('והכשל מדווח', response.data.logged, false);
}

{
  // BE-05 מחזיר שגיאה: FE-04 אינו ממציא תוכן ואינו מוסר דבר.
  const send = async () => ({ ok: false, error: { code: 'E-MODULE-FAILED' } });
  const handle = create({ repository: repository(), send, caller: CALLER, clock: fakeClock() });
  const response = await handle({
    from: 'module-geofence', module: 'FE-04', action: 'arrive',
    payload: { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' }, lang: 'he',
  });
  check('כשל BE-05 עובר כפי שהוא', response.error.code, 'E-MODULE-FAILED');
}

{
  // מפה 3.2, שורת FE-04: "כותב: אין (שולח log)".
  const writing = repository();
  for (const name of ['appendInteraction', 'setStatus', 'appendItem', 'updateItem']) {
    writing[name] = () => { throw new Error(`FE-04 כתב ב-${name}`); };
  }
  const handle = create({
    repository: writing,
    send: fakeSend({ stops: { 'st-1': [item('i-1', 'st-1')] }, anchors: [anchor('i-1')] }),
    caller: CALLER,
    clock: fakeClock(),
  });
  const response = await handle({
    from: 'module-geofence', module: 'FE-04', action: 'arrive',
    payload: { session_id: SESSION, site_id: 's-1', stop_id: 'st-1' }, lang: 'he',
  });
  check('המסירה אינה כותבת דבר', response.ok, true);
}

checkThrows('בלי Repository אין מודול', () => create({}));

{
  const { handle } = build({ stops: {}, anchors: [] });
  checkThrows('פעולה שאינה במפה נזרקת', () => handle({
    from: 'module-geofence', module: 'FE-04', action: 'לא קיימת', payload: {}, lang: 'he',
  }));
  const notBuilt = ['arrive', 'leave', 'release'].filter((action) => {
    try { handle({ from: 'module-geofence', module: 'FE-04', action, payload: { session_id: SESSION }, lang: 'he' }); return false; } catch { return true; }
  });
  check('שלוש הפעולות של 4.2 מיושמות', notBuilt, []);
}

report();
