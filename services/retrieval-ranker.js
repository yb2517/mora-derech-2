// מנוע הדירוג של BE-04. מודול נשלף (הכרעה ד1, ו-CLAUDE.md סעיף 5).
//
// המקור: usecase-f-05 צעד 5 ("BE-04 מדרג כל מועמד מול השאלה ומחשב
// ציון רלוונטיות"), סעיף 9 ("מנוע הדירוג, לקסיקלי היום וסמנטי מחר:
// אם נחליף אותו מחר לא יישבר דבר, כל עוד הוא מקבל מאגר מועמדים
// ומחזיר ציונים"), והכרעה פתוחה 9 במפה (לקסיקלי מול סמנטי).
//
// **זה הקובץ שנועד להיות מוחלף.** החוזה שלו הוא שורה אחת: הוא מקבל
// שאלה ומאגר מועמדים, ומחזיר לכל מועמד ציון בין 0 ל-1. הוא אינו
// יודע מהו הסף, אינו יודע מה קורה מתחתיו, אינו קורא נתונים, אינו
// מכיר מעטפה ואינו מכיר קוד שגיאה. מעבר לשליפה סמנטית הוא החלפת
// הקובץ הזה, ולא נגיעה ב-BE-04 (מבחן ההחלפה).
//
// **מה הוא אינו**: הוא אינו הסינון לפי מפתח. K1 של usecase-f-05
// נאכף לפני שהמאגר מגיע לכאן, וזה חלק מהחוזה ולא פרט מימוש: דירוג
// על הכול ואז סינון התוצאה נותן אותה תשובה ברוב המקרים, ונכשל
// בדיוק במקרה שחשוב.
//
// המימוש: לקסיקלי דו שלבי, לפי הכרעת בנייה 01 (אין מודל שפה בזמן
// ריצה, ואין embeddings ב-v1). הוא **אינו העתק** של המנוע באב
// הטיפוס, שאינו במאגר, אלא מימוש של אותה הגדרה: התאמה מדויקת
// תחילה, ואז התאמה סלחנית יותר במשקל נמוך.

// מילות שאלה ומילות קישור. הן אינן ערך משתנה במובן של BL-12: אין
// להן מפתח במפה 2.4, הן אינן סף ואינן מספר, והן נכס לשוני של המנוע
// הזה. מנוע אחר יביא את שלו, או לא יזדקק לאף אחת.
const STOP_WORDS = new Set([
  'מה', 'מי', 'מתי', 'איפה', 'למה', 'איך', 'כמה', 'האם', 'איזה', 'איזו',
  'של', 'את', 'עם', 'על', 'אל', 'זה', 'זו', 'הוא', 'היא', 'הם', 'הן',
  'יש', 'אין', 'לי', 'לנו', 'כאן', 'שם', 'פה', 'גם', 'רק', 'כל', 'אבל',
  'או', 'כי', 'אם', 'לא', 'כן', 'היה', 'הייתה', 'אני', 'אתה', 'אנחנו',
]);

// אותיות השימוש של העברית. השלב השני מסיר אות פתיחה אחת כזאת ומנסה
// שוב, וכך "בכיכר" מוצא את "כיכר". זו הסלחנות היחידה שהמנוע מרשה
// לעצמו: הוא אינו מנחש שורשים ואינו מרחיב שאילתה.
const PREFIXES = 'והבלמשכ';

// משקל ההתאמה בשלב השני. התאמה מדויקת שווה 1, והתאמה אחרי הסרת אות
// שימוש שווה פחות, מפני שהיא עשויה להיות מקרית.
const LOOSE_WEIGHT = 0.6;

// משקל הבונוס על הופעה בשם הפריט. שם התחנה הוא אות חזקה יותר
// מהופעה כלשהי בגוף הטקסט, והבונוס מוגבל כדי שלא יכריע לבדו.
const NAME_BONUS = 0.15;

function normalize(text) {
  return String(text ?? '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text).split(' ').filter(Boolean);
}

function stripPrefix(token) {
  return token.length > 2 && PREFIXES.includes(token[0]) ? token.slice(1) : token;
}

/** מילות התוכן של השאלה: אחרי נרמול, בלי מילות שאלה וקישור. */
export function questionTerms(question) {
  const tokens = tokenize(question).filter((token) => !STOP_WORDS.has(token));
  // שאלה שכולה מילות שאלה אינה מאבדת את כולן: עדיף לדרג על מילה
  // חלשה מאשר לדרג על כלום ולהחזיר הימנעות בכל מקרה.
  return tokens.length > 0 ? tokens : tokenize(question);
}

/**
 * ציון מועמד יחיד, בין 0 ל-1.
 *
 * הציון הוא שיעור מילות התוכן של השאלה שנמצאו בפריט: שאלה שכל
 * מילותיה מופיעות מקבלת 1, ושאלה שאף מילה בה אינה מופיעה מקבלת 0.
 * זה מה שהופך את הסף 0.28 לקריא: כשליש ממילות השאלה.
 */
export function score({ terms, item }) {
  if (terms.length === 0) return 0;

  const exact = new Set(tokenize(item?.text));
  const loose = new Set([...exact].map(stripPrefix));
  const inName = new Set(tokenize(item?.name));

  let matched = 0;
  let nameHits = 0;

  for (const term of terms) {
    if (exact.has(term)) matched += 1;
    else if (loose.has(stripPrefix(term))) matched += LOOSE_WEIGHT;
    if (inName.has(term) || inName.has(stripPrefix(term))) nameHits += 1;
  }

  const base = matched / terms.length;
  const bonus = nameHits > 0 ? NAME_BONUS : 0;
  return Math.min(1, Number((base + bonus).toFixed(4)));
}

/**
 * החוזה של המנוע: שאלה ומאגר מועמדים נכנסים, ציונים יוצאים.
 *
 * הסדר הוא לפי ציון יורד. שובר השוויון **אינו כאן**: הוא כלל עסקי
 * של usecase-f-05 זרימה ב, והוא של BE-04. מנוע אחר לא יידע עליו
 * דבר, וזו בדיוק הנקודה.
 *
 * @param {object} input
 * @param {string} input.question טקסט השאלה.
 * @param {object[]} input.candidates מאגר המועמדים, אחרי סינון K1.
 * @returns {{item: object, score: number}[]}
 */
export function rank({ question, candidates = [] } = {}) {
  const terms = questionTerms(question);
  return candidates
    .map((item) => ({ item, score: score({ terms, item }) }))
    .sort((a, b) => b.score - a.score);
}

export const ENGINE = Object.freeze({ id: 'lexical-two-stage', version: 1 });
