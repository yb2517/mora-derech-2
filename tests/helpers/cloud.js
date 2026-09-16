// רשת מדומה לדרייבר הענן: מסד קטן בזיכרון שעונה לצורות הבקשה
// שהדרייבר שולח (קריאה עם עמודים, הוספה, upsert, עדכון לפי מסנן
// שוויון), ומאפשר להכשיל את הרשת או להחזיר דחייה. משימה 13.3
// בתוכנית שלב 5 חלק ב.
//
// אינו קוד המערכת: יושב תחת tests/ ואינו נסרק במבחני המבנה.

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

/**
 * @param {object} [options]
 * @param {object} [options.tables] מצב התחלתי: שם טבלה לרשימת שורות.
 * @param {object} [options.keys] המפתח הראשי של כל טבלה, ל-upsert.
 */
export function fakePostgrest({ tables = {}, keys = {} } = {}) {
  const state = {};
  for (const [name, rows] of Object.entries(tables)) state[name] = rows.map((r) => ({ ...r }));

  const calls = [];
  let networkDown = false;
  let reject = null;

  async function fetch(url, { method = 'GET', headers = {}, body } = {}) {
    const parsed = new URL(url);
    const table = parsed.pathname.split('/rest/v1/')[1];
    calls.push({ method, table, headers, body: body === undefined ? undefined : JSON.parse(body) });

    if (networkDown) throw new TypeError('Failed to fetch');
    if (reject) return jsonResponse(reject.status, reject.body ?? { message: 'rejected' });
    if (headers.apikey === undefined || !String(headers.Authorization).startsWith('Bearer ')) {
      return jsonResponse(401, { message: 'No API key' });
    }

    const rows = (state[table] ??= []);

    if (method === 'GET') {
      const range = String(headers.Range ?? '0-999').split('-').map(Number);
      return jsonResponse(200, rows.slice(range[0], range[1] + 1).map((r) => ({ ...r })));
    }

    const payload = JSON.parse(body);

    if (method === 'POST') {
      const merge = String(headers.Prefer ?? '').includes('merge-duplicates');
      const key = keys[table];
      if (merge && key) {
        const at = rows.findIndex((r) => r[key] === payload[key]);
        if (at === -1) rows.push({ ...payload });
        else rows[at] = { ...rows[at], ...payload };
      } else {
        if (key && rows.some((r) => r[key] === payload[key])) {
          return jsonResponse(409, { message: 'duplicate key' });
        }
        rows.push({ ...payload });
      }
      return jsonResponse(201, null);
    }

    if (method === 'PATCH') {
      const [column, filter] = [...parsed.searchParams.entries()][0];
      const id = decodeURIComponent(filter.replace(/^eq\./, ''));
      for (let i = 0; i < rows.length; i += 1) {
        if (rows[i][column] === id) rows[i] = { ...rows[i], ...payload };
      }
      return jsonResponse(204, null);
    }

    return jsonResponse(405, { message: 'method not allowed' });
  }

  return {
    fetch,
    calls,
    state,
    rows: (table) => (state[table] ?? []).map((r) => ({ ...r })),
    setNetworkDown(down) { networkDown = down; },
    rejectWith(status, body) { reject = status === null ? null : { status, body }; },
  };
}

/** לוח זמנים ידני: הניסיון החוזר נדרך ורץ רק כשהבדיקה אומרת. */
export function manualSchedule() {
  const pending = [];
  return {
    pending,
    setTimeout: (fn, ms) => { pending.push({ fn, ms }); return pending.length; },
    async fire() {
      const items = pending.splice(0);
      for (const item of items) item.fn();
    },
  };
}

export async function settle(rounds = 8) {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}
