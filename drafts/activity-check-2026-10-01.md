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
