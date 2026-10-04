# Activity check for 1 October 2026

Checked on 4 October 2026 against the live Supabase project `mora-derech-2`.

## Short answer

No. There was no activity of any kind on 1 October 2026.

## Important note on "login"

The system has no login. There is no sign-in screen, and the Supabase `auth.users` table has 0 users. The closest measures of "someone used the system" are the `audit_log` and `sessions` tables, plus the Supabase API logs. All three were checked.

## Findings

| Source | Result for 1 October (Israel time window) |
|---|---|
| `audit_log` | 0 rows |
| `sessions` | 0 sessions |
| Supabase API logs (`edge_logs`) | 0 requests |

## Recent days for comparison

| Day | audit_log rows | Requests | Sessions | Last row |
|---|---|---|---|---|
| 27 Sep | 267 | 135 | 6 | 17:09 UTC |
| 28 Sep | 262 | 132 | 3 | 17:04 UTC |
| 29 Sep | 0 | 0 | 0 | none |
| 30 Sep | 62 | 31 | 1 | 11:57 UTC |
| 1 Oct | 0 | 0 | 0 | none |
| 2 to 4 Oct | 0 | 0 | 0 | none |

The most recent `audit_log` row in the whole database is from 30 September 2026 at 11:57 UTC. The table holds 1,860 rows in total. No sessions are marked `is_demo`.

## Caveats

- Activity that never reached the database would not appear here. For example, a page opened in a browser with no request sent would leave no trace.
- Supabase API logs were checked for the 24 hour window around 1 October only.
- I did not check who made the 30 September requests. The tables hold no user identity, only module names and request ids.

## The 30 September activity

A single short session of about 4 minutes, from 11:53 to 11:57 UTC (14:53 to 14:57 Israel time). It produced 31 requests and 62 `audit_log` rows, since each request writes two rows. Every row has an `ok` outcome, with no rejections and no error codes.

### Sequence

| Time (UTC) | What happened |
|---|---|
| 11:53:10 | The veto screen and the content screen loaded: site, sources, items, approvals, exit points and gate. The stale session closer (`close_stale`) ran and found nothing to close. |
| 11:53:27 | The traveler screen checked the gate and started session `sess-3d532a3a-3b9b-4bc4-9932-baf6802eafdd` for site `jaffa-01`. The geofence module listed anchors and exit points. |
| 11:53:59 to 11:54:04 | Arrival at `stop-02` (`arrive`). Delivery looked up the approved items for that stop and logged the delivery. |
| 11:54 to 11:57 | Three `release` actions from the system timer (the hold between arrivals). |
| 11:55:08 | The traveler asked one question, handled by the dialogue module and retrieval, and logged. |
| 11:55:13 | The owner screen loaded: site, sources, institutes, MOUs, metrics and lock readiness. |

### Observations

- The session carries only the `no_hebrew_voice` flag and no simulator flag. The pattern (screens load, a session starts 17 seconds later, an arrival 30 seconds after that) looks like someone opening the app on a device and walking through it. The data cannot confirm this.
- The session is still open: `ended_at` is empty and `completed` is false. Nothing has loaded since, so `close_stale` has not run again.
- `no_hebrew_voice` means the device had no Hebrew voice, so the spoken answer could not play in Hebrew.
