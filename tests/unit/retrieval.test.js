// Unit של BE-04, Retrieval, ושל מנוע הדירוג הנשלף. נגזר מבדיקת
// הקבלה של משימה 6 בתוכנית שלב 4, מ-usecase-f-05 (סעיף 4 והזרימות
// א עד ו), מ-BL-03, BL-05, BL-13, BL-14 ו-BL-21, ומשורות BE-04
// במפה 6.1 ("שאלה על פריט pending: הימנעות, והפריט אינו במועמדים";
// "ציון 0.27 מול סף 0.28: הימנעות"; "שאלה שהתשובה עליה במשפט באמצע
// הפריט: הציטוט מתחיל במשפט הזה").
//
// משימה 4 בתוכנית שלב 8: המנוע הדו שלבי של אב הטיפוס, ו-BL-05 ו-BL-13
// בנוסח מפה 3.12. המאגר הבסיסי כאן הוא 19 הטקסטים של הקורפוס
// (tests/helpers/corpus-pool.js): רצפת הייחודיות דורשת מונח שמופיע
// בפחות מעשירית ממשפטי המאגר, ובמאגר של שניים או שלושה פריטים
// סינתטיים אין מונח כזה. הפריטים הסינתטיים נשארו רק במקום שמקרה
// הבדיקה צריך אותם.
//
//   node tests/unit/retrieval.test.js

import { create } from '../../services/retrieval.js';
import { rank, questionTerms, sentencesOf, ENGINE } from '../../services/retrieval-ranker.js';
import { createChecker } from '../helpers/assert.js';
import { corpusItems, corpusSentence } from '../helpers/corpus-pool.js';
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

// מילה שאינה בקורפוס, ומופיעה רק בפריט שאינו מאושר. כל תשובה שמזכירה
// אותה היא הוכחה שהפריט נשלף.
const MARKER = 'צלוחית';

const CORPUS = corpusItems({ site_id: 's-1', source_id: 'src-1' });

const PENDING = {
  item_id: 'i-pending', site_id: 's-1', stop_id: 'stop-02', status: 'pending',
  source_id: 'src-1', page: 12, audience: 'כולם', name: 'פריט ממתין',
  text: `שער יפו נבנה ונחנך בשנת 1538, ובו נמצאה ${MARKER} עתיקה.`,
};

const ITEMS = [...CORPUS, PENDING];

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

const words = (text) => text.split(/\s+/).filter(Boolean).length;

check('מילת הסימון אינה בקורפוס, ולכן היא מוכיחה שליפה של הפריט הממתין',
  CORPUS.some((item) => item.text.includes(MARKER)), false);

// ---------------------------------------------------------------------
// K1: הסינון לפי מפתח, לפני כל דירוג
// ---------------------------------------------------------------------

// בדיקת הקבלה של שלב 4 (CLAUDE.md סעיף 6): שואלים על פריט pending.
{
  const response = await ask({ question: `מה זו ה${MARKER} העתיקה?`, site_id: 's-1' });

  check('התשובה מוצלחת', response.ok, true);
  check('והיא הימנעות', response.data.is_fallback, true);
  check('בנוסח הנעול מטבלת ה-reference', response.data.answer, REFERENCE.fallback_text);
  check('הפריט ה-pending אינו מוזכר בתשובה', response.data.answer.includes(MARKER), false);
  check('והוא כלל אינו במאגר המועמדים',
    response.data.considered.some((row) => row.item_id === 'i-pending'), false);
}

{
  // שאלה שהפריט ה-pending עונה עליה במילים שלה: אילו היה במאגר, היה
  // מתחרה. הוא אינו שם, והתשובה באה מהפריט המאושר.
  const response = await ask({ question: 'מתי נבנה שער יפו?', site_id: 's-1' });
  check('התשובה באה מהפריט המאושר', response.data.source_item, 'J-02');
  check('והפריט ה-pending לא נשקל',
    response.data.considered.some((row) => row.item_id === 'i-pending'), false);
  check('ונשקלו בדיוק 19 הפריטים המאושרים', response.data.considered.length, 19);
}

{
  // BL-03: מקור בלי הסכם בתוקף אינו מועמד.
  const expired = { ...MOU, valid_until: '2026-01-01T00:00:00.000Z' };
  const response = await ask(
    { question: 'מתי נבנה שער יפו?', site_id: 's-1' },
    { repository: fakeRepository({ mou: [expired] }) },
  );
  check('מקור בלי הסכם בתוקף אינו נשלף', response.data.considered, []);
  check('והתשובה היא הימנעות', response.data.is_fallback, true);
}

{
  // מסלול אחר אינו במאגר.
  const response = await ask({ question: 'מתי נבנה שער יפו?', site_id: 's-9' });
  check('מסלול אחר מחזיר מאגר ריק', response.data.considered, []);
  check('ולכן הימנעות', response.data.is_fallback, true);
}

// BL-21 ופער 43: מסנן ה-audience.
{
  const items = [...ITEMS, {
    item_id: 'i-adults', site_id: 's-1', stop_id: 'stop-10', status: 'approved',
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
// K3 ו-BL-05: הסף, רצפת הייחודיות, וההימנעות
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
  const low = await ask({ question: 'מתי נבנה שער יפו?', site_id: 's-1' });
  check('בסף של המפה השאלה נענית', low.data.is_fallback, false);
  check('הסף נקרא מהטבלה ולא מהקוד', low.data.threshold, 0.28);

  const top = low.data.score;
  const above = fakeRepository({ reference: { ...REFERENCE, relevance_threshold: top + 0.01 } });
  const high = await ask({ question: 'מתי נבנה שער יפו?', site_id: 's-1' }, { repository: above });
  check('סף מעל הציון המוביל הופך את אותה שאלה להימנעות', high.data.is_fallback, true);
  check('והסף שנקרא מדווח', high.data.threshold, top + 0.01);

  // הסף הוא "מעל או שווה": ציון שווה בדיוק לסף עובר.
  const equal = fakeRepository({ reference: { ...REFERENCE, relevance_threshold: top } });
  const exact = await ask({ question: 'מתי נבנה שער יפו?', site_id: 's-1' }, { repository: equal });
  check('ציון שווה לסף עובר', exact.data.is_fallback, false);
}

{
  // BL-05 בנוסח 3.12: מועמד מעל הסף בלי מונח ייחודי אינו נחשב.
  // "ירושלים" מופיעה ביותר מעשירית ממשפטי הקורפוס.
  const response = await ask({ question: 'ירושלים', site_id: 's-1' });
  const leader = response.data.considered[0];
  check('רצפת הייחודיות: הציון המוביל מעל הסף', leader.score >= REFERENCE.relevance_threshold, true);
  check('אבל אף מועמד אינו ייחודי', response.data.considered.some((row) => row.unique), false);
  check('ולכן הימנעות', response.data.is_fallback, true);
}

// ---------------------------------------------------------------------
// BL-13 בנוסח 3.12: המשפט שעונה, והבא אחריו אם נכנס, בגבול משפט
// ---------------------------------------------------------------------

{
  // בדיקת הקבלה של שלב 8 (CLAUDE.md סעיף 6).
  const response = await ask({ question: 'מתי נבנה שער יפו?', site_id: 's-1' });
  check('"מתי נבנה שער יפו?" נענית מ-J-02', response.data.source_item, 'J-02');
  check('במשפט 1538', response.data.answer, corpusSentence('J-02', 11));
  check('שהוא המשפט ה-11 של הפריט', response.data.sentence_index, 11);
  check('והעמוד במקור מוחזר', response.data.source_page, 5);
  check('והמשפט האחרון בפריט נמסר לבדו', response.data.answer.includes('1538'), true);
}

{
  // שורת BE-04 החדשה במפה 6.1: התשובה במשפט באמצע הפריט.
  const response = await ask({ question: 'כמה בתים נבנו בשכונת אבן ישראל?', site_id: 's-1' });
  const item = CORPUS.find((row) => row.item_id === 'J-15');
  check('הציטוט מתחיל במשפט שעונה', response.data.answer.startsWith(corpusSentence('J-15', 10)), true);
  check('ולא בפתיחת הפריט', response.data.answer.startsWith(sentencesOf(item.text)[0]), false);
  check('והטקסט הוא ציטוט מהפריט, בלי ניסוח מחדש', item.text.includes(response.data.answer), true);
}

{
  // המשפט הבא נכנס כששניהם יחד בתוך המכסה.
  const first = corpusSentence('J-03', 1);
  const second = corpusSentence('J-03', 2);
  const joined = `${first} ${second}`;

  const wide = await ask({ question: 'מה זה המשיקולי מעל השער?', site_id: 's-1' });
  check('המשפט שעונה ואחריו הבא, כשהם בתוך 60 מילים', wide.data.answer, joined);
  check('ומספר המילים מדווח', wide.data.words, words(joined));
  check('ולא חרג מהמכסה', wide.data.over_limit, false);

  const tight = fakeRepository({ reference: { ...REFERENCE, answer_max_words: words(first) } });
  const one = await ask({ question: 'מה זה המשיקולי מעל השער?', site_id: 's-1' }, { repository: tight });
  check('מכסה שאינה מכילה את שניהם: המשפט שעונה בלבד', one.data.answer, first);
  check('והוא שלם', one.data.answer.endsWith('.'), true);

  // הכרעה 5 בתוכנית שלב 4: משפט ארוך מהמכסה נמסר במלואו.
  const tiny = fakeRepository({ reference: { ...REFERENCE, answer_max_words: 2 } });
  const whole = await ask({ question: 'מה זה המשיקולי מעל השער?', site_id: 's-1' }, { repository: tiny });
  check('נמסר המשפט גם כשהוא חורג', whole.data.answer, first);
  check('והחריגה מדווחת', whole.data.over_limit, true);
  check('ואין קיצוץ באמצע משפט', whole.data.answer.endsWith('.'), true);
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

  const noSite = await ask({ question: 'מתי נבנה שער יפו?' });
  check('שאלה בלי מסלול היא שגיאת קלט', noSite.error.code, 'E-QUESTION-INVALID');
  check('והסיבה מדווחת', noSite.error.data.reason, 'missing_site');

  const atLimit = await ask({ question: 'א'.repeat(200), site_id: 's-1' });
  check('שאלה באורך הגבול בדיוק עוברת', atLimit.ok, true);
}

// ---------------------------------------------------------------------
// חוק ברזל 5: ערך חסר בטבלה אינו מומצא
// ---------------------------------------------------------------------

{
  for (const key of Object.keys(REFERENCE)) {
    const reference = { ...REFERENCE };
    delete reference[key];
    const response = await ask(
      { question: 'מתי נבנה שער יפו?', site_id: 's-1' }, { repository: fakeRepository({ reference }) },
    );
    check(`${key} ריק מחזיר E-REF-EMPTY`, response.error.code, 'E-REF-EMPTY');
    check(`ו-error.data נושא את שם ההגדרה ${key}`, response.error.data.key, key);
  }
}

// ---------------------------------------------------------------------
// זרימה ב: שובר השוויון (הכרעה 4 בתוכנית שלב 4)
// ---------------------------------------------------------------------

{
  // המילה כתובה בלי תחילית: רצפת הייחודיות נמדדת על הצורה הבסיסית
  // בלבד (אב הטיפוס, termMatch), ו"הצלוחית" לבדה אינה ייחודית.
  const twin = (id, stop) => ({
    item_id: id, site_id: 's-1', stop_id: stop, status: 'approved', source_id: 'src-1',
    page: 1, audience: 'כולם', name: 'א', text: `${MARKER} נמצאה כאן.`,
  });
  const repository = fakeRepository({ items: [...CORPUS, twin('i-far', 'stop-09'), twin('i-here', 'stop-01')] });

  const withStop = await ask({ question: MARKER, site_id: 's-1', stop_id: 'stop-01' }, { repository });
  check('שוויון ציונים: הפריט של התחנה הנוכחית מנצח', withStop.data.source_item, 'i-here');
  check('ושני המועמדים שוויוניים נרשמו ביומן התשובה',
    withStop.data.considered.filter((row) => row.item_id.startsWith('i-')).length, 2);
}

{
  const items = [...CORPUS,
    { item_id: 'i-long', site_id: 's-1', stop_id: 'stop-01', status: 'approved', source_id: 'src-1', page: 1, audience: 'כולם', name: 'א', text: `${MARKER} נמצאה כאן. ועוד מילים רבות שממשיכות את הטקסט הזה.` },
    { item_id: 'i-short', site_id: 's-1', stop_id: 'stop-01', status: 'approved', source_id: 'src-1', page: 2, audience: 'כולם', name: 'א', text: `${MARKER} נמצאה כאן.` },
  ];
  const response = await ask(
    { question: MARKER, site_id: 's-1', stop_id: 'stop-01' },
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
    { question: 'איפה אפשר לאכול פלאפל?', site_id: 's-1', session_id: 'sess-1', stop_id: 'stop-01' },
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
  await ask({ question: 'מתי נבנה שער יפו?', site_id: 's-1', session_id: 'sess-1' }, { send: recordingSend });
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
  const response = await ask({ question: 'מתי נבנה שער יפו?', site_id: 's-1' }, { repository });

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
  const response = await ask({ question: 'מתי נבנה שער יפו?', site_id: 's-1' }, { repository });
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
// מנוע הדירוג, כמודול בפני עצמו (מבחן ההחלפה, מפה 3.2 שורת BE-04)
// ---------------------------------------------------------------------

{
  check('מילות שאלה אינן נשקלות', questionTerms('מה זה שער יפו?'), ['שער', 'יפו']);
  check('שאלה שכולה מילות שאלה אינה מותירה מונח', questionTerms('מה זה?'), []);
  check('ניקוד ופיסוק מנורמלים', questionTerms('שָׁעַר, יפו!'), ['שער', 'יפו']);
}

{
  const ranked = rank({ question: 'מתי נבנה שער יפו?', candidates: CORPUS });
  check('הסדר יורד', ranked.every((row, i) => i === 0 || ranked[i - 1].score >= row.score), true);
  check('המוביל הוא הפריט שעוסק בשאלה', ranked[0].item.item_id, 'J-02');
  check('והוא מסומן ייחודי', ranked[0].unique, true);
  check('והמשפט שנבחר בו הוא משפט 1538', ranked[0].sentence, { index: 11, text: corpusSentence('J-02', 11) });
  check('"נבנה" מוצא את "נחנך" דרך קבוצת הנרדפות', ranked[0].sentence.text.includes('נחנך'), true);
  check('המשפט של כל מועמד מזוהה באותה חלוקה ש-BE-04 משתמש בה',
    ranked.every((row) => sentencesOf(row.item.text)[row.sentence.index] === row.sentence.text), true);
}

{
  const none = rank({ question: 'מה זה?', candidates: CORPUS });
  check('בלי מונח: כל הציונים אפס', none.every((row) => row.score === 0), true);
  check('ובלי משפט נבחר', none.every((row) => row.sentence === null), true);

  // מילה אחת מתוך שתיים ומעלה: ניחוש, לא תשובה.
  const half = rank({ question: 'שער פלאפל', candidates: CORPUS });
  check('מילה אחת משתיים בפריט: ציון אפס', half.every((row) => row.score === 0), true);
}

{
  // K1 מחוץ למנוע: המנוע מדרג רק את מה שנמסר לו.
  const ranked = rank({ question: MARKER, candidates: CORPUS });
  check('מילה שאינה במאגר: כל הציונים אפס', ranked.every((row) => row.score === 0), true);
  check('מאגר ריק מחזיר רשימה ריקה', rank({ question: 'שאלה', candidates: [] }), []);
  check('המנוע מזדהה', ENGINE.id, 'lexical-two-stage');
}

{
  // מבחן ההחלפה: החוזה של המנוע במפה 3.2 הוא ציון, סימן ייחודיות,
  // והמשפט הנבחר, לכל מועמד.
  check('החוזה של המנוע: פריט, ציון, ייחודיות ומשפט',
    Object.keys(rank({ question: 'שער יפו', candidates: CORPUS })[0]).sort(),
    ['item', 'score', 'sentence', 'unique']);
}

report();
