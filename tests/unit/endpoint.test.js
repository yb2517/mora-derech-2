// Unit: הכתובת האחת. משימה 3 בתוכנית שלב 2.
//
// המקור: מפה 4.1 (המעטפות), מבחן מבנה 03, חוק ברזל 1.
//
// הכתובת נבדקת לבדה: הפונקציה שמטפלת בבקשה מוזרקת, ולכן הבדיקה
// רואה בדיוק מה יצא ממנה בלי Orchestrator, בלי Repository ובלי
// אחסון. זה גם מבחן ההחלפה שלה: אם החלפת מה שמאחוריה דורשת שינוי
// בה, היא אינה כתובת.
//
//   node tests/unit/endpoint.test.js

import { createEndpoint } from '../../screens/endpoint.js';
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, report } = createChecker('Unit: הכתובת האחת');

// מקליט: מחזיר מעטפת תשובה קבועה, ושומר את מה שקיבל.
function recorder(response = { ok: true, data: null, error: null }) {
  const seen = [];
  return {
    seen,
    handle: (request) => {
      seen.push(request);
      return response;
    },
  };
}

// --- בדיקת הקבלה: הקריאה מגיעה לכתובת אחת ולא לשום מקום אחר ---

{
  const target = recorder();
  const send = createEndpoint({ handle: target.handle });

  const request = { from: 'caller-under-test', module: 'M', action: 'a', payload: { x: 1 } };
  await send(request);

  check('הקריאה הגיעה פעם אחת', target.seen.length, 1);
  check('שם הפונה הועבר כמות שהוא', target.seen[0].from, 'caller-under-test');
  check('המודול הועבר כמות שהוא', target.seen[0].module, 'M');
  check('הפעולה הועברה כמות שהיא', target.seen[0].action, 'a');
  check('ה-payload הועבר כמות שהוא', target.seen[0].payload, { x: 1 });
}

// --- השפה נחתמת כאן, ובנקודה הזאת בלבד ---

{
  const target = recorder();
  const send = createEndpoint({ handle: target.handle });

  await send({ from: 'c', module: 'M', action: 'a', payload: {} });
  check('השפה נחתמה על המעטפה', target.seen[0].lang, 'he');

  // מסך שחותם שפה משלו אינו גובר על הכתובת. אחרת "שדה השפה נקבע
  // במקום אחד" הוא סיפור ולא מבנה.
  await send({ from: 'c', module: 'M', action: 'a', payload: {}, lang: 'en' });
  check('שפה שהמסך שלח נדרסת', target.seen[1].lang, 'he');
}

// --- המעטפה מוחזרת כמות שהיא ---

{
  const response = { ok: false, data: null, error: { code: 'E-ALLOW-DENIED', data: { a: 1 } } };
  const target = recorder(response);
  const send = createEndpoint({ handle: target.handle });

  const returned = await send({ from: 'c', module: 'M', action: 'a', payload: {} });

  check('מעטפת התשובה חוזרת כמות שהיא', returned, response);
  check('הכתובת אינה מפרשת את קוד השגיאה', returned.error.code, 'E-ALLOW-DENIED');
}

// --- הכתובת אינה מאמתת, מפני שהאימות של CORE-01 ---

{
  const target = recorder();
  const send = createEndpoint({ handle: target.handle });

  // מעטפה בלי from עוברת הלאה ונדחית בהמשך השרשרת. כתובת שמאמתת
  // בעצמה היא מקום שני שיכול להיפרד מהראשון.
  await send({ module: 'M', action: 'a', payload: {} });

  check('מעטפה חסרה מועברת ואינה נחסמת כאן', target.seen[0].from, undefined);
  check('גם היא נחתמה בשפה', target.seen[0].lang, 'he');
}

// --- הרכבה שגויה נופלת מיד, ולא בבקשה הראשונה בשטח ---

checkThrows('כתובת בלי פונקציה נופלת', () => createEndpoint({}));
checkThrows('כתובת בלי ארגומנטים נופלת', () => createEndpoint());
checkThrows('כתובת עם ערך שאינו פונקציה נופלת', () => createEndpoint({ handle: 'x' }));

{
  const send = createEndpoint({ handle: () => ({ ok: true, data: null, error: null }) });
  let threw = false;
  try {
    await send('לא אובייקט');
  } catch {
    threw = true;
  }
  check('בקשה שאינה אובייקט נופלת', threw, true);
}

// --- הפונקציה שמאחורי הכתובת מתחלפת בלי לגעת בה ---

{
  const first = recorder({ ok: true, data: { who: 'first' }, error: null });
  const second = recorder({ ok: true, data: { who: 'second' }, error: null });

  const envelope = { from: 'c', module: 'M', action: 'a', payload: {} };

  const a = await createEndpoint({ handle: first.handle })(envelope);
  const b = await createEndpoint({ handle: second.handle })(envelope);

  check('אותה כתובת מול מימוש אחר', [a.data.who, b.data.who], ['first', 'second']);
  check('שתיהן קיבלו את אותה מעטפה', first.seen[0], second.seen[0]);
}

report();
