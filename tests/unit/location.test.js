// Unit של CONN-03, מתאם המיקום, ושל TOOL-01, הסימולטור שעונה לאותו
// חוזה. נגזר מבדיקת הקבלה של משימות 3 ו-4 בתוכנית שלב 5,
// מ-doc-build-03-interfaces סעיפים 3.3 ו-6 ("הרשאה נדחתה:
// E-LOCATION-NOT-ALLOWED"), מ-usecase-f-01-f-03 צעד 1 וזרימה ד,
// וממבחן ההחלפה של usecase-f-01-f-03 סעיף 8 ("כל מקור הוא Adapter
// שמוסר דגימות באותה צורה").
//
//   node tests/unit/location.test.js

import { create as createLocation } from '../../connectors/location.js';
import { create as createSimulator, routeOrder } from '../../tools/simulator.js';
import corpus from '../../data/corpus/jaffa-01.json' with { type: 'json' };
import { fakeGeolocation, flush } from '../helpers/device.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('CONN-03 location ו-TOOL-01 simulator');

const REFERENCE = { location_sample_interval_s: 5 };
const SAMPLE_FIELDS = ['lat', 'lng', 'accuracy_m', 'time'];

function fakeClock(start = 1_000_000) {
  let value = start;
  const clock = () => value;
  clock.advance = (seconds) => { value += seconds * 1000; };
  return clock;
}

// ---------------------------------------------------------------------
// CONN-03: הזרם, הצורה האחת, והקצב מטבלת ה-reference
// ---------------------------------------------------------------------

{
  const device = fakeGeolocation();
  const clock = fakeClock();
  const location = createLocation({ geolocation: device, reference: REFERENCE, clock });
  const samples = [];
  const errors = [];

  check('המכשיר זמין', location.available(), true);
  const started = location.start({ onSample: (s) => samples.push(s), onError: (e) => errors.push(e) });
  check('start פותח את הזרם', started, { ok: true, data: { watching: true, interval_s: 5 } });
  check('המכשיר מתבקש בדיוק גבוה ובגיל מרבי לפי המרווח', device.options[0], { enableHighAccuracy: true, maximumAge: 5000 });

  device.emit({ lat: 31.78, lng: 35.22, accuracy: 12, time: 1_000_000 });
  check('דגימה יוצאת בארבעת השדות של החוזה', Object.keys(samples[0]), SAMPLE_FIELDS);
  check('הערכים מתורגמים מהמכשיר', [samples[0].lat, samples[0].lng, samples[0].accuracy_m], [31.78, 35.22, 12]);
  check('הזמן הוא חותמת ISO', samples[0].time, new Date(1_000_000).toISOString());

  clock.advance(2);
  device.emit({ lat: 31.7801, lng: 35.22 });
  check('דגימה אחרי 2 שניות נבלעת: הקצב הוא 5', samples.length, 1);

  clock.advance(3);
  device.emit({ lat: 31.7802, lng: 35.22 });
  check('דגימה אחרי 5 שניות עוברת', samples.length, 2);

  device.fail(2);
  check('שגיאה זמנית של המכשיר אינה כשל, והזרם נשאר פתוח', [errors.length, location.watching()], [0, true]);

  check('stop סוגר את הזרם', location.stop(), { ok: true, data: { stopped: true } });
  check('המכשיר שוחרר', device.watching(), 0);
  clock.advance(10);
  device.emit({ lat: 31.79, lng: 35.23 });
  check('אחרי stop אין דגימה', samples.length, 2);
  check('stop שני: אישור בלי כשל', location.stop(), { ok: true, data: { stopped: false } });
}

// --- הרשאה נדחתה: E-LOCATION-NOT-ALLOWED פעם אחת, והזרם אינו נפתח ---

{
  const device = fakeGeolocation({ denied: true });
  const location = createLocation({ geolocation: device, reference: REFERENCE });
  const errors = [];
  const samples = [];
  location.start({ onSample: (s) => samples.push(s), onError: (e) => errors.push(e) });
  await flush();
  check('הרשאה נדחתה: E-LOCATION-NOT-ALLOWED', errors.map((e) => e.error.code), ['E-LOCATION-NOT-ALLOWED']);
  check('הזרם נסגר', [location.watching(), device.watching()], [false, 0]);
  device.emit({ lat: 31.78, lng: 35.22 });
  check('אין דגימה אחרי סירוב', samples.length, 0);
}

// --- מכשיר בלי מיקום כלל: אותו קוד, מיד ---

{
  const location = createLocation({ reference: REFERENCE });
  check('בלי מכשיר: לא זמין', location.available(), false);
  const started = location.start({});
  check('בלי מכשיר: E-LOCATION-NOT-ALLOWED מיד', [started.ok, started.error.code], [false, 'E-LOCATION-NOT-ALLOWED']);
}

// --- המרווח מטבלת ה-reference, ואינו מומצא ---

{
  const location = createLocation({ geolocation: fakeGeolocation(), reference: {} });
  const started = location.start({});
  check('מרווח חסר: E-REF-EMPTY עם שם המפתח', [started.error.code, started.error.data.key], ['E-REF-EMPTY', 'location_sample_interval_s']);
}

// ---------------------------------------------------------------------
// TOOL-01: אותו חוזה, ומה שמוסיף הכלי
// ---------------------------------------------------------------------

{
  const clock = fakeClock();
  const simulator = createSimulator({ clock });
  const samples = [];

  check('start באותה צורה', simulator.start({ onSample: (s) => samples.push(s) }), { ok: true, data: { watching: true, simulator: true } });
  simulator.load([
    { stop_id: 'st-1', lat: 31.7811, lng: 35.2190, name: 'ראשונה' },
    { stop_id: 'st-2', lat: 31.7830, lng: 35.2210, name: 'שנייה' },
  ]);
  check('המסלול נטען', simulator.route().length, 2);

  simulator.arriveAt('st-1');
  check('הגעה: דגימה בארבעת השדות של החוזה', Object.keys(samples[0]), SAMPLE_FIELDS);
  check('הדגימה בקואורדינטות של הנקודה, בדיוק טוב', [samples[0].lat, samples[0].lng, samples[0].accuracy_m], [31.7811, 35.2190, 5]);

  simulator.arriveAt(1, { accuracy_m: 80 });
  check('הגעה לפי אינדקס, בדיוק שנקבע: 80 מטר', [samples[1].lat, samples[1].accuracy_m], [31.7830, 80]);

  simulator.walkOn();
  const away = samples[2];
  check('המשך ללכת: הרחק מהנקודה האחרונה', away.lat > 31.7830 && away.lng > 35.2210, true);

  check('נקודה שאינה במסלול: אינה דגימה ואינה קוד שגיאה', simulator.arriveAt('אין'), { ok: false, error: null, reason: 'unknown_point' });
  check('הסימולטור זוכר את המיקום האחרון', simulator.position().lat, away.lat);

  simulator.stop();
  simulator.arriveAt('st-1');
  check('אחרי stop הדגימה נרשמת אך אינה נמסרת', [samples.length, simulator.emitted().length], [3, 4]);
}

// ---------------------------------------------------------------------
// TOOL-01: סדר הסיור. הלחצנים בפאנל מצב הבדיקה ממוספרים לפי סדר
// המסלול, ולא לפי סדר המזהים (במסד הענן המזהים אקראיים, ולחצן 5
// היה "רחבת שער יפו"). המקור: סדר התחנות של המסלול, והעמודים של
// החוברת (source-maslulimisrael-reference), כפי שהם בקורפוס.
// ---------------------------------------------------------------------

{
  const points = corpus.items.map((row) => ({
    item_id: row.item_id, stop_id: row.stop_id, page: row.page, lat: row.lat, lng: row.lng, name: row.name,
  }));
  const expected = points.map((point) => point.item_id);

  // ערבוב קבוע, כדי שהבדיקה לא תעבור במקרה: הפוך, ואז זוגיים לפני אי זוגיים.
  const reversed = [...points].reverse();
  const shuffled = [...reversed.filter((_, i) => i % 2 === 0), ...reversed.filter((_, i) => i % 2 === 1)];
  check('הקלט אכן מעורבב', shuffled.map((p) => p.item_id).join() === expected.join(), false);

  const ordered = routeOrder(shuffled, corpus.site.stops).map((point) => point.item_id);
  check('19 הנקודות בסדר הסיור של החוברת, J-01 עד J-19', ordered, expected);
  check('הנקודה הראשונה היא חניון ממילא, והשנייה תחילת הסיור בשער יפו', ordered.slice(0, 2), ['J-01', 'J-02']);
  check('שתי נקודות באותה תחנה ובאותו עמוד (J-17, J-18): הקרובה לתחילת המסלול קודמת',
    ordered.indexOf('J-17') < ordered.indexOf('J-18'), true);

  const simulator = createSimulator({ clock: fakeClock() });
  simulator.load(shuffled, { stops: corpus.site.stops });
  check('load עם stops טוען בסדר הסיור', simulator.route().map((point) => point.item_id), expected);
  simulator.load(shuffled);
  check('load בלי stops שומר את הסדר שנמסר', simulator.route().map((point) => point.item_id), shuffled.map((p) => p.item_id));
  check('תחנה שאינה במסלול: בסוף, ולא נזרקת',
    routeOrder([{ stop_id: 'x', page: 1, lat: 0, lng: 0 }, points[0]], corpus.site.stops).map((p) => p.item_id ?? p.stop_id),
    ['J-01', 'x']);
}

report();
