-- מיגרציה 0001: שתים עשרה הטבלאות של דרייבר הענן. משימה 13.2 בתוכנית
-- שלב 5 חלק ב, שינוי Schema באישור בעלת הפרויקט 16.09.2026.
--
-- המקור: מפה 2.1 (הישויות והשדות), BL-09 (כותב אחד לכל עמודה),
-- decision-05 סעיף 4 (מדיניות הגישה פתוחה ב-v1), תוכנית חלק ב
-- סעיף 5 (הטבלאות) והכרעות ב1, ב4, ב5 ו-ב6.
--
-- העותק הזה יושב במאגר לקריאה. הוא הוחל על הפרויקט בענן בכלי
-- apply_migration, והדרייבר אינו קורא אותו.
--
-- שדות זמן הם text ולא timestamptz: המודולים כותבים חותמות ISO
-- ומשווים אותן כמחרוזות, ו-timestamptz היה מחזיר אותן בצורה אחרת.
-- הדרייבר מחזיר בדיוק את מה שהמודול כתב. סטייה מהכרעה ב6, מדווחת
-- בדוח החלק.

-- טבלת ה-reference: אוסף מפתחות, נכתב ב-setRefKey בלבד.
create table public.reference (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

-- audit_log: שורה לכל בקשה ולכל תשובה, כותב יחיד ה-Orchestrator.
-- from היא מילה שמורה, ולכן העמודה from_module; שדות התוצאה, שצורתם
-- תלויה בשלב, יושבים ב-outcome. הדרייבר מתרגם בשני הכיוונים.
create table public.audit_log (
  request_id text not null,
  phase text not null,
  at text,
  from_module text,
  module text,
  action text,
  outcome jsonb not null default '{}'::jsonb,
  primary key (request_id, phase)
);

-- approvals: יומן ההחלטות, גדל בלבד.
create table public.approvals (
  approval_id text primary key,
  time text,
  who text,
  target text,
  action text,
  from_status text,
  to_status text,
  note text,
  is_demo boolean
);

-- interactions: יומן האינטראקציות, גדל בלבד.
create table public.interactions (
  interaction_id text primary key,
  session_id text,
  time text,
  type text,
  stop_id text,
  item_id text,
  question text,
  source_item text,
  is_fallback boolean,
  accuracy double precision,
  duration_ms integer,
  displayed_as_text boolean,
  is_demo boolean
);

-- שמונה הישויות.
create table public.sites (
  site_id text primary key,
  name text,
  stops jsonb,
  status text,
  locked_at text,
  corpus_version text,
  bounds jsonb,
  is_demo boolean
);

create table public.content_items (
  item_id text primary key,
  site_id text,
  stop_id text,
  name text,
  text text,
  source_id text,
  page integer,
  word_count integer,
  status text,
  audience text,
  is_demo boolean
);

create table public.geo_anchors (
  anchor_id text primary key,
  item_id text,
  lat double precision,
  lng double precision,
  verified boolean,
  verified_at text,
  is_crossing boolean,
  is_demo boolean
);

create table public.sources (
  source_id text primary key,
  name text,
  file text,
  publisher text,
  is_demo boolean
);

create table public.institutes (
  institute_id text primary key,
  name text,
  is_demo boolean
);

create table public.rights_mou (
  mou_id text primary key,
  institute_id text,
  scope jsonb,
  signed_at text,
  valid_until text,
  covers_content_contribution boolean,
  is_demo boolean
);

create table public.exit_points (
  exit_id text primary key,
  site_id text,
  lat double precision,
  lng double precision,
  name text,
  type text,
  is_demo boolean
);

create table public.sessions (
  session_id text primary key,
  site_id text,
  started_at text,
  ended_at text,
  completed boolean,
  last_stop_id text,
  flags jsonb,
  previous_session_id text,
  is_demo boolean
);

-- מדיניות הגישה (הכרעה ב4): RLS פעיל בכל טבלה, והמפתח הציבורי
-- מקבל בדיוק את מה שהדרייבר מרשה. מחיקה לאיש, ועדכון לישויות
-- ול-reference בלבד. ההרשאות ברמת הטבלה נשללות גם הן, כדי שניסיון
-- אסור ייכשל בשגיאה ולא ייעלם בשקט.
do $$
declare
  t text;
  append_only text[] := array['audit_log', 'approvals', 'interactions'];
  entities text[] := array['sites', 'content_items', 'geo_anchors', 'sources',
                           'institutes', 'rights_mou', 'exit_points', 'sessions'];
begin
  foreach t in array append_only || entities || array['reference'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert on public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                   t || '_read', t);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (true)',
                   t || '_append', t);
  end loop;

  foreach t in array entities || array['reference'] loop
    execute format('grant update on public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for update to anon, authenticated using (true) with check (true)',
                   t || '_update', t);
  end loop;
end $$;
