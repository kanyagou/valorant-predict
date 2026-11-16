const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_KEY, HK = process.env.HENRIK_KEY;
const sb = (p, o = {}) => fetch(`${U}/rest/v1/${p}`, {
  ...o,
  headers: { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', ...(o.headers || {}) }
});
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const key = o => (o.name + '#' + o.tag).toLowerCase();

module.exports = async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const code = String(body.room || '').toLowerCase();
    const room = encodeURIComponent(code);
    const sim = !!body.sim;
    const rows = await sb(`rooms?code=eq.${room}&select=state`).then(r => r.json());
    if (!rows[0]) return res.json({ ok: false, msg: '找不到房間' });
    const S = rows[0].state;
    S.done = S.done || []; S.total = S.total || {};
    const preds = await sb(`preds?room=eq.${room}&select=player_id,answers,created_at`).then(r => r.json());
    if (!preds.length) return res.json({ ok: false, msg: '還沒有人送出預測' });
    const ps = S.players.filter(p => p.on);
    const st = {}; let mid;

    if (sim) {
      mid = 'sim-' + Date.now();
      ps.forEach(p => {
        const k = rnd(5, 30), d = rnd(4, 20), a = rnd(1, 12);
        st[p.id] = { k, d, a, kda: (k + a) / Math.max(d, 1), hs: rnd(8, 35), kills: k, deaths: d, acs: rnd(120, 330), fb: rnd(0, 6) };
      });
    } else {
      if (!HK) return res.json({ ok: false, msg: '伺服器沒有設定 HENRIK_KEY' });
      const since = Math.min(...preds.map(x => Date.parse(x.created_at)));
      const [n, t] = ps[0].name.split('#');
      const r = await fetch(`https://api.henrikdev.xyz/valorant/v4/matches/${S.region || 'ap'}/pc/${encodeURIComponent(n.trim())}/${encodeURIComponent((t || '').trim())}?size=5`, { headers: { Authorization: HK } });
      if (!r.ok) return res.json({ ok: false, msg: r.status === 429 ? '請求太頻繁,稍後再試' : 'HenrikDev 錯誤 ' + r.status });
      const j = await r.json();
      const m = (j.data || [])
        .filter(x => x.metadata && !S.done.includes(x.metadata.match_id) && Date.parse(x.metadata.started_at) > since)
        .sort((a, b) => Date.parse(b.metadata.started_at) - Date.parse(a.metadata.started_at))
        .find(x => ps.every(p => x.players.some(o => key(o) === p.name.trim().toLowerCase())));
      if (!m) return res.json({ ok: false, msg: '還沒偵測到比賽結束(' + new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' }) + ')' });
      mid = m.metadata.match_id;
      const R = (m.rounds || []).length || 1, first = {}, byR = {};
      (m.kills || []).forEach(k => { const b = byR[k.round]; if (!b || k.time_in_round_in_ms < b.time_in_round_in_ms) byR[k.round] = k; });
      Object.values(byR).forEach(k => { const id = k.killer && k.killer.puuid; if (id) first[id] = (first[id] || 0) + 1; });
      ps.forEach(p => {
        const o = m.players.find(o => key(o) === p.name.trim().toLowerCase()), s = o.stats, sh = s.headshots + s.bodyshots + s.legshots;
        st[p.id] = { k: s.kills, d: s.deaths, a: s.assists, kda: (s.kills + s.assists) / Math.max(s.deaths, 1), hs: sh ? s.headshots / sh * 100 : 0, kills: s.kills, deaths: s.deaths, acs: s.score / R, fb: first[o.puuid] || 0 };
      });
    }

    // 先刪除預測當作鎖,避免多人同時觸發而重複計分
    const del = await sb(`preds?room=eq.${room}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } }).then(r => r.json());
    if (!del.length) return res.json({ ok: false, msg: '已被其他人結算' });
    const pr = {}; del.forEach(x => pr[x.player_id] = x.answers);

    const out = [], sc = {}; ps.forEach(p => sc[p.id] = 0);
    S.qs.filter(q => q.on).forEach(q => {
      const vals = ps.map(p => st[p.id][q.m]), t = q.d === 'max' ? Math.max(...vals) : Math.min(...vals);
      const win = ps.filter(p => st[p.id][q.m] === t).map(p => p.id);
      const hit = ps.filter(p => win.includes((pr[p.id] || {})[q.id]));
      hit.forEach(p => sc[p.id] += q.pts);
      out.push({ q, win, hit: hit.map(p => p.id), val: t });
    });
    ps.forEach(p => S.total[p.id] = (S.total[p.id] || 0) + sc[p.id]);
    S.last = { st, res: out, sc, ids: ps.map(p => p.id) };
    S.done.push(mid);
    await sb('rooms', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ code, state: S }) });
    res.json({ ok: true, msg: '已結算' });
  } catch (e) {
    res.json({ ok: false, msg: '伺服器錯誤:' + e.message });
  }
};
