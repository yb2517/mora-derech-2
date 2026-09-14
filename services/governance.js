// BE-05: Content Governance, פרוסת F-07. משימות 3, 4 ו-5 בתוכנית שלב 3.
//
// המקור: מפה 3.2 (BE-05), 4.2 (הפעולות), 2.2 (טבלת המעברים, שיושבת
// בליבה), BL-01, BL-02, BL-09, ו-usecase-f-07 צעדים 3 עד 13.
//
// האחריות האחת: מעברי המצב של פריט, ורישום ההסכמים והישויות שהוא
// הבעלים שלהן. הוא הכותב היחיד של status ושל APPROVALS (BL-09).
//
// **מה אין כאן**: טבלת המעברים, שיושבת ב-core/business-logic.js לפי
// usecase-f-07 סעיף 8; גישה לאחסון, שהיא של הדרייבר בלבד; וקריאה
// למודול אחר, שאסורה בחוק ברזל 2. גם חישוב M-06 אינו כאן: הוא של
// BE-06, והמסך שואל את שניהם בנפרד.
//
// מה נבנה בשלב 3 ומה לא: ארבעת המעברים של F-07, register_mou, ושבע
// פעולות הקריאה שהפרוסה צריכה. create_item, edit_item, verify_anchor,
// register_source, register_institute, register_exit_point, lock_site,
// listApprovedByStop, nearestExitPoint ו-listExitPoints הן שלבים 4
// ו-5, ועד אז ההדגמה עומדת במקומן בהרכבה.

import { error } from '../core/errors.js';
import { findTransition, missingItemFields } from '../core/business-logic.js';

/**
 * הפעולות שהמודול הזה מממש בפועל.
 *
 * ההרכבה קוראת את הרשימה כדי לדעת מה כבר נבנה: פעולה שאינה כאן
 * ממשיכה אל ההדגמה ומסומנת is_demo, במקום להיראות כמו מודול אמיתי
 * שאינו עונה. הרשימה נמחקת יחד עם ההדגמה בשלב 7.
 */
export const ACTIONS = Object.freeze([
  'submit', 'approve', 'reject', 'return',
  'register_mou',
  'listItems', 'getItem', 'listApprovals', 'getSite', 'listSources', 'listInstitutes', 'listMou',
]);

const TRANSITION_ACTIONS = Object.freeze(['submit', 'approve', 'reject', 'return']);

const ok = (data) => ({ ok: true, data });
const fail = (code, data) => ({ ok: false, error: error(code, data) });

function defaultNow() {
  return new Date().toISOString();
}

function defaultNewId() {
  return globalThis.crypto.randomUUID();
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04. הדרך היחידה לנתונים.
 * @param {() => string} [options.now] חותמת זמן. מוזרקת בבדיקה.
 * @param {() => string} [options.newId] מזהה רשומה. מוזרק בבדיקה.
 */
export function create({ repository, now = defaultNow, newId = defaultNewId } = {}) {
  if (!repository) {
    throw new Error('BE-05 זקוק ל-Repository');
  }

  // --- מעבר מצב. BL-01, BL-02, ו-usecase-f-07 צעדים 3, 4, 8, 9 ---

  function move(action, payload, from) {
    const itemId = payload?.item_id;
    const item = repository.getItem(itemId);

    // פריט שאינו קיים אינו מקרה מיוחד: אין לו מצב, ולכן אין בטבלה
    // שורה שיוצאת ממנו, והוא נדחה בדיוק כמו כל מעבר שאינו בטבלה.
    // כך אין צורך בקוד שגיאה שאינו ברשימה הסגורה (חוק ברזל 8).
    const transition = findTransition(action, item ? item.status : null);
    if (!transition) {
      return fail('E-TRANSITION-DENIED', {
        item_id: itemId ?? null,
        action,
        from_status: item ? item.status : null,
      });
    }

    // תנאי השלמות של טבלה 2.2, בשורות שדורשות אותו. העוגן נקרא כאן
    // מפני שהליבה אינה קוראת נתונים.
    if (transition.requires_completeness) {
      const missing = missingItemFields(item, repository.getAnchorForItem(item.item_id));
      if (missing.length > 0) {
        return fail('E-ITEM-INCOMPLETE', { item_id: item.item_id, field: missing[0], fields: missing });
      }
    }

    // BL-01, וזה כל העניין: הרשומה נכתבת **לפני** שינוי המצב. כשל
    // בכתיבתה מחזיר קוד ומשאיר את הפריט במקומו, ולכן אין פריט
    // מאושר בלי עדות. הסדר נקוב בשם ב-APPROVAL_BEFORE_STATUS.
    let approval;
    try {
      approval = repository.appendApproval({
        approval_id: newId(),
        time: now(),
        // אין אימות זהות ב-v1 (הוכרע 12.09), ולכן המבצע שנרשם הוא
        // שם הפונה שבמעטפה: זה מה שהמערכת באמת יודעת. פער בדוח.
        who: from,
        target: item.item_id,
        action,
        from_status: item.status,
        to_status: transition.to_status,
        note: typeof payload?.note === 'string' ? payload.note : '',
      });
    } catch {
      return fail('E-APPROVAL-WRITE-FAILED', { item_id: item.item_id, action });
    }

    repository.setItemStatus(item.item_id, transition.to_status);

    return ok({
      item_id: item.item_id,
      from_status: item.status,
      status: transition.to_status,
      approval_id: approval?.approval_id ?? null,
    });
  }

  // --- register_mou. usecase-f-07 צעדים 12 ו-13 ---

  function registerMou(payload) {
    const instituteId = payload?.institute_id;
    const scope = payload?.scope;
    // שם השדה valid_until מסומן [טרם נקבע] במפה 2.1 לפי decision-02.
    // הוא נקרא כאן בשם שנתוני ההדגמה כבר כתבו, והפער בדוח.
    const validUntil = payload?.valid_until;

    if (!instituteId || !repository.listInstitutes().some((row) => row.institute_id === instituteId)) {
      return fail('E-ITEM-INCOMPLETE', { field: 'institute_id' });
    }
    if (!Array.isArray(scope) || scope.length === 0) {
      return fail('E-ITEM-INCOMPLETE', { field: 'scope' });
    }
    if (!validUntil) {
      return fail('E-ITEM-INCOMPLETE', { field: 'valid_until' });
    }

    const mou = repository.appendMou({
      mou_id: newId(),
      institute_id: instituteId,
      scope: [...scope],
      signed_at: payload?.signed_at ?? now(),
      valid_until: validUntil,
      // הוכרע 12.09: ההסכם מכסה אישור וגם תרומת תוכן.
      covers_content_contribution: payload?.covers_content_contribution === true,
    });

    return ok({ mou });
  }

  // --- פעולות הקריאה. מפה 4.2 כפי שתוקנה בפער 30 ---
  //
  // קריאה שאינה מוצאת דבר מחזירה רשימה ריקה או null עם ok, ולא קוד
  // שגיאה: הרשימה הסגורה של 4.5 נשארת סגורה (מפה גרסה 3.2).

  function siteOf(payload) {
    if (payload?.site_id !== undefined) return repository.getSite(payload.site_id);
    // גרסה 1 היא חד מסלולית, ואין במפה פעולה שמודיעה למסך על איזה
    // מסלול הוא עובד. בלי site_id מוחזר המסלול היחיד, וכשיש יותר
    // מאחד מוחזר null: הנחה שקופה עדיף על בחירה שרירותית. פער בדוח.
    const sites = repository.listSites();
    return sites.length === 1 ? sites[0] : null;
  }

  const READS = {
    // הרשימה יוצאת בלי הטקסט המלא: הוא נקרא ב-getItem, כשהחוקר
    // פותח את הפריט (usecase-f-07 צעד 5).
    listItems: (payload) => ok({
      items: repository
        .listItems({ site_id: payload?.site_id, stop_id: payload?.stop_id, status: payload?.status })
        .map(({ text, ...rest }) => rest),
    }),

    getItem: (payload) => {
      const item = repository.getItem(payload?.item_id);
      return ok({
        item,
        source: item
          ? repository.listSources().find((row) => row.source_id === item.source_id) ?? null
          : null,
        anchor: item ? repository.getAnchorForItem(item.item_id) : null,
      });
    },

    // ביומן ההחלטות של מסלול נכללות רשומות הפריטים שלו ורשומות
    // המסלול עצמו (נעילה, שלב 4). בלי site_id מוחזר היומן כולו.
    listApprovals: (payload) => {
      const all = repository.listApprovals();
      if (payload?.site_id === undefined) return ok({ approvals: all });
      const targets = new Set([
        payload.site_id,
        ...repository.listItems({ site_id: payload.site_id }).map((row) => row.item_id),
      ]);
      return ok({ approvals: all.filter((row) => targets.has(row.target)) });
    },

    getSite: (payload) => ok({ site: siteOf(payload) }),
    listSources: () => ok({ sources: repository.listSources() }),
    listInstitutes: () => ok({ institutes: repository.listInstitutes() }),
    listMou: () => ok({ mou: repository.listMou() }),
  };

  /**
   * ה-handler שה-Orchestrator מנתב אליו. מקבל מעטפת בקשה ומחזיר
   * { ok, data } או { ok, error }: המעטפה המלאה נבנית בליבה.
   */
  return function handle(request) {
    const action = request?.action;

    if (TRANSITION_ACTIONS.includes(action)) {
      return move(action, request?.payload, request?.from);
    }
    if (action === 'register_mou') {
      return registerMou(request?.payload);
    }
    const read = READS[action];
    if (read) {
      return read(request?.payload);
    }

    // פעולה שהמודול אינו מממש נופלת, וה-Orchestrator מחזיר
    // E-MODULE-FAILED. בהרכבה היא אינה מגיעה לכאן כלל: ACTIONS
    // מנתב אותה להדגמה כל עוד היא לא נבנתה.
    throw new Error(`BE-05 אינו מממש את הפעולה ${String(action)} בשלב זה`);
  };
}
