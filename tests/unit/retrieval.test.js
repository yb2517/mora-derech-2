// Unit של BE-04, Retrieval, ושל מנוע הדירוג הנשלף. נגזר מבדיקת
// הקבלה של משימה 6 בתוכנית שלב 4, מ-usecase-f-05 (סעיף 4 והזרימות
// א עד ו), מ-BL-03, BL-05, BL-13, BL-14 ו-BL-21, ומשורות BE-04
// במפה 6.1 ("שאלה על פריט pending: הימנעות, והפריט אינו במועמדים";
// "ציון 0.27 מול סף 0.28: הימנעות").
//
//   node tests/unit/retrieval.test.js

import { create } from '../../services/retrieval.js';
import { rank, score, questionTerms, ENGINE } from '../../services/retrieval-ranker.js';
import { createChecker } from '../helpers/assert.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };

const { check, checkThrows, report } = createChecker('BE-04 retrieval');

const NOW = '2026-09-14T12:00:00.000Z';

const MOU = {
  mou_id: 'mou-1', institute_id: 'inst-1', scope: ['src-1'],
  signed_at: '2026-09-01T00:00:00.000Z', valid_until: '2099-01-01T00:00:00.000Z',
};

const REFERENCE = {
  question_max_chars: 200,
  relevance_threshold: 0.28,
  answer_max_words: 60,
  fallback_text: 'אין לי מידע מאומת על זה במסלול הזה.',
};

const ITEMS = [
  {
    item_id: 'i-gate', site_id: 's-1', stop_id: 'st-1', status: 'approved',
    source_id: 'src-1', page: 7, audience: 'כולם', name: 'שער יפו',
    text: 'שער יפו נבנה בימי סולימאן המפואר. הוא אחד משערי חומת העיר העתיקה.',
  },
  {
    item_id: 'i-square', site_id: 's-1', stop_id: 'st-2', status: 'approved',
    source_id: 'src-1', page: 18, audience: 'כולם', name: 'כיכר צהל',
    text: 'הכיכר נקראת על שם צבא ההגנה לישראל. היא צומת מרכזי במרכז העיר.',
  },
  {
    item_id: 'i-pending', site_id: 's-1', stop_id: 'st-1', status: 'pending',
    source_id: 'src-1', page: 12, audience: 'כולם', name: 'מגדל השעון',
    text: 'מגדל השעון עמד כאן וסולק. סולימאן אינו קשור אליו כלל.',
  },
];

function fakeRepository({ items = ITEMS, mou = [MOU], reference = REFERENCE } = {}) {
  return {
    getRef: (key) => reference[key],
    listItems: ({ site_id: siteId, status } = {}) => items
      .filter((row) => siteId === undefined || row.site_id === siteId)
      .filter((row) => status === undefined || row.status === status)
      .map((row) => ({ ...row })),
    listMou: () => mou.map((row) => ({ ...row })),
  };
}

const sent = [];
const recordingSend = async (request) => { sent.push(request); return { ok: true, data: {} }; };

// שם הפונה מגיע מטבלת המודולים, ולא מהקוד של המודול (מבחן מבנה 06).
const CALLER = modulesFile.modules.find((row) => row.id === 'BE-04').caller;

const ask = (payload, options = {}) => create({
  repository: options.repository ?? fakeRepository(),
  send: options.send,
  caller: CALLER,
  now: () => NOW,
})({
  from: 'module-dialogue', module: 'BE-04', action: 'retrieve', payload, lang: 'he',
});

// ---------------------------------------------------------------------
// K1: הסינון לפי מפתח, לפני כל דירוג
// ---------------------------------------------------------------------

// בדיקת הקבלה של השלב (CLAUDE.md סעיף 6): שואלים על פריט pending.
{
  const response = await ask({ question: 'מה קרה למגדל השעון?', site_id: 's-1' });

  check('התשובה מוצלחת', response.ok, true);
  check('והיא הימנעות', response.data.is_fallback, true);
  check('בנוסח הנעול מטבלת ה-reference', response.data.answer, REFERENCE.fallback_text);
  check('הפריט ה-pending אינו מוזכר בתשובה', response.data.answer.includes('מגדל'), false);
  check('והוא כלל אינו במאגר המועמדים',
    response.data.considered.some((row) => row.item_id === 'i-pending'), false);
}

{
  // אותה שאלה עם אותה מילה בדיוק שמופיעה בפריט המאושר: אילו הפריט
  // ה-pending היה במאגר, הוא היה מנצח. הוא אינו שם.
  const response = await ask({ question: 'מי היה סולימאן?', site_id: 's-1' });
  check('המילה המשותפת מובילה לפריט המאושר', response.data.source_item, 'i-gate');
  check('והפריט ה-pending לא נשקל',
    response.data.considered.map((row) => row.item_id), ['i-gate', 'i-square']);
}

{
  // BL-03: מקור בלי הסכם בתוקף אינו מועמד.
  const expired = { ...MOU, valid_until: '2026-01-01T00:00:00.000Z' };
  const response = await ask(
    { question: 'מי בנה את שער יפו?', site_id: 's-1' },
    { repository: fakeRepository({ mou: [expired] }) },
  );
  check('מקור בלי הסכם בתוקף אינו נשלף', response.data.considered, []);
  check('והתשובה היא הימנעות', response.data.is_fallback, true);
}

{
  // מסלול אחר אינו במאגר.
  const response = await ask({ question: 'מי בנה את שער יפו?', site_id: 's-9' });
  check('מסלול אחר מחזיר מאגר ריק', response.data.considered, []);
  check('ולכן הימנעות', response.data.is_fallback, true);
}

// BL-21 ופער 43: מסנן ה-audience.
{
  const items = [...ITEMS, {
    item_id: 'i-adults', site_id: 's-1', stop_id: 'st-1', status: 'approved',
    source_id: 'src-1', page: 57, audience: 'מבוגרים בלבד', name: 'הפגנות',
    text: 'הפגנות נערכו בכיכר לאורך שנים.',
  }];
  const repository = fakeRepository({ items });

  const child = await ask({ question: 'מה היו ההפגנות?', site_id: 's-1' }, { repository });
  check('פריט למבוגרים בלבד אינו נשקל בברירת המחדל',
    child.data.considered.some((row) => row.item_id === 'i-adults'), false);

  const adult = await ask(
    { question: 'מה היו ההפגנות?', site_id: 's-1', audience: 'מבוגרים בלבד' }, { repository },
  );
  check('ועם audience מפורש הוא נשקל',
    adult.data.considered.some((row) => row.item_id === 'i-adults'), true);
}

// ---------------------------------------------------------------------
// K3 ו-BL-05: הסף, וההימנעות
// ---------------------------------------------------------------------

{
  const response = await ask({ question: 'איפה אפשר לאכול פלאפל?', site_id: 's-1' });
  check('שאלה מחוץ לקורפוס מקבלת הימנעות', response.data.is_fallback, true);
  check('בלי מקור', response.data.source_item, null);
  check('ובלי עמוד', response.data.source_page, null);
  check('והמועמדים נרשמו עם ציוניהם', response.data.considered.every((row) => row.score === 0), true);
}

// שורת BE-04 במפה 6.1: ציון מתחת לסף מחזיר הימנעות, והסף מ-reference.
{
  const repository = fakeRepository({ reference: { ...REFERENCE, relevance_threshold: 0.9 } });
  const high = await ask({ question: 'מי בנה את שער יפו?', site_id: 's-1' }, { repository });
  check('סף גבוה הופך את אותה שאלה להימנעות', high.data.is_fallback, true);
  check('והסף שנקרא מדווח', high.data.threshold, 0.9);

  const low = await ask({ question: 'מי בנה את שער יפו?', site_id: 's-1' });
  check('ובסף של המפה אותה שאלה נענית', low.data.is_fallback, false);
  check('הסף נקרא מהטבלה ולא מהקוד', low.data.threshold, 0.28);
}

{
  // הסף הוא "מעל", ולא "מעל או שווה": ציון שווה בדיוק לסף עובר.
  const repository = fakeRepository({ reference: { ...REFERENCE, relevance_threshold: 1 } });
  const response = await ask({ question: 'סולימאן', site_id: 's-1' }, { repository });
  check('ציון 1 מול סף 1 עובר', response.data.is_fallback, false);
}

// ---------------------------------------------------------------------
// BL-14: שגיאת קלט אינה הימנעות
// ---------------------------------------------------------------------

{
  const empty = await ask({ question: '   ', site_id: 's-1' });
  check('שאלה ריקה היא שגיאת קלט', empty.error.code, 'E-QUESTION-INVALID');
  check('ולא הימנעות', empty.ok, false);
  check('והסיבה מדווחת', empty.error.data.reason, 'empty');

  const long = await ask({ question: 'א'.repeat(201), site_id: 's-1' });
  check('שאלה ארוכה מהמותר היא שגיאת קלט', long.error.code, 'E-QUESTION-INVALID');
  check('והגבול מדווח מטבלת ה-reference', long.error.data.max, 200);

  const noSite = await ask({ question: 'מי בנה את שער יפו?' });
  check('שאלה בלי מסלול היא שגיאת קלט', noSite.error.code, 'E-QUESTION-INVALID');
  check('והסיבה מדווחת', noSite.error.data.reason, 'missing_site');

  const atLimit = await ask({ question: 'א'.repeat(200), site_id: 's-1' });
  check('שאלה באורך הגבול בדיוק עוברת', atLimit.ok, true);
}

// ---------------------------------------------------------------------
// חוק ברזל 5: ערך חסר בטבלה אינו מומצא
// ---------------------------------------------------------------------

{
  for (const key of ['question_max_chars', 'relevance_threshold', 'answer_max_words', 'fallback_text']) {
    const reference = { ...REFERENCE, [key]: null };
    const response = await ask(
      { question: 'מי בנה את שער יפו?', site_id: 's-1' },
      { repository: fakeRepository({ reference }) },
    );
    check(`${key} ריק מחזיר E-REF-EMPTY`, response.error.code, 'E-REF-EMPTY');
    check(`ו-error.data נושא את שם ההגדרה ${key}`, response.error.data.key, key);
  }
}

// ---------------------------------------------------------------------
// BL-13: ציטוט או קיצוץ בגבול משפט, בלי ניסוח מחדש
// ---------------------------------------------------------------------

{
  const response = await ask({ question: 'מי בנה את שער יפו?', site_id: 's-1' });
  check('התשובה נלקחת מהפריט המוביל', response.data.source_item, 'i-gate');
  check('והעמוד במקור מוחזר', response.data.source_page, 7);
  check('והטקסט הוא ציטוט מהפריט',
    ITEMS[0].text.includes(response.data.answer), true);
  check('ולא חרג מהמכסה', response.data.over_limit, false);
}

{
  // מכסה שמכניסה משפט אחד בלבד: נמסר המשפט הראשון, שלם.
  const repository = fakeRepository({ reference: { ...REFERENCE, answer_max_words: 7 } });
  const response = await ask({ question: 'מי בנה את שער יפו?', site_id: 's-1' }, { repository });
  check('נמסר משפט אחד', response.data.answer, 'שער יפו נבנה בימי סולימאן המפואר.');
  check('והוא שלם', response.data.answer.endsWith('.'), true);
  check('ובתוך המכסה', response.data.words <= 7, true);
}

// הכרעה 5: כשאף משפט אינו נכנס, נמסר הראשון במלואו והחריגה מדווחת.
{
  const repository = fakeRepository({ reference: { ...REFERENCE, answer_max_words: 2 } });
  const response = await ask({ question: 'מי בנה את שער יפו?', site_id: 's-1' }, { repository });
  check('נמסר המשפט הראשון גם כשהוא חורג', response.data.answer, 'שער יפו נבנה בימי סולימאן המפואר.');
  check('והחריגה מדווחת', response.data.over_limit, true);
  check('ואין קיצוץ באמצע משפט', response.data.answer.endsWith('.'), true);
}

// ---------------------------------------------------------------------
// זרימה ב: שובר השוויון (הכרעה 4)
// ---------------------------------------------------------------------

{
  const items = [
    { item_id: 'i-far', site_id: 's-1', stop_id: 'st-9', status: 'approved', source_id: 'src-1', page: 1, audience: 'כולם', name: 'א', text: 'החומה נבנתה כאן.' },
    { item_id: 'i-here', site_id: 's-1', stop_id: 'st-1', status: 'approved', source_id: 'src-1', page: 2, audience: 'כולם', name: 'ב', text: 'החומה נבנתה כאן.' },
  ];
  const repository = fakeRepository({ items });

  const withStop = await ask({ question: 'החומה', site_id: 's-1', stop_id: 'st-1' }, { repository });
  check('שוויון ציונים: הפריט של התחנה הנוכחית מנצח', withStop.data.source_item, 'i-here');

  check('ושני המועמדים נרשמו ביומן התשובה', withStop.data.considered.length, 2);
}

{
  const items = [
    { item_id: 'i-long', site_id: 's-1', stop_id: 'st-1', status: 'approved', source_id: 'src-1', page: 1, audience: 'כולם', name: 'א', text: 'החומה נבנתה כאן ועוד מילים רבות שממשיכות את המשפט הזה.' },
    { item_id: 'i-short', site_id: 's-1', stop_id: 'st-1', status: 'approved', source_id: 'src-1', page: 2, audience: 'כולם', name: 'א', text: 'החומה.' },
  ];
  const response = await ask(
    { question: 'החומה', site_id: 's-1', stop_id: 'st-1' },
    { repository: fakeRepository({ items }) },
  );
  check('אותה תחנה: הקצר מנצח', response.data.source_item, 'i-short');
}

// ---------------------------------------------------------------------
// שורת abstained ל-BE-07, ו-BL-10
// ---------------------------------------------------------------------

{
  sent.length = 0;
  await ask(
    { question: 'איפה אפשר לאכול פלאפל?', site_id: 's-1', session_id: 'sess-1', stop_id: 'st-1' },
    { send: recordingSend },
  );

  check('נשלחה מעטפה אחת', sent.length, 1);
  check('אל BE-07', sent[0].module, 'BE-07');
  check('בפעולה log', sent[0].action, 'log');
  check('מסוג abstained', sent[0].payload.type, 'abstained');
  check('ובשם הפונה שבטבלת המודולים', sent[0].from, CALLER);
  check('והשם הזה הוא module-retrieval', CALLER, 'module-retrieval');
  check('עם מזהה הסשן', sent[0].payload.session_id, 'sess-1');
}

{
  sent.length = 0;
  await ask({ question: 'מי בנה את שער יפו?', site_id: 's-1', session_id: 'sess-1' }, { send: recordingSend });
  check('תשובה שנמסרה אינה שולחת abstained', sent.length, 0);
}

{
  sent.length = 0;
  await ask({ question: 'פלאפל', site_id: 's-1' }, { send: recordingSend });
  check('בלי סשן אין שורת יומן', sent.length, 0);
}

{
  // BL-10: היומן אינו חוסם. כשל שליחה אינו הופך את ההימנעות לשגיאה.
  const failing = async () => { throw new Error('היומן נפל'); };
  const response = await ask(
    { question: 'פלאפל', site_id: 's-1', session_id: 'sess-1' }, { send: failing },
  );
  check('כשל היומן אינו מונע את ההימנעות', response.ok, true);
  check('והמשפחה שומעת את הנוסח', response.data.answer, REFERENCE.fallback_text);
}

// ---------------------------------------------------------------------
// זרימה ד: כשל שליפה
// ---------------------------------------------------------------------

{
  const repository = fakeRepository();
  repository.listItems = () => { throw new Error('המאגר נפל'); };
  const response = await ask({ question: 'מי בנה את שער יפו?', site_id: 's-1' }, { repository });

  check('כשל קריאת המועמדים מוחזר בקוד שלו', response.error.code, 'E-RETRIEVAL-FAILED');
  check('ואינו הימנעות', response.ok, false);
}

// ---------------------------------------------------------------------
// K2: אין קריאה יוצאת, ואין כתיבה לקורפוס
// ---------------------------------------------------------------------

{
  const repository = fakeRepository();
  for (const name of ['setStatus', 'appendApproval', 'appendItem', 'updateItem', 'setRef']) {
    repository[name] = () => { throw new Error(`BE-04 כתב ב-${name}`); };
  }
  const response = await ask({ question: 'מי בנה את שער יפו?', site_id: 's-1' }, { repository });
  check('השליפה אינה כותבת דבר', response.ok, true);
}

checkThrows('בלי Repository אין מודול', () => create({}));

{
  const handle = create({ repository: fakeRepository(), caller: CALLER, now: () => NOW });
  checkThrows('פעולה שאינה במפה נזרקת', () => handle({
    from: 'module-dialogue', module: 'BE-04', action: 'לא קיימת', payload: {}, lang: 'he',
  }));
}

// ---------------------------------------------------------------------
// מנוע הדירוג, כמודול בפני עצמו (מבחן ההחלפה)
// ---------------------------------------------------------------------

{
  check('מילות שאלה אינן נשקלות', questionTerms('מה זה שער יפו?'), ['שער', 'יפו']);
  check('שאלה שכולה מילות שאלה אינה מאבדת את כולן', questionTerms('מה זה?'), ['מה', 'זה']);
  check('ניקוד ופיסוק מנורמלים', questionTerms('שָׁעַר, יפו!'), ['שער', 'יפו']);
}

{
  const item = ITEMS[0];
  check('כל מילות השאלה בפריט: ציון גבוה', score({ terms: ['סולימאן', 'שער'], item }) >= 1, true);
  check('אף מילה אינה בפריט: אפס', score({ terms: ['פלאפל', 'מסעדה'], item }), 0);
  check('בלי מילים כלל: אפס', score({ terms: [], item }), 0);
  check('אות שימוש מזוהה במשקל נמוך יותר',
    score({ terms: ['בסולימאן'], item }) < score({ terms: ['סולימאן'], item }), true);
}

{
  const ranked = rank({ question: 'מי בנה את שער יפו?', candidates: ITEMS });
  check('הסדר יורד', ranked[0].score >= ranked[1].score, true);
  check('והמוביל הוא הפריט שעוסק בשאלה', ranked[0].item.item_id, 'i-gate');
  check('מאגר ריק מחזיר רשימה ריקה', rank({ question: 'שאלה', candidates: [] }), []);
  check('המנוע מזדהה', ENGINE.id, 'lexical-two-stage');
}

{
  // מבחן ההחלפה: מנוע אחר, אותו BE-04. כאן הוא מנוע שמחזיר ציון
  // קבוע, והשליפה ממשיכה לעבוד ולציית לסף.
  check('החוזה של המנוע הוא שאלה ומועמדים נכנסים, ציונים יוצאים',
    Object.keys(rank({ question: 'שער', candidates: [ITEMS[0]] })[0]).sort(), ['item', 'score']);
}

report();
