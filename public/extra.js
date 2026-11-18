/* 擴充功能:今晚模式(多場結算)、全數據題目、門檻題、角色/職位題、暱稱、鎖定預測、假玩家、權限。放在 index.html 主 script 之後載入 */
(() => {
const WEAPONS = ['Vandal', 'Phantom', 'Operator', 'Sheriff', 'Ghost', 'Classic', 'Judge', 'Bulldog', 'Guardian', 'Marshal', 'Outlaw', 'Odin', 'Ares', 'Spectre', 'Stinger', 'Bucky', 'Frenzy', 'Shorty', 'Melee'];
const WL = { Vandal: 'Vandal 暴徒', Phantom: 'Phantom 幻象' };
Object.assign(M, {
  kills: '擊殺數', deaths: '死亡數', assists: '助攻數', kda: 'KDA', kdiff: '擊殺差(K−D)', fb: '首殺數', fd: '首死數',
  m2: '多殺回合數(2殺以上)', m3: '三殺以上回合數', ace: 'Ace 次數(5殺)',
  hs: '爆頭率', hsn: '爆頭數', bodyn: '身體命中數', legn: '腿部命中數', shots: '總命中數',
  dmg: '造成傷害', dmgr: '承受傷害', dd: 'DDΔ(每回合傷害差)', adr: 'ADR(每回合傷害)', score: '總分', acs: 'ACS',
  plants: '下包次數', defuses: '拆包次數'
});
WEAPONS.forEach(w => M['wk_' + w] = (WL[w] || w) + ' 擊殺數');
const GROUPS = [
  ['戰鬥', ['kills', 'deaths', 'assists', 'kda', 'kdiff', 'fb', 'fd', 'm2', 'm3', 'ace']],
  ['命中', ['hs', 'hsn', 'bodyn', 'legn', 'shots']],
  ['傷害與分數', ['dmg', 'dmgr', 'dd', 'adr', 'score', 'acs']],
  ['目標', ['plants', 'defuses']],
  ['武器擊殺', WEAPONS.map(w => 'wk_' + w)]
];
const RATE = new Set(['kda', 'hs', 'acs', 'adr', 'dd']);
const SCOPES = [['sum', '今晚加總'], ['max', '單場最高'], ['min', '單場最低'], ['wins', '拿第一名的場數'], ['avg', '平均每場(舊)'], ...Array.from({ length: 10 }, (_, i) => ['g' + (i + 1), `第 ${i + 1} 場`])];
const scopeOf = q => q.scope || (RATE.has(q.m) ? 'max' : 'sum');
const scopeTxt = q => { const s = scopeOf(q); return s === 'sum' ? '今晚總共' : s === 'max' ? '今晚單場最高' : s === 'min' ? '今晚單場最低' : s === 'wins' ? '今晚拿第一名的場數' : s === 'avg' ? '今晚平均每場' : `第 ${s.slice(1)} 場`; };

const sg = (v, d) => (v > 0 ? '+' : '') + v.toFixed(d);
const fmt2 = (m, v) => { v = +v || 0; return m === 'dd' ? sg(v, 1) : m === 'kdiff' ? sg(Math.round(v), 0) : m === 'kda' ? v.toFixed(2) : m === 'adr' ? v.toFixed(1) : m === 'hs' ? v.toFixed(0) + '%' : (Number.isInteger(v) ? String(v) : v.toFixed(1)); };
const label = p => p.nick || p.name.split('#')[0];
const dn = id => { const p = S.players.find(x => x.id === id); return p ? esc(label(p)) : '?'; };
const effHost = () => S.players.some(p => p.id === S.host) ? S.host : (S.players[0] || {}).id;
const isHost = () => !S.host || effHost() === me;
const canEdit = () => isHost() || !!((S.players.find(p => p.id === me) || {}).mgr);
const who = q => { if (q.target === 'any') return '任何一位玩家'; const p = S.players.find(x => x.id === q.target); return p ? esc(label(p)) : '(未選擇)'; };
const qText = q => q.t === 'th' ? (scopeOf(q) === 'wins' ? `${who(q)} 今晚拿下「${M[q.m]}最高」第一名的場數會超過 ${q.n} 嗎?` : `${who(q)} ${scopeTxt(q)}的${M[q.m]}會超過 ${q.n} 嗎?`)
  : q.t === 'pick' ? `${who(q)} 第 ${q.game || 1} 場會玩什麼${q.f === 'agent' ? '角色' : '職位'}?` : esc(q.text);
const isSelfQ = q => (q.t === 'th' || q.t === 'pick') && q.target === me;   // 題目問到自己 → 不能答
const post = b => fetch('/api/settle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, ...b }) }).then(r => r.json());
const seen = () => ls.get('vp_seen_' + room);
const pt = n => n > 0 ? '+' + n : String(n);

/* ---- 特務資料(大頭貼、角色、職位) ---- */
let AG = [], pick = {};
const roles = () => [...new Map(AG.filter(a => a.roleId).map(a => [a.roleId, a.roleName])).entries()];
const CUSTOM_ICONS = ['/nailong.png'];   // 題目卡片的自訂圖片(把圖檔放進 public/ 資料夾)。可放多張,例如 ['/nailong.png', '/nailong2.png'];設成 [] 就改回特務大頭貼
const agentImg = qid => {
  const base = CUSTOM_ICONS.length ? CUSTOM_ICONS : AG.map(a => a.icon);
  if (!base.length) return '';
  if (!pick[qid]) { const used = Object.values(pick), free = base.filter(x => !used.includes(x)), pool = free.length ? free : base; pick[qid] = pool[Math.floor(Math.random() * pool.length)]; }
  const fb = AG.length ? AG[Math.floor(Math.random() * AG.length)].icon : '';   // 自訂圖片載入失敗時,改用特務大頭貼
  return `<img src="${pick[qid]}" alt="" onerror="${fb ? `this.onerror=function(){this.style.display='none'};this.src='${fb}'` : `this.style.display='none'`}">`;
};

lb = function (map, ids) {
  return [...ids].sort((a, b) => (map[b] || 0) - (map[a] || 0)).map((id, i) => `<div class="lb"><span class="rank">${i + 1}</span><span class="n">${dn(id)}</span><span class="score">${map[id] || 0}</span></div>`).join('') || '<p class="mut">還沒有分數。</p>';
};

/* ---- 加入房間:Riot ID + 暱稱 ---- */
views.me = () => `<section><h2>建立你的身分</h2>
  <div class="row"><input type="text" id="rid" placeholder="你的 Riot ID (例: 小明#TW1)" aria-label="Riot ID"></div>
  <div class="row"><input type="text" id="rnick" maxlength="12" placeholder="暱稱(顯示在預測結果上)" aria-label="暱稱"><button class="b" data-a="join">鎖定身分</button></div>
  <p class="mut">Riot ID 要跟遊戲裡完全一致,系統用它抓你的戰績;暱稱只用來顯示。</p><p style="color:var(--acc)">${esc(note)}</p></section>`;
joinRoom = async function (name) {
  name = name.trim();
  const nick = ((document.getElementById('rnick') || {}).value || '').trim().slice(0, 12);
  if (!name.includes('#') || name.length < 3) { note = '請輸入完整的 Riot ID,格式是 名稱#Tag。'; render(); return; }
  if (!nick) { note = '請輸入暱稱。'; render(); return; }
  const id = 'u' + Math.random().toString(36).slice(2, 9);
  try {
    for (let i = 0; i < 4; i++) {
      await pull(true);
      if (S.players.some(p => p.id === id)) break;
      const ex = S.players.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
      if (ex) { if (!ex.nick) { ex.nick = nick; await push(); } me = ex.id; ls.set('vp_me_' + room, me); note = ''; tab = 'pred'; render(); return; }
      if (S.players.length >= 10) { note = '房間已滿。'; render(); return; }
      S.players.push({ id, name, nick, on: true }); if (!S.host) S.host = id;
      await push();
    }
    await pull(true); me = id; ls.set('vp_me_' + room, me); note = ''; tab = 'pred';
  } catch (e) { note = '加入失敗:' + e.message; }
  render();
};

/* ---- 結算卡片 ---- */
const BASE = [['kills', 'K'], ['deaths', 'D'], ['assists', 'A'], ['kda', 'KDA'], ['kdiff', 'K−D'], ['dd', 'DDΔ'], ['adr', 'ADR'], ['hs', '爆頭率'], ['acs', 'ACS'], ['fb', '首殺']];
const sv = (s, k) => k === 'assists' ? (s.assists ?? s.a ?? 0) : (s[k] ?? 0);
const statTable = L => {
  const cols = [...BASE]; L.res.forEach(r => { if (!r.void && r.q.m && !cols.some(c => c[0] === r.q.m)) cols.push([r.q.m, M[r.q.m] || r.q.m]); });
  return `<div class="wrap"><table><tr><th>玩家</th>${cols.map(c => `<th>${esc(c[1])}</th>`).join('')}</tr>
  ${L.ids.map(id => `<tr><td><b>${dn(id)}</b></td>${cols.map(c => `<td>${fmt2(c[0], sv(L.st[id], c[0]))}</td>`).join('')}</tr>`).join('')}</table></div>
  <p class="mut" style="margin-top:8px;">共 ${L.games || 1} 場。次數類為加總,KDA、爆頭率、ACS、ADR、DDΔ 為單場最高。</p>`;
};
const resCard = (r, prov) => {
  const q = r.q, my = (r.picks || {})[me], pk = q.t === 'pick', th = !!r.th;
  const badge = prov && !r.void ? `<div style="margin:-6px 0 8px;font-size:12px;" class="mut">${r.sure ? '✅ 已確定' : '⏳ 暫定'}</div>` : '';
  const head = `<div class="pick-img">${agentImg(q.id)}</div><div class="pick-header"><div class="pick-title">${qText(q)}</div><div class="pick-pts">${q.pts} PTS</div></div>${badge}`;
  if (r.void) return `<div class="pick-card">${head}<p class="mut">${prov ? '' : '本題作廢:'}${esc(r.why || '')}</p></div>`;
  const now = prov ? '目前' : '實際';
  const line = th ? `${now} <b style="color:var(--acc)">${fmt2(q.m, r.val)}</b>,${prov && !r.sure ? '暫時' : ''}${r.win[0] === 'y' ? '超過' : '沒超過'} ${q.n}`
    : pk ? `${now} <b style="color:var(--acc)">${esc(r.val)}</b>`
    : `${prov ? '目前領先' : '答案'} <b style="color:var(--acc)">${r.win.map(dn).join('、')}</b>(${M[q.m]} ${fmt2(q.m, r.val)})`;
  const ans = x => th ? (x.a === 'y' ? '會超過' : '不會') : pk ? esc((r.names || {})[x.a] || '?') : dn(x.a);
  const rows = Object.entries(r.picks || {}).map(([id, x]) => `<div class="row" style="margin:0 0 4px;font-size:14px;"><span style="flex:1">${dn(id)} 選 ${ans(x)} ${x.solo ? '👁' : ''}${x.bet ? '😈' : ''}</span><span class="${x.ok ? 'hit' : 'mut'}">${x.ok ? '✓ ' : '✗ '}${pt(x.pts)}</span></div>`).join('') || '<p class="mut">沒有人回答這題。</p>';
  return `<div class="pick-card" style="border-color:${my ? (my.pts > 0 ? 'var(--ok)' : 'var(--acc)') : 'var(--line)'}">${head}<p style="margin:0 0 10px;font-size:14px;">${line}</p>${rows}</div>`;
};
const rules = `<p class="mut" style="margin:8px 0 0;">👁 獨具慧眼:只有一人猜對,該題 ×1.5　😈 惡魔契約:每場一張,猜對 ×3、猜錯倒扣該題分數　🚫 題目問到你本人時,你不能作答</p>`;

/* ---- 預測頁 ---- */
views.pred = () => {
  const L = S.last;
  if (L && String(L.at) !== seen()) return `<section style="background:transparent;border:0;padding:0;box-shadow:none;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><h2 style="margin:0;">今晚結算(${L.games || 1} 場)</h2><button class="b" data-a="next">預測下一輪</button></div>
    ${rules}${L.absent && L.absent.length ? `<p class="mut" style="margin:4px 0 0;">⚠️ 不在房主對戰中:${L.absent.map(esc).join('、')}(他們的預測不計分)</p>` : ''}
    <div class="pick-grid">${L.res.map(r => resCard(r)).join('')}</div></section>
    <section><h2>今晚得分</h2>${lb(L.sc, L.ids)}</section><section><h2>今晚數據</h2>${statTable(L)}</section>`;
  const ps = act(), qs = S.qs.filter(q => q.on), lk = !!S.locked, host = isHost(), P = lk ? S.preview : null;
  if (ps.length < 2 || !qs.length) return `<section><h2>等待設定中</h2><p class="mut">請房主至「房間大廳」勾選至少 2 位玩家(可新增假玩家測試),並在「題目管理」啟用題目。</p></section>`;
  if (!ps.some(p => p.id === me)) return `<section><h2>你這輪未參戰</h2><p class="mut">請至「房間大廳」勾選「我這場有打」才能參與預測。</p></section>`;
  const mine = preds[me] || {};
  const controls = `<section style="margin-top:24px;"><div class="row">
    ${host ? (lk ? `<button class="g" data-a="unlock">解除鎖定</button>` : `<button class="b" data-a="lock">🔒 下好離手(鎖定所有人預測)</button>`) : ''}
    ${lk ? `<button class="b" data-a="preview">🔄 更新戰況</button><button class="b" data-a="final">🏁 結算今晚戰績</button><label class="chip ${autoOn ? 'on' : ''}"><input type="checkbox" data-auto="1" ${autoOn ? 'checked' : ''}>每分鐘自動更新戰況</label>` : ''}
    <button class="g" data-a="simpreview">模擬更新戰況</button><button class="g" data-a="sim">模擬結算</button><button class="g" data-a="loose">測試:不限開打時間</button></div>
    <div class="row"><span class="mut">結算時往前抓最近</span>${host ? `<input type="number" min="1" max="10" value="${S.nMatches || 5}" data-nm="1" aria-label="抓幾場" style="width:70px">` : `<b>${S.nMatches || 5}</b>`}<span class="mut">場(上限 10;第 1 場 = 抓到的最早一場,請填實際打的場數)</span></div>
    <p class="mut" id="msg">${lk ? '已鎖定。每打完一場就按「更新戰況」看進度,預測不用重填;全部打完再按「結算今晚戰績」。' : host ? '大家預測完後按「下好離手」鎖定,然後盡情打。' : '等房主按「下好離手」鎖定後再開打。'}</p></section>`;
  if (P) return `<section style="background:transparent;border:0;padding:0;box-shadow:none;">
    <h2 style="margin:0;">目前戰況(已打 ${P.games} 場・暫定)</h2>
    <p class="mut" style="margin:8px 0 0;">⏳ 暫定:之後還可能改變　✅ 已確定:不會再變(例如已經有人單場破門檻)。按「結算今晚戰績」後才會計入總積分。</p>${rules}
    ${P.absent && P.absent.length ? `<p class="mut" style="margin:4px 0 0;">⚠️ 不在房主對戰中:${P.absent.map(esc).join('、')}(他們的預測不計分)</p>` : ''}
    <div class="pick-grid">${P.res.map(r => resCard(r, true)).join('')}</div></section>
    <section><h2>目前得分(暫定)</h2>${lb(P.sc, P.ids)}</section><section><h2>目前數據</h2>${statTable(P)}</section>${controls}`;
  return `<section style="background:transparent;border:0;padding:0;box-shadow:none;">
    <div style="display:flex;justify-content:space-between;align-items:center;"><h2 style="margin:0;">大家快來預測</h2>
    <span class="mut">已提交: ${ps.filter(p => preds[p.id]).map(p => dn(p.id)).join('、') || '無'}</span></div>${rules}
    ${lk ? `<p style="color:var(--acc);font-weight:700;margin:8px 0 0;">🔒 下好離手!預測已鎖定。打完一場後按「更新戰況」。</p>` : ''}
    <div class="pick-grid">${qs.map(q => {
      const blocked = isSelfQ(q), bet = mine._bet === q.id;
      let opts;
      if (q.t === 'th') opts = `<option value="y" ${mine[q.id] === 'y' ? 'selected' : ''}>會超過 ${q.n}</option><option value="n" ${mine[q.id] === 'n' ? 'selected' : ''}>不會(${q.n} 以下)</option>`;
      else if (q.t === 'pick') opts = (q.f === 'agent' ? AG.map(a => [a.id, a.name]) : roles()).map(([id, n]) => `<option value="${id}" ${mine[q.id] === id ? 'selected' : ''}>${esc(n)}</option>`).join('');
      else opts = ps.map(o => `<option value="${o.id}" ${mine[q.id] === o.id ? 'selected' : ''}>${esc(label(o))}</option>`).join('');
      const meta = (!q.t || q.t === 'rank') ? `<p class="mut" style="margin:-4px 0 8px;">${scopeOf(q) === 'wins' ? `今晚誰拿下最多場「${M[q.m]}${q.d === 'min' ? '最低' : '最高'}」第一名` : `${scopeTxt(q)}・${M[q.m]}${q.d === 'min' ? '最低' : '最高'}`}</p>` : '';
      return `<div class="pick-card ${mine[q.id] && !blocked ? 'answered' : ''}"><div class="pick-img">${agentImg(q.id)}</div>
        <div class="pick-header"><div class="pick-title">${qText(q)}</div><div class="pick-pts">${q.pts} PTS</div></div>${meta}
        ${blocked ? `<p class="mut" style="margin:0;">🚫 這題是問你的,你不能作答</p>`
        : `<select class="pick-select" data-q="${q.id}" ${lk ? 'disabled' : ''}><option value="" disabled ${!mine[q.id] ? 'selected' : ''}>▼ 點擊鎖定答案...</option>${opts}</select>
        <button class="g" data-bet="${q.id}" ${mine[q.id] && !lk ? '' : 'disabled'} style="margin-top:10px;width:100%;${bet ? 'border-color:var(--acc);color:var(--acc);font-weight:700;' : ''}">😈 ${bet ? '惡魔契約已簽' : '簽惡魔契約'}</button>`}</div>`;
    }).join('')}</div></section>${controls}`;
};

/* ---- 題目管理 ---- */
views.qs = () => {
  if (!canEdit()) return `<section><h2>題目清單</h2>${S.qs.filter(q => q.on).map(q => `<div class="admin-q"><b>${qText(q)}</b> <span class="mut">(${q.pts} 分)</span></div>`).join('')}<p class="mut">⚠️ 只有房主 (${dn(effHost())}) 或被房主授權的人可以編輯題目。</p></section>`;
  const mOpts = q => GROUPS.map(([g, ks]) => `<optgroup label="${g}">${ks.map(k => `<option value="${k}" ${q.m === k ? 'selected' : ''}>${M[k]}</option>`).join('')}</optgroup>`).join('');
  const sOpts = q => SCOPES.filter(([k]) => k !== 'avg' || scopeOf(q) === 'avg').map(([k, v]) => `<option value="${k}" ${scopeOf(q) === k ? 'selected' : ''}>${v}</option>`).join('');
  const pOpts = (q, any) => `<option value="">選擇玩家…</option>${any ? `<option value="any" ${q.target === 'any' ? 'selected' : ''}>任何一位玩家</option>` : ''}${S.players.map(p => `<option value="${p.id}" ${q.target === p.id ? 'selected' : ''}>${esc(label(p))}</option>`).join('')}`;
  return `<section><h2>管理預測題目</h2>
  <p class="mut" style="margin-bottom:16px;">排名題:誰的數值最高或最低。門檻題:某人(或任何一位玩家)的數值有沒有超過 N,例如「任何一位玩家今晚總共的 Ace 次數超過 0」。角色題:某人第 N 場會玩什麼職位或角色。範圍可選:今晚加總、單場最高、單場最低、拿第一名的場數(例如「誰今晚拿最多場 ACS 第一」),或指定第幾場。門檻題與角色題指定的玩家本人不能回答。</p>
  ${S.qs.map((q, i) => `<div class="admin-q">
    <div class="row"><label class="chip ${q.on ? 'on' : ''}"><input type="checkbox" data-qon="${i}" ${q.on ? 'checked' : ''}>啟用</label>
    <select class="std" data-qt="${i}"><option value="rank" ${!q.t || q.t === 'rank' ? 'selected' : ''}>排名題</option><option value="th" ${q.t === 'th' ? 'selected' : ''}>門檻題</option><option value="pick" ${q.t === 'pick' ? 'selected' : ''}>角色題</option></select></div>
    ${q.t === 'th'
      ? `<div class="row"><select class="std" data-qtarget="${i}">${pOpts(q, true)}</select><select class="std" data-qscope="${i}">${sOpts(q)}</select><select class="std" data-qm="${i}">${mOpts(q)}</select><span class="mut">超過</span><input type="number" step="any" value="${q.n}" data-qn="${i}" aria-label="門檻"></div>`
      : q.t === 'pick'
      ? `<div class="row"><select class="std" data-qtarget="${i}">${pOpts(q, false)}</select><span class="mut">第</span><select class="std" data-qgame="${i}">${Array.from({ length: 10 }, (_, k) => `<option value="${k + 1}" ${(q.game || 1) === k + 1 ? 'selected' : ''}>${k + 1}</option>`).join('')}</select><span class="mut">場玩什麼</span><select class="std" data-qf="${i}"><option value="role" ${q.f !== 'agent' ? 'selected' : ''}>職位</option><option value="agent" ${q.f === 'agent' ? 'selected' : ''}>角色</option></select></div>`
      : `<div class="row"><input type="text" value="${esc(q.text)}" data-qtext="${i}" aria-label="題目文字" style="font-weight:bold;"></div>
         <div class="row"><select class="std" data-qscope="${i}">${sOpts(q)}</select><select class="std" data-qm="${i}">${mOpts(q)}</select>
         <select class="std" data-qd="${i}"><option value="max" ${q.d !== 'min' ? 'selected' : ''}>最高</option><option value="min" ${q.d === 'min' ? 'selected' : ''}>最低</option></select></div>`}
    <div class="row"><span class="mut">得分</span><input type="number" min="1" max="100" value="${q.pts}" data-qp="${i}"><div style="flex:1"></div>
    <button class="g" data-del="${i}" style="color:var(--acc);border-color:transparent;">刪除題目</button></div></div>`).join('')}
  <div class="row"><div class="admin-add" data-a="addq" style="flex:1">+ 排名題</div><div class="admin-add" data-a="addth" style="flex:1">+ 門檻題</div><div class="admin-add" data-a="addpick" style="flex:1">+ 角色題</div></div></section>`;
};

/* ---- 房間大廳 ---- */
views.setup = () => {
  const host = isHost(), eh = effHost();
  const row = (p, i) => p.id === me
    ? `<div class="row" style="background:var(--bg);padding:8px;border-radius:4px;"><input type="text" value="${esc(p.name)}" data-name="${i}" aria-label="Riot ID"><input type="text" value="${esc(p.nick || '')}" maxlength="12" placeholder="暱稱" data-nick="${i}" aria-label="暱稱" style="max-width:120px"><label class="chip ${p.on ? 'on' : ''}"><input type="checkbox" data-on="${i}" ${p.on ? 'checked' : ''}>我這場有打</label>${p.id === eh ? '<span title="房主">👑</span>' : ''}${p.mgr ? '<span title="題目管理權限">✏️</span>' : ''}</div>`
    : `<div class="row" style="padding:8px;"><span style="flex:1;"><b>${p.id === eh ? '👑 ' : ''}${p.fake ? '🤖 ' : ''}${p.mgr ? '✏️ ' : ''}${esc(label(p))}</b> <span class="mut">${esc(p.name)}</span></span>
       ${host && p.fake ? `<label class="chip ${p.on ? 'on' : ''}"><input type="checkbox" data-on="${i}" ${p.on ? 'checked' : ''}>參戰</label>` : `<span class="mut">${p.on ? '🟢 參戰中' : '⚪ 休息'}</span>`}
       ${host && !p.fake ? `<button class="g" data-mgr="${i}">${p.mgr ? '收回題目權限' : '給予題目權限'}</button><button class="g" data-hostto="${i}">設為房主</button>` : ''}${host ? `<button class="g" data-rm="${i}">踢除</button>` : ''}</div>`;
  return `<section><h2>大廳資訊 (${esc(room)})</h2><div class="row"><input type="text" value="${esc(location.origin)}/?room=${esc(room)}" readonly onclick="this.select()" style="color:var(--mut)"><button class="g" data-a="leave">切換房間</button><button class="g" data-a="quit">退出房間</button></div></section>
  <section><h2>參戰名單</h2>${S.players.map(row).join('') || '<p class="mut">尚無玩家。</p>'}
  ${host ? `<div class="row" style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px;"><span class="mut">伺服器:</span><select class="std" data-region="1">${['ap', 'na', 'eu', 'kr', 'br', 'latam'].map(r => `<option ${S.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select><div style="flex:1"></div><button class="g" data-a="addfake">+ 新增假玩家(測試用)</button></div>
  <p class="mut">假玩家只能搭配「模擬測試」:結算時會自動幫他們隨機猜題、產生數據。</p>` : ''}</section>
  <section><h2>房間總積分</h2>${lb(S.total, S.players.map(p => p.id))}${host ? `<div class="row" style="margin-top:16px;"><button class="g" data-a="resetscore">重置所有分數</button><button class="g" data-a="clearplayers">⚠️ 清空所有玩家</button></div>
  <p class="mut">重置分數:只清空積分與上一輪結果,玩家和題目保留。清空玩家:移除房主以外的所有人(含假玩家),題目保留。</p>` : ''}</section>`;
};

delete tabs.result;

const doPreview = async (sim, loose) => {
  msg('查詢中⋯');
  try { const j = await post({ action: 'preview', sim, loose }); if (j.ok) { await pull(true); render(); msg(j.msg); } else msg(j.msg); } catch (e) { msg('失敗:' + e.message); }
};
const doFinal = async (sim, loose) => {
  msg('查詢中⋯');
  try { const j = await post({ sim, loose }); if (j.ok) { await pull(true); tab = 'pred'; render(); } else msg(j.msg); } catch (e) { msg('失敗:' + e.message); }
};
// 主程式的自動計時器會呼叫 check(false):鎖定中只更新戰況,不會自動結算
check = async function (sim, loose) { if (sim || loose) return doFinal(sim, loose); if (S && S.locked) return doPreview(false, false); };

/* ---- 事件 ---- */
const newQ = t => ({ id: 'q' + Date.now(), pts: 10, on: true, ...t });
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-a]');
  if (a) {
    const k = a.dataset.a, first = (S.players[0] || {}).id || '';
    if (k === 'addth') { S.qs.push(newQ({ t: 'th', target: first, m: 'kills', n: 15 })); push(); render(); }
    else if (k === 'addpick') { S.qs.push(newQ({ t: 'pick', target: first, f: 'role', game: 1 })); push(); render(); }
    else if (k === 'addfake') {
      if (S.players.length >= 10) return;
      let n = S.players.filter(p => p.fake).length + 1, name;
      do { name = `假玩家${n++}#TEST`; } while (S.players.some(p => p.name === name));
      S.players.push({ id: 'f' + Math.random().toString(36).slice(2, 8), name, on: true, fake: true }); push(); render();
    }
    else if (k === 'loose') doPreview(false, true);
    else if (k === 'preview') doPreview(false, false);
    else if (k === 'simpreview') doPreview(true, false);
    else if (k === 'final') { if (confirm('確定結算今晚戰績?結算後會計入總積分並清空預測,進入下一輪。')) doFinal(false, false); }
    else if (k === 'resetscore') {
      if (!isHost() || !confirm('確定重置所有分數?玩家和題目會保留。')) return;
      S.total = {}; S.last = null; push(); render();
    }
    else if (k === 'clearplayers') {
      if (!isHost() || !confirm('確定清空所有玩家?房主以外的人都會被移除,他們需要重新加入。題目會保留。')) return;
      const keep = S.players.find(p => p.id === me);
      S.players = keep ? [keep] : []; S.total = {}; S.last = null; S.locked = false; S.lockedAt = 0; S.snap = null;
      await push(); await rest(`preds?room=eq.${room}`, { method: 'DELETE' }); preds = {}; render();
    }
    else if (k === 'lock') {
      const no = act().filter(p => !p.fake && !preds[p.id]).map(label);
      if (!Object.keys(preds).length) { msg('還沒有人送出預測。'); return; }
      if (no.length && !confirm(`還有 ${no.join('、')} 沒預測,鎖定後他們這輪就不能預測了。確定鎖定?`)) return;
      msg('鎖定中⋯');
      try { const j = await post({ action: 'lock' }); if (j.ok) { await pull(true); render(); } else msg(j.msg); } catch (er) { msg('失敗:' + er.message); }
    }
    else if (k === 'unlock') { try { await post({ action: 'unlock' }); await pull(true); render(); } catch (er) { msg('失敗:' + er.message); } }
    else if (k === 'next' && S.last) { ls.set('vp_seen_' + room, String(S.last.at)); pick = {}; render(); }
    return;
  }
  const g = e.target.closest('[data-mgr]');
  if (g) { if (!isHost()) return; const p = S.players[+g.dataset.mgr]; if (!p) return; p.mgr = !p.mgr; push(); render(); return; }
  const h = e.target.closest('[data-hostto]');
  if (h) {
    const p = S.players[+h.dataset.hostto];
    if (!p || !confirm(`確定把房主轉交給 ${label(p)}?你會失去房主權限。`)) return;
    S.host = p.id; push(); render(); return;
  }
  const b = e.target.closest('[data-bet]'); if (!b || b.disabled || S.locked) return;
  const m = { ...(preds[me] || {}) }; m._bet = m._bet === b.dataset.bet ? '' : b.dataset.bet;
  preds[me] = m; up('preds', { room, player_id: me, answers: m }); render();
});
document.addEventListener('change', e => {
  const d = e.target.dataset, v = e.target.value;
  if (d.qt !== undefined) {
    const q = S.qs[d.qt], first = (S.players[0] || {}).id || ''; q.t = v;
    if (v === 'th') { q.target = q.target || first; q.n = q.n ?? 15; q.m = q.m || 'kills'; }
    else if (v === 'pick') { q.target = (q.target && q.target !== 'any') ? q.target : first; q.f = q.f || 'role'; q.game = q.game || 1; }
    else q.text = q.text || '今晚誰的 KDA 最高?';
  }
  else if (d.qtarget !== undefined) S.qs[d.qtarget].target = v;
  else if (d.qn !== undefined) S.qs[d.qn].n = +v || 0;
  else if (d.qscope !== undefined) S.qs[d.qscope].scope = v;
  else if (d.qf !== undefined) S.qs[d.qf].f = v;
  else if (d.qgame !== undefined) S.qs[d.qgame].game = +v || 1;
  else if (d.nm !== undefined) S.nMatches = Math.min(10, Math.max(1, Math.round(+v) || 1));
  else if (d.nick !== undefined) S.players[d.nick].nick = v.trim().slice(0, 12);
  else return;
  push(); render();
});

/* ---- 背景:特戰風(斜切色塊、細點陣、角落光暈),低對比不搶內容 ---- */
const bgStyle = document.createElement('style');
bgStyle.textContent = `
body{background:
  radial-gradient(900px 520px at 0% 0%,rgba(255,70,85,.16),transparent 62%),
  radial-gradient(800px 480px at 100% 100%,rgba(70,160,180,.10),transparent 60%),
  linear-gradient(180deg,#0f1923 0%,#0b131b 100%);background-attachment:fixed;}
body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
   linear-gradient(115deg,transparent 0 60%,rgba(255,70,85,.06) 60% 74%,transparent 74%),
   linear-gradient(115deg,transparent 0 74%,rgba(255,70,85,.30) 74% 74.25%,transparent 74.25%),
   linear-gradient(295deg,transparent 0 70%,rgba(236,232,225,.035) 70% 82%,transparent 82%),
   radial-gradient(rgba(236,232,225,.07) 1px,transparent 1.3px);
  background-size:auto,auto,auto,26px 26px;}
section{background:rgba(31,43,56,.92);}
.pick-card{background:rgba(15,25,35,.88);}
`;
document.head.appendChild(bgStyle);

const sub = document.querySelector('.sub');
if (sub) sub.textContent = sub.textContent.replace(/^\s*Pick.em Style\s*[-－—–]\s*/i, '');
fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=zh-TW').then(r => r.json())
  .then(j => { AG = (j.data || []).filter(a => a.displayIcon).map(a => ({ id: a.uuid, name: a.displayName, icon: a.displayIcon, roleId: a.role && a.role.uuid, roleName: a.role && a.role.displayName })); if (S && joined()) render(); }).catch(() => {});
})();
