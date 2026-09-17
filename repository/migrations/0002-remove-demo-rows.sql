-- מיגרציה 0002: הסרת נתוני ההדגמה מהמסד החי. משימה 5 בתוכנית שלב 7,
-- הכרעה 1, באישור בעלת הפרויקט 17.09.2026.
--
-- המקור: מסמך הבנייה סעיף 7 ("הסרה בשלב 7, ובדיקת קבלה: שאילתה על
-- is_demo מחזירה אפס"); דוח שלב 5 חלק ב סעיף 6 פריט 3 (שורות במסלול
-- ההדגמה שאינן מסומנות); CLAUDE.md סעיף 11 (הסוכן אינו מוחק נתונים
-- בלי אישור, ולכן ההרצה היא באישור מפורש).
--
-- העותק הזה יושב במאגר לקריאה. הוא הוחל על הפרויקט בענן בכלי הניהול
-- של הספק, והדרייבר אינו קורא אותו. ל-Repository אין פעולת מחיקה,
-- בכוונה (decision-01: הסתרה במקום מחיקה), ולכן המחיקה אינה עוברת
-- דרך המערכת.
--
-- ההיקף, ולא מעבר לו:
--   1. כל שורה שבה is_demo = true, בעשר טבלאות הישויות.
--   2. שורות sessions ו-interactions של מסלול ההדגמה שאינן מסומנות:
--      אימות הטלפון של שלב 5 חלק ב פתח סשנים דרך המערכת, ו-BE-07 אינו
--      מסמן is_demo.
-- audit_log אינו נמחק: יומן המערכת, append-only, ואף מסמך אינו מונה
-- אותו בין נתוני ההדגמה. reference אינו נגוע. העמודה is_demo נשארת
-- בסכימה: הסרתה היא שינוי Schema, ואינה בהיקף.

begin;

-- 2. השורות הלא מסומנות של מסלול ההדגמה, לפי הסשן.
delete from public.interactions
 where session_id in (select session_id from public.sessions where site_id = 'site-demo-jaffa');
delete from public.sessions where site_id = 'site-demo-jaffa';

-- 1. כל המסומן.
delete from public.interactions  where is_demo = true;
delete from public.sessions      where is_demo = true;
delete from public.approvals     where is_demo = true;
delete from public.geo_anchors   where is_demo = true;
delete from public.exit_points   where is_demo = true;
delete from public.content_items where is_demo = true;
delete from public.rights_mou    where is_demo = true;
delete from public.sources       where is_demo = true;
delete from public.institutes    where is_demo = true;
delete from public.sites         where is_demo = true;

commit;

-- בדיקת הקבלה, אחרי ההחלה: אפס בכל טבלת ישויות, ו-audit_log כפי שהיה.
-- select count(*) from public.content_items;   -- 0
-- select count(*) from public.sessions;        -- 0
-- select count(*) from public.audit_log;       -- 342, לא נגע
