// עוזר ההשוואה של מערך הבדיקות, משימה 8 בתוכנית שלב 1.
//
// עד המשימה הזאת כל קובץ בדיקה החזיק עוזר משלו. הריכוז כאן מבטיח
// שכל הרמות משוות באותה צורה ומדווחות באותו פורמט, וזה מה שמאפשר
// למריץ האחד לקרוא את התוצאה של כל קובץ.
//
// ההשוואה היא על JSON, ולכן היא עמוקה וגם רגישה לסדר. סדר הוא חלק
// ממה שנבדק כאן יותר מפעם אחת (סדר הקודים ב-4.5, סדר שורות היומן),
// ולכן זו התנהגות מכוונת.
//
// הוא אינו תלוי בדבר, ולכן אינו מפר את כיוון התלות ואינו נבדק במבחני
// המבנה: הוא יושב תחת tests/ ואינו קוד המערכת.

export function createChecker(label) {
  let passed = 0;
  const failures = [];

  function fail(name, detail) {
    failures.push(`${name}\n    ${detail}`);
  }

  /** משווה ערך למה שצפוי. */
  function check(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) passed += 1;
    else fail(name, `ציפיתי: ${e}\n    קיבלתי: ${a}`);
  }

  function recordThrow(name, thrown) {
    if (thrown instanceof Error) passed += 1;
    else fail(name, `נזרק משהו שאינו Error: ${String(thrown)}`);
  }

  /** מוודא שהקריאה נופלת בזריקה. */
  function checkThrows(name, fn) {
    try {
      fn();
      fail(name, 'ציפיתי לזריקה, והקריאה חזרה בשלום');
    } catch (thrown) {
      recordThrow(name, thrown);
    }
  }

  /** אותו דבר לקריאה אסינכרונית. */
  async function checkThrowsAsync(name, fn) {
    try {
      await fn();
      fail(name, 'ציפיתי לזריקה, והקריאה חזרה בשלום');
    } catch (thrown) {
      recordThrow(name, thrown);
    }
  }

  /**
   * מדפיס את שורת הסיכום ומסמן כשל בקוד היציאה.
   * extra הוא מידע נוסף לשורת הסיכום, למשל מה נסרק.
   */
  function report(extra = '') {
    console.log(`${label}: ${passed} עברו, ${failures.length} נכשלו${extra}`);
    for (const failure of failures) console.log(`  נכשל: ${failure}`);
    if (failures.length > 0) process.exitCode = 1;
    return failures.length === 0;
  }

  return { check, checkThrows, checkThrowsAsync, report };
}
