// Unit של AUTO-01, ה-geofence. נגזר מבדיקת הקבלה של משימה 5 בתוכנית
// שלב 5, ממפה 6.1 (שורות AUTO-01: "דגימה בדיוק 80 מטר: אין אירוע";
// "שני עוגנים בטווח: הקרוב בלבד"), מ-CLAUDE.md סעיף 6 (שלב 5),
// מ-doc-build-03-automation סעיפים 3 ו-6 (45 מול 55 מטר), מ-BL-15,
// מ-BL-19 והכרעה 9, ומ-F-13 תיקון 1 סעיף 3 (מרחק וכיוון לנקודת
// היציאה).
//
//   node tests/unit/geofence.test.js

import { create, direction } from '../../automation/geofence.js';
import { create as createSimulator } from '../../tools/simulator.js';
import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };

const { check, report } = createChecker('AUTO-01 geofence');

const CALLER = modulesFile.modules.find((row) => row.id === 'AUTO-01').caller;

const REFERENCE = {
  geofence_radius_m: 40, exit_margin_m: 10, accuracy_threshold_m: 40, crossing_clear_seconds: 15,
};

// עוגן ייחוס, וממנו מטרים צפונה: מעלה אחת של קו רוחב היא כ-111 קילומטר.
const BASE = { lat: 31.7811, lng: 35.2192 };
const METER_LAT = 1 / 111_320;
const north = (meters) => ({ lat: BASE.lat + meters * METER_LAT, lng: BASE.lng });

const anchor = (id, stopId, at, isCrossing = false) => ({
  anchor_id: `anch-${id}`, item_id: `item-${id}`, stop_id: stopId, lat: at.lat, lng: at.lng,
  verified: true, verified_at: 'T', is_crossing: isCrossing,
});

function fakeClock(start = 0) {
  let value = start;
  const clock = () => value;
  clock.advance = (seconds) => { value += seconds * 1000; };
  return clock;
}

/** ה-Orchestrator המזויף: עונה על שתי הקריאות ל-BE-05 ומתעד כל מעטפה. */
function fakeSend({ anchors = [], exits = [] } = {}) {
  const sent = [];
  const send = async (request) => {
    sent.push(request);
    if (request.module === 'BE-05' && request.action === 'listAnchors') return { ok: true, data: { anchors } };
    if (request.module === 'BE-05' && request.action === 'listExitPoints') return { ok: true, data: { exit_points: exits } };
    if (request.module === 'FE-04') return { ok: true, data: { delivered: null } };
    return { ok: false, error: { code: 'E-MODULE-FAILED' } };
  };
  send.sent = sent;
  send.toDelivery = () => sent.filter((r) => r.module === 'FE-04').map((r) => [r.action, r.payload.stop_id]);
  return send;
}

const repository = (reference = REFERENCE) => ({ getRef: (key) => reference[key] });

async function build({ anchors = [], exits = [], reference, clock = fakeClock() } = {}) {
  const send = fakeSend({ anchors, exits });
  const simulator = createSimulator({ clock });
  const geofence = create({ repository: repository(reference), send, caller: CALLER, location: simulator, clock });
  const started = await geofence.start({ session_id: 'sess-1', site_id: 'site-1' });
  return { geofence, send, simulator, clock, started };
}

// ---------------------------------------------------------------------
// ההפעלה: העוגנים ונקודות היציאה במעטפה, הזרם נפתח
// ---------------------------------------------------------------------

{
  const { started, send, simulator } = await build({ anchors: [anchor(1, 'st-1', BASE)], exits: [{ exit_id: 'x', ...north(300) }] });
  check('start מחזיר את מה שנקרא', started, { ok: true, data: { session_id: 'sess-1', anchors: 1, exit_points: 1, watching: true } });
  check('העוגנים ונקודות היציאה התבקשו במעטפה, בשם הפונה מהנתונים',
    send.sent.map((r) => [r.from, r.module, r.action]),
    [[CALLER, 'BE-05', 'listAnchors'], [CALLER, 'BE-05', 'listExitPoints']]);
  check('מקור הדגימות נפתח', simulator.watching(), true);
}

// ---------------------------------------------------------------------
// דגימה בדיוק 80 מטר: אין אירוע, המונה עולה (CLAUDE.md סעיף 6)
// ---------------------------------------------------------------------

{
  const { geofence, send, simulator } = await build({ anchors: [anchor(1, 'st-1', BASE)] });
  simulator.sampleAt({ lat: BASE.lat, lng: BASE.lng, accuracy_m: 80 });
  await geofence.settled();
  check('דגימה בדיוק 80 מטר על העוגן עצמו: אין arrive', send.toDelivery(), []);
  check('הדגימה נדחתה ונספרה', [geofence.current().rejected, geofence.current().samples], [1, 1]);
  check('אין דגימה תקפה אחרונה', geofence.current().sample, null);

  simulator.sampleAt({ lat: BASE.lat, lng: BASE.lng, accuracy_m: 40 });
  await geofence.settled();
  check('דיוק בגבול הסף עובר: arrive', send.toDelivery(), [['arrive', 'st-1']]);
  check('הדיוק נשלח עם ההגעה', send.sent.at(-1).payload.accuracy, 40);
}

// ---------------------------------------------------------------------
// שני עוגנים בטווח: הקרוב בלבד (מפה 6.1, זרימה א)
// ---------------------------------------------------------------------

{
  const { geofence, send, simulator } = await build({
    anchors: [anchor(1, 'st-far', north(30)), anchor(2, 'st-near', north(15))],
  });
  simulator.sampleAt({ ...BASE, accuracy_m: 5 });
  await geofence.settled();
  check('שני עוגנים במרחק 15 ו-30: arrive לקרוב בלבד', send.toDelivery(), [['arrive', 'st-near']]);
  check('התחנה הנוכחית היא הקרובה', geofence.current().stop_id, 'st-near');
}

// ---------------------------------------------------------------------
// אידמפוטנטיות, יציאה עם שוליים (45 מול 55), וכניסה חוזרת
// ---------------------------------------------------------------------

{
  const { geofence, send, simulator } = await build({ anchors: [anchor(1, 'st-1', BASE)] });

  simulator.sampleAt({ ...BASE, accuracy_m: 5 });
  simulator.sampleAt({ ...north(10), accuracy_m: 5 });
  await geofence.settled();
  check('אותה תחנה בדגימה הבאה: אין מעטפה נוספת', send.toDelivery(), [['arrive', 'st-1']]);

  simulator.sampleAt({ ...north(45), accuracy_m: 5 });
  await geofence.settled();
  check('45 מטר מהתחנה עם שוליים 10: אין leave (45 קטן מ-50)', send.toDelivery(), [['arrive', 'st-1']]);
  check('התחנה הנוכחית נשמרת בטבעת', geofence.current().stop_id, 'st-1');

  simulator.sampleAt({ ...north(55), accuracy_m: 5 });
  await geofence.settled();
  check('55 מטר: leave', send.toDelivery(), [['arrive', 'st-1'], ['leave', 'st-1']]);
  check('leave נושא סשן, מסלול ותחנה', send.sent.at(-1).payload, { session_id: 'sess-1', site_id: 'site-1', stop_id: 'st-1' });
  check('אין תחנה נוכחית אחרי היציאה', geofence.current().stop_id, null);

  simulator.sampleAt({ ...north(100), accuracy_m: 5 });
  await geofence.settled();
  check('הליכה בלי תחנה: אין אירוע', send.toDelivery().length, 2);

  simulator.sampleAt({ ...BASE, accuracy_m: 5 });
  await geofence.settled();
  check('כניסה חוזרת: arrive שוב, ו-FE-04 הוא שמחליט אם להשמיע (הכרעה 12 של שלב 4)',
    send.toDelivery(), [['arrive', 'st-1'], ['leave', 'st-1'], ['arrive', 'st-1']]);
}

// ---------------------------------------------------------------------
// מעבר ישיר בין שתי תחנות שחופפות: arrive לחדשה, בלי leave מהישנה
// ---------------------------------------------------------------------

{
  const { send, simulator, geofence } = await build({
    anchors: [anchor(1, 'st-a', BASE), anchor(2, 'st-b', north(50))],
  });
  simulator.sampleAt({ ...BASE, accuracy_m: 5 });
  simulator.sampleAt({ ...north(35), accuracy_m: 5 });
  await geofence.settled();
  check('הקרובה מתחלפת: arrive לשנייה', send.toDelivery(), [['arrive', 'st-a'], ['arrive', 'st-b']]);
}

// ---------------------------------------------------------------------
// BL-19 והכרעה 9: תחנת חצייה משוחררת אחרי crossing_clear_seconds
// מחוץ לרדיוס, גם בתוך השוליים
// ---------------------------------------------------------------------

{
  const clock = fakeClock();
  const { geofence, send, simulator } = await build({ anchors: [anchor(1, 'st-cross', BASE, true)], clock });

  simulator.sampleAt({ ...BASE, accuracy_m: 5 });
  await geofence.settled();
  check('הגעה לתחנת חצייה: arrive רגיל, ההשתקה היא של FE-04', send.toDelivery(), [['arrive', 'st-cross']]);

  simulator.sampleAt({ ...north(45), accuracy_m: 5 });
  clock.advance(10);
  simulator.sampleAt({ ...north(45), accuracy_m: 5 });
  await geofence.settled();
  check('10 שניות בטבעת: עדיין אין leave', send.toDelivery().length, 1);

  clock.advance(5);
  simulator.sampleAt({ ...north(45), accuracy_m: 5 });
  await geofence.settled();
  check('15 שניות מחוץ לרדיוס: leave, גם בתוך השוליים', send.toDelivery(), [['arrive', 'st-cross'], ['leave', 'st-cross']]);
}

{
  const clock = fakeClock();
  const { geofence, send, simulator } = await build({ anchors: [anchor(1, 'st-cross', BASE, true)], clock });
  simulator.sampleAt({ ...BASE, accuracy_m: 5 });
  simulator.sampleAt({ ...north(45), accuracy_m: 5 });
  clock.advance(10);
  simulator.sampleAt({ ...BASE, accuracy_m: 5 });
  clock.advance(10);
  simulator.sampleAt({ ...north(45), accuracy_m: 5 });
  await geofence.settled();
  check('חזרה לרדיוס מאפסת את הספירה: המשפחה עומדת בצומת, הפריט מוחזק (זרימה א)', send.toDelivery().length, 1);
}

{
  const clock = fakeClock();
  const { geofence, send, simulator } = await build({ anchors: [anchor(1, 'st-plain', BASE, false)], clock });
  simulator.sampleAt({ ...BASE, accuracy_m: 5 });
  simulator.sampleAt({ ...north(45), accuracy_m: 5 });
  clock.advance(30);
  simulator.sampleAt({ ...north(45), accuracy_m: 5 });
  await geofence.settled();
  check('תחנה רגילה בטבעת: הזמן אינו משחרר, רק המרחק', send.toDelivery().length, 1);
}

// ---------------------------------------------------------------------
// נקודת היציאה הקרובה: מרחק וכיוון (F-13 תיקון 1)
// ---------------------------------------------------------------------

{
  const { geofence, simulator } = await build({
    anchors: [anchor(1, 'st-1', BASE)],
    exits: [
      { exit_id: 'far', name: 'רחוקה', ...north(900) },
      { exit_id: 'near', name: 'קרובה', ...north(300) },
    ],
  });
  check('לפני דגימה אין נקודת יציאה', geofence.nearestExit(), null);
  simulator.sampleAt({ ...BASE, accuracy_m: 5 });
  await geofence.settled();
  const exit = geofence.nearestExit();
  check('הקרובה נבחרת', exit.exit_point.exit_id, 'near');
  check('המרחק במטרים, מעוגל', exit.distance_m, 300);
  check('הכיוון כרוח שמיים', exit.direction, 'צפון');
}

check('כיוון: מזרח', direction(BASE, { lat: BASE.lat, lng: BASE.lng + 0.01 }), 'מזרח');
check('כיוון: דרום מערב', direction(BASE, { lat: BASE.lat - 0.01, lng: BASE.lng - 0.0118 }), 'דרום מערב');

// ---------------------------------------------------------------------
// ערך חסר בטבלת ה-reference: E-REF-EMPTY, בלי הפעלה
// ---------------------------------------------------------------------

{
  const { started } = await build({ reference: { geofence_radius_m: 40, exit_margin_m: 10, accuracy_threshold_m: 40 } });
  check('crossing_clear_seconds חסר: E-REF-EMPTY עם שם המפתח', [started.error.code, started.error.data.key], ['E-REF-EMPTY', 'crossing_clear_seconds']);
}

// ---------------------------------------------------------------------
// stop: הזרם נסגר והזיכרון נמחק
// ---------------------------------------------------------------------

{
  const { geofence, simulator, send } = await build({ anchors: [anchor(1, 'st-1', BASE)] });
  simulator.sampleAt({ ...BASE, accuracy_m: 5 });
  await geofence.settled();
  check('stop: נעצר', geofence.stop(), { ok: true, data: { stopped: true } });
  check('הזרם נסגר', simulator.watching(), false);
  simulator.sampleAt({ ...north(100), accuracy_m: 5 });
  await geofence.settled();
  check('אחרי stop אין leave ואין arrive', send.toDelivery(), [['arrive', 'st-1']]);
  check('הזיכרון קצר הטווח נמחק', [geofence.current().stop_id, geofence.current().sample], [null, null]);
}

// ---------------------------------------------------------------------
// בלי מקור דגימות: E-LOCATION-NOT-ALLOWED
// ---------------------------------------------------------------------

{
  const geofence = create({ repository: repository(), send: fakeSend(), caller: CALLER });
  const started = await geofence.start({ session_id: 's', site_id: 'x' });
  check('בלי מקור: E-LOCATION-NOT-ALLOWED', [started.ok, started.error.code], [false, 'E-LOCATION-NOT-ALLOWED']);
}

report();
