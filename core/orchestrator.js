// CORE-02: ה-Orchestrator. חמשת הצעדים.
//
// המקור: מפה 3.1 (CORE-02), BL-11 (סדר בדיקת הפונה), מפה 4.2 ו-4.3
// (רשימת המותר), מפה 4.5 (הקודים), BL-09 (audit_log נכתב בידי
// ה-Orchestrator), ושורה 6 בתוכנית שלב 1.
//
// הקובץ אינו נוגע באחסון ואינו מכיר מודול מסוים: הוא מקבל את
// ה-Repository ואת מפת ה-handlers, ולכן החלפת דרייבר או הוספת מודול
// אינן נוגעות בו (מבחן ההחלפה, חוק 1).
//
// חמשת הצעדים, לפי BL-11 ולפי שורה 6 בתוכנית:
//   1. אימות המעטפה (CORE-01).
//   2. הפונה: from קיים, from ברשימה הסגורה, ושורה ברשימת המותר.
//   3. רישום הבקשה עם request_id. כשל רישום עוצר, והבקשה אינה מנותבת.
//   4. ניתוב ל-handler אחד.
//   5. רישום התשובה תחת אותו request_id, והחזרה.

import { validate, okResponse, errorResponse } from './contract.js';
import { error } from './errors.js';

const PHASE_REQUEST = 'request';
const PHASE_RESPONSE = 'response';

function defaultRequestId() {
  return globalThis.crypto.randomUUID();
}

function defaultNow() {
  return new Date().toISOString();
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04. הגישה היחידה לנתונים.
 * @param {Record<string, Function>} options.handlers מזהה מודול לפונקציה.
 * @param {() => string} [options.newRequestId] מזהה בקשה. מוזרק בבדיקה.
 * @param {() => string} [options.now] חותמת זמן. מוזרקת בבדיקה.
 */
export function createOrchestrator({
  repository,
  handlers = {},
  newRequestId = defaultRequestId,
  now = defaultNow,
} = {}) {
  if (!repository) {
    throw new Error('ה-Orchestrator זקוק ל-Repository');
  }

  // השורה ביומן אינה נושאת את ה-payload. BL-18 אוסר זיהוי אישי בנתונים,
  // וה-payload נושא שאלות של המשפחה. היומן מתעד מי ביקש מה, לא את התוכן.
  function auditRow(requestId, phase, request, outcome) {
    return {
      request_id: requestId,
      phase,
      at: now(),
      from: typeof request?.from === 'string' ? request.from : null,
      module: typeof request?.module === 'string' ? request.module : null,
      action: typeof request?.action === 'string' ? request.action : null,
      ...outcome,
    };
  }

  function callerIsKnown(from) {
    return repository.listCallers().includes(from);
  }

  function rowIsAllowed(request) {
    return repository.listAllowed().some(
      (row) => row.from === request.from
        && row.module === request.module
        && row.action === request.action
        && row.allowed === true,
    );
  }

  return {
    /**
     * מעביר בקשה בחמשת הצעדים ומחזיר את מעטפת התשובה.
     *
     * async כדי שדרייבר ענן או handler אסינכרוני בשלבים הבאים לא
     * יחייבו שינוי בחוזה הזה. await על ערך שאינו הבטחה תקין.
     */
    async handle(request) {
      const requestId = newRequestId();

      // צעדים 1 ו-2: המעטפה והפונה, בסדר של BL-11.
      let rejection = null;

      const verdict = validate(request);
      if (!verdict.valid) {
        rejection = error(verdict.code, verdict.data);
      } else if (!callerIsKnown(request.from)) {
        rejection = error('E-FROM-UNKNOWN', { from: request.from });
      } else if (!rowIsAllowed(request)) {
        rejection = error('E-ALLOW-DENIED', {
          from: request.from,
          module: request.module,
          action: request.action,
        });
      }

      // צעד 3: רישום הבקשה. כשל רישום עוצר, והבקשה אינה מנותבת (BL-11).
      // גם בקשה שנדחתה נרשמת: מבחן מבנה 04 דורש שכל בקשה תותיר שורה.
      try {
        await repository.appendAudit(
          auditRow(requestId, PHASE_REQUEST, request, {
            rejected_with: rejection ? rejection.code : null,
          }),
        );
      } catch {
        return errorResponse(error('E-AUDIT-WRITE-FAILED', { request_id: requestId }));
      }

      // בקשה שנדחתה בצעד 1 או 2 אינה מנותבת. התשובה נרשמת ומוחזרת.
      if (rejection) {
        return await respond(requestId, request, errorResponse(rejection));
      }

      // צעד 4: ניתוב ל-handler אחד.
      //
      // מודול שיש לו שורה מותרת ואין לו handler הוא תקלת הרכבה, לא
      // שגיאה עסקית, ולכן הוא נופל בזריקה ואינו מקבל קוד: הרשימה
      // הסגורה של 4.5 אינה מונה קוד למודול שאינו מגיב, וקוד שאינו
      // ברשימה אינו נזרק (חוק ברזל 8). אותו נימוק חל על handler שנופל
      // מעצמו: הזריקה עוברת הלאה ואינה מתורגמת לקוד מומצא. פער מדווח.
      const handler = handlers[request.module];
      if (typeof handler !== 'function') {
        throw new Error(`אין handler רשום למודול ${String(request.module)}`);
      }

      return await respond(requestId, request, await handler(request));
    },
  };

  // צעד 5: רישום התשובה תחת אותו request_id, והחזרה.
  async function respond(requestId, request, response) {
    const shaped = response && typeof response === 'object' && 'ok' in response
      ? response
      : okResponse(response ?? null);

    try {
      await repository.appendAudit(
        auditRow(requestId, PHASE_RESPONSE, request, {
          ok: shaped.ok === true,
          error_code: shaped.error?.code ?? null,
        }),
      );
    } catch {
      return errorResponse(error('E-AUDIT-WRITE-FAILED', { request_id: requestId }));
    }

    return shaped;
  }
}
