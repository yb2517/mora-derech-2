// Unit של CONN-01, מתאם הקול הנכנס. נגזר מבדיקת הקבלה של משימה 2
// בתוכנית שלב 5, מ-doc-build-03-interfaces סעיף 6 ("שקט של 5
// שניות: E-SPEECH-NOT-RECOGNIZED"), מ-usecase-f-04 זרימה א,
// ומ-usecase-f-02 סעיף 4 (listen: טקסט, או כשל).
//
//   node tests/unit/stt.test.js

import { create } from '../../connectors/stt.js';
import { fakeRecognition, flush } from '../helpers/device.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('CONN-01 stt');

// --- תמלול: הטקסט חוזר כפי שהוא ---

{
  const Recognition = fakeRecognition({ transcript: '  מה זה הבניין הזה?  ' });
  const stt = create({ Recognition, lang: 'he' });
  check('המנוע זמין', stt.available(), true);
  const response = await stt.listen();
  check('התמלול חוזר, בלי ניקוי מלבד רווחי קצה', response, { ok: true, data: { text: 'מה זה הבניין הזה?' } });
  check('השפה מהחוזה תורגמה לקוד המנוע', Recognition.instances[0].lang, 'he-IL');
  check('תוצאה סופית אחת, בלי ביניים', [Recognition.instances[0].interimResults, Recognition.instances[0].maxAlternatives], [false, 1]);
  check('אחרי התשובה אין קליטה פעילה', stt.listening(), false);
}

// --- שקט: E-SPEECH-NOT-RECOGNIZED ---

{
  const stt = create({ Recognition: fakeRecognition({ error: 'no-speech' }) });
  const response = await stt.listen();
  check('שקט: E-SPEECH-NOT-RECOGNIZED', [response.ok, response.error.code], [false, 'E-SPEECH-NOT-RECOGNIZED']);
}

{
  const stt = create({ Recognition: fakeRecognition({}) });
  const response = await stt.listen();
  check('המנוע נסגר בלי תוצאה: E-SPEECH-NOT-RECOGNIZED', [response.ok, response.error.code], [false, 'E-SPEECH-NOT-RECOGNIZED']);
}

{
  const stt = create({ Recognition: fakeRecognition({ transcript: '   ' }) });
  const response = await stt.listen();
  check('תמלול ריק: E-SPEECH-NOT-RECOGNIZED', response.error.code, 'E-SPEECH-NOT-RECOGNIZED');
}

// --- הרשאה נדחתה: E-MIC-NOT-ALLOWED ---

{
  const stt = create({ Recognition: fakeRecognition({ error: 'not-allowed' }) });
  const response = await stt.listen();
  check('הרשאה נדחתה: E-MIC-NOT-ALLOWED', [response.ok, response.error.code], [false, 'E-MIC-NOT-ALLOWED']);
}

{
  const stt = create({ Recognition: fakeRecognition({ error: 'audio-capture' }) });
  const response = await stt.listen();
  check('אין מיקרופון: E-MIC-NOT-ALLOWED', response.error.code, 'E-MIC-NOT-ALLOWED');
}

// --- בלי מנוע: המיקרופון אינו דרך זמינה ---

{
  const stt = create({});
  check('בלי מנוע: לא זמין', stt.available(), false);
  const response = await stt.listen();
  check('בלי מנוע: E-MIC-NOT-ALLOWED, והמסך מציע הקלדה', response.error.code, 'E-MIC-NOT-ALLOWED');
}

// --- ביטול בידי המשתמשת: אינו קוד שגיאה ---

{
  const Recognition = fakeRecognition({ transcript: 'לא אמור להגיע' });
  // המנוע המדומה עונה במשימה זעירה, ולכן הביטול חייב לבוא לפניה.
  Recognition.prototype.start = function start() {};
  const stt = create({ Recognition });
  const pending = stt.listen();
  check('קליטה פעילה', stt.listening(), true);
  check('stop: נעצר', stt.stop(), { ok: true, data: { stopped: true } });
  const response = await pending;
  check('ביטול: לא ok, לא קוד שגיאה, aborted', response, { ok: false, aborted: true, error: null });
  check('stop בלי קליטה: אישור', stt.stop(), { ok: true, data: { stopped: false } });
}

// --- שגיאת מנוע שאינה מוכרת: לא זוהה דיבור, ולא קוד חדש ---

{
  const stt = create({ Recognition: fakeRecognition({ error: 'network' }) });
  const response = await stt.listen();
  check('שגיאה אחרת: E-SPEECH-NOT-RECOGNIZED, הרשימה הסגורה נשמרת', response.error.code, 'E-SPEECH-NOT-RECOGNIZED');
  await flush();
}

report();
