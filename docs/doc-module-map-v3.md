# מפת המודולים: מורה הדרך 2.0, מסלול יפו

סטטוס: טיוטה, גרסה 3, ממתינה למילת אישור של בעלת הפרויקט. גרסה 1 אושרה 11.09.2026; גרסה 2 (DESIGN-01 והמיפוי שורה לשורה) לא הובאה לאישור בנפרד ונבלעה כאן.
תאריך: 12.09.2026
מה נוסף בגרסה 3: ההכרעות של doc-decision-round-01 שאושרו 12.09; דרישת הבטיחות F-13 ותיקון הסוללה; ישות EXIT_POINTS; רישום דחיית F-14 מ-v1.
נוצר לפי: template-module-map.md (פריט 47, גרסה 1.2), חלק ב, ולפי guide-use-case-creation.md (פריט 55) חלק ד: קיבוץ צעדי מקרי השימוש לפי סוג הרכיב. זהו מסמך האב של הארכיטקטורה. שלושת מסמכי הבן (אוטומציה, סוכנים בקוד, ממשקים) נגזרים ממנו.
מחליף: doc-module-feature-breakdown.md (31.08.2026) כמסמך הייחוס של המודולים. הסעיף האחרון מפרט את ההתאמה.

## 1. פתיח

| השדה | הערך |
|---|---|
| הפרויקט | מורה הדרך 2.0: מדריך קולי מבוסס מיקום, מסלול רחוב יפו, ירושלים |
| השאלה האסטרטגית | ליבה חדשה. אין ליבה קיימת: בנייה 02 היא קובץ יחיד בלי הפרדה בין מסך, לוגיקה ונתונים, והיא הופכת כאן למערך הדרייברים הראשון של ליבה שנבנית מהחוזה |
| יעד ההרצה | decision-04 (מאושרת 12.09.2026): קובץ יחיד בלחיצה כפולה לשלבים 1 עד 4, ענן משלב 5; הקובץ היחיד הוא מערך הדרייברים הראשון ולא הארכיטקטורה; סביבת הבנייה היא מאגר Git עם סוכן, משלב 2 |
| המקורות | שמונת מקרי השימוש ותרשימיהם (project-docs); story-catalog-step-25, story-f-04, story-f-07, story-f-13; decision-01, decision-02, decision-03, decision-04; doc-decision-round-01; usecase-f-13 ותיקון 1; prd-morei-haderech גרסה 1.3; doc-build-01, doc-build-02; prototype-mora-darech-jaffa-v1.html |
| הכרעת תוכן מנחה | טקסט הסיור המודרך הנוכחי (19 פריטים, מקור אחד) הוא מציין מקום לקורפוס גדול יותר (הכרעת בעלת הפרויקט, 11.09.2026). המפה בנויה לריבוי מקורות וריבוי מכונים מהיום הראשון |
| גרסה ותאריך | 3, 12.09.2026 |

## 2. הליבה

### 2.1 ישויות הליבה

ישות ליבה היא ישות שיותר ממודול אחד צריך. השדות מ-decision-01, ממקרי השימוש ומההכרעות של 12.09.2026. שדה שמסומן [הצעה] או [טרם נקבע] עדיין ממתין.

| הישות | השדות | המצבים | המעברים המותרים ומי מעביר |
|---|---|---|---|
| SITES (המסלול) | site_id, name, stops (רשימת תחנות סדורה), status, locked_at, corpus_version, bounds [הצעה] | open, locked | open ל-locked: BE-05, בפעולת lock_site של screen-owner, אחרי L1 עד L4. locked ל-open: BE-05, אוטומטית, בכל create_item או edit_item במסלול (L6) |
| CONTENT_ITEMS (הפריט) | item_id, site_id, stop_id, name, text, source_id, page, word_count, status, audience (כולם, מבוגרים בלבד; הוכרע 12.09) | draft, pending, approved, rejected | לפי טבלת המעברים 2.2. כותב יחיד: BE-05 |
| GEO_ANCHORS (העוגן) | anchor_id, item_id, lat, lng, verified, verified_at, is_crossing (ברירת מחדל false, F-13) | לא מאומת, מאומת | verify_anchor של screen-content דרך BE-05 |
| SOURCES (המקור) | source_id, name, file, publisher | אין מצב | נכתב ב-create של screen-content דרך BE-05 |
| INSTITUTES (המכון) | institute_id, name | אין מצב | screen-owner דרך BE-05 |
| RIGHTS_MOU (ההסכם) | mou_id, institute_id, scope (רשימת source_id), signed_at, valid_until [שם השדה טרם נקבע, decision-02], covers_content_contribution (הוכרע 12.09: ההסכם מכסה אישור וגם תרומת תוכן) | בתוקף, פג | screen-owner דרך BE-05 (usecase-f-07 צעד 12) |
| APPROVALS (יומן ההחלטות) | approval_id, time, who, target (item_id או site_id), action, from_status, to_status, note | append-only, אין מצב | נכתב בלבד, בידי BE-05, בכל מעבר מצב. אין עריכה ואין מחיקה |
| ADMIN_USERS (המשתמשים המנהליים) | user_id, role (researcher, owner, content), institute_id | אין מצב | screen-owner. אימות זהות: אין ב-v1 (הוכרע 12.09), סיסמה לפני שהפאנל יוצא למכון |
| SESSIONS (הסשן) | session_id (אקראי), site_id, started_at, ended_at, completed, last_stop_id, flags (no_location, no_hebrew_voice, simulator, partial_log, low_battery_warned, ended_on_battery, ended_on_battery_block), previous_session_id | open, closed | open ל-closed: BE-07, בפעולת session_end של screen-traveler, בהגעה לנקודה האחרונה, או ב-close_stale של system-timer |
| EXIT_POINTS (נקודת יציאה) | exit_id, site_id, lat, lng, name, type | אין מצב | screen-content, באימות השטח. נדרשת מנוהל הסוללה (F-13 תיקון 1). ROUTE_PATH ו-route_type נדחו מ-v1 עם F-14 |
| INTERACTIONS (האינטראקציות) | interaction_id, session_id, time, type, stop_id, item_id, question, source_item, is_fallback, accuracy, duration_ms, displayed_as_text | append-only | נכתב בלבד, בידי BE-07. type מרשימה סגורה בטבלת ה-reference |

טבלאות המערכת, שאינן ישויות עסקיות אך כל מודול תלוי בהן: modules ו-allow_list (ה-Registry), audit_log (שורה לכל בקשה ותשובה, כותב יחיד: ה-Orchestrator), reference (סעיף 2.4), EMBEDDINGS (מקום שמור וריק ב-v1, decision-01).

### 2.2 טבלת מעברי המצב של הפריט

אושרה 12.09.2026 (סבב ההכרעות, חלק א1). ארבעת השמות באנגלית הם הקנוניים, והעברית ביאור במסך בלבד. אין מצב חמישי לפריט: הנעילה היא מצב מסלול.

| מהמצב | למצב | מי רשאי (from) | הפעולה | תנאי |
|---|---|---|---|---|
| (חדש) | draft | screen-content | create_item | שלמות: טקסט, עמוד, תחנה, מקור, קואורדינטות בגבולות |
| draft | pending | screen-veto | submit | שלמות כנ"ל |
| pending | approved | screen-veto (researcher) | approve | אין |
| pending | rejected | screen-veto (researcher) | reject | הערה רשות |
| approved | pending | screen-veto (researcher) | return | נרשם |
| rejected | pending | screen-veto (researcher) | return | נרשם |
| approved | draft | BE-05 אוטומטית | revert | עריכת טקסט (edit_item); המסלול נפתח אם היה locked |
| rejected | draft | screen-content | edit_item | נרשם |

כל מעבר אחר נדחה ב-E-TRANSITION-DENIED ונרשם.

### 2.3 Business Logic: החוקים העסקיים

ממוספרים, יושבים בליבה ולא במודול, ונאכפים בקוד רגיל.

| חוק | הכלל | מקור |
|---|---|---|
| BL-01 | אין שינוי מצב של פריט או מסלול בלי רשומת APPROVALS. כשל כתיבה מבטל את המעבר | usecase-f-07 זרימה ב |
| BL-02 | מעברי מצב לפי טבלה 2.2 בלבד | usecase-f-07 סעיף 12 |
| BL-03 | שליפה ומסירה מפריטים במצב approved בלבד, מהמסלול הנוכחי, ממקור תחת הסכם בתוקף. הסינון לפי מפתח קודם לכל דירוג | usecase-f-05 K1, usecase-f-01-f-03 צעד 5 |
| BL-04 | אין קריאה לרשת חיצונית בזרימת השליפה | usecase-f-05 K2 |
| BL-05 | אין מועמד מעל relevance_threshold: תשובת ההימנעות בנוסח הנעול, בלי השלמה | usecase-f-05 K3 |
| BL-06 | נעילת מסלול רק כשמתקיימים L1 עד L5: כל פריט הוכרע ולכל approved רשומה; לכל תחנה approved אחד לפחות; לכל approved עמוד, מקור ועוגן מאומת; כל מקור תחת הסכם בתוקף; נעילה היא פעולת אדם מתועדת עם corpus_version | usecase-f-08 סעיף 4 |
| BL-07 | יצירה או עריכה של פריט במסלול locked מחזירה את המסלול ל-open ואת הפריט ל-draft (L6) | usecase-f-08 סעיף 4, usecase-f-07 זרימה ה |
| BL-08 | שער B פתוח כאשר המסלול locked ו-M-06 גדול או שווה 1. כאשר enforce_gate_b כבוי, המצב מוצג ואינו נאכף | usecase-f-07 צעד 14, usecase-f-08 צעד 13 |
| BL-09 | כותב אחד לכל עמודה: CONTENT_ITEMS, GEO_ANCHORS, SITES, APPROVALS, RIGHTS_MOU, SOURCES, INSTITUTES, EXIT_POINTS: BE-05. SESSIONS, INTERACTIONS: BE-07. audit_log: ה-Orchestrator | המצגת, כל מקרי השימוש |
| BL-10 | יומן ההחלטות (APPROVALS) חוסם פעולה כשאינו נכתב; יומן האינטראקציות (INTERACTIONS) לעולם אינו חוסם את החוויה בשטח, מנסה שוב ומסמן partial_log | usecase-f-09 זרימה א |
| BL-11 | סדר בדיקת הפונה קבוע: from קיים; from ברשימה הסגורה; שורה ברשימת המותר עבור from, module, action. בקשה שלא נרשמה ב-audit_log אינה מנותבת | המצגת חלק ב |
| BL-12 | כל ערך משתנה נקרא מטבלת ה-reference ולא מהקוד | המצגת חלק ה |
| BL-13 | תשובה היא ציטוט או קיצוץ מפריט approved, עד answer_max_words, בגבול משפט. אין ניסוח מחדש | usecase-f-05 צעד 7, usecase-f-04 צעד 8 |
| BL-14 | תשובת הימנעות ושגיאת קלט הם שני מצבים עם שני קודים ושני נוסחים | usecase-f-05 זרימה ג |
| BL-15 | דגימת מיקום שדיוקה גרוע מ-accuracy_threshold נדחית; בין שני geofence נבחר הקרוב; היציאה דורשת רדיוס ועוד exit_margin | usecase-f-01-f-03 |
| BL-16 | שורות מסשן עם דגל simulator או partial_log אינן נכנסות למדגם M-01 ו-M-02 | usecase-f-01-f-03 זרימה ה, usecase-f-09 |
| BL-17 | שורת INTERACTIONS מתקבלת רק אם type ברשימה הסגורה ו-from מורשה לסוג הזה | usecase-f-09 צעד 4 |
| BL-18 | אין זיהוי אישי בנתונים: session_id אקראי, אודיו לעולם לא נשמר, מיקום כנקודות כניסה ויציאה בלבד | usecase-f-09 סעיף 7 |
| BL-19 | עוגן שמסומן is_crossing אינו מפעיל מסירה. הפריט מוחזק עד leave, או עד crossing_clear_seconds מחוץ לרדיוס. הבדיקה קודמת לבדיקת המינון | usecase-f-13 צעדים 3 עד 6 |
| BL-20 | סוללה מתחת ל-battery_block_percent: המערכת מפסיקה מסירה, מכבה את מאזין המיקום ואת מנוע הקול, ומציגה הודעת יציאה סטטית. חידוש רק מעל battery_resume_percent | F-13 תיקון 1 |
| BL-21 | השליפה והמסירה מסננות גם לפי audience | usecase-f-06 סעיף 5, הוכרע 12.09 |

### 2.4 טבלת ה-reference

| המפתח | הערך ב-v1 | מי קורא | מקור |
|---|---|---|---|
| geofence_radius_m | 40 | AUTO-01 | doc-build-01 |
| exit_margin_m | 10 | AUTO-01 | הוכרע 12.09 |
| accuracy_threshold_m | 40 | AUTO-01 | הוכרע 12.09 |
| location_sample_interval_s | 5 | CONN-03 | הוכרע 12.09 |
| delivery_gap_s | 20 | FE-04 | doc-build-01 |
| pushed_item_max_words | 150 | FE-04 | הוכרע 12.09. פריטים ארוכים יותר יפוצלו בידי צוות התוכן |
| relevance_threshold | 0.28 | BE-04 | doc-build-01 |
| answer_max_words | 60 | BE-04 | doc-build-01 |
| question_max_chars | 200 | BE-04 | הוכרע 12.09 |
| fallback_text | הנוסח הנעול בבנייה 01 [היום בקוד, צעד הבא: לכאן] | BE-04 | doc-build-01 |
| unavailable_text | [טרם נקבע] | BE-03 | usecase-f-05 זרימה ד |
| voice_id, voice_rate | [היום בקוד, צעד הבא: לכאן] | CONN-02 | usecase-f-02 |
| stale_session_minutes | 60 | AUTO-02 | הוכרע 12.09 |
| interaction_types | initiated, pushed, arrived_no_content, attempt_failed, replay, session_start, session_end | BE-07 | usecase-f-09 סעיף 3 |
| m01_threshold, m02_threshold, sample_min, sample_max | 3, 0.70, 15, 25 | BE-07 | הסיפורים M-01, M-02 |
| enforce_gate_b | false בפיתוח | BE-06 | doc-build-01 |
| error_human_text | טבלת ההסברים לבני אדם, לפי קוד | הליבה | המצגת חלק א |
| crossing_clear_seconds | 15 | FE-04 | F-13 |
| battery_warn_percent | 20 | FE-05 | F-13 תיקון 1 |
| battery_block_percent | 5 | FE-05 | F-13 תיקון 1 |
| battery_resume_percent | 20 | FE-05 | F-13 תיקון 1 |
| battery_block_text | תבנית: נקודת ציון, מרחק, כיוון | FE-05 | F-13 תיקון 1 |
| safety_opening_text | משפט הבטיחות בתחילת הסשן | FE-05 | F-13 |
| model_tier | אין (v1 בלי AI) | GW-01 | decision-01 |

## 3. המודולים

מצב הביצוע לפי שלושת המבחנים בתבנית. ב-v1 אין Agent ואין רשת סוכנים: כל דרגות המימוש "קוד רגיל".

### 3.1 הליבה

| המזהה | המודול | האחריות האחת | מצב הביצוע | הדרישות | קורא | כותב | נתונים פרטיים | מצב הבנייה |
|---|---|---|---|---|---|---|---|---|
| CORE-01 | Contract and Errors | שתי המעטפות, פונקציית האימות, רשימת קודי השגיאה הסגורה | קוד רגיל | כולן | reference (error_human_text) | אין | אין | לא נבנה |
| CORE-02 | Orchestrator | חמשת הצעדים: אימות, בדיקת פונה, רישום, ניתוב אחד, רישום תשובה | קוד רגיל | כולן | modules, allow_list | audit_log | request_id | לא נבנה. בבנייה 02 המסך קורא לפונקציות ישירות |
| CORE-03 | Registry | טבלאות modules ו-allow_list, כנתונים | נתונים | כולן | אין | אין | אין | לא נבנה |
| CORE-04 | Repository | הגישה היחידה לנתונים, פעולות בשם עסקי, דרייבר אחד | קוד רגיל | כולן | הכל | הכל, לפי BL-09 | מחרוזת החיבור, בקובץ אחד, בכספת | חלקי: בנייה 02 כותבת לאחסון הדפדפן ממקומות שונים |

### 3.2 מודולי השירות

| המזהה | המודול | האחריות האחת | מצב הביצוע | הדרישות | קורא | כותב | נתונים פרטיים | מצב הבנייה |
|---|---|---|---|---|---|---|---|---|
| BE-05 | Content Governance | מעברי מצב של פריט ומסלול, שלמות פריט, נעילה, רישום הסכמים, מקורות ונקודות יציאה | קוד רגיל | F-07, F-08, F-06, F-13 | CONTENT_ITEMS, SITES, GEO_ANCHORS, SOURCES, RIGHTS_MOU, EXIT_POINTS | כל אלה, ו-APPROVALS | אין | חלקי: מעברי פריט נבנו; נעילה, עוגנים, הסכמים לא |
| BE-06 | Gate Enforcement | חישוב M-06, מצב שער B, טבלת המוכנות לנעילה | קוד רגיל | F-07, F-08 | SITES, CONTENT_ITEMS, GEO_ANCHORS, RIGHTS_MOU, reference | אין | אין | חלקי: תצוגה נבנתה, M-06 קבוע בקוד |
| BE-04 | Retrieval | מאגר מועמדים לפי מפתח, דירוג, סף, הרכבת תשובה או הימנעות | קוד רגיל | F-05 | CONTENT_ITEMS, SITES, RIGHTS_MOU, reference | אין (שולח log ל-BE-07) | מנוע הדירוג הלקסיקלי, נשלף | נבנה (בתוך הקובץ) |
| BE-03 | Dialogue | קליטת שאלה, הקשר מיקום, קריאה לשליפה, השהיית תוכן נדחף, הרכבה להשמעה | קוד רגיל | F-04 | זיכרון קצר טווח של הסשן | אין (שולח log) | מצב השאלה הפעילה | חלקי: קיים בקובץ בלי הפרדה |
| FE-04 | Delivery and Dosage | פריטי הנקודה, בדיקת is_crossing, מרווח המינון, החזקה, מסירה בסדר | קוד רגיל, עם מפעיל זמן | F-01, F-03, F-13, UX-02 | CONTENT_ITEMS ו-GEO_ANCHORS דרך BE-05 | אין (שולח log) | הפריט המוחזק, זמן המסירה הקודמת | נבנה (בתוך הקובץ). המזהה FE נשמר מהמפה הקודמת; זהו מודול שירות ולא מסך |
| BE-07 | Interaction Log | סשנים, רשומות אינטראקציה, סגירת סשנים, חישוב M-01 ו-M-02, ייצוא | קוד רגיל | F-09, F-10, F-11 | SESSIONS, INTERACTIONS, reference | SESSIONS, INTERACTIONS | תור ניסיונות חוזרים | חלקי: יומן סשן נבנה, בלי חישוב וייצוא |

### 3.3 מודולי הממשק

| המזהה | המודול | סוג הממשק | האחריות האחת | הדרישות | קורא | כותב | מצב הבנייה |
|---|---|---|---|---|---|---|---|
| FE-06 | Veto Panel (screen-veto) | Frontend | הגשה, אישור, דחייה, החזרה, יומן ההחלטות, פס השערים | F-07 | דרך מעטפות | אין | נבנה. פעולת האיפוס תוסר |
| FE-05 | Traveler Screen (screen-traveler) | Frontend | תחילת וסיום סשן, משפט הבטיחות, הרשאות, חיווי, כפתור שאלה והקלדה, התראת וחסימת סוללה, תצוגת טקסט בהיעדר קול | F-04, F-02, F-01, F-13 | דרך מעטפות | אין | נבנה חלקית |
| FE-07 | Content Screen (screen-content) | Frontend | יצירה ועריכה של פריטים, מקורות, אימות עוגן ו-is_crossing, נקודות יציאה, הגשה | F-08, F-06, F-13 | דרך מעטפות | אין | לא נבנה. הוכרע 12.09: מאוחד עם FE-08 למסך ניהול אחד עם role |
| FE-08 | Owner Screen (screen-owner) | Frontend | רישום הסכם ומכון, מתג enforce_gate_b, טבלת מוכנות ונעילה, מסך המדדים וייצוא | F-07, F-08, F-09 | דרך מעטפות | אין | לא נבנה. מאוחד עם FE-07; רשימת המותר עדיין מבחינה לפי from |
| CONN-01 | STT Adapter | מתאם | listen: אודיו לטקסט, או כשל | F-02, F-04 | אין | אין | נבנה בתוך הקובץ |
| CONN-02 | TTS Adapter | מתאם | speak ו-stop, קול עברי מפורש, שרשור, השהיה אחרי ביטול | F-02 | reference (voice_id, voice_rate) | אין | נבנה בתוך הקובץ |
| CONN-03 | Location Adapter | מתאם | דגימות מיקום מהמכשיר, או מהסימולטור, באותה צורה | F-01 | reference (interval) | אין | נבנה בתוך הקובץ |
| AUTO-01 | Geofence (system-geofence) | שכבת אוטומציה | מרחק לעוגנים ולנקודות יציאה, סינון דיוק, בחירת הקרוב, arrive ו-leave | F-01, F-03, F-13 | GEO_ANCHORS, EXIT_POINTS, reference | זיכרון קצר טווח: התחנה הנוכחית | נבנה בתוך הקובץ |
| AUTO-02 | Timer (system-timer) | שכבת אוטומציה | release למינון, close_stale לסשנים | F-01, F-09 | reference | אין | חלקי: טיימר המינון קיים |
| GW-01 | AI Gateway | שער | יציאה יחידה לספק AI, Adapter לספק, חוזה קריאה | אין ב-v1 | reference (model_tier) | אין | לא נבנה, מוגדר כתפר ריק |
| TOOL-01 | Walk Simulator (tool-simulator) | מתאם, פיתוח בלבד | הזרמת דגימות מלאכותיות ל-CONN-03 | פיתוח | אין | אין | נבנה |
| DESIGN-01 | Design System | מודול רוחבי | ה-Design Tokens ורכיבי ה-UI הבסיסיים. כל מסך משתמש בו ואינו מגדיר עיצוב משלו | UX-01, UX-03 | אין | אין | לא נבנה. נבנה ראשון בשלב 2 |

## 4. החוזה

### 4.1 המעטפות

בקשה: { from, module, action, payload, lang }. תשובה: { ok, data, error }. שניהם ב-CORE-01, ואף מודול אינו מגדיר מעטפה משלו. from מרשימה סגורה: screen-veto, screen-traveler, screen-content, screen-owner, module-dialogue (BE-03), module-delivery (FE-04), module-retrieval (BE-04), module-geofence (AUTO-01), system-timer (AUTO-02), tool-simulator (TOOL-01).

### 4.2 הפעולות

| המודול | הפעולה | המקור | פונה מורשה |
|---|---|---|---|
| BE-05 | submit | F-07 צעד 1 | screen-veto |
| BE-05 | approve, reject, return | F-07 צעד 6 | screen-veto |
| BE-05 | register_mou, register_institute, register_source | F-07 צעד 12 | screen-owner, screen-content (source) |
| BE-05 | create_item, edit_item, verify_anchor | F-08 צעדים 1, 5, 7 | screen-content |
| BE-05 | register_exit_point | F-13 תיקון 1 | screen-content |
| BE-05 | lock_site | F-08 צעד 10 | screen-owner |
| BE-05 | listApprovedByStop | F-01 ו-F-03 צעד 5 | module-delivery |
| BE-05 | nearestExitPoint | F-13 תיקון 1 | screen-traveler |
| BE-06 | get_gate, get_lock_readiness | F-07 צעד 10, F-08 צעד 9 | screen-veto, screen-owner, screen-traveler (get_gate) |
| BE-06 | set_enforce | F-07 זרימה ו | screen-owner |
| BE-04 | retrieve | F-05 צעד 1 | module-dialogue |
| BE-03 | ask | F-04 צעד 3 | screen-traveler |
| FE-04 | arrive, leave | F-01 ו-F-03 צעדים 4, 11 | module-geofence, tool-simulator (פיתוח) |
| FE-04 | release | F-01 ו-F-03 צעד 7 | system-timer |
| BE-07 | session_start, session_end | F-09 צעדים 1, 6 | screen-traveler |
| BE-07 | log | F-09 צעד 3 | module-dialogue (initiated), module-delivery (pushed, arrived_no_content), screen-traveler (attempt_failed, replay) |
| BE-07 | close_stale | F-09 צעד 7 | system-timer |
| BE-07 | compute_metrics, export | F-09 צעד 8 | screen-owner |

### 4.3 רשימת המותר

השורות של 4.2, שורה לכל צירוף from, module, action, עם allowed = true. שורות tool-simulator: allowed = false בייצור. הוספת מסך או פונה: שורה, לא קוד. כל צירוף שאינו ברשימה: E-ALLOW-DENIED.

### 4.4 טבלת פעולות המסכים

| המסך | הפעולות שלו ואותן בלבד |
|---|---|
| screen-veto | submit, approve, reject, return, get_gate |
| screen-traveler | session_start, session_end, ask, log (attempt_failed, replay), get_gate, nearestExitPoint |
| screen-content | create_item, edit_item, verify_anchor, register_source, register_exit_point |
| screen-owner | register_mou, register_institute, set_enforce, get_lock_readiness, lock_site, compute_metrics, export |

### 4.5 קודי השגיאה, רשימה סגורה

הקוד וההסבר למפתח ב-CORE-01; ההסבר לבני אדם בטבלת ה-reference [הנוסחים לבני אדם: הכרעה פתוחה 1].

| הקוד | ההסבר למפתח | היכן נזרק |
|---|---|---|
| E-FROM-MISSING | שדה from חסר במעטפה | CORE-02 |
| E-FROM-UNKNOWN | from אינו ברשימה הסגורה של הפונים | CORE-02 |
| E-ALLOW-DENIED | אין שורה ברשימת המותר לצירוף | CORE-02 |
| E-ENVELOPE-INVALID | שדה חובה חסר או payload לא תקין | CORE-01 |
| E-AUDIT-WRITE-FAILED | לא ניתן לרשום את הבקשה; אינה מנותבת | CORE-02 |
| E-TRANSITION-DENIED | מעבר מצב שאינו בטבלה 2.2 | BE-05 |
| E-ITEM-INCOMPLETE | שדה חסר ביצירה או בעריכה, עם שם השדה | BE-05 |
| E-ANCHOR-OUT-OF-BOUNDS | קואורדינטות מחוץ לגבולות המסלול | BE-05 |
| E-APPROVAL-WRITE-FAILED | רשומת APPROVALS לא נכתבה; המעבר בוטל | BE-05 |
| E-LOCK-REFUSED | תנאי נעילה נכשל; data מכיל את רשימת הכשלים | BE-05 |
| E-GATE-CLOSED | שער B חסום ואכיפה דולקת | BE-06 |
| E-QUESTION-INVALID | שאלה ריקה, ארוכה מדי או חסרת site_id | BE-04 |
| E-RETRIEVAL-FAILED | כשל בקריאת מאגר המועמדים | BE-04 |
| E-REF-EMPTY | ערך reference חסר | הליבה |
| E-SESSION-CLOSED | רשומת log לסשן שאינו פתוח | BE-07 |
| E-LOG-TYPE-INVALID | type אינו ברשימה, או from אינו מורשה לסוג | BE-07 |
| E-LOG-WRITE-FAILED | כשל כתיבה אחרי הניסיונות החוזרים; הסשן partial_log | BE-07 |
| E-NO-HEBREW-VOICE | אין קול עברי במכשיר; המסך עובר לטקסט | CONN-02 |
| E-SPEECH-NOT-RECOGNIZED | לא זוהה דיבור | CONN-01 |
| E-MIC-NOT-ALLOWED | הרשאת מיקרופון נדחתה | CONN-01 |
| E-LOCATION-NOT-ALLOWED | הרשאת מיקום נדחתה | CONN-03 |
| E-NO-EXIT-POINT | אין נקודת יציאה רשומה למסלול; הודעת חסימת הסוללה אינה יכולה להיבנות | BE-05 |

"אסור" ו"טרם נקבע" הם שני קודים שונים: E-ALLOW-DENIED לעומת E-REF-EMPTY.

## 5. תרשימים

- diagram-module-map-smart-guide.mmd: המופע של הפרויקט לתרשים 06. סוגר את הערת פער 4 באינדקס.
- תרשימי האב והבן של תשעת מקרי השימוש (שמונה ועוד F-13), ב-project-docs.

## 6. מערך הבדיקות

### 6.1 Unit, למודול

| המודול | קלט לדוגמה (סינתטי) | פלט צפוי | קריטריון |
|---|---|---|---|
| CORE-01 | מעטפה בלי from | E-FROM-MISSING | הקוד זהה בקוד ובמפה |
| CORE-02 | approve מ-screen-traveler | E-ALLOW-DENIED, שורת audit_log | הבקשה לא נותבה |
| CORE-04 | חיפוש מחרוזת החיבור בקוד | קובץ אחד | מבנה 01 |
| BE-05 | approve על פריט approved | E-TRANSITION-DENIED | אין רשומה חדשה |
| BE-05 | lock_site עם תחנה בלי approved | E-LOCK-REFUSED עם התחנה | SITES ללא שינוי |
| BE-06 | M-06 = 0, enforce = true | שער חסום | M-06 נקרא מרשומה |
| BE-04 | שאלה על פריט pending | הימנעות; הפריט אינו במועמדים | הבדיקה האדומה |
| BE-04 | ציון 0.27 מול סף 0.28 | הימנעות | הסף מ-reference |
| BE-03 | שאלה בזמן פריט מוחזק | הפריט נשאר מוחזק, התשובה נשמעת | סדר הקדימות |
| FE-04 | הגעה לעוגן עם is_crossing = true | אין מסירה; הפריט מוחזק | BL-19 |
| FE-04 | שתי הגעות בהפרש 5 שניות | השנייה מוחזקת 15 שניות | delivery_gap מ-reference |
| FE-05 | סוללה 4% | חסימה, כיבוי מיקום וקול, הודעת יציאה | BL-20 |
| AUTO-01 | דגימה בדיוק 80 מטר | אין אירוע | accuracy_threshold |
| AUTO-01 | שני עוגנים בטווח | הקרוב בלבד | BL-15 |
| BE-07 | initiated מ-module-delivery | E-LOG-TYPE-INVALID | הבדיקה האדומה |
| BE-07 | סשנים עם 2, 3, 5 שאלות | M-01 = 3, עובר | גדול או שווה |
| CONN-02 | מכשיר בלי קול עברי | E-NO-HEBREW-VOICE פעם אחת | הודעה לסשן |

### 6.2 בדיקות הממשקים, לכל שלב

המעטפה (כל מודול מקבל ומחזיר את שתי המעטפות בלבד); רשימת המותר (כל צירוף מותר עובר, כל צירוף אחר נדחה); קודי השגיאה (כל קוד בקוד קיים במפה ולהפך).

### 6.3 בדיקות System, שלושה אשכולות

נורמה: הליכה מלאה בסימולטור, 12 תחנות, ארבע שאלות, נעילה קודמת. קצה: תחנה 11 עם pending, שאלה בין תחנות, חציון 3.0 בדיוק, הפסקה של 45 דקות, עוגן חצייה שהמשפחה עוצרת בו. כשל: כתיבת APPROVALS נכשלת (המעבר מבוטל), כתיבת INTERACTIONS נכשלת (החוויה נמשכת), אין קול עברי, הרשאת מיקום נדחתה, סוללה יורדת ל-4%.

### 6.4 שמונת מבחני המבנה של המצגת

01 חיבור לנתונים בקובץ אחד; 02 קריאה לספק AI בקובץ אחד; 03 כל מסך פונה לכתובת אחת ומצהיר מי הוא; 04 כל בקשה רשומה עם request_id; 05 ערכים משתנים מטבלת ה-reference; 06 הוספת מסך יוצרת שורה ברשימת המותר; 07 קודי השגיאה זהים בקוד ובמפה; 08 אף מודול אינו קורא למודול אחר ישירות.

### 6.5 הבדיקות האדומות

שלוש, נכתבות כדי להיכשל אם ההגנה תוסר: פריט pending במאגר המועמדים (F-05); פריט approved בלי רשומת APPROVALS עובר את L1 (F-08); שורת initiated שלא ממודול השיחה נספרת (F-09).

### 6.6 UAT

חוקר המכון מאשר פריט ורואה את הרשומה; בעלת הפרויקט רושמת הסכם ורואה את השער נפתח; בעלת הפרויקט נועלת מסלול; מבחן שלוש המשפחות: הליכה מלאה, מדדים על המסך, ואפס אירועי בטיחות.

## 7. סדר הבנייה והשערים

| שלב | מה נבנה | בדיקת הקבלה | שער חוסם |
|---|---|---|---|
| 1 | חוזה ושלד: CORE-01 עד CORE-04, טבלאות modules, allow_list, audit_log, reference; דרייבר אחסון דפדפן | מבחני מבנה 01, 03, 04, 07; בדיקת CORE-02 | הנוסחים לבני אדם של קודי השגיאה (הכרעה פתוחה 1) |
| 2 | DESIGN-01 תחילה, ואז המסכים על נתוני הדגמה: FE-06 מחדש דרך מעטפות, FE-05, ומסך הניהול המאוחד | כל מסך שולח מעטפות בלבד; מבחן מבנה 06; החלפת ערכת העיצוב אינה נוגעת באף מסך | אין |
| 3 | Slice ראשון: F-07 מקצה לקצה דרך ה-Orchestrator, כולל register_mou ו-M-06 מרשומה | UAT של החוקר ושל בעלת הפרויקט; BL-01 | אין |
| 4 | מודולי הליבה: BE-05 מלא, BE-06, BE-04, BE-03, FE-04 עם BL-19, BE-07 עם חישוב | הבדיקות האדומות; מבחני מבנה 05, 08 | חידוש סשן אחרי טעינה (הכרעה פתוחה 5) |
| 5 | ממשקי קלט ואוטומציה: CONN-01 עד CONN-03, AUTO-01, AUTO-02, TOOL-01, וחסימת הסוללה | הליכה מלאה בסימולטור; BL-15; BL-20 | ספק הענן (הכרעה פתוחה 2) |
| 6 | GW-01 כתפר ריק עם חוזה קריאה אחד לדוגמה | מבחן מבנה 02 | אין |
| 7 | ניקוי נתוני הדגמה, הסרת פעולת האיפוס, הקורפוס לרשומות, אימות עוגנים, is_crossing ונקודות יציאה בשטח | L3 עובר על 19 הפריטים; נעילה ראשונה | נקודה שהיא גם צומת וגם תוכן (הכרעה פתוחה 4) |

כל שלב: ענף נפרד, משימה אחת, דוח שלב, תיקון מסמכים לפני קוד נוסף, מיזוג אחרי בדיקות ירוקות, שיחה חדשה לשלב הבא.

## 8. הכרעות פתוחות

ההכרעות 1 עד 20 של גרסה 2 הוכרעו ב-12.09.2026 (decision-04 ו-doc-decision-round-01 חלקים א עד ד) ונקלטו לאורך המסמך. מה שנשאר:

| # | ההכרעה | מי קורא אותה | היכן יושבת | עוצר |
|---|---|---|---|---|
| 1 | הנוסחים לבני אדם של 22 קודי השגיאה, ו-unavailable_text | הליבה | reference | שלב 1 |
| 2 | ספק הענן, חשבון האירוח ומסד הנתונים | CORE-04 | decision | שלב 5 |
| 3 | האם שלב 1 נבנה בצ'ט או ישירות בסביבת הקוד | כולם | decision | שלב 1 |
| 4 | נקודה שהיא גם צומת וגם תוכן: להזיז את העוגן בשטח, או לסמן is_crossing ולדחות את המסירה | צוות התוכן | GEO_ANCHORS | שלב 7 |
| 5 | חידוש הסשן אחרי טעינה: המשך אותו סשן, או סשן חדש עם previous_session_id | BE-07 | הליבה | שלב 4 |
| 6 | האם F-13 הוא MUST או SHOULD | ה-PRD | PRD | לא עוצר |
| 7 | שאלת הבטיחות בשאלון מבחן שלוש המשפחות | ה-PRD | PRD | שער A |
| 8 | מנגנון יישוב מחלוקת עם המכון, SLA ל-Veto | החוזה | מחוץ למערכת | לא עוצר |
| 9 | לקסיקלי מול סמנטי, ומודל שפה לניסוח | BE-04, GW-01 | decision | לא עוצר v1 |
| 10 | page_image, is_map, ייצוא corpus.json | BE-05 | CONTENT_ITEMS | לא עוצר |

נדחה מ-v1 בהכרעת 12.09.2026: F-14 (ייצוג המסלול כקו, זיהוי חריגה והכוונה חזרה) ושדה route_type. הסיפור נשמר כ-story-f-14-deferred.md. הישות EXIT_POINTS נשארה, מפני שנוהל הסוללה מחייב אותה. הנימוק לדחייה: עלות מתמשכת בכל מסלול עתידי, סיכון להודעות שווא, ואי ידיעה אם הבעיה קיימת בכלל במדרחוב עירוני מסומן. הבדיקה מחדש: אחרי מבחן שלוש המשפחות.

## 9. התאמה למפה הקודמת, שורה לשורה

doc-module-feature-breakdown.md (31.08.2026, 19 מודולים) קדם לתבנית, למתודולוגיה ולמקרי השימוש.

| המודול הקודם | מה היה | היעד במפה הזאת |
|---|---|---|
| FE-01 Background Location Engine | מאזין GPS ו-geofence | פוצל: CONN-03 (מקור הדגימות) ו-AUTO-01 (הכרעת ה-geofence) |
| FE-02 Voice Layer | STT ו-TTS | פוצל: CONN-01 ו-CONN-02 |
| FE-03 Client Dialogue Manager | ניהול סשן, תיוג, הצמדת הקשר | פוצל: BE-03 (השיחה) ו-BE-07 (התיוג והיומן) |
| FE-04 Content Dosage Scheduler | מינון ותדירות | FE-04 Delivery and Dosage. אותו מזהה |
| FE-05 Minimal Screen | מסך מינימלי | FE-05 Traveler Screen. אותו מזהה |
| FE-06 Institute Veto Panel | פאנל הווטו | FE-06 Veto Panel. אותו מזהה |
| BE-01 Location to Content Mapper | נקודה לפריט | נעלם כמודול: הפעולה listApprovedByStop של BE-05 |
| BE-02 Dialogue Orchestrator | STT, שליפה, LLM, TTS | BE-03 Dialogue, בלי ה-LLM |
| BE-03 RAG Engine | שליפה סמנטית | BE-04 Retrieval, בשליפה לקסיקלית |
| BE-04 Guardrail and Fallback | הימנעות ב-no-hit | נבלע ב-BE-04 Retrieval כ-K3 |
| BE-05 Content Governance | מעברי מצב הווטו | BE-05, בתוספת נעילה, עוגנים, מקורות, הסכמים ונקודות יציאה |
| BE-06 Gate Enforcement | חסימת שער A | BE-06. אותו מזהה |
| BE-07 Analytics and Logging | יומן ומדדים | BE-07 Interaction Log. אותו מזהה |
| DB-01 Vector Store | Embeddings | ישות EMBEDDINGS, ריקה ב-v1 |
| DB-02 Content Store | טקסט וסטטוס | ישות CONTENT_ITEMS |
| DB-03 Geo Anchor Table | קואורדינטות | ישות GEO_ANCHORS |
| DB-04 Audit Trail Store | מי אישר ומתי | ישות APPROVALS |
| DB-05 Event Log | יזומה מול נדחפת | ישויות SESSIONS ו-INTERACTIONS |
| DB-06 Rights and MOU Registry | M-06 | ישויות INSTITUTES ו-RIGHTS_MOU |

**התנגשות מזהים, לרישום מפורש**: במפה הקודמת BE-02 היה השיחה, BE-03 השליפה ו-BE-04 ההימנעות. במקרי השימוש המאושרים BE-03 הוא השיחה ו-BE-04 הוא השליפה, וכך נשמר כאן. לכן המפה הקודמת עוברת לארכיון עם אישור הגרסה הזאת ואינה נשארת כמסמך פעיל.

**המודולים החדשים**: CORE-01 עד CORE-04, FE-07 ו-FE-08 (מאוחדים למסך ניהול אחד), GW-01, TOOL-01, DESIGN-01.

**הדרישות בלי מודול**: F-12 (35 מסלולים) נשאר WON'T; מודל הנתונים תומך בו (site_id בכל ישות). M-05, M-08, M-09 מחוץ למערכת. UX-04 ו-UX-06 תוצאה נגזרת. F-14 נדחה, ראו סעיף 8.

**הצעת היעילות מסעיף 7 במפה הקודמת** (תשובות מיוצרות מראש): התייתרה. בלי מודל שפה בזמן ריצה, התשובה היא ממילא ציטוט מפריט מאושר.

## 10. יומן גרסאות

גרסה 3, 12.09.2026: נקלטו decision-04 ו-doc-decision-round-01 (חלקים א עד ד); נוספו F-13 (is_crossing, BL-19), נוהל הסוללה (BL-20, ארבעה מפתחות, דגלי סשן, E-NO-EXIT-POINT), מסנן audience (BL-21), ישות EXIT_POINTS ושתי פעולות ל-BE-05; טבלת ה-reference התמלאה; FE-07 ו-FE-08 אוחדו למסך ניהול עם role; סעיף 8 צומצם מ-20 הכרעות ל-10, ונרשמה דחיית F-14. גרסה 2, 11.09.2026: נוסף DESIGN-01 (המתודולוגיה פרק א קובעת אותו כחובה; התבנית אינה מזכירה אותו, וזו הערת פער לספרייה), ונוסף המיפוי שורה לשורה למפה הקודמת. גרסה 1, 11.09.2026: נגזרה משמונת מקרי השימוש לפי פריט 55 חלק ד ותבנית פריט 47. המפה משתנה לפני הקוד, לעולם לא אחריו.

זהו תוצר השלב. השלב הבא ממתין לאישור שלך.
