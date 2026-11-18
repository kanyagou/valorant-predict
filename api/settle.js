const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_KEY, HK = process.env.HENRIK_KEY;
const sb = (p, o = {}) => fetch(`${U}/rest/v1/${p}`, {
  ...o,
  headers: { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', ...(o.headers || {}) }
});
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const key = o => (o.name + '#' + o.tag).toLowerCase();
const hm = t => new Date(t).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' });
const dn = p => p.nick || p.name.split('#')[0];
const WEAPONS = ['Vandal', 'Phantom', 'Operator', 'Sheriff', 'Ghost', 'Classic', 'Judge', 'Bulldog', 'Guardian', 'Marshal', 'Outlaw', 'Odin', 'Ares', 'Spectre', 'Stinger', 'Bucky', 'Frenzy', 'Shorty', 'Melee'];

function simOne() {
  const k = rnd(5, 30), d = rnd(4, 20), a = rnd(1, 12), R = 22, sh = rnd(60, 160), h = Math.round(sh * rnd(8, 35) / 100), l = rnd(2, 10), dealt = rnd(1500, 4500), recv = rnd(1500, 4500);
  const x = { k, d, a, kills: k, deaths: d, assists: a, kda: (k + a) / Math.max(d, 1), hs: h / sh * 100, hsn: h, bodyn: Math.max(0, sh - h - l), legn: l, shots: sh, score: rnd(2000, 7000), acs: rnd(120, 330), dmg: dealt, dmgr: recv, dd: (dealt - recv) / R + Math.random(), adr: dealt / R, kdiff: k - d, fb: rnd(0, 6), fd: rnd(0, 6), m2: rnd(0, 5), m3: rnd(0, 2), ace: rnd(0, 1), plants: rnd(0, 3), defuses: rnd(0, 2) };
  WEAPONS.forEach(w => x['wk_' + w] = rnd(0, Math.floor(k / 2)));
  return x;
}

const RATE = new Set(['kda', 'hs', 'acs', 'adr', 'dd']);
let AGC = null;
async function getAgents() {
  if (AGC) return AGC;
  try {
    const j = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=zh-TW').then(r => r.json());
    const m = {};
    (j.data || []).forEach(a => m[a.uuid] = { name: a.displayName, role: a.role && a.role.uuid, roleName: a.role && a.role.displayName });
    if (Object.keys(m).length) AGC = m;
    return m;
  } catch (e) { return {}; }
}

function realStats(m, ps, nk) {
  const R = (m.rounds || []).length || 1, agg = {}, byR = {};
  const A = id => agg[id] = agg[id] || { fb: 0, fd: 0, m2: 0, m3: 0, ace: 0, plants: 0, defuses: 0, wk: {} };
  (m.kills || []).forEach(k => { (byR[k.round] = byR[k.round] || []).push(k); });
  Object.values(byR).forEach(ks => {
    ks.sort((a, b) => a.time_in_round_in_ms - b.time_in_round_in_ms);
    const f = ks[0];
    if (f.killer && f.killer.puuid) A(f.killer.puuid).fb++;
    if (f.victim && f.victim.puuid) A(f.victim.puuid).fd++;
    const c = {};
    ks.forEach(k => { const id = k.killer && k.killer.puuid; if (id) c[id] = (c[id] || 0) + 1; });
    Object.entries(c).forEach(([id, n]) => { if (n >= 2) A(id).m2++; if (n >= 3) A(id).m3++; if (n >= 5) A(id).ace++; });
  });
  (m.kills || []).forEach(k => {
    const id = k.killer && k.killer.puuid, w = k.weapon && k.weapon.name;
    if (id && w) { const a = A(id), n = w.toLowerCase(); a.wk[n] = (a.wk[n] || 0) + 1; }
  });
  (m.rounds || []).forEach(r => {
    const a = r.plant && r.plant.player && r.plant.player.puuid, b = r.defuse && r.defuse.player && r.defuse.player.puuid;
    if (a) A(a).plants++; if (b) A(b).defuses++;
  });
  const st = {}, ag = {};
  ps.forEach(p => {
    const o = m.players.find(o => key(o) === nk(p)), s = o.stats, dm = s.damage || {}, g = A(o.puuid);
    const sh = s.headshots + s.bodyshots + s.legshots, dealt = dm.dealt || 0, recv = dm.received || 0;
    const x = { k: s.kills, d: s.deaths, a: s.assists, kills: s.kills, deaths: s.deaths, assists: s.assists, kda: (s.kills + s.assists) / Math.max(s.deaths, 1), hs: sh ? s.headshots / sh * 100 : 0, hsn: s.headshots, bodyn: s.bodyshots, legn: s.legshots, shots: sh, score: s.score, acs: s.score / R, dmg: dealt, dmgr: recv, dd: (dealt - recv) / R, adr: dealt / R, kdiff: s.kills - s.deaths, fb: g.fb, fd: g.fd, m2: g.m2, m3: g.m3, ace: g.ace, plants: g.plants, defuses: g.defuses };
    WEAPONS.forEach(w => x['wk_' + w] = g.wk[w.toLowerCase()] || 0);
    st[p.id] = x;
    ag[p.id] = { id: o.agent && o.agent.id, name: o.agent && o.agent.name };
  });
  return { st, ag };
}

module.exports = async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const code = String(body.room || '').toLowerCase();
    const room = encodeURIComponent(code);
    const sim = !!body.sim, loose = !!body.loose, action = body.action, preview = action === 'preview';
    const rows = await sb(`rooms?code=eq.${room}&select=state`).then(r => r.json());
    if (!rows[0]) return res.json({ ok: false, msg: '找不到房間' });
    const S = rows[0].state;
    S.done = S.done || []; S.total = S.total || {};
    const save = () => sb('rooms', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ code, state: S }) });
    const preds = await sb(`preds?room=eq.${room}&select=player_id,answers,created_at`).then(r => r.json());
    const tbl = {}; preds.forEach(x => tbl[x.player_id] = x.answers);

    // 下好離手:把當下所有預測存成快照
    if (action === 'lock') {
      if (!preds.length) return res.json({ ok: false, msg: '還沒有人送出預測' });
      S.locked = true; S.lockedAt = Date.now(); S.snap = tbl; S.preview = null; await save();
      return res.json({ ok: true, msg: '已鎖定' });
    }
    if (action === 'unlock') { S.locked = false; S.lockedAt = 0; S.snap = null; S.preview = null; await save(); return res.json({ ok: true, msg: '已解除鎖定' }); }

    if (!preds.length) return res.json({ ok: false, msg: '還沒有人送出預測' });
    const locked = !!(S.locked && S.snap);
    if (!sim && !loose && !locked) return res.json({ ok: false, msg: '房主還沒按「下好離手」鎖定預測' });
    const pr = locked ? { ...S.snap } : tbl;
    const on = S.players.filter(p => p.on);
    const need = on.filter(p => pr[p.id]);
    if (!need.length) return res.json({ ok: false, msg: '送出預測的人都沒有勾選「我這場有下場」' });
    const NM = Math.min(10, Math.max(1, +S.nMatches || 5));
    const AGENTS = S.qs.some(q => q.on && q.t === 'pick') ? await getAgents() : {};
    const games = [], mids = []; let absent = [];

    if (sim) {
      const aIds = Object.keys(AGENTS);
      for (let g = 0; g < 3; g++) {
        const st = {}, ag = {};
        on.forEach(p => { st[p.id] = simOne(); if (aIds.length) { const id = aIds[rnd(0, aIds.length - 1)]; ag[p.id] = { id, name: AGENTS[id].name }; } });
        games.push({ st, ag });
      }
    } else {
      if (!HK) return res.json({ ok: false, msg: '伺服器沒有設定 HENRIK_KEY' });
      const since = locked ? S.lockedAt : Math.min(...preds.map(x => Date.parse(x.created_at)));
      const base = S.players.find(p => p.id === S.host && p.on) || need[0];   // 以房主的比賽為準
      const [n, t] = base.name.split('#');
      const r = await fetch(`https://api.henrikdev.xyz/valorant/v4/matches/${S.region || 'ap'}/pc/${encodeURIComponent(n.trim())}/${encodeURIComponent((t || '').trim())}?size=10`, { headers: { Authorization: HK } });
      if (!r.ok) return res.json({ ok: false, msg: r.status === 429 ? '請求太頻繁,稍後再試' : `HenrikDev 錯誤 ${r.status}(請確認 ${base.name} 與地區 ${S.region || 'ap'} 是否正確)` });
      const j = await r.json();
      const list = (j.data || []).filter(x => x.metadata && x.players).sort((a, b) => Date.parse(b.metadata.started_at) - Date.parse(a.metadata.started_at));
      if (!list.length) return res.json({ ok: false, msg: 'HenrikDev 查不到最近的比賽,請確認 Riot ID 與地區' });
      const nk = p => p.name.trim().toLowerCase();
      const inM = x => on.filter(p => !p.fake && x.players.some(o => key(o) === nk(p)));
      const elig = list.filter(x => !S.done.includes(x.metadata.match_id) && (loose || Date.parse(x.metadata.started_at) > since) && inM(x).length >= 2);
      if (!elig.length) {
        const x = list[0], mode = (x.metadata.queue && x.metadata.queue.name) || '未知模式';
        let why = '';
        if (S.done.includes(x.metadata.match_id)) why = '這場已經結算過了';
        else if (!loose && Date.parse(x.metadata.started_at) <= since) why = `這場早於鎖定預測的時間(${hm(since)})。要先預測並鎖定,再開打;若剛打完,可能是資料延遲,請過幾分鐘再試`;
        else if (inM(x).length < 2) why = `這場只有 ${inM(x).length} 位勾選下場的人在場上(請確認 Riot ID 拼法)`;
        return res.json({ ok: false, msg: `找到 ${list.length} 場最近比賽。最新一場(${hm(x.metadata.started_at)} 開打,${mode}):${why}` });
      }
      elig.slice(0, NM).reverse().forEach(m => {           // 由舊到新,第 1 場 = 最早的一場
        const { st, ag } = realStats(m, inM(m), nk);
        games.push({ st, ag }); mids.push(m.metadata.match_id);
      });
    }

    const present = new Set(); games.forEach(g => Object.keys(g.st).forEach(id => present.add(id)));
    const ps = on.filter(p => present.has(p.id));
    absent = on.filter(p => !p.fake && !present.has(p.id)).map(dn);
    const scopeOf = q => q.scope || (RATE.has(q.m) ? 'max' : 'sum');
    const aggv = (id, m, scope, d) => {
      const mt = /^g(\d+)$/.exec(scope);
      if (mt) { const g = games[+mt[1] - 1]; return g && g.st[id] ? (g.st[id][m] || 0) : null; }
      if (scope === 'wins') {   // 今晚有幾場拿到該項第一名(依最高/最低方向),並列都算
        let c = 0, played = false;
        games.forEach(g => {
          const ids = Object.keys(g.st); if (!g.st[id] || ids.length < 2) return;
          played = true;
          const vs = ids.map(i => g.st[i][m] || 0), best = d === 'min' ? Math.min(...vs) : Math.max(...vs);
          if (Math.abs((g.st[id][m] || 0) - best) < 1e-9) c++;
        });
        return played ? c : null;
      }
      const vals = games.filter(g => g.st[id]).map(g => g.st[id][m] || 0);
      if (scope === 'sum') return vals.reduce((a, b) => a + b, 0);
      if (!vals.length) return null;
      return scope === 'max' ? Math.max(...vals) : scope === 'min' ? Math.min(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    const tot = {};   // 結算頁數據表:次數類加總、比率類平均
    ps.forEach(p => { tot[p.id] = {}; const first = games.find(g => g.st[p.id]).st[p.id]; Object.keys(first).forEach(k => tot[p.id][k] = aggv(p.id, k, RATE.has(k) ? 'max' : 'sum')); });

    // 先刪除預測當作鎖,避免多人同時觸發而重複計分
    if (!preview) {
      const del = await sb(`preds?room=eq.${room}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } }).then(r => r.json());
      if (!del.length) return res.json({ ok: false, msg: '已被其他人結算' });
    }
    if (sim) {
      const aIds = Object.keys(AGENTS);
      S.players.filter(p => p.fake && p.on).forEach(p => {   // 假玩家:模擬時自動隨機猜題
        const a = {};
        S.qs.filter(q => q.on).forEach(q => {
          if (q.t === 'th') a[q.id] = Math.random() < 0.5 ? 'y' : 'n';
          else if (q.t === 'pick') { if (aIds.length) { const id = aIds[rnd(0, aIds.length - 1)]; a[q.id] = q.f === 'agent' ? id : AGENTS[id].role; } }
          else a[q.id] = ps[rnd(0, ps.length - 1)].id;
        });
        pr[p.id] = a;
      });
    }

    const tname = q => { const p = S.players.find(x => x.id === q.target); return p ? dn(p) : '?'; };
    const out = [], sc = {}; ps.forEach(p => sc[p.id] = 0);
    S.qs.filter(q => q.on).forEach(q => {
      const voidQ = why => out.push({ q, void: true, why: preview ? `還沒打到或資料不足(目前已打 ${games.length} 場)` : why });
      let win, val, th = false, names, sure = false;
      if (q.t === 'pick') {
        const gi = q.game || 1, g = games[gi - 1];
        if (!g || !g.st[q.target]) return voidQ(`${tname(q)} 沒有第 ${gi} 場的資料(只抓到 ${games.length} 場)`);
        const a = g.ag[q.target], info = a && a.id && AGENTS[a.id];
        if (!info) return voidQ('抓不到角色資料');
        sure = true;
        if (q.f === 'agent') { win = [a.id]; val = info.name; names = Object.fromEntries(Object.entries(AGENTS).map(([id, v]) => [id, v.name])); }
        else { win = [info.role]; val = `${info.name}(${info.roleName})`; names = Object.fromEntries(Object.values(AGENTS).map(v => [v.role, v.roleName])); }
      } else if (q.t === 'th') {
        const tg = q.target === 'any' ? ps : ps.filter(p => p.id === q.target);
        const vs = tg.map(p => aggv(p.id, q.m, scopeOf(q), 'max')).filter(v => v !== null);
        if (!vs.length) return voidQ('沒有可比對的資料');
        val = Math.max(...vs); win = [val > q.n ? 'y' : 'n']; th = true;
        const s0 = scopeOf(q);   // 已確定:單調增加的數值一旦超過就不會再變回去
        sure = /^g\d+$/.test(s0) || (['sum', 'max', 'wins'].includes(s0) ? val > q.n : s0 === 'min' ? !(val > q.n) : false);
      } else {
        const cand = ps.map(p => [p.id, aggv(p.id, q.m, scopeOf(q), q.d)]).filter(x => x[1] !== null);
        if (!cand.length) return voidQ('沒有可比對的資料');
        const vals = cand.map(x => x[1]), t = (q.d === 'min' && scopeOf(q) !== 'wins') ? Math.min(...vals) : Math.max(...vals);
        val = t; win = cand.filter(x => Math.abs(x[1] - t) < 1e-9).map(x => x[0]); sure = /^g\d+$/.test(scopeOf(q));
      }
      const picks = {};
      ps.forEach(p => {
        if ((q.t === 'th' || q.t === 'pick') && q.target === p.id) return;   // 題目問到的當事人不能答
        const a = (pr[p.id] || {})[q.id]; if (a) picks[p.id] = { a, ok: win.includes(a) };
      });
      const ids = Object.keys(picks), okIds = ids.filter(id => picks[id].ok);
      const solo = okIds.length === 1 && ids.length >= 2 ? okIds[0] : '';   // 獨具慧眼 ×1.5
      ids.forEach(id => {
        const x = picks[id], bet = (pr[id] || {})._bet === q.id;             // 惡魔契約:猜對 ×3、猜錯倒扣
        let pts = x.ok ? q.pts : 0;
        if (x.ok && id === solo) pts *= 1.5;
        if (bet) pts = x.ok ? pts * 3 : -q.pts;
        x.pts = pts; x.solo = id === solo; x.bet = bet;
        sc[id] += pts;
      });
      out.push({ q, win, hit: okIds, val, th, picks, names, sure });
    });
    const result = { st: tot, res: out, sc, ids: ps.map(p => p.id), at: Date.now(), absent, games: games.length };
    if (preview) { S.preview = result; await save(); return res.json({ ok: true, msg: `已更新:目前共 ${games.length} 場` }); }   // 只更新戰況,不計入總分、不清空預測
    ps.forEach(p => S.total[p.id] = (S.total[p.id] || 0) + sc[p.id]);
    S.last = result; S.preview = null;
    mids.forEach(id => S.done.push(id));
    S.locked = false; S.lockedAt = 0; S.snap = null;
    await save();
    res.json({ ok: true, msg: '已結算' });
  } catch (e) {
    res.json({ ok: false, msg: '伺服器錯誤:' + e.message });
  }
};
