// BE-04: Retrieval. משימה 6 בתוכנית שלב 4.
//
// המקור: מפה 3.2 (שורת BE-04), 4.2 (retrieve), usecase-f-05 (הזרימה
// הראשית וזרימות א עד ו), ו-BL-03, BL-04, BL-05, BL-13, BL-14, BL-21.
//
// שלושת הכללים של usecase-f-05 סעיף 4, ואיפה כל אחד נאכף כאן:
//   K1: מאגר המועמדים כולל פריטים approved בלבד, מהמסלול הנוכחי,
//       ממקור תחת הסכם בתוקף. נאכף ב-candidatePool, **לפני** כל
//       דירוג. הסדר הוא חלק מהחוזה ולא פרט מימוש.
//   K2: אין קריאה לרשת חיצונית. הקובץ הזה אינו מייבא דבר מלבד
//       הליבה ומנוע הדירוג, ואין בו fetch. מבחן מבנה 02 שומר על
//       הצד השני של אותו כלל.
//   K3: אין מועמד מעל הסף, ומוחזרת ההימנעות בנוסח הנעול. אין
//       השלמה, אין ניחוש, ואין ניסוח מחדש של פריט לא רלוונטי.
//
// המודול **אינו כותב דבר** לקורפוס (מפה 3.2: "כותב: אין"). שורת
// ה-abstained היא מעטפה ל-BE-07, ולא כתיבה: BL-09 נותן ל-BE-07 את
// הבעלות על INTERACTIONS.

import { error } from '../core/errors.js';
import { mouInEffect } from '../core/business-logic.js';
import { rank, sentencesOf } from './retrieval-ranker.js';

const EVERYONE = 'כולם';

function ok(data) {
  return { ok: true, data };
}

function failed(code, data) {
  return { ok: false, error: error(code, data) };
}

function defaultNow() {
  return new Date().toISOString();
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04.
 * @param {(request: object) => Promise<object>} [options.send] הכתובת
 *   האחת, מוזרקת בהרכבה. דרכה נשלחת שורת ה-abstained ל-BE-07, בלי
 *   שהמודול יקרא למודול אחר ישירות (חוק ברזל 2).
 * @param {string} [options.caller] שם הפונה של המודול, מעמודת caller
 *   בטבלת המודולים. **אינו כתוב כאן**, בדיוק כפי שהוא אינו כתוב
 *   במסך: מפה 4.3 קובעת "הוספת מסך או פונה: שורה, לא קוד", ומבחן
 *   מבנה 06 אוכף זאת. מודול שיחתום את שמו בעצמו הופך את ההצהרה
 *   לבלתי ניתנת לבדיקה.
 * @param {() => string} [options.now]
 */
export function create({ repository, send, caller, now = defaultNow } = {}) {
  if (!repository) {
    throw new Error('BE-04 זקוק ל-Repository');
  }

  /** ערך מטבלת ה-reference, או שגיאה. חוק ברזל 5 ו-BL-12. */
  function ref(key) {
    const value = repository.getRef(key);
    return value === undefined || value === null
      ? { missing: failed('E-REF-EMPTY', { key }) }
      : { value };
  }

  /**
   * K1: מאגר המועמדים, לפי מפתח בלבד.
   *
   * ארבעה מסננים, וכולם לפני הדירוג: מצב approved, המסלול הנוכחי,
   * מקור תחת הסכם בתוקף (BL-03), ו-audience (BL-21).
   *
   * **פער 43**: אין ישות שנושאת את ה-audience של הסשן, ולכן הוא
   * מגיע ב-payload, וכשאינו מגיע עוברים פריטי "כולם" בלבד. אותו
   * כלל בדיוק חל ב-listApprovedByStop של BE-05, כדי ששליפה ומסירה
   * לא יסננו אחרת.
   */
  function candidatePool({ siteId, audience, at }) {
    const items = repository.listItems({ site_id: siteId, status: 'approved' });

    const covered = new Set(
      repository.listMou()
        .filter((mou) => mouInEffect(mou, at))
        .flatMap((mou) => mou.scope ?? []),
    );

    return items
      .filter((item) => covered.has(item.source_id))
      .filter((item) => item.audience === audience || item.audience === EVERYONE);
  }

  /**
   * BL-13 בנוסח מפה 3.12 (פער 81): התשובה היא ציטוט מהפריט, בלי
   * ניסוח מחדש. המשפט שהמנוע בחר בתוך הפריט נמסר, ואחריו המשפט הבא
   * בפריט אם שניהם יחד נכנסים ב-answer_max_words. החיתוך בגבול משפט
   * בלבד.
   *
   * **הכרעה 5 בתוכנית שלב 4, בהכרעת בעלת הפרויקט**: משפט ארוך מהמכסה
   * נמסר במלואו ולא חציו. קיצוץ באמצע משפט הוא שינוי משמעות, ו-BL-13
   * אוסר שינוי. החריגה מדווחת בתשובה כדי שתגיע ליומן ולצוות התוכן.
   * זו גם הסטייה המכוונת (א) מאב הטיפוס, שקיצץ ל-60 מילים (הכרעה 1
   * בתוכנית שלב 8).
   *
   * המשפט מזוהה במיקומו ברשימת המשפטים של הפריט, באותה חלוקה שהמנוע
   * משתמש בה. מנוע שלא בחר משפט (אין לו) מוביל למשפט הראשון.
   */
  function compose(text, sentenceIndex, maxWords) {
    const sentences = sentencesOf(text);
    const countWords = (value) => value.split(/\s+/).filter(Boolean).length;
    const at = Number.isInteger(sentenceIndex) && sentences[sentenceIndex] !== undefined
      ? sentenceIndex
      : 0;
    const chosen = sentences[at] ?? String(text ?? '').trim();
    const next = sentences[at + 1];

    const withNext = next !== undefined ? `${chosen} ${next}` : null;
    const answer = withNext !== null && countWords(withNext) <= maxWords ? withNext : chosen;
    const words = countWords(answer);

    return {
      answer,
      sentence_index: at,
      words,
      over_limit: words > maxWords,
    };
  }

  /**
   * שובר השוויון של usecase-f-05 זרימה ב (הכרעה 4 בתוכנית שלב 4):
   * הפריט של התחנה הנוכחית קודם, ואם שניהם באותה תחנה, הקצר.
   *
   * הוא כאן ולא במנוע הדירוג מפני שהוא כלל עסקי ולא חישוב דמיון:
   * מנוע סמנטי שיחליף את הדירוג לא יידע עליו דבר, וטוב שכך.
   */
  function pickLeader(eligible, stopId) {
    const top = eligible[0].score;
    const tied = eligible.filter((row) => row.score === top);
    if (tied.length === 1) return tied[0];

    const here = tied.filter((row) => stopId !== undefined && row.item.stop_id === stopId);
    const pool = here.length > 0 ? here : tied;

    return [...pool].sort(
      (a, b) => String(a.item.text ?? '').length - String(b.item.text ?? '').length,
    )[0];
  }

  /**
   * שורת abstained ל-BE-07 (מפה 4.2, ו-interaction_types בטבלת
   * ה-reference). BL-10: היומן אינו חוסם את החוויה, ולכן כשל שליחה
   * נבלע כאן ואינו הופך את התשובה לשגיאה.
   */
  async function logAbstention({ sessionId, stopId, question }) {
    if (typeof send !== 'function' || !sessionId || !caller) return;
    try {
      await send({
        from: caller,
        module: 'BE-07',
        action: 'log',
        payload: {
          session_id: sessionId, type: 'abstained', stop_id: stopId ?? null, question,
        },
      });
    } catch {
      // הצד השני של BL-10: המשפחה כבר שמעה את ההימנעות.
    }
  }

  const ACTIONS = {
    /**
     * usecase-f-05 צעדים 3 עד 10.
     *
     * BL-14: שגיאת קלט והימנעות הם שני מצבים שונים עם שני קודים.
     * שאלה ריקה, ארוכה מדי או בלי מסלול היא E-QUESTION-INVALID, ולא
     * הימנעות: "לא הבנתי את השאלה" אינו "אין לי מידע מאומת".
     */
    retrieve: async ({ payload = {} }) => {
      const maxChars = ref('question_max_chars');
      if (maxChars.missing) return maxChars.missing;

      const question = typeof payload.question === 'string' ? payload.question.trim() : '';
      if (question === '') return failed('E-QUESTION-INVALID', { reason: 'empty' });
      if (question.length > maxChars.value) {
        return failed('E-QUESTION-INVALID', { reason: 'too_long', max: maxChars.value });
      }
      if (typeof payload.site_id !== 'string' || payload.site_id === '') {
        return failed('E-QUESTION-INVALID', { reason: 'missing_site' });
      }

      const threshold = ref('relevance_threshold');
      if (threshold.missing) return threshold.missing;
      const maxWords = ref('answer_max_words');
      if (maxWords.missing) return maxWords.missing;
      const fallback = ref('fallback_text');
      if (fallback.missing) return fallback.missing;

      const at = now();
      let candidates;
      try {
        candidates = candidatePool({
          siteId: payload.site_id,
          audience: payload.audience ?? EVERYONE,
          at,
        });
      } catch {
        // זרימה ד: BE-04 אינו מנחש ואינו מחזיר תשובה חלקית.
        return failed('E-RETRIEVAL-FAILED', { site_id: payload.site_id });
      }

      const scored = rank({ question, candidates });
      const considered = scored.map((row) => ({
        item_id: row.item.item_id, score: row.score, unique: row.unique === true,
      }));

      const abstain = async () => {
        await logAbstention({
          sessionId: payload.session_id, stopId: payload.stop_id, question,
        });
        return ok({
          answer: fallback.value,
          source_item: null,
          source_page: null,
          is_fallback: true,
          considered,
          threshold: threshold.value,
        });
      };

      // K3 ו-BL-05 בנוסח מפה 3.12: מועמד נחשב רק אם הוא מעל הסף וגם
      // עבר את רצפת הייחודיות שהמנוע מסמן. הסדר של המנוע נשמר.
      const eligible = scored.filter((row) => row.score >= threshold.value && row.unique === true);
      if (eligible.length === 0) return abstain();

      const leader = pickLeader(eligible, payload.stop_id);
      const composed = compose(leader.item.text, leader.sentence?.index, maxWords.value);

      return ok({
        answer: composed.answer,
        source_item: leader.item.item_id,
        source_page: leader.item.page ?? null,
        source_stop: leader.item.stop_id ?? null,
        is_fallback: false,
        score: leader.score,
        sentence_index: composed.sentence_index,
        words: composed.words,
        // הכרעה 5: משפט שחרג מהמכסה נמסר במלואו, והחריגה מדווחת.
        over_limit: composed.over_limit,
        considered,
        threshold: threshold.value,
      });
    },
  };

  return function handle(request) {
    const handler = ACTIONS[request?.action];
    if (typeof handler !== 'function') {
      throw new Error(`BE-04 אינו מממש את הפעולה ${request?.action}`);
    }
    return handler(request);
  };
}
