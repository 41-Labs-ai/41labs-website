// Minimal Twenty REST client for the booking cron.

const { fetchWithTimeout } = require('./util');

const twentyBase = (env) => env.TWENTY_BASE_URL || 'https://twenty-server-production-bb71.up.railway.app';

// 41 Closer deals at SCREENING or MEETING created since `sinceIso`, newest first,
// with pointOfContact + company expanded (depth=1). Up to 5 pages of 200.
async function listCloserCandidates({ env, fetchImpl, sinceIso }) {
  const filter = `and(productLine[eq]:CLOSER_41,stage[in]:[SCREENING,MEETING],createdAt[gte]:"${sinceIso}")`;
  const out = [];
  let cursor = '';
  for (let page = 0; page < 5; page += 1) {
    const q = new URLSearchParams({ filter, limit: '200', depth: '1', order_by: 'createdAt[DescNullsLast]' });
    if (cursor) q.set('starting_after', cursor);
    const r = await fetchWithTimeout(fetchImpl, `${twentyBase(env)}/rest/opportunities?${q}`, {
      headers: { Authorization: `Bearer ${env.TWENTY_API_KEY}` },
    }, 8000);
    if (!r.ok) throw new Error(`twenty list ${r.status}`);
    const j = await r.json();
    out.push(...((j && j.data && j.data.opportunities) || []));
    const info = (j && j.pageInfo) || {};
    if (!info.hasNextPage || !info.endCursor) break;
    cursor = info.endCursor;
  }
  return out;
}

async function patchOpportunity({ env, fetchImpl, id, fields }) {
  const r = await fetchWithTimeout(fetchImpl, `${twentyBase(env)}/rest/opportunities/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${env.TWENTY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }, 8000);
  if (!r.ok) throw new Error(`twenty patch ${r.status}`);
}

module.exports = { twentyBase, listCloserCandidates, patchOpportunity };
