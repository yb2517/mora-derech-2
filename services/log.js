// BE-07: Interaction Log. משימה 9 בתוכנית שלב 4.
//
// המקור: מפה 3.2 (שורת BE-07: "סשנים, רשומות אינטראקציה, סגירת
// סשנים, חישוב M-01 ו-M-02, ייצוא"), 4.2 (ארבע שורות), usecase-f-09
// (הזרימה הראשית וזרימות א עד ו), ו-BL-10, BL-16, BL-17, BL-18.
//
// **זהו הכותב היחיד של SESSIONS ושל INTERACTIONS** (BL-09). מודול
// השיחה, FE-04 ומסך המטייל אינם כותבים ליומן בעצמם: הם שולחים
// מעטפת log דרך ה-Orchestrator, וכאן היא מאומתת ונכתבת. זה מה
// שמאפשר לתיוג להיות אחיד, ולכן ל-M-01 להיות מדיד.
//
// ההבחנה בין שני היומנים, usecase-f-09 זרימה א: יומן ההחלטות של
// F-07 הוא **תנאי** לפעולה, ויומן האינטראקציות הוא **עדות** לפעולה.
// הראשון חוסם, השני לעולם לא (BL-10). לכן כשל כתיבה כאן מסמן את
// הסשן partial_log וממשיך, במקום לעצור משפחה באמצע רחוב.

import { error } from '../core/errors.js';

// דגלי הסשן של מפה 2.1. הם נתון ולא קוד: מי מדליק אותם הוא הפונה,
// וכאן הם רק נשמרים.
const PARTIAL_LOG = 'partial_log';
const SIMULATOR = 'simulator';

// **הכרעה 9 בתוכנית שלב 4, בהכרעת בעלת הפרויקט**: שלושה ניסיונות
// כתיבה, ואז הכשל מדווח והסשן מסומן. זו ההצעה שבזרימה א3 של
// usecase-f-09. אין לו מפתח במפה 2.4, ולכן הוא אינו סף משתנה אלא
// מספר הניסיונות של אותו תור. מדווח כפער.
const WRITE_ATTEMPTS = 3;

function ok(data) {
  return { ok: true, data };
}

function failed(code, data) {
  return { ok: false, error: error(code, data) };
}

function defaultNewId() {
  return globalThis.crypto.randomUUID();
}

function defaultNow() {
  return new Date().toISOString();
}

/** חציון. מדגם ריק מחזיר null, ולא אפס: "אין נתון" אינו "אפס". */
export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04.
 * @param {() => string} [options.newId]
 * @param {() => string} [options.now]
 */
export function create({ repository, newId = defaultNewId, now = defaultNow } = {}) {
  if (!repository) {
    throw new Error('BE-07 זקוק ל-Repository');
  }

  function ref(key) {
    const value = repository.getRef(key);
    return value === undefined || value === null
      ? { missing: failed('E-REF-EMPTY', { key }) }
      : { value };
  }

  function flagsOf(session) {
    return Array.isArray(session?.flags) ? session.flags : [];
  }

  function markPartial(session) {
    if (flagsOf(session).includes(PARTIAL_LOG)) return;
    repository.updateSession(session.session_id, {
      flags: [...flagsOf(session), PARTIAL_LOG],
    });
  }

  /**
   * BL-10 והכרעה 9: שלושה ניסיונות, ואז הסשן מסומן partial_log
   * והכשל מדווח. הדיווח הוא E-LOG-WRITE-FAILED, וה-Orchestrator
   * רושם אותו ב-audit_log תחת אותו request_id, וזה "רישום הכשל
   * ב-Audit Log" של זרימה א3.
   */
  function writeWithRetries(record, session) {
    for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt += 1) {
      try {
        return { row: repository.appendInteraction(record) };
      } catch (thrown) {
        if (attempt === WRITE_ATTEMPTS) {
          markPartial(session);
          return { failure: thrown, attempts: attempt };
        }
      }
    }
    return { failure: new Error('לא נכתב'), attempts: WRITE_ATTEMPTS };
  }

  /**
   * BL-17: שורה מתקבלת רק אם הסוג ברשימה הסגורה **ו**-from מורשה
   * לסוג הזה.
   *
   * שני התנאים נקראים מטבלת ה-reference: interaction_types
   * ו-interaction_type_senders. לא מהקוד, ולא מרשימת המותר: רשימת
   * המותר יודעת שמודול רשאי לשלוח log, ואינה יודעת איזה סוג.
   *
   * **זו ההגנה של הבדיקה האדומה השלישית** (מפה 6.5): שורת initiated
   * שנשלחה שלא ממודול השיחה חייבת להידחות, אחרת M-01 מתנפח משורה
   * שמודול לא מורשה יצר.
   */
  function typeProblem({ type, from }) {
    const types = ref('interaction_types');
    if (types.missing) return types.missing;
    const senders = ref('interaction_type_senders');
    if (senders.missing) return senders.missing;

    if (!types.value.includes(type)) {
      return failed('E-LOG-TYPE-INVALID', { type: type ?? null, reason: 'unknown_type' });
    }

    const allowed = senders.value[type] ?? [];
    if (!allowed.includes(from)) {
      return failed('E-LOG-TYPE-INVALID', { type, from: from ?? null, reason: 'sender_not_allowed', allowed });
    }

    return null;
  }

  const ACTIONS = {
    /**
     * usecase-f-09 צעדים 1 ו-2.
     *
     * **הכרעה 2 בתוכנית שלב 4, בהכרעת בעלת הפרויקט** (ההכרעה
     * הפתוחה 5 במפה, שחסמה את השלב): סשן שעודנו פתוח ממשיך באותו
     * session_id, מפני שטעינת דף אינה אירוע במודל. סשן שנסגר,
     * בסיום או ב-close_stale, פותח סשן חדש עם previous_session_id
     * שמצביע עליו, וכך "שתי הרשומות מצביעות זו על זו" של זרימה ה3.
     *
     * BL-18: session_id אקראי. אין שם, אין חשבון, ואין מזהה מכשיר.
     */
    session_start: ({ payload = {} }) => {
      // הפונה נושא מזהה כשהוא יודע אותו. כשאינו יודע, למשל אחרי
      // טעינת דף, הסשן הפתוח של המסלול נמצא כאן מהנתונים.
      //
      // **מדוע לא מהמסך**: הכרעה 2 ניסחה את החידוש כך שהמסך יחזיק
      // את המזהה באחסון הדפדפן, וחוק ברזל 3 קובע שרק CORE-04 נוגע
      // באחסון. הכוונה נשמרת והמנגנון השתנה: הסשן הפתוח נמצא
      // בנתונים, שהם ממילא המקום היחיד ששורד טעינה. **מדווח כפער**,
      // מפני שבמכשיר משותף שני מטיילים יתחלקו בסשן אחד, וזה נפתח
      // מחדש בשלב 5 עם הענן.
      const byId = payload.session_id ? repository.getSession(payload.session_id) : null;
      const open = byId ?? repository.listSessions({ site_id: payload.site_id })
        .filter((row) => row.ended_at === null)
        .at(-1) ?? null;
      const existing = open;

      if (existing && existing.ended_at === null) {
        return ok({ session: existing, resumed: true });
      }

      const session = repository.appendSession({
        session_id: `sess-${newId()}`,
        site_id: payload.site_id ?? null,
        started_at: now(),
        ended_at: null,
        completed: false,
        last_stop_id: null,
        flags: Array.isArray(payload.flags) ? [...payload.flags] : [],
        previous_session_id: existing ? existing.session_id : null,
      });

      return ok({ session, resumed: false });
    },

    /**
     * usecase-f-09 צעד 3 עד 5.
     *
     * הסדר: הסשן קיים ופתוח, הסוג והשולח מותרים, ואז הכתיבה.
     */
    log: ({ payload = {}, from }) => {
      const session = repository.getSession(payload.session_id);
      if (!session || session.ended_at !== null) {
        return failed('E-SESSION-CLOSED', { session_id: payload.session_id ?? null });
      }

      const problem = typeProblem({ type: payload.type, from });
      if (problem) return problem;

      // BL-18: אין זיהוי אישי. מה שנכתב הוא שדות מפה 2.1 ואלה בלבד,
      // ושדה שאינו רלוונטי לסוג נשאר ריק (usecase-f-09 צעד 3).
      const record = {
        interaction_id: `int-${newId()}`,
        session_id: session.session_id,
        time: typeof payload.time === 'string' ? payload.time : now(),
        type: payload.type,
        stop_id: payload.stop_id ?? null,
        item_id: payload.item_id ?? null,
        question: typeof payload.question === 'string' ? payload.question : null,
        source_item: payload.source_item ?? null,
        is_fallback: payload.is_fallback === true,
        accuracy: payload.accuracy ?? null,
        duration_ms: payload.duration_ms ?? null,
        displayed_as_text: payload.displayed_as_text === true,
      };

      const written = writeWithRetries(record, session);
      if (written.failure) {
        return failed('E-LOG-WRITE-FAILED', {
          session_id: session.session_id, type: payload.type, attempts: written.attempts,
        });
      }

      // צעד 6: התחנה האחרונה נשמרת בסשן, וממנה נגזר completed.
      if (record.stop_id) {
        repository.updateSession(session.session_id, { last_stop_id: record.stop_id });
      }

      return ok({ interaction: written.row });
    },

    /**
     * usecase-f-09 צעד 6.
     *
     * **הכרעה 7 בתוכנית שלב 4**: completed נכון כאשר נרשמה הגעה
     * לנקודה האחרונה ברשימת התחנות של SITES. זו ההצעה שבזרימה,
     * והיא היחידה שאינה דורשת שדה חדש.
     */
    session_end: ({ payload = {} }) => {
      const session = repository.getSession(payload.session_id);
      if (!session) {
        return failed('E-SESSION-CLOSED', { session_id: payload.session_id ?? null });
      }
      if (session.ended_at !== null) {
        return ok({ session, already_closed: true });
      }

      const site = repository.getSite(session.site_id);
      const lastStop = (site?.stops ?? []).at(-1) ?? null;
      const reached = repository.listInteractions({ session_id: session.session_id })
        .some((row) => row.stop_id === lastStop && lastStop !== null);

      const flags = Array.isArray(payload.flags)
        ? [...new Set([...flagsOf(session), ...payload.flags])]
        : flagsOf(session);

      return ok({
        session: repository.updateSession(session.session_id, {
          ended_at: now(),
          completed: reached,
          flags,
        }),
        completed: reached,
      });
    },

    /**
     * usecase-f-09 צעד 7. הפונה הוא system-timer.
     *
     * סשן שלא רשם אירוע במשך stale_session_minutes נסגר עם
     * completed = false. הפרק נקרא מטבלת ה-reference, ו-usecase-f-09
     * זרימה ה מסבירה למה הוא ארוך: הפסקת קפה של 45 דקות אינה נשירה.
     */
    close_stale: ({ payload = {} }) => {
      const minutes = ref('stale_session_minutes');
      if (minutes.missing) return minutes.missing;

      const at = now();

      // הפרק מוחסר ביחידות שלו, ולא בהמרה למילישניות. מבחן מבנה 05
      // תפס כאן את המספר 60 של "שניות בדקה" וזיהה אותו כערך של
      // טבלת ה-reference, ובצדק: המבחן אינו יודע להבחין בין השניים,
      // ולכן מוטב שלא יהיה בקוד מספר שצריך להסביר.
      const cutoffDate = new Date(Date.parse(at));
      cutoffDate.setMinutes(cutoffDate.getMinutes() - minutes.value);
      const cutoff = cutoffDate.getTime();

      const closed = repository.listSessions({ site_id: payload.site_id })
        .filter((session) => session.ended_at === null)
        .filter((session) => {
          const rows = repository.listInteractions({ session_id: session.session_id });
          const last = rows.length === 0
            ? Date.parse(session.started_at)
            : Math.max(...rows.map((row) => Date.parse(row.time)));
          return Number.isFinite(last) && last < cutoff;
        })
        .map((session) => {
          const rows = repository.listInteractions({ session_id: session.session_id });
          return repository.updateSession(session.session_id, {
            ended_at: at,
            completed: false,
            last_stop_id: session.last_stop_id ?? rows.at(-1)?.stop_id ?? null,
          });
        });

      return ok({ closed: closed.map((session) => session.session_id), checked_at: at });
    },

    /**
     * usecase-f-09 צעדים 9 ו-10.
     *
     * המדגם, לפי BL-16 והכרעה 8: סשן עם דגל simulator או partial_log
     * אינו נספר, וסשן נספר אם רשם לפחות הגעה אחת, כלומר שורת pushed
     * או arrived_no_content.
     *
     * M-01 הוא חציון שורות initiated לסשן, ו-M-02 שיעור הסשנים עם
     * completed. ההשוואה היא "גדול או שווה" (מפה 6.1, usecase-f-09
     * זרימה ד: "הסף הוא לפחות 3, ולכן 3.0 עובר").
     */
    compute_metrics: ({ payload = {} }) => {
      const keys = ['m01_threshold', 'm02_threshold', 'sample_min', 'sample_max'];
      const values = {};
      for (const key of keys) {
        const value = ref(key);
        if (value.missing) return value.missing;
        values[key] = value.value;
      }

      const all = repository.listSessions({
        site_id: payload.site_id, from: payload.from_date, to: payload.to_date,
      });

      const excluded = { simulator: 0, partial_log: 0, no_arrival: 0 };
      const sample = all.filter((session) => {
        const flags = flagsOf(session);
        if (flags.includes(SIMULATOR)) { excluded.simulator += 1; return false; }
        if (flags.includes(PARTIAL_LOG)) { excluded.partial_log += 1; return false; }
        const rows = repository.listInteractions({ session_id: session.session_id });
        const arrived = rows.some((row) => row.type === 'pushed' || row.type === 'arrived_no_content');
        if (!arrived) { excluded.no_arrival += 1; return false; }
        return true;
      });

      const counts = { initiated: 0, attempt_failed: 0, arrived_no_content: 0, abstained: 0, is_fallback: 0 };
      const initiatedPerSession = sample.map((session) => {
        const rows = repository.listInteractions({ session_id: session.session_id });
        for (const row of rows) {
          if (counts[row.type] !== undefined) counts[row.type] += 1;
          if (row.is_fallback === true) counts.is_fallback += 1;
        }
        return rows.filter((row) => row.type === 'initiated').length;
      });

      const n = sample.length;
      const m01 = median(initiatedPerSession);
      const m02 = n === 0 ? null : sample.filter((session) => session.completed === true).length / n;

      return ok({
        n,
        sample_small: n < values.sample_min,
        sample_min: values.sample_min,
        sample_max: values.sample_max,
        excluded,
        metrics: [
          {
            metric: 'M-01',
            name: 'חציון שאלות יזומות',
            value: m01,
            threshold: values.m01_threshold,
            passes: m01 !== null && m01 >= values.m01_threshold,
          },
          {
            metric: 'M-02',
            name: 'שיעור השלמת מסלול',
            value: m02,
            threshold: values.m02_threshold,
            passes: m02 !== null && m02 >= values.m02_threshold,
          },
        ],
        counts,
        computed_at: now(),
      });
    },

    /**
     * usecase-f-09 צעד 11. הייצוא נעשה מאותו חישוב.
     *
     * **פער 45**: usecase-f-09 צעד 11 וסעיף 7 משאירים פתוח אם
     * הייצוא כולל את טקסט השאלות, ותולים זאת בהכרעת הפרטיות של
     * PRD סעיפים 25 עד 29. עד שתוכרע, הייצוא **אינו כולל** את
     * הטקסט: BL-18 אוסר זיהוי אישי בנתונים, ושאלה שמשפחה שאלה
     * ברחוב היא הדבר הקרוב ביותר לכך ביומן. ההשמטה מוצהרת בתשובה
     * ואינה שקטה.
     */
    export: (request) => {
      const computed = ACTIONS.compute_metrics(request);
      if (!computed.ok) return computed;

      const header = ['session_id', 'started_at', 'ended_at', 'completed', 'initiated', 'pushed', 'flags'];
      const rows = repository.listSessions({
        site_id: request.payload?.site_id,
        from: request.payload?.from_date,
        to: request.payload?.to_date,
      }).map((session) => {
        const interactions = repository.listInteractions({ session_id: session.session_id });
        return [
          session.session_id,
          session.started_at,
          session.ended_at ?? '',
          session.completed === true ? 'true' : 'false',
          interactions.filter((row) => row.type === 'initiated').length,
          interactions.filter((row) => row.type === 'pushed').length,
          flagsOf(session).join(' '),
        ];
      });

      const csv = [header, ...rows]
        .map((row) => row.map((cell) => String(cell)).join(','))
        .join('\n');

      return ok({
        csv,
        rows: rows.length,
        metrics: computed.data.metrics,
        n: computed.data.n,
        includes_question_text: false,
        omitted: ['question'],
      });
    },
  };

  return function handle(request) {
    const handler = ACTIONS[request?.action];
    if (typeof handler !== 'function') {
      throw new Error(`BE-07 אינו מממש את הפעולה ${request?.action}`);
    }
    return handler(request);
  };
}
