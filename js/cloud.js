/* Supabase sync over its REST API (no library needed).
   Everything here is optional: when the url/key in content.js are empty,
   `enabled` is false and the site keeps everything in the browser. */
window.CLOUD = (() => {
  const cfg = window.KAMY.supabase || {};
  const base = (cfg.url || '').replace(/\/+$/, '');
  // Local copies (localhost / file) stay off the real database so your own
  // testing never grows her flowers. Add ?live to the URL to test against it.
  const local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const enabled = !!(base && cfg.key) && (!local || new URLSearchParams(location.search).has('live'));

  async function call(path, body) {
    const headers = { apikey: cfg.key, 'Content-Type': 'application/json' };
    if (cfg.key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + cfg.key; // legacy anon JWT
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    try {
      const res = await fetch(base + path, {
        method: body ? 'POST' : 'GET',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.message) || `supabase ${res.status}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    enabled,
    registerVisit: everyVisit => call('/rest/v1/rpc/register_visit', { every_visit: !!everyVisit }),
    getGarden: () => call('/rest/v1/garden?select=count&id=eq.1').then(r => ({ count: r[0] ? r[0].count : 0, grew: false })),
    planted: () => call('/rest/v1/planted?select=id,created_at,fx,fy,head,color,note&order=id'),
    shareWish: text => call('/rest/v1/rpc/share_wish', { p_wish: text }),
    plant: f => call('/rest/v1/rpc/plant_flower', { p_fx: f.fx, p_fy: f.fy, p_head: f.head, p_color: f.color, p_note: f.note })
  };
})();
