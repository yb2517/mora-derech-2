// מנוע הדירוג של BE-04. מודול נשלף (הכרעה ד1, ו-CLAUDE.md סעיף 5).
//
// המקור: מפה 3.2, שורת BE-04 (חוזה המנוע, פער 70, הוכרע 27.09.2026);
// מפה BL-05 ו-BL-13 בנוסח 3.12; PRD סעיף 20 ("ניקוד פריט ואז משפט");
// doc-build-01 סעיף 4 (רצפת ייחודיות, שליפה דו שלבית, תלישת
// תחיליות); והכרעה 1 בתוכנית שלב 8: המנוע **מועבר** מאב הטיפוס,
// prototype-mora-darech-jaffa-v1.html, השורות 673 עד 765 (הקבועים,
// האינדקס, expand, queryTerms, termMatch ו-answer). CLAUDE.md סעיף 2
// מונה אותו בין מה שנלקח מאב הטיפוס.
//
// **זה הקובץ שנועד להיות מוחלף.** החוזה שלו (מפה 3.2): הוא מקבל שאלה
// ומאגר מועמדים, ומחזיר לכל מועמד ציון, סימן ייחודיות, ואת המשפט
// הנבחר בפריט. הוא אינו יודע מהו הסף, אינו קורא נתונים, אינו מכיר
// מעטפה ואינו מכיר קוד שגיאה. מנוע סמנטי עתידי מחזיר את אותם שלושה,
// ו-BE-04 אינו משתנה (מבחן ההחלפה).
//
// המשפט מזוהה במיקומו ברשימת המשפטים של טקסט הפריט, לפי החלוקה
// (?<=[.!?])\s+, שהיא החלוקה של אב הטיפוס ושל BE-04. כך BE-04 יודע
// מהו המשפט הבא אחריו.
//
// **מה הוא אינו**: הוא אינו הסינון לפי מפתח. K1 של usecase-f-05 נאכף
// לפני שהמאגר מגיע לכאן, ולכן גם האינדקס (נדירות המילים) נבנה על
// המאגר המסונן בלבד: פריט pending אינו משפיע אפילו על הציון של אחר.
//
// שתי סטיות מכוונות מאב הטיפוס, לפי הכרעה 1 בתוכנית שלב 8:
//   (א) המנוע אינו חותך טקסט. אב הטיפוס קיצץ את התשובה ל-60 מילים גם
//       באמצע משפט; כאן BE-04 מרכיב את הציטוט בגבול משפט בלבד (BL-13).
//   (ב) אין כאן מכפיל 1.06 לפריט הקרוב למיקום. שובר השוויון לפי
//       התחנה הנוכחית נשאר של BE-04, כפי שהיה (usecase-f-05 זרימה ב).
//
// הקבועים שלמטה הם נכס לשוני של המנוע הזה ולא ערכי reference (הכרעה
// 1): אין להם מפתח במפה 2.4, ומנוע אחר יביא את שלו. הם הועתקו מאב
// הטיפוס כלשונם.

const STOP = new Set(('מה מי מתי איפה היכן למה מדוע איך כיצד האם זה זו זאת אלה אלו את של על עם אל כל גם או אבל רק לא כן יש אין היה הייתה היו הוא היא הם הן אני אתה אנחנו אתם כאן שם פה עכשיו היום אז כבר עוד מאוד יותר פחות בין אחרי לפני תחת מעל ליד כמו כדי אם כי אשר בו בה בהם בהן לו לה להם ממנו ממנה בזה בזמן פני כמה איזה איזו ספר לי תספר שאלה ידוע אפשר בבקשה ניתן כאן קצת דבר משהו זהו זוהי נמצא נמצאת נמצאים נמצאות שנמצא נראה נראית נראים קיים קיימת ישנו ישנה גר גרים לראות רואים ה ו ב ל מ ש כ').split(/\s+/));

// נטיות סיום, אחרי הסרת האות האחרונה של מילה בת ארבע אותיות לפחות.
const SUFFIXES = ['', 'ה', 'ת', 'ו', 'ים', 'ות', 'תה', 'נו', 'יו', 'יה'];

// קבוצות מילים נרדפות מבוקרות. אין כאן מודל, רק רשימה שאפשר לקרוא
// ולאשר (אב הטיפוס).
const SYN = [
  ['נבנה', 'נבנתה', 'נבנו', 'הוקם', 'הוקמה', 'הוקמו', 'נפתח', 'נפתחה', 'נחנך', 'נחנכה', 'נסללה', 'נוסד', 'נוסדה', 'הוצב', 'הוצבה', 'נבנית'],
  ['נהרס', 'נהרסה', 'נהרסו', 'נמחק'],
  ['נקרא', 'נקראת', 'נקראים', 'מכונה', 'המכונה', 'כינויו', 'כינוי', 'שם', 'שמו', 'שמה'],
  ['גר', 'גרו', 'התגורר', 'התגוררו', 'מתגוררים', 'השתכנו', 'שכן', 'שכנה'],
];
const SYNMAP = new Map();
SYN.forEach((group) => group.forEach((word) => SYNMAP.set(word, group)));

// תחיליות, הארוכות קודם.
const PREFIXES = ['וה', 'ול', 'וב', 'ומ', 'וש', 'וכ', 'ה', 'ו', 'ב', 'ל', 'מ', 'ש', 'כ'];

// המשקלים של אב הטיפוס. צורה בסיסית שווה 1; נרדפת חלשה ממנה.
const WEIGHT_SYNONYM = 0.7;
const WEIGHT_PREFIXED = 0.9;
const WEIGHT_INFLECTED = 0.8;
const TERM_FREQUENCY_BOOST = 0.35;
const PAIR_BOOST = 0.25;
const ADJACENT_PAIR = 1.5;
const NO_PAIR_FACTOR = 0.25;
const YEAR_FACTOR = 2.2;
const COUNT_FACTOR = 1.3;

// רצפת הייחודיות (מפה BL-05, doc-build-01 סעיף 4): מונח שמופיע בפחות
// מעשירית ממשפטי המאגר.
const UNIQUE_SHARE = 0.10;

// שאלת זמן מעדיפה משפט עם שנה, ושאלת כמות משפט עם מספר.
const WANTS_YEAR = /^(מתי|באיזו שנה|באיזה שנה|מאיזו שנה)/;
const WANTS_COUNT = /^(כמה)/;
const HAS_DIGIT = /\d/;

// שנה: מספר בן ארבע ספרות מ-1000 עד 2099. שקול לביטוי של אב הטיפוס,
// \b1[0-9]{3}\b|\b20[0-9]{2}\b, בכתיב של טווח.
const FOUR_DIGITS = /\b\d{4}\b/g;
const YEAR_FROM = 1000;
const YEAR_TO = 2099;

function hasYear(text) {
  return (text.match(FOUR_DIGITS) ?? []).some((digits) => {
    const year = Number(digits);
    return year >= YEAR_FROM && year <= YEAR_TO;
  });
}

function normWord(word) {
  return word.replace(/[^֐-׿0-9A-Za-z]/g, '').replace(/[֑-ׇ]/g, '');
}

/** משפטי טקסט, לפי החלוקה של אב הטיפוס ושל BE-04. */
export function sentencesOf(text) {
  return String(text ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** האינדקס של המאגר: כל משפט של כל מועמד, ובכמה משפטים כל צורה מופיעה. */
function buildIndex(candidates) {
  const vocab = new Map();
  const segs = [];
  candidates.forEach((item, position) => sentencesOf(item?.text).forEach((text, idx) => {
    const words = new Set(text.split(/\s+/).map(normWord).filter((word) => word.length > 1));
    segs.push({ position, idx, text, words });
    words.forEach((word) => vocab.set(word, (vocab.get(word) || 0) + 1));
  }));
  return { vocab, segs, N: segs.length };
}

// צורה ומשקל. בסיסים: המילה, ובלי תחילית. מהם בלבד: נרדפות, תחיליות
// בטקסט, נטיות סיום. בלי שרשור.
function expand(word, index) {
  const bases = new Set([word]);
  for (const prefix of PREFIXES) {
    if (word.startsWith(prefix) && word.length - prefix.length >= 2) {
      const rest = word.slice(prefix.length);
      if (index.vocab.has(rest)) bases.add(rest);
    }
  }
  const out = new Map();
  bases.forEach((base) => out.set(base, 1));
  bases.forEach((base) => {
    const group = SYNMAP.get(base);
    if (group) group.forEach((form) => {
      if (index.vocab.has(form) && !out.has(form)) out.set(form, WEIGHT_SYNONYM);
    });
  });
  bases.forEach((base) => {
    for (const prefix of PREFIXES) {
      const form = prefix + base;
      if (index.vocab.has(form) && !out.has(form)) out.set(form, WEIGHT_PREFIXED);
    }
  });
  bases.forEach((base) => {
    if (base.length < 4) return;
    const stem = base.slice(0, base.length - 1);
    SUFFIXES.forEach((suffix) => {
      const form = stem + suffix;
      if (form !== base && index.vocab.has(form) && !out.has(form)) out.set(form, WEIGHT_INFLECTED);
    });
  });
  return out;
}

function queryTermsFor(question, index) {
  const raw = String(question ?? '').split(/\s+/).map(normWord)
    .filter((word) => word.length > 1 && !STOP.has(word));
  return raw.map((word) => {
    const forms = expand(word, index);
    STOP.forEach((stop) => forms.delete(stop));
    return { raw: word, forms };
  });
}

/** מילות התוכן של השאלה, בלי מילות שאלה וקישור. */
export function questionTerms(question) {
  return String(question ?? '').split(/\s+/).map(normWord)
    .filter((word) => word.length > 1 && !STOP.has(word));
}

function idf(word, index) {
  const df = index.vocab.get(word) || 0;
  return df ? Math.log(1 + index.N / df) : 0;
}

// נדירות המושג: הצורה הבסיסית הנפוצה ביותר.
function termIdf(term, index) {
  let min = Infinity;
  term.forms.forEach((weight, form) => {
    if (weight === 1) {
      const value = idf(form, index);
      if (value && value < min) min = value;
    }
  });
  return min === Infinity ? Math.log(1 + index.N) : min;
}

// כל הצורות יחד: משקל מרבי, ספירה מצטברת, ייחודיות לפי צורה בסיסית.
function termMatch(term, wordSet, counts, index) {
  let weight = 0;
  let tf = 0;
  let unique = false;
  let any = false;
  term.forms.forEach((formWeight, form) => {
    if (!wordSet.has(form)) return;
    any = true;
    weight = Math.max(weight, formWeight);
    tf += counts.get(form) || 1;
    if (formWeight === 1 && (index.vocab.get(form) || 0) < index.N * UNIQUE_SHARE) unique = true;
  });
  return any ? { weight, tf, unique } : null;
}

/** שלב 1: ציון הפריט. */
function scoreItem({ item, position, terms, maxWeight, index }) {
  const sequence = String(item?.text ?? '').split(/\s+/).map(normWord);
  const counts = new Map();
  sequence.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  const words = new Set(sequence);

  let total = 0;
  let unique = false;
  let present = 0;
  terms.forEach((term) => {
    const match = termMatch(term, words, counts, index);
    if (!match) return;
    present += 1;
    total += termIdf(term, index) * match.weight * (1 + TERM_FREQUENCY_BOOST * Math.log(match.tf));
    if (match.unique) unique = true;
  });

  // כמה ממילות השאלה נפגשות באותו משפט: חיזוק. אף שתיים לא נפגשות:
  // הציון יורד לרבע.
  let maxInSentence = 0;
  index.segs.filter((seg) => seg.position === position).forEach((seg) => {
    const n = terms.filter((term) => termMatch(term, seg.words, new Map(), index)).length;
    if (n > maxInSentence) maxInSentence = n;
  });
  let pairs = Math.max(0, maxInSentence - 1);

  // צמד מילים סמוכות בשאלה שמופיע צמוד גם בטקסט, באותו סדר: חיזוק
  // נוסף (שם רב מילי כמו "שער יפו").
  for (let k = 0; k < terms.length - 1; k += 1) {
    const first = terms[k].forms;
    const second = terms[k + 1].forms;
    for (let j = 0; j < sequence.length - 1; j += 1) {
      if (first.has(sequence[j]) && second.has(sequence[j + 1])) {
        pairs += ADJACENT_PAIR;
        break;
      }
    }
  }

  // מילה אחת מתוך שתיים ומעלה: ניחוש, לא תשובה.
  if (terms.length >= 2 && present < 2) return { score: 0, unique: false };

  let score = maxWeight ? total / maxWeight : 0;
  score *= 1 + PAIR_BOOST * pairs;
  if (present >= 2 && maxInSentence < 2) score *= NO_PAIR_FACTOR;
  return { score, unique };
}

/** שלב 2: המשפט הטוב ביותר בתוך הפריט. */
function pickSentence({ position, terms, question, index }) {
  const asked = String(question ?? '').trim();
  const wantsYear = WANTS_YEAR.test(asked);
  const wantsCount = WANTS_COUNT.test(asked);

  let best = null;
  let bestScore = -1;
  index.segs.filter((seg) => seg.position === position).forEach((seg) => {
    let score = 0;
    terms.forEach((term) => {
      const match = termMatch(term, seg.words, new Map(), index);
      if (match) score += termIdf(term, index) * match.weight;
    });
    if (wantsYear && hasYear(seg.text)) score *= YEAR_FACTOR;
    if (wantsCount && HAS_DIGIT.test(seg.text)) score *= COUNT_FACTOR;
    if (score > bestScore) {
      bestScore = score;
      best = seg;
    }
  });
  return best ? { index: best.idx, text: best.text } : null;
}

/**
 * החוזה של המנוע (מפה 3.2, שורת BE-04): שאלה ומאגר מועמדים נכנסים;
 * לכל מועמד יוצאים ציון, סימן ייחודיות, והמשפט הנבחר בפריט.
 *
 * הסדר הוא לפי ציון יורד. הסף, רצפת הייחודיות ושובר השוויון **אינם
 * כאן**: הם של BE-04 (BL-05 וזרימה ב).
 *
 * @param {object} input
 * @param {string} input.question טקסט השאלה.
 * @param {object[]} input.candidates מאגר המועמדים, אחרי סינון K1.
 * @returns {{item: object, score: number, unique: boolean,
 *   sentence: {index: number, text: string} | null}[]}
 */
export function rank({ question, candidates = [] } = {}) {
  const index = buildIndex(candidates);
  const terms = queryTermsFor(question, index);

  if (terms.length === 0) {
    return candidates.map((item) => ({ item, score: 0, unique: false, sentence: null }));
  }

  // נרמול כיסוי: גם מילים שאינן במאגר נספרות.
  const maxWeight = terms.reduce((sum, term) => sum + termIdf(term, index), 0);

  return candidates
    .map((item, position) => {
      const { score, unique } = scoreItem({ item, position, terms, maxWeight, index });
      return { item, score, unique, sentence: pickSentence({ position, terms, question, index }) };
    })
    .sort((a, b) => b.score - a.score);
}

export const ENGINE = Object.freeze({ id: 'lexical-two-stage', version: 2 });
