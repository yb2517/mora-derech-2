// Unit של CONN-02, מתאם הקול היוצא. נגזר מבדיקת הקבלה של משימה 1
// בתוכנית שלב 5, ממפה 6.1 (שורת CONN-02: "מכשיר בלי קול עברי:
// E-NO-HEBREW-VOICE"), מ-usecase-f-02 סעיף 4 (שלושת כללי החוזה)
// וסעיף 9 ("פריט של 400 מילים: בלי הפסקה נשמעת בין קטעים"),
// מ-doc-build-03-interfaces סעיף 6, ומתוכנית שלב 5 סעיף 8.
//
//   node tests/unit/tts.test.js

import { create, sentences } from '../../connectors/tts.js';
import { fakeSpeechEngine, flush } from '../helpers/device.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('CONN-02 tts');

const REFERENCE = { voice_id: 'he', voice_rate: 0.95 };
const HEBREW = { name: 'Carmit', lang: 'he-IL' };
const ENGLISH = { name: 'Samantha', lang: 'en-US' };

function fakeClock(start = 0) {
  let value = start;
  const clock = () => value;
  clock.advance = (seconds) => { value += seconds * 1000; };
  return clock;
}

// לוח זמנים מיידי: ההשהיה אחרי ביטול נרשמת ואינה מעכבת את הבדיקה.
// ההמתנה לרשימת הקולות (שנייה) אינה מופעלת: הבדיקה מודיעה על
// הקולות בעצמה, ובודקת שהמתאם המתין.
function immediateSchedule() {
  const calls = [];
  return {
    calls,
    setTimeout: (fn, ms) => { calls.push(ms); if (ms < 1000) queueMicrotask(fn); return calls.length; },
  };
}

function build({ voices = [HEBREW], reference = REFERENCE, utteranceMs = 0, engine: given } = {}) {
  const clock = fakeClock();
  const device = given ?? fakeSpeechEngine({ voices, utteranceMs, clock });
  const schedule = immediateSchedule();
  const events = [];
  const tts = create({ engine: device.engine, Utterance: device.Utterance, reference, clock, schedule });
  for (const name of ['start', 'end', 'unavailable']) tts.on(name, (detail) => events.push({ name, ...detail }));
  return { tts, device, events, clock, schedule };
}

const LONG = Array.from({ length: 40 }, (_, i) => `משפט מספר ${i + 1} בפריט ארוך שנמסר בקול עברי ברצף אחד בלי הפסקה.`).join(' ');

// ---------------------------------------------------------------------
// חלוקה לקטעים בגבול משפט
// ---------------------------------------------------------------------

check('שלושה משפטים הם שלושה קטעים', sentences('שלום. מה שלומך? טוב!').length, 3);
check('שורה חדשה היא גבול', sentences('ראשון\nשני').length, 2);
check('טקסט ריק הוא אפס קטעים', sentences('   '), []);
check('משפט ארוך בלי סימן פיסוק נשאר קטע אחד', sentences('מילה '.repeat(90).trim()).length, 1);

// ---------------------------------------------------------------------
// מכשיר בלי קול עברי: E-NO-HEBREW-VOICE, ואירוע הטקסט למסך (מפה 6.1)
// ---------------------------------------------------------------------

{
  const { tts, device, events } = build({ voices: [ENGLISH] });
  const response = await tts.speak('שלום לכולם.');
  check('בלי קול עברי: E-NO-HEBREW-VOICE', [response.ok, response.error.code], [false, 'E-NO-HEBREW-VOICE']);
  check('המנוע לא קיבל דבר: לא מקריאים בקול זר', device.spoken.length, 0);
  check('אירוע unavailable עם הטקסט, כדי שהמסך יציג', events, [{ name: 'unavailable', text: 'שלום לכולם.' }]);
  check('hasVoice מדווח שאין', tts.hasVoice(), false);
}

// ---------------------------------------------------------------------
// בלי מנוע כלל: אותו קוד, אותו אירוע
// ---------------------------------------------------------------------

{
  const events = [];
  const tts = create({ reference: REFERENCE });
  tts.on('unavailable', (d) => events.push(d));
  const response = await tts.speak('טקסט');
  check('בלי מנוע: E-NO-HEBREW-VOICE', [response.ok, response.error.code], [false, 'E-NO-HEBREW-VOICE']);
  check('בלי מנוע: אירוע הטקסט', events, [{ text: 'טקסט' }]);
  check('בלי מנוע: available שקר', tts.available(), false);
}

// ---------------------------------------------------------------------
// ערך חסר בטבלת ה-reference: E-REF-EMPTY, בלי פנייה למנוע
// ---------------------------------------------------------------------

{
  const { tts, device } = build({ reference: { voice_id: null, voice_rate: 0.95 } });
  const response = await tts.speak('שלום.');
  check('voice_id ריק: E-REF-EMPTY עם שם המפתח', [response.error.code, response.error.data.key], ['E-REF-EMPTY', 'voice_id']);
  check('המנוע לא נגע', device.spoken.length, 0);
}
{
  const { tts } = build({ reference: { voice_id: 'he' } });
  const response = await tts.speak('שלום.');
  check('voice_rate חסר: E-REF-EMPTY', [response.error.code, response.error.data.key], ['E-REF-EMPTY', 'voice_rate']);
}

// ---------------------------------------------------------------------
// 400 מילים: אירוע סיום אחד, כל הקטעים ברצף, בקול העברי ובקצב מהטבלה
// ---------------------------------------------------------------------

{
  const { tts, device, events } = build({ voices: [ENGLISH, HEBREW], utteranceMs: 1500 });
  const words = LONG.split(/\s+/).length;
  check('הטקסט ארוך דיו', words >= 400, true);

  const response = await tts.speak(LONG);
  const parts = sentences(LONG);

  check('ההשמעה הסתיימה בשלום', response.ok, true);
  check('כל הקטעים נמסרו למנוע, בסדר', device.spoken.map((u) => u.text), parts);
  check('הקול העברי נבחר במפורש, ולא הראשון ברשימה', [...new Set(device.spoken.map((u) => u.voice))], ['Carmit']);
  check('שפת ההיגד היא שפת הקול', [...new Set(device.spoken.map((u) => u.lang))], ['he-IL']);
  check('הקצב מטבלת ה-reference', [...new Set(device.spoken.map((u) => u.rate))], [0.95]);
  check('אירוע התחלה אחד ואירוע סיום אחד', events.map((e) => e.name), ['start', 'end']);
  check('המשך הוא סכום הקטעים', response.data.duration_ms, parts.length * 1500);
  check('הסיום אינו קטיעה', [response.data.interrupted, events[1].interrupted], [false, false]);
  check('מספר הקטעים מדווח', response.data.chunks, parts.length);
}

// ---------------------------------------------------------------------
// כלל 3: אחרי ביטול, השהיה לפני ההשמעה הבאה
// ---------------------------------------------------------------------

{
  const { tts, device, schedule, events } = build();
  const first = tts.speak('ראשון. שני. שלישי.');
  await flush(1);
  check('הקטע הראשון יצא', device.spoken.length >= 1, true);

  const second = tts.speak('חדש.');
  const firstResponse = await first;
  check('ההשמעה הראשונה נסגרה כקטיעה', firstResponse.data.interrupted, true);
  check('ההשהיה אחרי הביטול נדרכה, 150 אלפיות שנייה', schedule.calls.includes(150), true);

  const secondResponse = await second;
  check('השנייה הסתיימה בשלום', [secondResponse.ok, secondResponse.data.interrupted], [true, false]);
  check('הקטע האחרון שהמנוע קיבל הוא של ההשמעה השנייה', device.spoken.at(-1).text, 'חדש.');
  check('אירועי הסיום: קטיעה ואז סיום', events.filter((e) => e.name === 'end').map((e) => e.interrupted), [true, false]);
}

// ---------------------------------------------------------------------
// stop: עצירה מפורשת, ואישור בלי כשל
// ---------------------------------------------------------------------

{
  const { tts, device } = build({ engine: fakeSpeechEngine({ voices: [HEBREW], manual: true }) });
  check('stop בלי השמעה: אישור, לא נעצר דבר', tts.stop(), { ok: true, data: { stopped: false } });
  const pending = tts.speak('ראשון. שני.');
  await flush();
  check('ההשמעה פעילה', tts.speaking(), { text: 'ראשון. שני.' });
  check('stop בזמן השמעה: נעצר', tts.stop(), { ok: true, data: { stopped: true } });
  const response = await pending;
  check('ההבטחה נפתרה כקטיעה', [response.ok, response.data.interrupted], [true, true]);
  check('הקטע השני לא נמסר', device.spoken.length, 1);
  check('אין השמעה פעילה', tts.speaking(), null);
}

// ---------------------------------------------------------------------
// רשימת הקולות נטענת בעצלות: המתאם ממתין ל-voiceschanged
// ---------------------------------------------------------------------

{
  const { tts, device } = build({ voices: [] });
  const pending = tts.speak('שלום.');
  await flush(1);
  check('לפני voiceschanged אין השמעה', device.spoken.length, 0);
  device.engine.announceVoices([HEBREW]);
  const response = await pending;
  check('אחרי voiceschanged ההשמעה יצאה', [response.ok, device.spoken.length], [true, 1]);
}

// ---------------------------------------------------------------------
// כינוי השפה: מכשיר שמסמן עברית כ-iw
// ---------------------------------------------------------------------

{
  const { tts, device } = build({ voices: [ENGLISH, { name: 'Old', lang: 'iw_IL' }] });
  check('hasVoice מזהה iw כעברית', tts.hasVoice(), true);
  await tts.speak('שלום.');
  check('הקול הישן נבחר', device.spoken[0].voice, 'Old');
}

// ---------------------------------------------------------------------
// חלופת שגיאת מנוע שאינה ביטול: ממשיכים לקטע הבא
// ---------------------------------------------------------------------

{
  const { tts, device } = build();
  const original = device.engine.speak;
  let calls = 0;
  device.engine.speak = (u) => {
    calls += 1;
    if (calls === 1) {
      device.spoken.push({ text: u.text, voice: u.voice?.name ?? null, lang: u.lang, rate: u.rate });
      queueMicrotask(() => u.onerror?.({ error: 'synthesis-failed' }));
      return;
    }
    original(u);
  };
  const response = await tts.speak('ראשון. שני.');
  check('שגיאה שאינה ביטול אינה עוצרת את הרצף', [response.ok, device.spoken.map((u) => u.text)], [true, ['ראשון.', 'שני.']]);
}

report();
