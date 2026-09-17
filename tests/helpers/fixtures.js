// הזריעה הסינתטית של הבדיקות. משימה 2 בתוכנית שלב 7.
//
// עד שלב 7 שבע בדיקות נזרעו מנתוני ההדגמה של /data/demo/, שהוסרו
// מהמאגר לפי מסמך הבנייה סעיף 7 ("שאילתה על is_demo מחזירה אפס").
// השורות כאן הן אותן שורות סינתטיות, בלי הסימון: הן עזר בדיקה
// שיושב תחת tests/ (מסמך הבנייה סעיף 5: "עזרי בדיקה ומודול הדמה"),
// אינן נתוני המערכת, אינן נטענות בהרכבה ואינן נארזות.
//
// המערך נבחר בשלב 2 (הכרעה ג) כדי לכסות תצוגה: ארבעת מצבי הפריט,
// תחנה בלי פריט מאושר, ופריט בלי עוגן מאומת. אין כאן ציטוט ממקור
// אמיתי, ואף שורה אינה מ-19 פריטי הקורפוס.

export const FIXTURE_SEED = Object.freeze({
  "content_items": [
    {
      "item_id": "item-demo-1",
      "site_id": "site-demo-jaffa",
      "stop_id": "stop-demo-a",
      "name": "פתיחת המסלול",
      "text": "טקסט הדגמה סינתטי לפתיחת המסלול. אינו ציטוט ממקור, ואינו נמסר למשפחה.",
      "source_id": "src-demo-1",
      "page": 7,
      "word_count": 71,
      "status": "approved",
      "audience": "כולם"
    },
    {
      "item_id": "item-demo-2",
      "site_id": "site-demo-jaffa",
      "stop_id": "stop-demo-a",
      "name": "הבניין שבפינה",
      "text": "טקסט הדגמה סינתטי על הבניין שבפינת הרחוב. אינו ציטוט ממקור.",
      "source_id": "src-demo-1",
      "page": 9,
      "word_count": 84,
      "status": "approved",
      "audience": "כולם"
    },
    {
      "item_id": "item-demo-3",
      "site_id": "site-demo-jaffa",
      "stop_id": "stop-demo-a",
      "name": "פריט שהוגש להכרעה",
      "text": "טקסט הדגמה סינתטי שממתין להכרעת החוקר.",
      "source_id": "src-demo-1",
      "page": 12,
      "word_count": 52,
      "status": "pending",
      "audience": "כולם"
    },
    {
      "item_id": "item-demo-4",
      "site_id": "site-demo-jaffa",
      "stop_id": "stop-demo-b",
      "name": "הכיכר",
      "text": "טקסט הדגמה סינתטי על הכיכר. אינו ציטוט ממקור.",
      "source_id": "src-demo-1",
      "page": 18,
      "word_count": 63,
      "status": "approved",
      "audience": "כולם"
    },
    {
      "item_id": "item-demo-5",
      "site_id": "site-demo-jaffa",
      "stop_id": "stop-demo-b",
      "name": "פריט שנדחה",
      "text": "טקסט הדגמה סינתטי שנדחה בהכרעת החוקר, עם הערה.",
      "source_id": "src-demo-1",
      "page": 23,
      "word_count": 47,
      "status": "rejected",
      "audience": "כולם"
    },
    {
      "item_id": "item-demo-6",
      "site_id": "site-demo-jaffa",
      "stop_id": "stop-demo-b",
      "name": "פריט בכתיבה",
      "text": "טקסט הדגמה סינתטי בכתיבה, טרם הוגש.",
      "source_id": "src-demo-1",
      "page": 31,
      "word_count": 38,
      "status": "draft",
      "audience": "כולם"
    },
    {
      "item_id": "item-demo-7",
      "site_id": "site-demo-jaffa",
      "stop_id": "stop-demo-c",
      "name": "התחנה בלי פריט מאושר",
      "text": "טקסט הדגמה סינתטי לתחנה שאין בה עדיין פריט מאושר. זו התחנה שמכשילה את תנאי הנעילה.",
      "source_id": "src-demo-1",
      "page": 44,
      "word_count": 96,
      "status": "pending",
      "audience": "כולם"
    },
    {
      "item_id": "item-demo-8",
      "site_id": "site-demo-jaffa",
      "stop_id": "stop-demo-b",
      "name": "פריט למבוגרים בלבד",
      "text": "טקסט הדגמה סינתטי שסומן למבוגרים בלבד, כדי שמסנן ה-audience ייראה על המסך.",
      "source_id": "src-demo-1",
      "page": 57,
      "word_count": 112,
      "status": "approved",
      "audience": "מבוגרים בלבד"
    }
  ],
  "approvals": [
    {
      "approval_id": "appr-demo-1",
      "time": "2026-09-03T08:12:00.000Z",
      "who": "user-demo-researcher",
      "target": "item-demo-1",
      "action": "approve",
      "from_status": "pending",
      "to_status": "approved",
      "note": ""
    },
    {
      "approval_id": "appr-demo-2",
      "time": "2026-09-03T08:17:00.000Z",
      "who": "user-demo-researcher",
      "target": "item-demo-2",
      "action": "approve",
      "from_status": "pending",
      "to_status": "approved",
      "note": ""
    },
    {
      "approval_id": "appr-demo-3",
      "time": "2026-09-03T08:23:00.000Z",
      "who": "user-demo-researcher",
      "target": "item-demo-5",
      "action": "reject",
      "from_status": "pending",
      "to_status": "rejected",
      "note": "הערת הדגמה: העמוד אינו תואם את הטקסט."
    },
    {
      "approval_id": "appr-demo-4",
      "time": "2026-09-03T08:29:00.000Z",
      "who": "user-demo-researcher",
      "target": "item-demo-4",
      "action": "approve",
      "from_status": "pending",
      "to_status": "approved",
      "note": ""
    },
    {
      "approval_id": "appr-demo-5",
      "time": "2026-09-03T08:36:00.000Z",
      "who": "user-demo-researcher",
      "target": "item-demo-8",
      "action": "approve",
      "from_status": "pending",
      "to_status": "approved",
      "note": "הערת הדגמה: מתאים למבוגרים."
    }
  ],
  "sites": [
    {
      "site_id": "site-demo-jaffa",
      "name": "מסלול הדגמה, רחוב יפו",
      "stops": [
        "stop-demo-a",
        "stop-demo-b",
        "stop-demo-c"
      ],
      "bounds": {
        "min_lat": 31.778,
        "max_lat": 31.786,
        "min_lng": 35.21,
        "max_lng": 35.225
      },
      "status": "open",
      "locked_at": null,
      "corpus_version": null
    }
  ],
  "sources": [
    {
      "source_id": "src-demo-1",
      "name": "חוברת הדגמה: רחוב יפו",
      "file": "demo-source.pdf",
      "publisher": "הוצאת הדגמה"
    }
  ],
  "institutes": [
    {
      "institute_id": "inst-demo-1",
      "name": "מכון הדגמה למחקר ירושלים"
    }
  ],
  "rights_mou": [
    {
      "mou_id": "mou-demo-1",
      "institute_id": "inst-demo-1",
      "scope": [
        "src-demo-1"
      ],
      "signed_at": "2026-09-01T09:00:00.000Z",
      "valid_until": "2027-09-01T09:00:00.000Z",
      "covers_content_contribution": true
    }
  ],
  "geo_anchors": [
    {
      "anchor_id": "anchor-demo-1",
      "item_id": "item-demo-1",
      "lat": 31.7811,
      "lng": 35.2192,
      "verified": true,
      "verified_at": "2026-09-02T07:30:00.000Z",
      "is_crossing": false
    },
    {
      "anchor_id": "anchor-demo-2",
      "item_id": "item-demo-2",
      "lat": 31.7813,
      "lng": 35.2186,
      "verified": true,
      "verified_at": "2026-09-02T07:34:00.000Z",
      "is_crossing": false
    },
    {
      "anchor_id": "anchor-demo-4",
      "item_id": "item-demo-4",
      "lat": 31.7822,
      "lng": 35.2174,
      "verified": true,
      "verified_at": "2026-09-02T07:41:00.000Z",
      "is_crossing": true
    },
    {
      "anchor_id": "anchor-demo-8",
      "item_id": "item-demo-8",
      "lat": 31.7826,
      "lng": 35.2168,
      "verified": false,
      "verified_at": null,
      "is_crossing": false
    }
  ],
  "exit_points": [
    {
      "exit_id": "exit-demo-1",
      "site_id": "site-demo-jaffa",
      "lat": 31.7818,
      "lng": 35.2179,
      "name": "תחנת הרכבת הקלה, הדגמה",
      "type": "תחבורה ציבורית"
    }
  ],
  "sessions": [
    {
      "session_id": "sess-demo-1",
      "site_id": "site-demo-jaffa",
      "started_at": "2026-09-05T06:02:00.000Z",
      "ended_at": "2026-09-05T07:11:00.000Z",
      "completed": true,
      "last_stop_id": "stop-demo-c",
      "flags": [],
      "previous_session_id": null
    },
    {
      "session_id": "sess-demo-2",
      "site_id": "site-demo-jaffa",
      "started_at": "2026-09-06T06:44:00.000Z",
      "ended_at": "2026-09-06T07:39:00.000Z",
      "completed": true,
      "last_stop_id": "stop-demo-c",
      "flags": [],
      "previous_session_id": null
    },
    {
      "session_id": "sess-demo-3",
      "site_id": "site-demo-jaffa",
      "started_at": "2026-09-07T07:03:00.000Z",
      "ended_at": "2026-09-07T07:36:00.000Z",
      "completed": false,
      "last_stop_id": "stop-demo-b",
      "flags": [],
      "previous_session_id": null
    },
    {
      "session_id": "sess-demo-4",
      "site_id": "site-demo-jaffa",
      "started_at": "2026-09-08T06:02:00.000Z",
      "ended_at": "2026-09-08T06:55:00.000Z",
      "completed": false,
      "last_stop_id": "stop-demo-a",
      "flags": [
        "partial_log"
      ],
      "previous_session_id": null
    }
  ],
  "interactions": [
    {
      "interaction_id": "int-demo-1",
      "session_id": "sess-demo-1",
      "time": "2026-09-05T06:09:00.000Z",
      "type": "initiated",
      "stop_id": "stop-demo-a",
      "item_id": "item-demo-1",
      "question": "שאלת הדגמה ראשונה",
      "source_item": "item-demo-1",
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-2",
      "session_id": "sess-demo-1",
      "time": "2026-09-05T06:31:00.000Z",
      "type": "initiated",
      "stop_id": "stop-demo-b",
      "item_id": "item-demo-4",
      "question": "שאלת הדגמה שנייה",
      "source_item": "item-demo-4",
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-3",
      "session_id": "sess-demo-2",
      "time": "2026-09-06T06:51:00.000Z",
      "type": "initiated",
      "stop_id": "stop-demo-a",
      "item_id": "item-demo-1",
      "question": "שאלת הדגמה שלישית",
      "source_item": "item-demo-1",
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-4",
      "session_id": "sess-demo-2",
      "time": "2026-09-06T07:02:00.000Z",
      "type": "initiated",
      "stop_id": "stop-demo-b",
      "item_id": "item-demo-4",
      "question": "שאלת הדגמה רביעית",
      "source_item": "item-demo-4",
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-5",
      "session_id": "sess-demo-2",
      "time": "2026-09-06T07:22:00.000Z",
      "type": "initiated",
      "stop_id": "stop-demo-c",
      "item_id": null,
      "question": "שאלת הדגמה חמישית",
      "source_item": null,
      "is_fallback": true
    },
    {
      "interaction_id": "int-demo-6",
      "session_id": "sess-demo-3",
      "time": "2026-09-07T07:09:00.000Z",
      "type": "initiated",
      "stop_id": "stop-demo-a",
      "item_id": "item-demo-1",
      "question": "שאלת הדגמה שישית",
      "source_item": "item-demo-1",
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-7",
      "session_id": "sess-demo-3",
      "time": "2026-09-07T07:18:00.000Z",
      "type": "initiated",
      "stop_id": "stop-demo-b",
      "item_id": "item-demo-4",
      "question": "שאלת הדגמה שביעית",
      "source_item": "item-demo-4",
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-8",
      "session_id": "sess-demo-3",
      "time": "2026-09-07T07:27:00.000Z",
      "type": "initiated",
      "stop_id": "stop-demo-b",
      "item_id": null,
      "question": "שאלת הדגמה שמינית",
      "source_item": null,
      "is_fallback": true
    },
    {
      "interaction_id": "int-demo-9",
      "session_id": "sess-demo-3",
      "time": "2026-09-07T07:31:00.000Z",
      "type": "initiated",
      "stop_id": "stop-demo-b",
      "item_id": "item-demo-4",
      "question": "שאלת הדגמה תשיעית",
      "source_item": "item-demo-4",
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-11",
      "session_id": "sess-demo-3",
      "time": "2026-09-07T07:34:00.000Z",
      "type": "initiated",
      "stop_id": "stop-demo-b",
      "item_id": "item-demo-4",
      "question": "שאלת הדגמה עשירית",
      "source_item": "item-demo-4",
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-push-1",
      "session_id": "sess-demo-1",
      "time": "2026-09-05T06:05:00.000Z",
      "type": "pushed",
      "stop_id": "stop-demo-a",
      "item_id": "item-demo-1",
      "question": null,
      "source_item": null,
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-push-2",
      "session_id": "sess-demo-2",
      "time": "2026-09-06T06:05:00.000Z",
      "type": "pushed",
      "stop_id": "stop-demo-a",
      "item_id": "item-demo-1",
      "question": null,
      "source_item": null,
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-push-3",
      "session_id": "sess-demo-3",
      "time": "2026-09-07T06:05:00.000Z",
      "type": "pushed",
      "stop_id": "stop-demo-a",
      "item_id": "item-demo-1",
      "question": null,
      "source_item": null,
      "is_fallback": false
    },
    {
      "interaction_id": "int-demo-push-4",
      "session_id": "sess-demo-4",
      "time": "2026-09-08T06:07:00.000Z",
      "type": "pushed",
      "stop_id": "stop-demo-a",
      "item_id": "item-demo-1",
      "question": null,
      "source_item": null,
      "is_fallback": false
    }
  ]
});
