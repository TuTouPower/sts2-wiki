'use strict';
/* 《杀戮尖塔2》图鉴前端：数据来自同目录 data.js（window.STS2_DATA，由 scraper/scrape.py 生成） */

const DATA = window.STS2_DATA || { cards: [], relics: [], enemies: [], characters: [] };

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- 主题（深/亮） ---------- */
const themeBtn = $('#themeToggle');
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
}
(function initTheme() {
  const saved = localStorage.getItem('sts2-theme');
  const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(saved || sys);
})();
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('sts2-theme', next);
  applyTheme(next);
});

/* ---------- 状态 ---------- */
const state = {
  tab: 'cards',
  query: '',
  filters: { cards: {}, relics: {}, enemies: {} },
  sort: { cards: 'winRate', relics: 'name', enemies: 'hardest' },
};

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const pct = (v) => (num(v) == null ? '—' : `${Number(v).toFixed(2).replace(/\.?0+$/, '')}%`);

/* 卡牌统计字段：列表接口是 avgXxx，详情接口是 xxx，合并后两者都可能存在 */
const cRate = (c, base) => num(c[base] ?? c['avg' + base[0].toUpperCase() + base.slice(1)]);

/* ---------- 筛选配置 ---------- */
const distinct = (arr, key) => [...new Set(arr.map((x) => x[key]).filter(Boolean))];
const RARITY_ORDER = ['普通', '罕见', '稀有', '特殊', '诅咒',
  '普通遗物', '罕见遗物', '稀有遗物', '商店遗物', '事件遗物', 'Boss遗物', '先古遗物'];

/* 卡牌「角色」筛选的头像（源站以中文名命名的图标，已下载到本地） */
const TYPE_ORDER = ['铁甲战士', '静默猎手', '储君', '亡灵契约师', '故障机器人', '无色牌', '先古之民', '其他'];
const TYPE_ICONS = {
  '铁甲战士': 'assets/img/character/IRONCLAD.png',
  '静默猎手': 'assets/img/character/SILENT.png',
  '储君': 'assets/img/character/REGENT.png',
  '亡灵契约师': 'assets/img/character/NECROBINDER.png',
  '故障机器人': 'assets/img/character/DEFECT.png',
  '无色牌': 'assets/img/character/COLORLESS.png',
  '先古之民': 'assets/img/character/ANCIENT.png',
  '其他': 'assets/img/character/OTHER.png',
};
const byTypeOrder = (a, b) => {
  const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
};
const byRarityOrder = (a, b) => {
  const ia = RARITY_ORDER.indexOf(a), ib = RARITY_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'zh');
};

const TAB_CONF = {
  cards: {
    items: () => DATA.cards,
    filters: [
      { key: 'type', label: '角色', values: (d) => distinct(d, 'type').sort(byTypeOrder) },
      { key: 'rarity', label: '稀有度', values: (d) => distinct(d, 'rarity').sort(byRarityOrder) },
      { key: 'category', label: '类别', values: (d) => distinct(d, 'category') },
      { key: 'tier', label: '强度', values: (d) => distinct(d, 'tier') },
    ],
    sorts: [
      ['winRate', '胜率最高'], ['pickRate', '选取率最高'], ['skipRate', '跳过率最高'],
      ['upgradeRate', '升级率最高'], ['name', '名称'],
    ],
    match: (c, f) => Object.entries(f).every(([k, v]) => !v || c[k] === v),
    sortFn: (a, b, s) => {
      if (s === 'name') return (a.zhName || '').localeCompare(b.zhName || '', 'zh');
      return (cRate(b, s) ?? -1) - (cRate(a, s) ?? -1);
    },
  },
  relics: {
    items: () => DATA.relics,
    filters: [
      { key: 'rarity', label: '稀有度', values: (d) => distinct(d, 'rarity').sort(byRarityOrder) },
    ],
    sorts: [['name', '名称'], ['rarity', '稀有度']],
    match: (r, f) => Object.entries(f).every(([k, v]) => !v || r[k] === v),
    sortFn: (a, b, s) => (s === 'rarity'
      ? byRarityOrder(a.rarity, b.rarity) || (a.zhName || '').localeCompare(b.zhName || '', 'zh')
      : (a.zhName || '').localeCompare(b.zhName || '', 'zh')),
  },
  enemies: {
    items: () => DATA.enemies,
    filters: [
      { key: 'enemyType', label: '类型', values: (d) => distinct(d, 'enemyType') },
    ],
    sorts: [['hardest', '最难打（玩家胜率低）'], ['easiest', '最好打'], ['fights', '交战最多'], ['name', '名称']],
    match: (e, f) => Object.entries(f).every(([k, v]) => !v || e[k] === v),
    sortFn: (a, b, s) => {
      if (s === 'name') return (a.zhName || '').localeCompare(b.zhName || '', 'zh');
      if (s === 'fights') return (num(b.totalFights) ?? 0) - (num(a.totalFights) ?? 0);
      if (s === 'easiest') return (num(b.avgWinRate) ?? -1) - (num(a.avgWinRate) ?? -1);
      return (num(a.avgWinRate) ?? 101) - (num(b.avgWinRate) ?? 101);
    },
  },
};

/* ---------- 渲染：筛选栏 ---------- */
function renderFilterbar() {
  const bar = $('#filterbar');
  if (state.tab === 'characters') { bar.innerHTML = ''; return; }
  const conf = TAB_CONF[state.tab];
  const items = conf.items();
  const f = state.filters[state.tab];
  let html = '';
  for (const fc of conf.filters) {
    const vals = fc.values(items);
    if (state.tab === 'cards' && fc.key === 'type') {
      /* 角色筛选：带头像的按钮组（对齐源站样式） */
      /* 只有当前选中的角色显示全名，其余只显示头像（悬停/长按有 title 提示） */
      html += `<span class="chips"><span class="chips-label">${esc(fc.label)}</span>` +
        `<button type="button" class="chip text-only ${!f.type ? 'active' : ''}" data-chip="">全部</button>` +
        vals.map((v) => {
          const active = f.type === v;
          const cls = !TYPE_ICONS[v] ? 'text-only' : (active ? '' : 'icon-only');
          return `<button type="button" class="chip ${cls} ${active ? 'active' : ''}" data-chip="${esc(v)}" title="${esc(v)}" aria-label="${esc(v)}">` +
            (TYPE_ICONS[v] ? `<img src="${esc(TYPE_ICONS[v])}" alt="">` : '') +
            (active || !TYPE_ICONS[v] ? esc(v) : '') + `</button>`;
        }).join('') +
        `</span>`;
      continue;
    }
    html += `<span class="filter-group"><label>${esc(fc.label)}</label>` +
      `<select data-filter="${esc(fc.key)}"><option value="">全部</option>` +
      vals.map((v) => `<option value="${esc(v)}" ${f[fc.key] === v ? 'selected' : ''}>${esc(v)}</option>`).join('') +
      `</select></span>`;
  }
  html += `<span class="filter-group"><label>排序</label><select data-sort>` +
    conf.sorts.map(([k, label]) => `<option value="${k}" ${state.sort[state.tab] === k ? 'selected' : ''}>${label}</option>`).join('') +
    `</select></span>`;
  bar.innerHTML = html;
  bar.querySelectorAll('select[data-filter]').forEach((sel) => {
    sel.addEventListener('change', () => { state.filters[state.tab][sel.dataset.filter] = sel.value; render(); });
  });
  bar.querySelectorAll('[data-chip]').forEach((btn) => {
    btn.addEventListener('click', () => { state.filters.cards.type = btn.dataset.chip; render(); });
  });
  bar.querySelector('select[data-sort]').addEventListener('change', (e) => {
    state.sort[state.tab] = e.target.value; render();
  });
}

/* ---------- 渲染：瓷砖 ---------- */
function badges(list) {
  return `<span class="badges">${list.filter(Boolean).map((b) =>
    `<span class="badge ${b.cls || ''}">${esc(b.text)}</span>`).join('')}</span>`;
}
function rarBadge(v) { return v ? { text: v, cls: `rar rar-${CSS.escape(v)}` } : null; }
function statBar(label, value, danger) {
  const v = num(value);
  return `<div class="stat-row"><div class="stat-head"><span>${label}</span><b>${pct(value)}</b></div>` +
    `<div class="bar ${danger ? 'danger' : ''}"><i style="width:${v == null ? 0 : Math.min(100, Math.max(0, v))}%"></i></div></div>`;
}
/* 敌人：有专属图的用专属图，没有的按源站口径用类型通用图（普通/精英）兜底 */
function withEnemyImg(e) {
  if (e.imageLocal) return e;
  const icon = e.enemyType === '精英'
    ? 'assets/img/enemy_type/elite.png' : 'assets/img/enemy_type/ordinary.png';
  return { ...e, imageLocal: icon };
}

function imgOrPh(item, kind) {
  if (item.imageLocal) {
    return `<div class="tile-img ${kind}"><img loading="lazy" src="${esc(item.imageLocal)}" alt="${esc(item.zhName)}"></div>`;
  }
  return `<div class="tile-img ${kind}"><span class="tile-ph">${esc((item.zhName || '?').slice(0, 1))}</span></div>`;
}

/* 卡片底部显示的指标跟随当前排序（按名称排序时回落到胜率） */
const CARD_STAT_LABEL = { winRate: '胜率', pickRate: '选取率', skipRate: '跳过率', upgradeRate: '升级率' };

const tileRender = {
  cards(c, i) {
    const f = state.filters.cards;
    const sk = CARD_STAT_LABEL[state.sort.cards] ? state.sort.cards : 'winRate';
    /* 已作为筛选条件的字段不再在结果卡上重复显示标签 */
    return `<button class="tile" type="button" data-open="cards" data-en="${esc(c.enName)}">
      <span class="tile-idx">${i + 1}</span>
      ${imgOrPh(c, 'card')}
      <span class="tile-body">
        <span><span class="tile-name">${esc(c.zhName)}</span><br><span class="tile-en">${esc(c.enName)}</span></span>
        ${badges([!f.rarity && rarBadge(c.rarity),
                  !f.category && c.category && { text: c.category },
                  !f.type && c.type && { text: c.type },
                  !f.tier && c.tier && { text: c.tier, cls: 'tier' }])}
        ${statBar(CARD_STAT_LABEL[sk], cRate(c, sk))}
      </span></button>`;
  },
  relics(r, i) {
    const f = state.filters.relics;
    return `<button class="tile" type="button" data-open="relics" data-en="${esc(r.enName)}">
      <span class="tile-idx">${i + 1}</span>
      ${imgOrPh(r, 'relic')}
      <span class="tile-body">
        <span><span class="tile-name">${esc(r.zhName)}</span><br><span class="tile-en">${esc(r.enName)}</span></span>
        ${badges([!f.rarity && rarBadge(r.rarity)])}
        <span class="tile-effect">${esc(r.effect)}</span>
      </span></button>`;
  },
  enemies(e, i) {
    const f = state.filters.enemies;
    const hard = num(e.avgWinRate) != null && num(e.avgWinRate) < 60;
    const statHtml = state.sort.enemies === 'fights'
      ? `<div class="stat-row"><div class="stat-head"><span>交战次数</span><b>${esc(e.totalFights ?? '—')}</b></div></div>`
      : statBar('玩家胜率', e.avgWinRate, hard);
    return `<button class="tile" type="button" data-open="enemies" data-en="${esc(e.enName)}">
      <span class="tile-idx">${i + 1}</span>
      ${imgOrPh(withEnemyImg(e), 'boss')}
      <span class="tile-body">
        <span><span class="tile-name">${esc(e.zhName)}</span><br><span class="tile-en">${esc(e.enName)}</span></span>
        ${badges([!f.enemyType && e.enemyType && { text: e.enemyType }, e.blood && { text: `HP ${e.blood}` }])}
        ${statHtml}
      </span></button>`;
  },
};

function renderCharacters(list) {
  const wrap = $('#charWrap');
  wrap.innerHTML = list.map((c) => `
    <div class="char-card">
      <div class="char-head">
        ${TYPE_ICONS[c.zhName] ? `<img class="char-avatar" src="${esc(TYPE_ICONS[c.zhName])}" alt="${esc(c.zhName)}">` : ''}
        <div>
          <h3>${esc(c.zhName)}</h3>
          <div class="tile-en">${esc((c.enName || '').replace('CHARACTER.', ''))}</div>
        </div>
      </div>
      ${statBar('胜率', c.winRate)}
      <div style="height:8px"></div>
      ${statBar('选取率', c.pickRate)}
    </div>`).join('');
}

/* ---------- 渲染：主流程 ---------- */
function currentList() {
  const conf = TAB_CONF[state.tab];
  let list = conf.items().slice();
  const q = state.query.trim().toLowerCase();
  if (q) {
    list = list.filter((x) => (x.zhName || '').toLowerCase().includes(q) ||
      (x.enName || '').toLowerCase().includes(q));
  }
  list = list.filter((x) => conf.match(x, state.filters[state.tab]));
  list.sort((a, b) => conf.sortFn(a, b, state.sort[state.tab]));
  return list;
}

function render() {
  saveState();
  const grid = $('#grid'), charWrap = $('#charWrap');
  document.querySelectorAll('#tabs .tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === state.tab));
  renderFilterbar();

  if (state.tab === 'characters') {
    grid.hidden = true; charWrap.hidden = false;
    let list = DATA.characters.slice();
    const q = state.query.trim().toLowerCase();
    if (q) list = list.filter((c) => (c.zhName || '').includes(q) ||
      (c.enName || '').toLowerCase().includes(q));
    renderCharacters(list);
    $('#resultMeta').textContent = `共 ${list.length} 名角色（按胜率统计口径）`;
    $('#emptyTip').hidden = list.length > 0;
    return;
  }
  charWrap.hidden = true; grid.hidden = false;
  const list = currentList();
  grid.innerHTML = list.map((x, i) => tileRender[state.tab](x, i)).join('');
  $('#resultMeta').textContent = `共 ${list.length} 条`;
  $('#emptyTip').hidden = list.length > 0;
}

/* ---------- 详情弹窗 ---------- */
const backdrop = $('#modalBackdrop');
function openModal(html) { $('#modalBody').innerHTML = html; backdrop.hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal() { backdrop.hidden = true; document.body.style.overflow = ''; }
$('#modalClose').addEventListener('click', closeModal);
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function statCell(k, v, rank) {
  return `<div class="stat-cell"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>` +
    (rank ? `<div class="r">排名 #${esc(rank)}</div>` : '') + `</div>`;
}
function detailImg(item, kind) {
  if (item.imageLocal) {
    return `<div class="detail-img ${kind}"><img src="${esc(item.imageLocal)}" alt="${esc(item.zhName)}"></div>`;
  }
  return `<div class="detail-img ${kind}"><span class="tile-ph">${esc((item.zhName || '?').slice(0, 1))}</span></div>`;
}

/* 在给定集合内按某指标算名次（值越大名次越靠前；并列同名次） */
function rankIn(list, item, key) {
  const v = cRate(item, key);
  if (v == null) return null;
  let r = 1;
  for (const x of list) {
    const xv = cRate(x, key);
    if (xv != null && xv > v) r++;
  }
  return r;
}

const detailRender = {
  cards(c, list) {
    const scope = Array.isArray(list) && list.length ? list : DATA.cards;
    const stats = [
      statCell('胜率', pct(cRate(c, 'winRate')), rankIn(scope, c, 'winRate')),
      statCell('选取率', pct(cRate(c, 'pickRate')), rankIn(scope, c, 'pickRate')),
      statCell('跳过率', pct(cRate(c, 'skipRate')), rankIn(scope, c, 'skipRate')),
      statCell('升级率', pct(c.upgradeRate), rankIn(scope, c, 'upgradeRate')),
    ];
    if (num(c.usageCount)) stats.push(statCell('样本对局', String(c.usageCount)));
    /* 左列：详情大图（竖版整卡图）贴合显示，下方可切换普通/升级后；无大图时回落列表图 */
    const leftCol = c.imageBig
      ? `<div class="detail-left">
           <div class="detail-img bigcard"><img id="bigCardImg" src="${esc(c.imageBig)}" alt="${esc(c.zhName)}"></div>
           ${c.imageBigUpgrade ? `<div class="img-toggle">
             <button type="button" class="toggle-btn active" data-big="${esc(c.imageBig)}">普通</button>
             <button type="button" class="toggle-btn" data-big="${esc(c.imageBigUpgrade)}">升级后</button>
           </div>` : ''}
         </div>`
      : detailImg(c, 'card');
    /* 费用与类别不进标签：卡图上已印着。描述用「升级前：/升级后：」两段同行标签 */
    return `<div class="detail detail-card">
      ${leftCol}
      <div>
        <h2>${esc(c.zhName)} <span class="h-en">${esc(c.enName)}</span></h2>
        ${badges([rarBadge(c.rarity), c.type && { text: c.type },
                  c.tier && { text: c.tier, cls: 'tier' },
                  c.buildType && { text: `流派 ${c.buildType}` }, c.mechanism && { text: c.mechanism }])}
        <p class="desc-line"><span class="desc-label">升级前：</span>${esc(c.description || '（暂无）')}</p>
        ${c.upgradeDescription ? `<p class="desc-line up"><span class="desc-label">升级后：</span>${esc(c.upgradeDescription)}</p>` : ''}
        <div class="stat-grid card-stats">${stats.join('')}</div>
      </div></div>`;
  },
  relics(r) {
    return `<div class="detail">
      ${detailImg(r, 'relic')}
      <div>
        <h2>${esc(r.zhName)}</h2><div class="tile-en">${esc(r.enName)}</div>
        ${badges([rarBadge(r.rarity)])}
        <h4>效果</h4><div class="detail-desc">${esc(r.effect || '（暂无）')}</div>
      </div></div>`;
  },
  enemies(e) {
    const stats = [statCell('玩家胜率', pct(e.avgWinRate))];
    if (num(e.totalFights)) stats.push(statCell('交战次数', String(e.totalFights)));
    if (e.blood) stats.push(statCell('生命值', e.blood));
    return `<div class="detail">
      ${detailImg(withEnemyImg(e), 'boss')}
      <div>
        <h2>${esc(e.zhName)}</h2><div class="tile-en">${esc(e.enName)}</div>
        ${badges([e.enemyType && { text: e.enemyType }])}
        ${e.action ? `<h4>行动模式</h4><div class="detail-desc">${esc(e.action)}</div>` : ''}
        ${e.power ? `<h4>特殊机制</h4><div class="detail-desc">${esc(e.power)}</div>` : ''}
        <h4>实战统计</h4><div class="stat-grid">${stats.join('')}</div>
      </div></div>`;
  },
};

/* 详情弹窗内：普通/升级后大图切换 */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-big]');
  if (!btn) return;
  const img = $('#bigCardImg');
  if (img) img.src = btn.dataset.big;
  btn.parentElement.querySelectorAll('.toggle-btn').forEach((b) =>
    b.classList.toggle('active', b === btn));
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-open]');
  if (!el) return;
  const kind = el.dataset.open;
  const item = TAB_CONF[kind].items().find((x) => x.enName === el.dataset.en);
  if (!item) return;
  /* 卡牌详情的排名按当前筛选结果集计算，其余类型维持原样 */
  if (kind === 'cards') openModal(detailRender.cards(item, currentList()));
  else openModal(detailRender[kind](item));
});

/* ---------- 搜索 & 标签 ---------- */
$('#searchInput').addEventListener('input', (e) => { state.query = e.target.value; render(); });
document.querySelectorAll('#tabs .tab').forEach((t) => {
  t.addEventListener('click', () => { state.tab = t.dataset.tab; render(); });
});

/* ---------- 筛选状态持久化（localStorage，刷新不丢） ---------- */
const STORE_KEY = 'sts2-view-state-v1';
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      tab: state.tab, query: state.query, filters: state.filters, sort: state.sort,
    }));
  } catch (e) { /* 隐私模式等场景下静默放弃 */ }
}
function loadState() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return; }
  if (!s) return;
  if (['cards', 'relics', 'enemies', 'characters'].includes(s.tab)) state.tab = s.tab;
  if (typeof s.query === 'string') state.query = s.query;
  for (const t of ['cards', 'relics', 'enemies']) {
    if (s.filters && s.filters[t]) {
      for (const fc of TAB_CONF[t].filters) {
        const v = s.filters[t][fc.key];
        /* 只恢复数据里仍然存在的值，防数据源更新后筛出空结果 */
        if (typeof v === 'string' && v && fc.values(TAB_CONF[t].items()).includes(v)) {
          state.filters[t][fc.key] = v;
        }
      }
    }
    if (s.sort && TAB_CONF[t].sorts.some(([k]) => k === s.sort[t])) state.sort[t] = s.sort[t];
  }
}

/* ---------- 初始化 ---------- */
for (const [k, arr] of Object.entries(
  { cards: DATA.cards, relics: DATA.relics, enemies: DATA.enemies, characters: DATA.characters })) {
  const el = document.querySelector(`[data-count="${k}"]`);
  if (el) el.textContent = arr ? `(${arr.length})` : '';
}
if (DATA.generatedAt) $('#dataStamp').textContent = `数据抓取时间：${DATA.generatedAt}`;
loadState();
$('#searchInput').value = state.query;
render();
