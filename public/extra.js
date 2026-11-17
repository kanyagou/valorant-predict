/* 擴充:DDΔ、擊殺差、門檻題。放在 index.html 主 script 之後載入 */
(() => {
Object.assign(M, { dd: 'DDΔ(每回合傷害差)', kdiff: '擊殺差(K−D)' });
const sg = (v, d) => (v > 0 ? '+' : '') + v.toFixed(d);
const fmt2 = (m, v) => m === 'dd' ? sg(v, 1) : m === 'kdiff' ? sg(Math.round(v), 0) : fmt(m, v);
const pname = id => { const p = S.players.find(x => x.id === id); return p ? esc(p.name.split('#')[0]) : '(未選擇)'; };
const effHost = () => S.players.some(p => p.id === S.host) ? S.host : (S.players[0] || {}).id;
const isHost = () => !S.host || effHost() === me;
const qText = q => q.t === 'th' ? `${pname(q.target)} 的${M[q.m]}會超過 ${q.n} 嗎?` : esc(q.text);

const seen = () => ls.get('vp_seen_' + room);
const pt = n => n > 0 ? '+' + n : String(n);
const statTable = L => `<div class="wrap"><table><tr><th>玩家</th><th>K</th><th>D</th><th>A</th><th>KDA</th><th>K−D</th><th>DDΔ</th><th>爆頭率</th><th>ACS</th><th>首殺</th></tr>
  ${L.ids.map(id => { const s = L.st[id]; return `<tr><td><b>${nm(id)}</b></td><td>${s.k}</td><td>${s.d}</td><td>${s.a}</td><td>${s.kda.toFixed(2)}</td><td>${fmt2('kdiff', s.k - s.d)}</td><td>${fmt2('dd', s.dd || 0)}</td><td>${s.hs.toFixed(0)}%</td><td>${Math.round(s.acs)}</td><td>${s.fb}</td></tr>`; }).join('')}</table></div>`;
const resCard = r => {
  const my = (r.picks || {})[me], th = r.th;
  const line = th ? `實際 <b style="color:var(--acc)">${fmt2(r.q.m, r.val)}</b>,${r.win[0] === 'y' ? '超過' : '沒超過'} ${r.q.n}`
    : `答案 <b style="color:var(--acc)">${r.win.map(nm).join('、')}</b>(${M[r.q.m]} ${fmt2(r.q.m, r.val)})`;
  const rows = Object.entries(r.picks || {}).map(([id, x]) => `<div class="row" style="margin:0 0 4px;font-size:14px;"><span style="flex:1">${nm(id)} 選 ${th ? (x.a === 'y' ? '會超過' : '不會') : nm(x.a)} ${x.solo ? '👁' : ''}${x.bet ? '😈' : ''}</span><span class="${x.ok ? 'hit' : 'mut'}">${x.ok ? '✓ ' : '✗ '}${pt(x.pts)}</span></div>`).join('') || '<p class="mut">沒有人回答這題。</p>';
  return `<div class="pick-card" style="border-color:${my ? (my.pts > 0 ? 'var(--ok)' : 'var(--acc)') : 'var(--line)'}"><div class="pick-img"><img src="${qImg(r.q.m)}" alt="Agent"></div>
    <div class="pick-header"><div class="pick-title">${qText(r.q)}</div><div class="pick-pts">${r.q.pts} PTS</div></div>
    <p style="margin:0 0 10px;font-size:14px;">${line}</p>${rows}</div>`;
};
const rules = `<p class="mut" style="margin:8px 0 0;">👁 獨具慧眼:只有一人猜對,該題 ×1.5　😈 惡魔契約:每場一張,猜對 ×3、猜錯倒扣該題分數</p>`;

views.pred = () => {
  const L = S.last;
  if (L && String(L.at) !== seen()) return `<section style="background:transparent;border:0;padding:0;box-shadow:none;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><h2 style="margin:0;">本場結算</h2><button class="b" data-a="next">預測下一場</button></div>
    ${rules}${L.absent && L.absent.length ? `<p class="mut" style="margin:4px 0 0;">⚠️ 不在房主這場對戰中:${L.absent.map(esc).join('、')}(他們的預測不計分)</p>` : ''}<div class="pick-grid">${L.res.map(resCard).join('')}</div></section>
    <section><h2>本場得分</h2>${lb(L.sc, L.ids)}</section><section><h2>本場數據</h2>${statTable(L)}</section>`;
  const ps = act(), qs = S.qs.filter(q => q.on);
  if (ps.length < 2 || !qs.length) return `<section><h2>等待設定中</h2><p class="mut">請房主至「房間大廳」勾選至少 2 位玩家，並在「題目管理」啟用題目。</p></section>`;
  if (!ps.some(p => p.id === me)) return `<section><h2>你這場未參戰</h2><p class="mut">請至「房間大廳」勾選「我這場有下場」才能參與預測。</p></section>`;
  const mine = preds[me] || {};
  return `<section style="background:transparent;border:0;padding:0;box-shadow:none;">
    <div style="display:flex;justify-content:space-between;align-items:center;"><h2 style="margin:0;">水晶球預測</h2>
    <span class="mut">已提交: ${ps.filter(p => preds[p.id]).map(p => nm(p.id)).join('、') || '無'}</span></div>${rules}
    <div class="pick-grid">${qs.map(q => {
      const bet = mine._bet === q.id;
      const opts = q.t === 'th'
        ? `<option value="y" ${mine[q.id] === 'y' ? 'selected' : ''}>會超過 ${q.n}</option><option value="n" ${mine[q.id] === 'n' ? 'selected' : ''}>不會(${q.n} 以下)</option>`
        : ps.map(o => `<option value="${o.id}" ${mine[q.id] === o.id ? 'selected' : ''}>${esc(o.name.split('#')[0])}</option>`).join('');
      return `<div class="pick-card ${mine[q.id] ? 'answered' : ''}"><div class="pick-img"><img src="${qImg(q.m)}" alt="Agent"></div>
        <div class="pick-header"><div class="pick-title">${qText(q)}</div><div class="pick-pts">${q.pts} PTS</div></div>
        <select class="pick-select" data-q="${q.id}"><option value="" disabled ${!mine[q.id] ? 'selected' : ''}>▼ 點擊鎖定答案...</option>${opts}</select>
        <button class="g" data-bet="${q.id}" ${mine[q.id] ? '' : 'disabled'} style="margin-top:10px;width:100%;${bet ? 'border-color:var(--acc);color:var(--acc);font-weight:700;' : ''}">😈 ${bet ? '惡魔契約已簽' : '簽惡魔契約'}</button></div>`;
    }).join('')}</div></section>
   <section style="margin-top:24px;"><div class="row"><button class="b" data-a="check">結算最新比賽</button>
    <label class="chip ${autoOn ? 'on' : ''}"><input type="checkbox" data-auto="1" ${autoOn ? 'checked' : ''}>自動偵測</label>
    <button class="g" data-a="sim">模擬測試</button><button class="g" data-a="loose">測試:不限開打時間</button></div>
    <p class="mut" id="msg">送出預測後，系統只會結算在那之後開打的比賽。</p></section>`;
};

views.setup = () => {
  const host = isHost(), eh = effHost();
  const row = (p, i) => p.id === me
    ? `<div class="row" style="background:var(--bg);padding:8px;border-radius:4px;"><input type="text" value="${esc(p.name)}" data-name="${i}"><label class="chip ${p.on ? 'on' : ''}"><input type="checkbox" data-on="${i}" ${p.on ? 'checked' : ''}>我這場有打</label>${p.id === eh ? '<span title="房主">👑</span>' : ''}</div>`
    : `<div class="row" style="padding:8px;"><span style="flex:1;font-weight:bold;">${p.id === eh ? '👑 ' : ''}${p.fake ? '🤖 ' : ''}${esc(p.name)}</span>
       ${host && p.fake ? `<label class="chip ${p.on ? 'on' : ''}"><input type="checkbox" data-on="${i}" ${p.on ? 'checked' : ''}>參戰</label>` : `<span class="mut">${p.on ? '🟢 參戰中' : '⚪ 休息'}</span>`}
       ${host && !p.fake ? `<button class="g" data-hostto="${i}">設為房主</button>` : ''}${host ? `<button class="g" data-rm="${i}">踢除</button>` : ''}</div>`;
  return `<section><h2>大廳資訊 (${esc(room)})</h2><div class="row"><input type="text" value="${esc(location.origin)}/?room=${esc(room)}" readonly onclick="this.select()" style="color:var(--mut)"><button class="g" data-a="leave">切換房間</button><button class="g" data-a="quit">退出房間</button></div></section>
  <section><h2>參戰名單</h2>${S.players.map(row).join('') || '<p class="mut">尚無玩家。</p>'}
  ${host ? `<div class="row" style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px;"><span class="mut">伺服器:</span><select class="std" data-region="1">${['ap', 'na', 'eu', 'kr', 'br', 'latam'].map(r => `<option ${S.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select><div style="flex:1"></div><button class="g" data-a="addfake">+ 新增假玩家(測試用)</button></div>
  <p class="mut">假玩家只能搭配「模擬測試」:結算時會自動幫他們隨機猜題、產生數據。</p>` : ''}</section>
  <section><h2>房間總積分</h2>${lb(S.total, S.players.map(p => p.id))}${host ? `<div style="margin-top:16px;"><button class="g" data-a="reset">⚠️ 重置所有分數</button></div>` : ''}</section>`;
};

views.qs = () => {
  if (!isHost()) return `<section><h2>題目清單</h2>${S.qs.filter(q => q.on).map(q => `<div class="admin-q"><b>${qText(q)}</b> <span class="mut">(${q.pts} 分)</span></div>`).join('')}<p class="mut">⚠️ 只有房主 (${nm(effHost())}) 可以編輯題目。</p></section>`;
  const mOpts = q => Object.entries(M).map(([k, v]) => `<option value="${k}" ${q.m === k ? 'selected' : ''}>${v}</option>`).join('');
  return `<section><h2>管理預測題目</h2><p class="mut" style="margin-bottom:16px;">排名題:誰的數值最高或最低。門檻題:某人的數值有沒有超過 N。</p>
  ${S.qs.map((q, i) => `<div class="admin-q">
    <div class="row"><label class="chip ${q.on ? 'on' : ''}"><input type="checkbox" data-qon="${i}" ${q.on ? 'checked' : ''}>啟用</label>
    <select class="std" data-qt="${i}"><option value="rank" ${q.t !== 'th' ? 'selected' : ''}>排名題</option><option value="th" ${q.t === 'th' ? 'selected' : ''}>門檻題</option></select></div>
    ${q.t === 'th'
      ? `<div class="row"><select class="std" data-qtarget="${i}"><option value="">選擇玩家…</option>${S.players.map(p => `<option value="${p.id}" ${q.target === p.id ? 'selected' : ''}>${esc(p.name.split('#')[0])}</option>`).join('')}</select>
         <span class="mut">的</span><select class="std" data-qm="${i}">${mOpts(q)}</select><span class="mut">超過</span><input type="number" step="any" value="${q.n}" data-qn="${i}" aria-label="門檻"></div>`
      : `<div class="row"><input type="text" value="${esc(q.text)}" data-qtext="${i}" aria-label="題目文字" style="font-weight:bold;"></div>
         <div class="row"><span class="mut">比對欄位</span><select class="std" data-qm="${i}">${mOpts(q)}</select>
         <select class="std" data-qd="${i}"><option value="max" ${q.d === 'max' ? 'selected' : ''}>最高</option><option value="min" ${q.d === 'min' ? 'selected' : ''}>最低</option></select></div>`}
    <div class="row"><span class="mut">得分</span><input type="number" min="1" max="100" value="${q.pts}" data-qp="${i}"><div style="flex:1"></div>
    <button class="g" data-del="${i}" style="color:var(--acc);border-color:transparent;">刪除題目</button></div></div>`).join('')}
  <div class="row"><div class="admin-add" data-a="addq" style="flex:1">+ 排名題</div><div class="admin-add" data-a="addth" style="flex:1">+ 門檻題</div></div></section>`;
};

delete tabs.result;

check = async function (sim, loose) {
  msg('查詢中⋯');
  try {
    const j = await fetch('/api/settle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, sim, loose }) }).then(r => r.json());
    if (j.ok) { await pull(true); tab = 'pred'; render(); } else msg(j.msg);
  } catch (e) { msg('失敗:' + e.message); }
};

document.addEventListener('click', e => {
  const a = e.target.closest('[data-a]'); if (!a) return;
  if (a.dataset.a === 'addth') { S.qs.push({ id: 'q' + Date.now(), t: 'th', target: (S.players[0] || {}).id || '', m: 'kills', n: 15, pts: 10, on: true }); push(); render(); }
  else if (a.dataset.a === 'addfake') {
    if (S.players.length >= 10) return;
    let n = S.players.filter(p => p.fake).length + 1, name;
    do { name = `假玩家${n++}#TEST`; } while (S.players.some(p => p.name === name));
    S.players.push({ id: 'f' + Math.random().toString(36).slice(2, 8), name, on: true, fake: true }); push(); render();
  }
  else if (a.dataset.a === 'loose') check(false, true);
});
document.addEventListener('change', e => {
  const d = e.target.dataset, v = e.target.value;
  if (d.qt !== undefined) { const q = S.qs[d.qt]; q.t = v; if (v === 'th') { q.target = q.target || (S.players[0] || {}).id || ''; q.n = q.n || 15; q.m = q.m || 'kills'; } }
  else if (d.qtarget !== undefined) S.qs[d.qtarget].target = v;
  else if (d.qn !== undefined) S.qs[d.qn].n = +v || 0;
  else return;
  push(); render();
});
document.addEventListener('click', e => {
  const a = e.target.closest('[data-a="next"]');
  if (a && S.last) { ls.set('vp_seen_' + room, String(S.last.at)); render(); return; }
  const b = e.target.closest('[data-bet]'); if (!b || b.disabled) return;
  const m = { ...(preds[me] || {}) }; m._bet = m._bet === b.dataset.bet ? '' : b.dataset.bet;
  preds[me] = m; up('preds', { room, player_id: me, answers: m }); render();
});
document.addEventListener('click', e => {
  const h = e.target.closest('[data-hostto]'); if (!h) return;
  const p = S.players[+h.dataset.hostto]; if (!p || !confirm(`確定把房主轉交給 ${p.name.split('#')[0]}?你會失去房主權限。`)) return;
  S.host = p.id; push(); render();
});
})();
