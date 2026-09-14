// BE-05: Content Governance. משימה 3 בתוכנית שלב 3.
//
// המקור: מפה 3.2 (שורת BE-05), 4.2 (הפעולות), 2.1 (הישויות),
// usecase-f-07 צעדים 3, 4, 8, 9, 12, 13, ו-BL-01, BL-02, BL-09.
//
// **ההיקף הוא F-07 ואותו בלבד.** פעולות ה-BE-05 של F-08 ושל F-13
// (create_item, edit_item, verify_anchor, register_exit_point,
// lock_site, nearestExitPoint, listExitPoints, listApprovedByStop)
// נבנות בשלב 4, ואינן כאן. בקשה לאחת מהן מקבלת E-MODULE-FAILED
// מה-Orchestrator, גלוי לעין (הכרעה 3 בתוכנית השלב, בהכרעת בעלת
// הפרויקט 14.09.2026). זו התנהגות מוגדרת ולא תקלה: מודול שיענה
// תשובה מנומסת על פעולה שלא נבנתה יסתיר את מה שחסר.
//
// מה המודול הזה אינו עושה:
//   אינו מחליט אם מעבר מותר. הטבלה בליבה, והוא שואל אותה (BL-02,
//   ומבחן ההחלפה של usecase-f-07 סעיף 8).
//
//   אינו נוגע באחסון ואינו מכיר טבלה. הוא מקבל את ה-Repository
//   בהזרקה ומדבר בשמות עסקיים (חוק ברזל 3 ו-7).
//
//   אינו קורא למודול אחר. מצב השער הוא של BE-06, והמסך הוא שמרכיב
//   את שתי התשובות (חוק ברזל 2).
//
//   אינו מגדיר מעטפה ואינו ממציא קוד שגיאה. הוא מחזיר { ok, data }
//   או { ok: false, error } עם קוד מהרשימה הסגורה של 4.5.

import { error } from '../core/errors.js';
import { canTransition, buildApprovalRecord, ITEM_STATUSES } from '../core/business-logic.js';

// ארבע פעולות המעבר של F-07 (מפה 4.2, usecase-f-07 צעדים 1 ו-6).
// create_item ו-edit_item הם F-08, ולכן אינם ברשימה הזאת גם שהם
// בטבלת המעברים: הטבלה היא של הליבה, והרשימה כאן היא של השלב.
const TRANSITION_ACTIONS = Object.freeze(['submit', 'approve', 'reject', 'return']);

// **אורך ההערה אינו נאכף כאן, וזה פער ולא השמטה** (פער 38).
// usecase-f-07 צעד 6 כותב "הערה עד 200 תווים", למפה 2.4 אין מפתח
// לאורך הזה, ו-BL-12 אוסר ערך משתנה בקוד. שלושת המסמכים אינם
// מאפשרים לאכוף את הגבול בשום מקום בלי להמציא מפתח או להפר כלל,
// ולכן ההערה נשמרת כפי שהגיעה, הפער מדווח, והתיקון הוא מפתח
// בטבלה בהכרעת בעלת הפרויקט.

function defaultNewId() {
  return globalThis.crypto.randomUUID();
}

function defaultNow() {
  return new Date().toISOString();
}

function ok(data) {
  return { ok: true, data };
}

function failed(code, data) {
  return { ok: false, error: error(code, data) };
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04, מוזרק בהרכבה.
 * @param {() => string} [options.newId] מזהים לרשומות חדשות.
 * @param {() => string} [options.now] חותמת הזמן של הרשומה.
 */
export function create({ repository, newId = defaultNewId, now = defaultNow } = {}) {
  if (!repository) {
    throw new Error('BE-05 זקוק ל-Repository');
  }

  // מוני המצבים של המסלול. usecase-f-07 צעד 11 מבקש ש-counts יחזרו
  // עם התשובה, וזו ספירה של הישות ש-BE-05 הוא הבעלים שלה. מצב השער
  // אינו כאן: הוא של BE-06.
  function countsFor(siteId) {
    const items = repository.listItems({ site_id: siteId });
    // ארבעת המצבים תמיד, גם כשאין בהם פריט: מונה שנעלם כשהוא מתאפס
    // נראה על המסך כמו מונה שלא נטען. השמות מהליבה (מפה 2.1).
    const counts = Object.fromEntries(ITEM_STATUSES.map((status) => [status, 0]));
    for (const item of items) {
      if (counts[item.status] !== undefined) counts[item.status] += 1;
    }
    return counts;
  }

  /**
   * מעבר מצב של פריט, לפי BL-01 ו-BL-02.
   *
   * הסדר קבוע ואינו נתון לשיקול דעת: קודם הטבלה שבליבה מכריעה, אחר
   * כך רשומת APPROVALS נכתבת, ורק אחרי שהכתיבה הצליחה המצב משתנה.
   * זהו BL-01 בקוד: "אין שינוי מצב בלי רשומת APPROVALS. כשל כתיבה
   * מבטל את המעבר".
   */
  function transition(request) {
    const { action, payload = {}, from } = request;
    const item = repository.getItem(payload.item_id);

    // פריט שאינו קיים, או בקשה בלי מזהה: אין מצב נוכחי, ולכן אין
    // שורה בטבלת המעברים, ולכן E-TRANSITION-DENIED. אין ברשימה
    // הסגורה של 4.5 קוד ל"פריט לא נמצא", ולא ממציאים אחד כדי לדווח
    // מדויק יותר (חוק ברזל 8). מדווח כפער בדוח השלב.
    const status = item?.status ?? null;

    const verdict = canTransition({ status, action });
    if (!verdict.allowed) {
      return failed(verdict.code, verdict.data);
    }

    const note = typeof payload.note === 'string' ? payload.note : '';

    const record = buildApprovalRecord({
      approval_id: `appr-${newId()}`,
      time: now(),
      // פער 32: אין זהות משתמש במעטפה, ולכן נרשם שם הפונה כפי
      // שהגיע. ה-Orchestrator כבר אימת אותו מול רשימת המותר
      // (BL-11), ולכן זה ערך נבדק ולא הצהרה של המסך על עצמו.
      who: from,
      target: item.item_id,
      action,
      from_status: status,
      to_status: verdict.to,
      note,
    });

    try {
      repository.appendApproval(record);
    } catch {
      // המצב לא נגע. זו בדיוק זרימה ב של usecase-f-07: "BE-05 אינו
      // משנה את מצב הפריט: אין שינוי מצב בלי רשומת ביקורת".
      return failed('E-APPROVAL-WRITE-FAILED', { item_id: item.item_id, action });
    }

    // כשל כאן הוא המקרה ההפוך, ונדיר יותר: רשומה נכתבה והמצב לא
    // השתנה. אין לו קוד ברשימה הסגורה, ולכן הוא אינו נבלע כאן:
    // ה-Orchestrator מחזיר עליו E-MODULE-FAILED ורושם אותו, והיומן
    // נשאר עדות למה שנוסה. מדווח כפער בדוח השלב.
    const updated = repository.setStatus(item.item_id, verdict.to);

    return ok({
      item_id: item.item_id,
      status: updated?.status ?? verdict.to,
      from_status: status,
      approval: record,
      counts: countsFor(item.site_id),
    });
  }

  // שדה חובה שחסר מוחזר ב-E-ITEM-INCOMPLETE, ו-error.data נושא את
  // שמו (מפה 4.5). הקוד נוסח ב-4.5 על יצירה ועריכה של פריט, ורישום
  // הסכם או מכון הוא יצירה גם הוא. מדווח כפער בדוח השלב.
  function missingField(payload, fields) {
    const missing = fields.find((field) => {
      const value = payload?.[field];
      if (Array.isArray(value)) return value.length === 0;
      return typeof value !== 'string' || value.trim() === '';
    });
    return missing ?? null;
  }

  const ACTIONS = {
    // --- הקריאות שהמסכים מציגים (מפה 4.2, פער 30) ---

    listItems: ({ payload = {} }) => ok({
      items: repository.listItems(payload).map(({ text, ...rest }) => rest),
    }),

    getItem: ({ payload = {} }) => {
      const item = repository.getItem(payload.item_id);
      return ok({
        item,
        source: item
          ? repository.listSources().find((row) => row.source_id === item.source_id) ?? null
          : null,
      });
    },

    listApprovals: ({ payload = {} }) => ok({ approvals: repository.listApprovals(payload) }),

    getSite: ({ payload = {} }) => ok({ site: repository.getSite(payload.site_id) }),

    listSources: ({ payload = {} }) => ok({ sources: repository.listSources(payload) }),

    listInstitutes: () => ok({ institutes: repository.listInstitutes() }),

    listMou: () => ok({ mou: repository.listMou() }),

    // --- רישום ההסכם והמכון (usecase-f-07 צעדים 12 ו-13) ---

    register_mou: ({ payload = {} }) => {
      const missing = missingField(payload, ['institute_id', 'scope', 'signed_at', 'valid_until']);
      if (missing) return failed('E-ITEM-INCOMPLETE', { field: missing });

      if (!repository.listInstitutes().some((row) => row.institute_id === payload.institute_id)) {
        return failed('E-ITEM-INCOMPLETE', { field: 'institute_id' });
      }

      // ההיקף הוא רשימת source_id (מפה 2.1), והקישור למקורות הוא
      // הרשימה הזאת (usecase-f-07 צעד 13). מקור שאינו רשום אינו
      // נכנס להיקף בשקט: הסכם שמכסה מקור שאינו קיים יזייף את M-06.
      const known = new Set(repository.listSources().map((row) => row.source_id));
      const unknown = payload.scope.filter((id) => !known.has(id));
      if (unknown.length > 0) return failed('E-ITEM-INCOMPLETE', { field: 'scope', unknown });

      const record = {
        mou_id: `mou-${newId()}`,
        institute_id: payload.institute_id,
        scope: [...payload.scope],
        signed_at: payload.signed_at,
        valid_until: payload.valid_until,
        // הוכרע 12.09.2026: ההסכם מכסה אישור וגם תרומת תוכן.
        covers_content_contribution: payload.covers_content_contribution === true,
      };
      repository.appendMou(record);
      return ok({ mou: record });
    },

    register_institute: ({ payload = {} }) => {
      const missing = missingField(payload, ['name']);
      if (missing) return failed('E-ITEM-INCOMPLETE', { field: missing });

      const record = { institute_id: `inst-${newId()}`, name: payload.name };
      repository.appendInstitute(record);
      return ok({ institute: record });
    },

    register_source: ({ payload = {} }) => {
      const missing = missingField(payload, ['name']);
      if (missing) return failed('E-ITEM-INCOMPLETE', { field: missing });

      // file ו-publisher הם שדות הישות (מפה 2.1) ואף מסמך אינו קובע
      // שהם חובה, ולכן הם עוברים כמות שהם ואינם נדרשים כאן.
      const record = {
        source_id: `src-${newId()}`,
        name: payload.name,
        file: payload.file ?? null,
        publisher: payload.publisher ?? null,
      };
      repository.appendSource(record);
      return ok({ source: record });
    },
  };

  for (const action of TRANSITION_ACTIONS) {
    ACTIONS[action] = transition;
  }

  /** ה-handler שה-Orchestrator מנתב אליו. */
  return function handle(request) {
    const handler = ACTIONS[request?.action];
    if (typeof handler !== 'function') {
      // הזריקה היא מכוונת: ה-Orchestrator הופך אותה ל-E-MODULE-FAILED
      // ורושם אותה, במקום שהמודול ימציא קוד לפעולה שלא נבנתה.
      throw new Error(`BE-05 אינו מממש את הפעולה ${request?.action} בשלב הזה`);
    }
    return handler(request);
  };
}

// אין כאן export default, וזה מכוון: נקודת הכניסה מזהה מודול שמייצא
// create כמודול שצריך הרכבה, ומזריקה לו את ה-Repository (הכרעה 4
// בתוכנית השלב). ייצוא ברירת מחדל היה נטען כ-handler מוכן, בלי
// נתונים, ונופל בבקשה הראשונה.
