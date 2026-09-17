// מודול דמה לבדיקה, משימה 7 בתוכנית שלב 1; משלב 7 עזר בדיקה בלבד.
//
// עד שלב 7 הוא היה רשום ב-registry/modules.json כ-test-echo עם
// is_demo, ועם שורה אחת ברשימת המותר. שתי השורות הוסרו מהנתונים
// במשימה 2 של שלב 7 (מסמך הבנייה סעיף 7: "שאילתה על is_demo מחזירה
// אפס"). הקובץ נשאר תחת tests/helpers/ ("עזרי בדיקה ומודול הדמה",
// מסמך הבנייה סעיף 5): חמש בדיקות של הליבה צריכות מודול שאינו
// מייצג דרישה כדי להוכיח שהניתוב עובר ב-CORE-02, והשורות שהוא צריך
// ב-Registry קיימות כאן בלבד, ומצורפות לזריעה של הבדיקה.
//
// תפקידו היחיד: לאפשר להוכיח שהבקשה מנותבת דרך ה-Orchestrator ולא
// נקראת ישירות. הוא אינו מודול אמיתי ואינו מייצג דרישה.

/** שורת המודול, כפי שהייתה ב-modules.json עד שלב 7. */
export const TEST_MODULE_ROW = Object.freeze({
  id: 'test-echo',
  caller: null,
  handler: 'tests/helpers/echo-module.js',
  actions: Object.freeze(['echo']),
});

/** השורה ברשימת המותר, כפי שהייתה עד שלב 7. הפונה הוא tool-simulator, מהרשימה הסגורה של 4.1. */
export const TEST_ALLOW_ROW = Object.freeze({
  from: 'tool-simulator',
  module: 'test-echo',
  action: 'echo',
  allowed: true,
});

/** שתי הטבלאות עם שורות הבדיקה מצורפות. הקבצים שבמאגר אינם משתנים. */
export function withTestModule({ modules, allow_list: allowList }) {
  return {
    modules: { ...modules, modules: [...modules.modules, { ...TEST_MODULE_ROW, actions: [...TEST_MODULE_ROW.actions] }] },
    allow_list: { ...allowList, rows: [...allowList.rows, { ...TEST_ALLOW_ROW }] },
  };
}

/**
 * מחזיר את מה שקיבל, בלי לגעת בדבר.
 *
 * מקבל את מעטפת הבקשה ומחזיר את מעטפת התשובה, כמו כל מודול: הוא אינו
 * מגדיר מעטפה משלו (חוק ברזל 1) ואינו קורא למודול אחר (חוק ברזל 2).
 */
export function handle(request) {
  return { ok: true, data: { echo: request.payload } };
}
