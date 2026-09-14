// BE-05: Content Governance. משימה 3 בתוכנית שלב 3.
//
// המקור: מפה 3.2 (שורת BE-05), 4.2 (הפעולות), 2.1 (הישויות),
// usecase-f-07 צעדים 3, 4, 8, 9, 12, 13, ו-BL-01, BL-02, BL-09.
//
// ההיקף היה F-07 בלבד בשלב 3. משימות 3 ו-4 של שלב 4 הוסיפו את
// פעולות התוכן של F-08 ושל F-13 ואת הנעילה, ובכך המודול שלם מול
// מפה 4.2: אין בו יותר פעולה שחוזרת כ-E-MODULE-FAILED.
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
import {
  canTransition,
  buildApprovalRecord,
  ITEM_STATUSES,
  SYSTEM,
  distanceMeters,
  lockReadiness,
  nextCorpusVersion,
  siteReopensOn,
  withinBounds,
} from '../core/business-logic.js';

// ארבע פעולות המעבר של F-07 (מפה 4.2, usecase-f-07 צעדים 1 ו-6).
// create_item ו-edit_item הם F-08, ולכן אינם ברשימה הזאת גם שהם
// בטבלת המעברים: הטבלה היא של הליבה, והרשימה כאן היא של השלב.
const TRANSITION_ACTIONS = Object.freeze(['submit', 'approve', 'reject', 'return']);

// שדות החובה של פריט, לפי usecase-f-08 צעד 3: "טקסט לא ריק, עמוד
// קיים, תחנה קיימת ברשימת התחנות של המסלול, מקור רשום, קואורדינטות
// בתוך גבולות המסלול". השם אינו ברשימה מפני שצעד 1 מונה אותו כשדה
// הזנה, וצעד 3 אינו דורש אותו בשלמות.
const ITEM_REQUIRED = Object.freeze(['text', 'page', 'stop_id', 'source_id']);

// שני ערכי audience של מפה 2.1 (הוכרע 12.09.2026). הערך "כולם"
// מופיע כאן מפני ש-BL-21 מסנן לפיו, והוא ערך של נתונים ולא סף
// משתנה: מפה 2.4 אינה מגדירה לו מפתח ב-reference.
const EVERYONE = 'כולם';

// שם המפתח, ולא הערך. הערך יושב בטבלת ה-reference (BL-12).
const NOTE_MAX_KEY = 'note_max_chars';

// אורך ההערה נאכף מאז משימה 10 של שלב 4. פער 38, שנפתח בשלב 3,
// נסגר במפה גרסה 3.4 במפתח note_max_chars, והאכיפה נדחתה במפורש
// לשלב הזה (doc-stage-03-gap-decisions סעיף 6 פריט 3).
//
// **הכרעה 15 בתוכנית שלב 4, בהכרעת בעלת הפרויקט**: הערה ארוכה
// מהגבול נקצצת, ואינה נדחית. אין ברשימה הסגורה של 4.5 קוד ל"הערה
// ארוכה מדי", וקוד חדש אינו מומצא (חוק ברזל 8). המסך מגביל את
// השדה מראש מאותו מפתח, ולכן הקיצוץ כאן הוא רשת ביטחון ולא הדרך
// הרגילה.

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

    const trimmed = trimNote(payload.note);
    if (trimmed.missing) return trimmed.missing;
    const note = trimmed.note;

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

  // -------------------------------------------------------------------
  // עזרי פעולות התוכן, משימה 3 בתוכנית שלב 4
  // -------------------------------------------------------------------

  /**
   * רושם רשומת APPROVALS ואז מחיל את השינוי. BL-01: אין שינוי מצב
   * בלי רשומה, וכשל כתיבה מבטל את המעבר.
   *
   * זה הסדר שכל פעולה שמשנה מצב עוברת בו, ולא רק המעברים של F-07:
   * יצירת פריט, החזרתו ל-draft בעריכה, פתיחת מסלול נעול ונעילתו.
   */
  function recordThen(record, apply) {
    try {
      repository.appendApproval(record);
    } catch {
      return failed('E-APPROVAL-WRITE-FAILED', { target: record.target, action: record.action });
    }
    return apply(record);
  }

  /**
   * קוצץ את ההערה לפי note_max_chars (מפה 2.4).
   *
   * המפתח נדרש רק כשיש הערה: הערה היא רשות (usecase-f-07 צעד 8),
   * ומעבר מצב בלי הערה אינו זקוק לגבול. חוק ברזל 5 חל על ערך
   * שהמערכת אינה יכולה לתפקד בלעדיו, וכאן היא יכולה.
   */
  function trimNote(note) {
    const text = typeof note === 'string' ? note : '';
    if (text === '') return { note: '' };

    const max = repository.getRef(NOTE_MAX_KEY);
    if (max === undefined || max === null) {
      return { missing: failed('E-REF-EMPTY', { key: NOTE_MAX_KEY }) };
    }

    return { note: text.length > max ? text.slice(0, max) : text, trimmed: text.length > max };
  }

  function approvalFor({ who, target, action, from, to, note = '' }) {
    return buildApprovalRecord({
      approval_id: `appr-${newId()}`,
      time: now(),
      who,
      target,
      action,
      from_status: from,
      to_status: to,
      note,
    });
  }

  /**
   * BL-07 ו-L6: יצירה או עריכה של פריט במסלול locked מחזירה את
   * המסלול ל-open.
   *
   * זהו שינוי מצב של מסלול, ולכן גם הוא נושא רשומת APPROVALS (BL-01,
   * שנוקב ב"פריט או מסלול"). הרשומה נושאת את הפעולה שגרמה לפתיחה,
   * ולא שם פעולה חדש: מפה 2.2 אומרת "אוטומטית, בכל create_item או
   * edit_item", ואינה נותנת לפתיחה שם משלה.
   */
  function reopenSiteIfLocked({ site, action, who }) {
    if (!siteReopensOn({ site_status: site?.status, action })) return null;

    const record = approvalFor({
      who, target: site.site_id, action, from: 'locked', to: 'open',
    });
    repository.appendApproval(record);
    repository.updateSite(site.site_id, { status: 'open' });
    return record;
  }

  /**
   * שלמות הפריט, usecase-f-08 צעד 3. מחזיר null כשהכול תקין, או
   * תשובת שגיאה מוכנה.
   *
   * שתי שגיאות שונות ולא אחת: שדה חסר הוא E-ITEM-INCOMPLETE עם שם
   * השדה, וקואורדינטות מחוץ לגבולות הן E-ANCHOR-OUT-OF-BOUNDS
   * (מפה 4.5). מיזוגן היה מסתיר מצוות התוכן איזו מהשתיים קרתה.
   */
  function itemProblem({ fields, site }) {
    const missing = missingField(
      { ...fields, page: fields.page === undefined || fields.page === null ? '' : String(fields.page) },
      ITEM_REQUIRED,
    );
    if (missing) return failed('E-ITEM-INCOMPLETE', { field: missing });

    if (!(site?.stops ?? []).includes(fields.stop_id)) {
      return failed('E-ITEM-INCOMPLETE', { field: 'stop_id' });
    }

    if (!repository.listSources().some((row) => row.source_id === fields.source_id)) {
      return failed('E-ITEM-INCOMPLETE', { field: 'source_id' });
    }

    if (!Number.isFinite(fields.lat) || !Number.isFinite(fields.lng)) {
      return failed('E-ITEM-INCOMPLETE', { field: Number.isFinite(fields.lat) ? 'lng' : 'lat' });
    }

    // null פירושו שלמסלול אין גבולות מוכרעים, ואז הבדיקה אינה רצה
    // ומדווחת כפער (פער 39). false פירושו שהיא רצה ונכשלה.
    const inside = withinBounds({ bounds: site?.bounds, lat: fields.lat, lng: fields.lng });
    if (inside === false) {
      return failed('E-ANCHOR-OUT-OF-BOUNDS', {
        lat: fields.lat, lng: fields.lng, bounds: site.bounds,
      });
    }

    return null;
  }

  // מפה 2.1: word_count הוא שדה של הפריט. הוא נגזר מהטקסט ואינו
  // מתקבל מהמסך, כדי ששני מקורות לא יחלקו על אורך אותו טקסט.
  function wordCount(text) {
    return String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
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
        // העוגן חוזר עם הפריט מאותו טעם שהוא חוזר עם
        // listApprovedByStop: מפה 4.4 נותנת ל-screen-content את
        // getItem ואת verify_anchor, ואינה נותנת לו פעולה שקוראת
        // עוגן. בלי זה המסך אינו יכול להראות אם העוגן אומת, ואומת
        // בשטח היה הופך לכפתור שפועל בעיוורון. נמצא באימות בדפדפן
        // בסוף שלב 4.
        anchor: item ? repository.getAnchorByItem(item.item_id) : null,
      });
    },

    listApprovals: ({ payload = {} }) => ok({ approvals: repository.listApprovals(payload) }),

    getSite: ({ payload = {} }) => ok({ site: repository.getSite(payload.site_id) }),

    listSources: ({ payload = {} }) => ok({ sources: repository.listSources(payload) }),

    listInstitutes: () => ok({ institutes: repository.listInstitutes() }),

    listMou: () => ok({ mou: repository.listMou() }),

    listExitPoints: ({ payload = {} }) => ok({
      exit_points: repository.listExitPoints(payload),
    }),

    /**
     * הפריטים המאושרים של נקודה, בסדר הפריטים (usecase-f-01-f-03
     * צעד 5). הפונה היחיד הוא module-delivery.
     *
     * K1 של F-05 מוחל גם על המסירה: פריט pending, draft או rejected
     * אינו מוחזר. הסינון הוא לפי מפתח ב-Repository, לפני כל דבר אחר.
     *
     * **BL-21, מסנן ה-audience, ופער 43**: מפה BL-21 קובעת ששליפה
     * ומסירה מסננות גם לפי audience, ואין ישות שנושאת את ה-audience
     * של הסשן: מפה 2.1 אינה מגדירה שדה כזה ב-SESSIONS, ו-4.2 אינה
     * מגדירה פעולה שקוראת אותו. לכן הפונה מוסר אותו ב-payload, וכשהוא
     * אינו נמסר עוברים פריטי "כולם" בלבד. זהו הכיוון הזהיר, והוא
     * מדווח כפער: ברירת מחדל שמוסרת תוכן למבוגרים בלבד למי שלא אמר
     * מי הוא היא בדיוק מה ש-F-06 בא למנוע.
     */
    listApprovedByStop: ({ payload = {} }) => {
      const items = repository.listItems({
        site_id: payload.site_id,
        stop_id: payload.stop_id,
        status: 'approved',
      });
      const audience = payload.audience ?? EVERYONE;
      const allowed = items.filter(
        (item) => item.audience === audience || item.audience === EVERYONE,
      );

      // העוגנים חוזרים עם הפריטים, מפני שמפה 3.2 קובעת ש-FE-04 קורא
      // "CONTENT_ITEMS ו-GEO_ANCHORS **דרך BE-05**". בלעדיהם FE-04
      // אינו יכול לבדוק is_crossing לפני המסירה (BL-19), והיה נאלץ
      // לגעת בישות שאינה שלו.
      return ok({
        items: allowed,
        anchors: allowed
          .map((item) => repository.getAnchorByItem(item.item_id))
          .filter(Boolean),
        audience,
      });
    },

    /**
     * נקודת היציאה הקרובה ביותר (F-13 תיקון 1). הפונה הוא מסך
     * המטייל, שזקוק לה כדי לבנות את הודעת חסימת הסוללה.
     *
     * מסלול בלי נקודת יציאה רשומה מחזיר E-NO-EXIT-POINT, כפי שמפה
     * 4.5 קובעת: "הודעת חסימת הסוללה אינה יכולה להיבנות". בלי
     * קואורדינטות של המשפחה אין "קרובה", ומוחזרת הראשונה עם המרחק
     * null, כדי שההודעה תוכל להיבנות בלי מיקום.
     */
    nearestExitPoint: ({ payload = {} }) => {
      const points = repository.listExitPoints({ site_id: payload.site_id });
      if (points.length === 0) {
        return failed('E-NO-EXIT-POINT', { site_id: payload.site_id ?? null });
      }

      if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
        return ok({ exit_point: points[0], distance_m: null });
      }

      const measured = points
        .map((point) => ({ point, distance: distanceMeters(payload, point) }))
        .sort((a, b) => a.distance - b.distance);

      return ok({
        exit_point: measured[0].point,
        distance_m: Math.round(measured[0].distance),
      });
    },

    // --- פעולות התוכן של F-08 ושל F-13 (usecase-f-08 צעדים 1 עד 8) ---

    /**
     * יצירת פריט, usecase-f-08 צעדים 1 עד 4.
     *
     * הסדר: שלמות, ואז רשומת APPROVALS, ואז הפריט והעוגן. הרשומה
     * ראשונה מפני ש-BL-01 קובע שאין מעבר מצב בלי רשומה, והשורה
     * (חדש) ל-draft בטבלת 2.2 היא מעבר כמו כל מעבר.
     *
     * העוגן נכתב עם verified = false ו-is_crossing = false: העוגן
     * נחשב בטוח עד שסומן אחרת (usecase-f-13 סעיף 3), והאימות הוא
     * פעולת שטח נפרדת (צעד 7).
     */
    create_item: ({ payload = {}, from }) => {
      const site = repository.getSite(payload.site_id);
      const fields = {
        text: payload.text,
        page: payload.page,
        stop_id: payload.stop_id,
        source_id: payload.source_id,
        lat: Number(payload.lat),
        lng: Number(payload.lng),
      };

      const verdict = canTransition({ status: null, action: 'create_item' });
      if (!verdict.allowed) return failed(verdict.code, verdict.data);

      const problem = itemProblem({ fields, site });
      if (problem) return problem;

      const itemId = `item-${newId()}`;
      const record = approvalFor({
        who: from, target: itemId, action: 'create_item', from: null, to: verdict.to,
      });

      return recordThen(record, () => {
        const item = repository.appendItem({
          item_id: itemId,
          site_id: site.site_id,
          stop_id: fields.stop_id,
          name: typeof payload.name === 'string' ? payload.name : '',
          text: fields.text,
          source_id: fields.source_id,
          page: payload.page,
          word_count: wordCount(fields.text),
          status: verdict.to,
          // מפה 2.1 מונה את audience בין שדות הפריט, ו-usecase-f-08
          // צעד 1 אינו מונה אותו בין שדות ההזנה. הוא נשמר כפי שהגיע
          // ואינו מומצא: ערך ברירת מחדל כאן היה קובע למי מותר לשמוע.
          audience: payload.audience ?? null,
        });

        const anchor = repository.appendAnchor({
          anchor_id: `anchor-${newId()}`,
          item_id: itemId,
          lat: fields.lat,
          lng: fields.lng,
          verified: false,
          verified_at: null,
          is_crossing: false,
        });

        const reopened = reopenSiteIfLocked({ site, action: 'create_item', who: from });

        return ok({ item, anchor, approval: record, site_reopened: reopened !== null });
      });
    },

    /**
     * עריכת פריט, usecase-f-08 צעד 5 ו-usecase-f-07 זרימה ה.
     *
     * ארבעה מצבים ושלוש התנהגויות, וכולן מהטבלה שבליבה:
     *   draft: עדכון שדות בלי מעבר מצב. אין מעבר, ולכן אין רשומה
     *     (BL-01 מדבר על שינוי מצב), והפריט ממילא טרם הוגש לאיש.
     *   approved: revert ל-draft, source system. זה המעבר היחיד
     *     בטבלה שאיש אינו שולח במעטפה, ולכן הוא מבוקש כאן במפורש.
     *   rejected: edit_item ל-draft, source caller.
     *   pending: אין שורה בטבלה, ולכן E-TRANSITION-DENIED. פריט
     *     שנמצא אצל החוקר אינו נערך מתחתיו.
     */
    edit_item: ({ payload = {}, from }) => {
      const item = repository.getItem(payload.item_id);
      const status = item?.status ?? null;

      // פריט שאינו קיים: אין לו מצב, ולכן אין לו שורה בטבלה.
      if (!item) {
        const verdict = canTransition({ status: null, action: 'edit_item' });
        return failed(verdict.code, verdict.data);
      }

      const site = repository.getSite(item.site_id);
      const fields = {
        text: payload.text ?? item.text,
        page: payload.page ?? item.page,
        stop_id: payload.stop_id ?? item.stop_id,
        source_id: payload.source_id ?? item.source_id,
        lat: Number(payload.lat ?? repository.getAnchorByItem(item.item_id)?.lat),
        lng: Number(payload.lng ?? repository.getAnchorByItem(item.item_id)?.lng),
      };

      const move = status === 'approved'
        ? { action: 'revert', source: SYSTEM }
        : { action: 'edit_item' };

      let to = status;
      if (status !== 'draft') {
        const verdict = canTransition({ status, ...move });
        if (!verdict.allowed) return failed(verdict.code, verdict.data);
        to = verdict.to;
      }

      const problem = itemProblem({ fields, site });
      if (problem) return problem;

      const apply = () => {
        const updated = repository.updateItem(item.item_id, {
          text: fields.text,
          page: fields.page,
          stop_id: fields.stop_id,
          source_id: fields.source_id,
          word_count: wordCount(fields.text),
          status: to,
          ...(payload.name === undefined ? {} : { name: payload.name }),
          ...(payload.audience === undefined ? {} : { audience: payload.audience }),
        });

        const anchor = repository.getAnchorByItem(item.item_id);
        if (anchor && (payload.lat !== undefined || payload.lng !== undefined)) {
          repository.updateAnchor(anchor.anchor_id, { lat: fields.lat, lng: fields.lng });
        }

        const reopened = reopenSiteIfLocked({ site, action: 'edit_item', who: from });

        return ok({
          item: updated,
          from_status: status,
          status: to,
          site_reopened: reopened !== null,
        });
      };

      if (status === 'draft') return apply();

      const noted = trimNote(payload.note);
      if (noted.missing) return noted.missing;

      const record = approvalFor({
        who: from,
        target: item.item_id,
        action: move.action,
        from: status,
        to,
        note: noted.note,
      });
      return recordThen(record, apply);
    },

    /**
     * אימות עוגן בשטח, usecase-f-08 צעדים 7 ו-8, ו-is_crossing של
     * usecase-f-13 סעיף 3.
     *
     * **אינו מחזיר פריט approved ל-draft** (הכרעה 11 בתוכנית שלב 4,
     * בהכרעת בעלת הפרויקט): BL-07 נוקב ב"יצירה או עריכה של פריט",
     * והחוקר אישר תוכן ולא קואורדינטה. הרשומה נכתבת בכל זאת, כדי
     * שהשינוי לא יהיה שקוף.
     */
    verify_anchor: ({ payload = {}, from }) => {
      const anchor = payload.anchor_id
        ? repository.getAnchor(payload.anchor_id)
        : repository.getAnchorByItem(payload.item_id);

      if (!anchor) return failed('E-ITEM-INCOMPLETE', { field: 'anchor_id' });

      const item = repository.getItem(anchor.item_id);
      const site = repository.getSite(item?.site_id);
      const lat = Number(payload.lat ?? anchor.lat);
      const lng = Number(payload.lng ?? anchor.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return failed('E-ITEM-INCOMPLETE', { field: Number.isFinite(lat) ? 'lng' : 'lat' });
      }

      if (withinBounds({ bounds: site?.bounds, lat, lng }) === false) {
        return failed('E-ANCHOR-OUT-OF-BOUNDS', { lat, lng, bounds: site.bounds });
      }

      const noted = trimNote(payload.note);
      if (noted.missing) return noted.missing;

      const at = now();
      const record = approvalFor({
        who: from,
        target: anchor.anchor_id,
        action: 'verify_anchor',
        from: anchor.verified === true ? 'מאומת' : 'לא מאומת',
        to: 'מאומת',
        note: noted.note,
      });

      return recordThen(record, () => ok({
        anchor: repository.updateAnchor(anchor.anchor_id, {
          lat,
          lng,
          verified: true,
          verified_at: at,
          // ברירת המחדל false נשמרת כשהפונה לא אמר דבר: העוגן נחשב
          // בטוח עד שסומן אחרת (usecase-f-13 סעיף 3).
          is_crossing: payload.is_crossing === true,
        }),
        approval: record,
      }));
    },

    /** רישום נקודת יציאה, F-13 תיקון 1. */
    register_exit_point: ({ payload = {} }) => {
      const missing = missingField(payload, ['name']);
      if (missing) return failed('E-ITEM-INCOMPLETE', { field: missing });

      const lat = Number(payload.lat);
      const lng = Number(payload.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return failed('E-ITEM-INCOMPLETE', { field: Number.isFinite(lat) ? 'lng' : 'lat' });
      }

      const site = repository.getSite(payload.site_id);
      const record = {
        exit_id: `exit-${newId()}`,
        site_id: site?.site_id ?? payload.site_id ?? null,
        lat,
        lng,
        name: payload.name,
        // מפה 2.1 מונה type בין שדות הישות, ואף מסמך אינו קובע
        // רשימה סגורה של סוגים, ולכן הוא עובר כפי שהגיע.
        type: payload.type ?? null,
      };
      repository.appendExitPoint(record);
      return ok({ exit_point: record });
    },

    /**
     * נעילת המסלול, usecase-f-08 צעדים 10 עד 12, ו-BL-06.
     *
     * L1 עד L4 נבדקים **מחדש בליבה** ברגע הנעילה, ולא נלקחים
     * מתצוגת המוכנות של צעד 9: בין התצוגה ללחיצה יכול היה להיכנס
     * פריט חדש. תנאי אחד שנכשל מחזיר E-LOCK-REFUSED עם רשימת
     * הכשלים, ואין שינוי מצב (מפה 4.5, ושורת BE-05 במפה 6.1).
     *
     * L5 הוא הפעולה עצמה: היא מגיעה במעטפה מאדם, ונרשמת ברשומת
     * APPROVALS ברמת המסלול עם corpus_version. הסדר הוא של BL-01,
     * הרשומה לפני המצב, ולכן נעילה שהיומן לא קלט אינה קורית.
     */
    lock_site: ({ payload = {}, from }) => {
      const site = repository.getSite(payload.site_id);
      if (!site) return failed('E-LOCK-REFUSED', { site_id: payload.site_id ?? null, failed: ['L2'] });

      const readiness = lockReadiness({
        site,
        items: repository.listItems({ site_id: site.site_id }),
        anchors: repository.listAnchors({ site_id: site.site_id }),
        approvals: repository.listApprovals(),
        sources: repository.listSources(),
        mou: repository.listMou(),
        at: now(),
      });

      if (!readiness.ready) {
        return failed('E-LOCK-REFUSED', {
          site_id: site.site_id,
          failed: readiness.failed,
          conditions: readiness.conditions,
        });
      }

      const noted = trimNote(payload.note);
      if (noted.missing) return noted.missing;

      const version = nextCorpusVersion(site);
      const at = now();
      const record = approvalFor({
        who: from,
        target: site.site_id,
        action: 'lock_site',
        from: site.status,
        to: 'locked',
        note: noted.note,
      });
      // corpus_version אינו שדה של APPROVALS במפה 2.1, ו-usecase-f-08
      // סעיף 4 דורש ש-L5 יירשם עם "מי, מתי, ומספר גרסת קורפוס".
      // הוא נכנס להערה ולא כשדה חדש, מפני שהוספת שדה לישות היא שינוי
      // Schema לפי CLAUDE.md סעיף 9.3. מדווח כפער.
      record.note = record.note === ''
        ? `corpus_version ${version}`
        : `${record.note} (corpus_version ${version})`;

      return recordThen(record, () => ok({
        site: repository.updateSite(site.site_id, {
          status: 'locked',
          locked_at: at,
          corpus_version: version,
        }),
        approval: record,
        corpus_version: version,
        readiness,
      }));
    },

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
