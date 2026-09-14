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
import { rank } from './retrieval-ranker.js';

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
   * BL-13: התשובה היא ציטוט או קיצוץ מהפריט, עד answer_max_words,
   * בגבול משפט. אין ניסוח מחדש.
   *
   * **הכרעה 5 בתוכנית שלב 4, בהכרעת בעלת הפרויקט**: כשאף משפט אינו
   * נכנס במכסה, נמסר המשפט הראשון במלואו ולא חציו. קיצוץ באמצע
   * משפט הוא שינוי משמעות, ו-BL-13 אוסר שינוי. החריגה מדווחת
   * בתשובה כדי שתגיע ליומן ולצוות התוכן.
   */
  function compose(text, maxWords) {
    const sentences = String(text ?? '')
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const taken = [];
    let words = 0;

    for (const sentence of sentences) {
      const count = sentence.split(/\s+/).filter(Boolean).length;
      if (words + count > maxWords) break;
      taken.push(sentence);
      words += count;
    }

    if (taken.length > 0) {
      return { answer: taken.join(' '), words, over_limit: false };
    }

    const first = sentences[0] ?? String(text ?? '').trim();
    return {
      answer: first,
      words: first.split(/\s+/).filter(Boolean).length,
      over_limit: first !== '',
    };
  }

  /**
   * שובר השוויון של usecase-f-05 זרימה ב (הכרעה 4 בתוכנית שלב 4):
   * הפריט של התחנה הנוכחית קודם, ואם שניהם באותה תחנה, הקצר.
   *
   * הוא כאן ולא במנוע הדירוג מפני שהוא כלל עסקי ולא חישוב דמיון:
   * מנוע סמנטי שיחליף את הדירוג לא יידע עליו דבר, וטוב שכך.
   */
  function pickLeader(scored, stopId) {
    const top = scored[0].score;
    const tied = scored.filter((row) => row.score === top);
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
      const considered = scored.map((row) => ({ item_id: row.item.item_id, score: row.score }));

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

      if (scored.length === 0 || scored[0].score < threshold.value) return abstain();

      const leader = pickLeader(scored, payload.stop_id);
      const composed = compose(leader.item.text, maxWords.value);

      return ok({
        answer: composed.answer,
        source_item: leader.item.item_id,
        source_page: leader.item.page ?? null,
        source_stop: leader.item.stop_id ?? null,
        is_fallback: false,
        score: leader.score,
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
