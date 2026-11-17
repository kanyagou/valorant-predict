const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_KEY, HK = process.env.HENRIK_KEY;
const sb = (p, o = {}) => fetch(`${U}/rest/v1/${p}`, {
  ...o,
  headers: { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', ...(o.headers || {}) }
});
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const key = o => (o.name + '#' + o.tag).toLowerCase();
const hm = t => new Date(t).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' });

module.exports = async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const code = String(body.room || '').toLowerCase();
    const room = encodeURIComponent(code);
    const sim = !!body.sim, loose = !!body.loose;
    const rows = await sb(`rooms?code=eq.${room}&select=state`).then(r => r.json());
    if (!rows[0]) return res.json({ ok: false, msg: '找不到房間' });
    const S = rows[0].state;
    S.done = S.done || []; S.total = S.total || {};
    const preds = await sb(`preds?room=eq.${room}&select=player_id,answers,created_at`).then(r => r.json());
    if (!preds.length) return res.json({ ok: false, msg: '還沒有人送出預測' });
    const on = S.players.filter(p => p.on);
    const need = on.filter(p => preds.some(x => x.player_id === p.id));
    if (!need.length) return res.json({ ok: false, msg: '送出預測的人都沒有勾選「我這場有下場」' });
    const st = {}; let mid, ps, absent = [];

    if (sim) {
      mid = 'sim-' + Date.now(); ps = on;
      ps.forEach(p => {
        const k = rnd(5, 30), d = rnd(4, 20), a = rnd(1, 12);
        st[p.id] = { k, d, a, kda: (k + a) / Math.max(d, 1), hs: rnd(8, 35), kills: k, deaths: d, acs: rnd(120, 330), fb: rnd(0, 6), kdiff: k - d, dd: rnd(-60, 80) + Math.random() };
      });
    } else {
      if (!HK) return res.json({ ok: false, msg: '伺服器沒有設定 HENRIK_KEY' });
      const since = Math.min(...preds.map(x => Date.parse(x.created_at)));
      const base = S.players.find(p => p.id === S.host && p.on) || need[0];   // 以房主的比賽為準(房主沒下場才退回第一位預測者)
      const [n, t] = base.name.split('#');
      const r = await fetch(`https://api.henrikdev.xyz/valorant/v4/matches/${S.region || 'ap'}/pc/${encodeURIComponent(n.trim())}/${encodeURIComponent((t || '').trim())}?size=10`, { headers: { Authorization: HK } });
      if (!r.ok) return res.json({ ok: false, msg: r.status === 429 ? '請求太頻繁,稍後再試' : `HenrikDev 錯誤 ${r.status}(請確認 ${base.name} 與地區 ${S.region || 'ap'} 是否正確)` });
      const j = await r.json();
      const list = (j.data || []).filter(x => x.metadata && x.players).sort((a, b) => Date.parse(b.metadata.started_at) - Date.parse(a.metadata.started_at));
      if (!list.length) return res.json({ ok: false, msg: 'HenrikDev 查不到最近的比賽,請確認 Riot ID 與地區' });
      const nk = p => p.name.trim().toLowerCase();
      const inM = x => on.filter(p => x.players.some(o => key(o) === nk(p)));
      const m = list.find(x => !S.done.includes(x.metadata.match_id) && (loose || Date.parse(x.metadata.started_at) > since) && inM(x).length >= 2);
      if (!m) {
        const x = list[0], mode = (x.metadata.queue && x.metadata.queue.name) || '未知模式';
        let why = '';
        if (S.done.includes(x.metadata.match_id)) why = '這場已經結算過了';
        else if (!loose && Date.parse(x.metadata.started_at) <= since) why = `這場開打時間早於預測送出時間(${hm(since)}),若剛打完可能是資料延遲,請過幾分鐘再試`;
        else if (inM(x).length < 2) why = `這場只有 ${inM(x).length} 位勾選下場的人在場上(請確認 Riot ID 拼法)`;
        return res.json({ ok: false, msg: `找到 ${list.length} 場最近比賽。最新一場(${hm(x.metadata.started_at)} 開打,${mode}):${why}` });
      }
      mid = m.metadata.match_id;
      ps = inM(m);
      absent = on.filter(p => !ps.includes(p)).map(p => p.name.split('#')[0]);
      const R = (m.rounds || []).length || 1, first = {}, byR = {};
      (m.kills || []).forEach(k => { const b = byR[k.round]; if (!b || k.time_in_round_in_ms < b.time_in_round_in_ms) byR[k.round] = k; });
      Object.values(byR).forEach(k => { const id = k.killer && k.killer.puuid; if (id) first[id] = (first[id] || 0) + 1; });
      ps.forEach(p => {
        const o = m.players.find(o => key(o) === nk(p)), s = o.stats, sh = s.headshots + s.bodyshots + s.legshots;
        const dm = s.damage || {};
        st[p.id] = { k: s.kills, d: s.deaths, a: s.assists, kda: (s.kills + s.assists) / Math.max(s.deaths, 1), hs: sh ? s.headshots / sh * 100 : 0, kills: s.kills, deaths: s.deaths, acs: s.score / R, fb: first[o.puuid] || 0, kdiff: s.kills - s.deaths, dd: ((dm.dealt || 0) - (dm.received || 0)) / R };
      });
    }

    // 先刪除預測當作鎖,避免多人同時觸發而重複計分
    const del = await sb(`preds?room=eq.${room}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } }).then(r => r.json());
    if (!del.length) return res.json({ ok: false, msg: '已被其他人結算' });
    const pr = {}; del.forEach(x => pr[x.player_id] = x.answers);

    const out = [], sc = {}; ps.forEach(p => sc[p.id] = 0);
    S.qs.filter(q => q.on).forEach(q => {
      let win, val, th = false;
      if (q.t === 'th') {
        if (!st[q.target]) return;
        val = st[q.target][q.m]; win = [val > q.n ? 'y' : 'n']; th = true;
      } else {
        const vals = ps.map(p => st[p.id][q.m]), t = q.d === 'max' ? Math.max(...vals) : Math.min(...vals);
        val = t; win = ps.filter(p => st[p.id][q.m] === t).map(p => p.id);
      }
      const picks = {};
      ps.forEach(p => { const a = (pr[p.id] || {})[q.id]; if (a) picks[p.id] = { a, ok: win.includes(a) }; });
      const ids = Object.keys(picks), okIds = ids.filter(id => picks[id].ok);
      const solo = okIds.length === 1 && ids.length >= 2 ? okIds[0] : '';   // 獨具慧眼:只有一人猜對 ×1.5
      ids.forEach(id => {
        const x = picks[id], bet = (pr[id] || {})._bet === q.id;             // 惡魔契約:猜對 ×3,猜錯倒扣該題分數
        let pts = x.ok ? q.pts : 0;
        if (x.ok && id === solo) pts *= 1.5;
        if (bet) pts = x.ok ? pts * 3 : -q.pts;
        x.pts = pts; x.solo = id === solo; x.bet = bet;
        sc[id] += pts;
      });
      out.push({ q, win, hit: okIds, val, th, picks });
    });
    ps.forEach(p => S.total[p.id] = (S.total[p.id] || 0) + sc[p.id]);
    S.last = { st, res: out, sc, ids: ps.map(p => p.id), at: Date.now(), absent };
    S.done.push(mid);
    await sb('rooms', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ code, state: S }) });
    res.json({ ok: true, msg: '已結算' });
  } catch (e) {
    res.json({ ok: false, msg: '伺服器錯誤:' + e.message });
  }
};
