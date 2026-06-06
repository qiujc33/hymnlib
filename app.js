// ---- State ----
let allSongs   = [];
let activeFilters = {};
let searchQuery   = '';
let viewMode      = 'grid'; // 'grid' | 'list'
let currentPage   = 1;
const PAGE_SIZE   = { grid: 21, list: 20 };
let setlist       = [];     // session-only, resets on close
let dragSrcIndex  = null;
let currentSong   = null;   // song shown in the open modal, for the setlist toggle
let pdfRenderToken = 0;     // guards against stale renders when songs are switched quickly

// Drive PDF.js with our own worker so pages render to canvas (no browser PDF chrome).
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

// ---- Init ----
async function init() {
  if (!CONFIG.SHEET_CSV_URL) { showState('setup'); return; }
  try {
    allSongs = await fetchSongs();
    validateTags(allSongs);
    showState('loaded');
    renderFilters();
    renderSongs();
    updateSetlistBtn();
    setupSearch();
    setupModal();
    setupTagReference();
    setupViewToggle();
    setupFilterDrawer();
    handleDirectLink();
  } catch (e) {
    console.error('Failed to load songs:', e);
    showState('error');
  }
}

function showState(state) {
  document.getElementById('loading-state').style.display = state === 'loading' ? 'block' : 'none';
  document.getElementById('error-state').style.display   = state === 'error'   ? 'block' : 'none';
  document.getElementById('setup-state').style.display   = state === 'setup'   ? 'block' : 'none';
  document.getElementById('song-grid').style.display     = state === 'loaded' && viewMode === 'grid' ? 'grid' : 'none';
  document.getElementById('song-list').style.display     = state === 'loaded' && viewMode === 'list' ? 'block' : 'none';
}

// ---- Fetch & parse ----
async function fetchSongs() {
  const res = await fetch(CONFIG.SHEET_CSV_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCSV(await res.text());
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').trim(); });
    // Split on both ASCII ';' and full-width '；' — the sheet mixes them.
    const split = val => val ? val.split(/[;；]/).map(t => t.trim()).filter(Boolean) : [];
    const file = obj['PDF链接'] || '';
    const audioFile = obj['音频链接'] || '';
    return {
      title:     obj['标题']    || '',
      titleEn:   obj['英文标题'] || '',
      key:       obj['调']      || '',
      types:     split(obj['类型']),
      themes:    split(obj['主题']),
      occasions: split(obj['场合']),
      notes:     obj['备注']    || '',
      file,
      downloadUrl: file ? `scores/${file}` : '',
      audioFile,
      // Accept either a full URL (external host) or a bare filename (served from audio/).
      audioUrl: audioFile ? (/^https?:\/\//i.test(audioFile) ? audioFile : `audio/${audioFile}`) : '',
    };
  }).filter(s => s.title);
}

function parseCSVLine(line) {
  const result = [];
  let field = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(field); field = '';
    } else { field += c; }
  }
  result.push(field);
  return result;
}

// ---- Filters ----
function valuesFor(song, cat) {
  switch (cat) {
    case 'type':     return song.types;
    case 'theme':    return song.themes;
    case 'occasion': return song.occasions;
    case 'key':      return song.key ? [song.key] : [];
    default:         return [];
  }
}

// Map of tag → number of songs carrying it, for one category.
function getTagCounts(cat) {
  const counts = new Map();
  allSongs.forEach(s => valuesFor(s, cat).forEach(v => counts.set(v, (counts.get(v) || 0) + 1)));
  return counts;
}

// Categories with a controlled vocabulary in CONFIG.TAGS, mapped to song fields.
const CANON_CATS = [
  { cat: 'type',     label: '类型', field: 'types' },
  { cat: 'theme',    label: '主题', field: 'themes' },
  { cat: 'occasion', label: '场合', field: 'occasions' },
];

// Fix 1: warn (in console) about sheet tags that aren't in the canonical list,
// so typos and drift (e.g. 降临节 vs 降临期) surface instead of silently
// becoming their own filter button.
function validateTags(songs) {
  if (!CONFIG.TAGS) return;
  CANON_CATS.forEach(({ label, field }) => {
    const canon = new Set(Object.keys(CONFIG.TAGS[label] || {}));
    const unknown = new Map();
    songs.forEach(s => s[field].forEach(v => {
      if (!canon.has(v)) unknown.set(v, (unknown.get(v) || 0) + 1);
    }));
    if (unknown.size) {
      const list = [...unknown.entries()].map(([t, n]) => `${t}（${n}首）`).join('、');
      console.warn(`[标签校验] 「${label}」中有未登记的标签：${list}`);
    }
  });
}

function renderFilters() {
  const container = document.getElementById('filters-section');
  container.innerHTML = '';
  [{ id: 'type', label: '类型' }, { id: 'theme', label: '主题' },
   { id: 'occasion', label: '场合' }, { id: 'key', label: '调' }]
  .forEach(({ id, label }) => {
    const counts = getTagCounts(id);
    const tags = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'zh'));
    if (!tags.length) return;
    activeFilters[id] = new Set();
    const group = document.createElement('div');
    group.className = 'filter-group';
    const lbl = document.createElement('span');
    lbl.className = 'filter-label';
    lbl.textContent = label;
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'filter-tags';
    tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'tag-btn';
      btn.innerHTML = `${esc(tag)} <span class="tag-count">${counts.get(tag)}</span>`;
      btn.addEventListener('click', () => toggleFilter(id, tag, btn));
      tagsDiv.appendChild(btn);
    });
    group.appendChild(lbl);
    group.appendChild(tagsDiv);
    container.appendChild(group);
  });
  document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
}

function toggleFilter(cat, tag, btn) {
  activeFilters[cat].has(tag) ? (activeFilters[cat].delete(tag), btn.classList.remove('active'))
                              : (activeFilters[cat].add(tag),    btn.classList.add('active'));
  updateClearButton();
  currentPage = 1;
  renderSongs();
}

function clearFilters() {
  Object.keys(activeFilters).forEach(c => activeFilters[c].clear());
  document.querySelectorAll('.tag-btn.active').forEach(b => b.classList.remove('active'));
  searchQuery = '';
  document.getElementById('search-input').value = '';
  updateClearButton();
  currentPage = 1;
  renderSongs();
}

function updateClearButton() {
  const activeCount = Object.values(activeFilters).reduce((n, s) => n + s.size, 0);
  const has = activeCount > 0 || searchQuery;
  document.getElementById('clear-filters-btn').style.display = has ? 'inline' : 'none';
  // Badge on the sidebar handle shows how many filters are active, even collapsed.
  const badge = document.getElementById('filter-active-count');
  badge.textContent = activeCount || '';
  badge.style.display = activeCount > 0 ? 'flex' : 'none';
}

// ---- Filter sidebar ----
// Open by default on wide screens; collapsed by default on narrow screens, where
// it acts as an overlay drawer. The circular handle toggles it in both cases.
const filterIsMobile = () => window.matchMedia('(max-width: 767px)').matches;

function setupFilterDrawer() {
  const drawer = document.getElementById('filter-drawer');
  // Sensible default per screen size: open on desktop, collapsed (slide-in) on mobile.
  const applyDefault = () => drawer.classList.toggle('collapsed', filterIsMobile());
  applyDefault();
  window.matchMedia('(max-width: 767px)').addEventListener('change', applyDefault);
  document.getElementById('filter-toggle').addEventListener('click', () => drawer.classList.toggle('collapsed'));
  document.getElementById('filter-overlay').addEventListener('click', closeFilterDrawer);
}

// Only auto-collapses in mobile/overlay mode, so the desktop sidebar never closes
// unexpectedly on overlay-click or Escape.
function closeFilterDrawer() {
  if (filterIsMobile()) document.getElementById('filter-drawer').classList.add('collapsed');
}

function songMatches(song) {
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    if (!song.title.toLowerCase().includes(q) && !song.titleEn.toLowerCase().includes(q)) return false;
  }
  if (activeFilters.type     ?.size > 0 && !song.types.some(t => activeFilters.type.has(t)))           return false;
  if (activeFilters.theme    ?.size > 0 && !song.themes.some(t => activeFilters.theme.has(t)))        return false;
  if (activeFilters.occasion ?.size > 0 && !song.occasions.some(t => activeFilters.occasion.has(t))) return false;
  if (activeFilters.key      ?.size > 0 && !activeFilters.key.has(song.key))                          return false;
  return true;
}

// ---- Render songs ----
function renderSongs() {
  let filtered = allSongs.filter(songMatches);
  // List view is alphabetical, so sort the whole set before paginating;
  // grid keeps the sheet's order.
  if (viewMode === 'list') filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title, 'zh'));

  const size = PAGE_SIZE[viewMode];
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const pageItems = filtered.slice((currentPage - 1) * size, currentPage * size);

  document.getElementById('results-count').textContent = `共 ${filtered.length} 首`;
  viewMode === 'grid' ? renderGrid(pageItems) : renderList(pageItems);
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'flex';
  el.innerHTML = '';

  const btn = (label, page, { disabled = false, active = false } = {}) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (active ? ' active' : '');
    b.textContent = label;
    b.disabled = disabled;
    if (!disabled && !active) b.addEventListener('click', () => goToPage(page));
    return b;
  };

  el.appendChild(btn('‹', currentPage - 1, { disabled: currentPage === 1 }));
  pageList(currentPage, totalPages).forEach(tok => {
    if (tok === '…') {
      const span = document.createElement('span');
      span.className = 'page-ellipsis';
      span.textContent = '…';
      el.appendChild(span);
    } else {
      el.appendChild(btn(String(tok), tok, { active: tok === currentPage }));
    }
  });
  el.appendChild(btn('›', currentPage + 1, { disabled: currentPage === totalPages }));
}

// Windowed page numbers: first, last, current ±1, with ellipses when there's a gap.
function pageList(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  if (cur > 3) out.push('…');
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) out.push(i);
  if (cur < total - 2) out.push('…');
  out.push(total);
  return out;
}

function goToPage(page) {
  currentPage = page;
  renderSongs();
  document.querySelector('.main-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function tagPills(song) {
  return [
    ...song.types.map(t => `<span class="song-tag type-tag">${esc(t)}</span>`),
    song.key  ? `<span class="song-tag key-tag">${esc(song.key)}</span>`   : '',
    ...song.themes.map(t    => `<span class="song-tag">${esc(t)}</span>`),
    ...song.occasions.map(t => `<span class="song-tag">${esc(t)}</span>`),
  ].join('');
}

// A real link to the song (?song=Title), which handleDirectLink resolves on load,
// so titles support right-click / open-in-new-tab.
function songLink(song) {
  return `?song=${encodeURIComponent(song.title)}`;
}

// Left-click opens the modal in place (existing behavior); Ctrl/Cmd/Shift/middle-click
// fall through to the browser so the link opens in a new tab.
function bindSongLink(link, song) {
  if (!link) return;
  link.addEventListener('click', e => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) { e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    openModal(song);
  });
}

function renderGrid(filtered) {
  const grid = document.getElementById('song-grid');
  document.getElementById('song-list').style.display = 'none';
  grid.style.display = 'grid';
  if (!filtered.length) { grid.innerHTML = '<div class="no-results">没有找到符合条件的诗歌</div>'; return; }
  grid.innerHTML = '';
  filtered.forEach(song => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const inSetlist = setlist.includes(song);
    card.innerHTML = `
      <a class="song-card-title song-link" href="${songLink(song)}">${esc(song.title)}</a>
      ${song.titleEn ? `<div class="song-card-en">${esc(song.titleEn)}</div>` : ''}
      <div class="song-card-tags">${tagPills(song)}</div>
      <button class="add-setlist-btn ${inSetlist ? 'in-setlist' : ''}" title="${inSetlist ? '从选曲移除' : '加入选曲'}">
        ${inSetlist ? '−' : '+'}
      </button>
    `;
    card.querySelector('.add-setlist-btn').addEventListener('click', e => {
      e.stopPropagation();
      toggleSetlist(song);
      renderSongs();
      renderSetlistPanel();
    });
    bindSongLink(card.querySelector('.song-link'), song);
    card.addEventListener('click', () => openModal(song));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(song); });
    grid.appendChild(card);
  });
}

function renderList(filtered) {
  const listEl = document.getElementById('song-list');
  document.getElementById('song-grid').style.display = 'none';
  listEl.style.display = 'block';
  const sorted = [...filtered].sort((a, b) => a.title.localeCompare(b.title, 'zh'));
  if (!sorted.length) { listEl.innerHTML = '<div class="no-results">没有找到符合条件的诗歌</div>'; return; }
  listEl.innerHTML = `
    <table class="song-table">
      <thead><tr>
        <th>标题</th><th>英文标题</th><th>标签</th><th></th>
      </tr></thead>
      <tbody>
        ${sorted.map(song => `
          <tr class="song-row" data-title="${esc(song.title)}">
            <td class="song-row-title"><a class="song-link" href="${songLink(song)}">${esc(song.title)}</a></td>
            <td class="song-row-en">${esc(song.titleEn)}</td>
            <td>${tagPills(song)}</td>
            <td>
              <button class="add-setlist-btn ${setlist.includes(song) ? 'in-setlist' : ''}" title="${setlist.includes(song) ? '从选曲移除' : '加入选曲'}">
                ${setlist.includes(song) ? '−' : '+'}
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  listEl.querySelectorAll('.song-row').forEach(row => {
    const song = sorted.find(s => s.title === row.dataset.title);
    bindSongLink(row.querySelector('.song-link'), song);
    row.addEventListener('click', e => {
      if (e.target.closest('.add-setlist-btn') || e.target.closest('.song-link')) return;
      openModal(song);
    });
    row.querySelector('.add-setlist-btn').addEventListener('click', e => {
      e.stopPropagation();
      toggleSetlist(song);
      renderSongs();
      renderSetlistPanel();
    });
  });
}

// ---- View toggle ----
function setupViewToggle() {
  document.getElementById('view-grid-btn').addEventListener('click', () => setView('grid'));
  document.getElementById('view-list-btn').addEventListener('click', () => setView('list'));
}

function setView(mode) {
  viewMode = mode;
  document.getElementById('view-grid-btn').classList.toggle('active', mode === 'grid');
  document.getElementById('view-list-btn').classList.toggle('active', mode === 'list');
  currentPage = 1;
  renderSongs();
}

// ---- Search ----
function setupSearch() {
  const input = document.getElementById('search-input');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { searchQuery = input.value.trim(); updateClearButton(); currentPage = 1; renderSongs(); }, 200);
  });
}

// ---- Direct song link ----
function handleDirectLink() {
  const params = new URLSearchParams(window.location.search);
  const title  = params.get('song');
  if (!title) return;
  const song = allSongs.find(s => s.title === title || s.titleEn === title);
  if (song) openModal(song);
}

// ---- Tag Reference ----
// A glossary of what the 主题 tags mean, built from CONFIG.TAGS (term → description).
function setupTagReference() {
  const btn   = document.getElementById('tag-ref-btn');
  const panel = document.getElementById('tag-reference');
  const defs  = (CONFIG.TAGS && CONFIG.TAGS['主题']) || {};
  const items = Object.entries(defs).map(([tag, meaning]) =>
    `<div class="ref-item"><span class="ref-term">${esc(tag)}</span><span class="ref-desc">${esc(meaning)}</span></div>`
  ).join('');
  panel.innerHTML = `<div class="ref-group"><div class="ref-items">${items}</div></div>`;
  btn.addEventListener('click', () => {
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    btn.textContent = open ? '标签参考 ▾' : '标签参考 ▴';
  });
}

// ---- Setlist ----
function toggleSetlist(song) {
  const wasEmpty = setlist.length === 0;
  const idx = setlist.indexOf(song);
  idx === -1 ? setlist.push(song) : setlist.splice(idx, 1);
  updateSetlistBtn();
  if (wasEmpty && setlist.length === 1) {
    renderSetlistPanel();
    document.getElementById('setlist-panel').classList.add('open');
  }
}

function updateSetlistBtn() {
  const btn = document.getElementById('setlist-fab');
  btn.textContent = `选曲 (${setlist.length})`;
  btn.style.display = 'inline-block';
}

// Reflect whether the modal's current song is in the setlist on its toggle button.
function updateModalSetlistBtn() {
  const btn = document.getElementById('modal-setlist-btn');
  if (!currentSong) return;
  const inSetlist = setlist.includes(currentSong);
  btn.textContent = inSetlist ? '从选曲移除' : '加入选曲';
  btn.classList.toggle('in-setlist', inSetlist);
}

function renderSetlistPanel() {
  const panel = document.getElementById('setlist-panel');
  const body  = document.getElementById('setlist-body');
  if (!setlist.length) {
    body.innerHTML = '<p class="setlist-empty">尚未选择诗歌</p>';
    document.getElementById('setlist-download').style.display = 'none';
    document.getElementById('setlist-clear').style.display = 'none';
    return;
  }
  document.getElementById('setlist-download').style.display = 'inline-block';
  document.getElementById('setlist-clear').style.display = 'inline';
  body.innerHTML = '';
  setlist.forEach((song, i) => {
    const item = document.createElement('div');
    item.className = 'setlist-item';
    item.draggable = true;
    item.dataset.index = i;
    item.innerHTML = `
      <span class="drag-handle">⠿</span>
      <span class="setlist-item-title">${esc(song.title)}</span>
      <button class="setlist-remove" data-index="${i}" aria-label="移除">×</button>
    `;
    item.addEventListener('dragstart', e => {
      dragSrcIndex = i;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => { item.classList.remove('dragging'); clearDropMarkers(); });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragSrcIndex === null) return;
      const rect  = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      clearDropMarkers();
      item.classList.add(after ? 'drop-after' : 'drop-before');
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcIndex === null) return;
      const rect  = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      let target  = i + (after ? 1 : 0);
      const moved = setlist.splice(dragSrcIndex, 1)[0];
      if (dragSrcIndex < target) target--;   // account for the removed item shifting indices
      setlist.splice(target, 0, moved);
      dragSrcIndex = null;
      renderSetlistPanel();
      renderSongs();
    });
    item.querySelector('.setlist-remove').addEventListener('click', () => {
      setlist.splice(i, 1);
      renderSetlistPanel();
      renderSongs();
      updateSetlistBtn();
    });
    body.appendChild(item);
  });
}

function clearDropMarkers() {
  document.querySelectorAll('.setlist-item.drop-before, .setlist-item.drop-after')
    .forEach(el => el.classList.remove('drop-before', 'drop-after'));
}

function clearSetlist() {
  setlist = [];
  renderSetlistPanel();
  renderSongs();
  updateSetlistBtn();
}

async function downloadSetlistPDF() {
  const btn = document.getElementById('setlist-download');
  btn.textContent = '合并中…';
  btn.disabled = true;
  try {
    const { PDFDocument } = PDFLib;
    const merged = await PDFDocument.create();
    for (const song of setlist) {
      if (!song.file) continue;
      try {
        const bytes = await fetch(`scores/${song.file}`).then(r => r.arrayBuffer());
        const pdf   = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      } catch (e) { console.warn(`Skipped ${song.file}:`, e); }
    }
    const blob = new Blob([await merged.save()], { type: 'application/pdf' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: setlistFileName() });
    a.click();
    URL.revokeObjectURL(a.href);
  } finally {
    btn.textContent = '下载合并PDF';
    btn.disabled = false;
  }
}

// e.g. 诗歌-2026-06-06-5首.pdf
function setlistFileName() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `诗歌-${date}-${setlist.length}首.pdf`;
}

// ---- Modal ----
function setupModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeSetlistPanel(); closeFilterDrawer(); } });

  // Zoom controls
  document.getElementById('pdf-zoom-in').addEventListener('click',  () => changeZoom(0.25));
  document.getElementById('pdf-zoom-out').addEventListener('click', () => changeZoom(-0.25));
  document.getElementById('pdf-fit').addEventListener('click', toggleFitPage);

  // Re-fit pages when the window resizes while the viewer is open
  let resizeTimer;
  window.addEventListener('resize', () => {
    if (!currentPdfDoc || document.getElementById('modal-overlay').style.display === 'none') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawPdf(), 150);
  });

  // Setlist FAB + panel
  document.getElementById('setlist-fab').addEventListener('click', () => {
    renderSetlistPanel();
    document.getElementById('setlist-panel').classList.add('open');
  });
  document.getElementById('modal-setlist-btn').addEventListener('click', () => {
    if (!currentSong) return;
    toggleSetlist(currentSong);
    updateModalSetlistBtn();
    renderSongs();
    renderSetlistPanel();
  });
  document.getElementById('setlist-clear').addEventListener('click', clearSetlist);
  document.getElementById('setlist-panel-close').addEventListener('click', closeSetlistPanel);
  document.getElementById('setlist-download').addEventListener('click', downloadSetlistPDF);
  document.getElementById('setlist-overlay').addEventListener('click', closeSetlistPanel);
}

function closeSetlistPanel() {
  document.getElementById('setlist-panel').classList.remove('open');
}

function openModal(song) {
  currentSong = song;
  updateModalSetlistBtn();
  document.getElementById('modal-title-cn').textContent = song.title;
  const enEl = document.getElementById('modal-title-en');
  enEl.textContent   = song.titleEn;
  enEl.style.display = song.titleEn ? 'block' : 'none';

  document.getElementById('modal-tags').innerHTML = tagPills(song);

  const notesEl = document.getElementById('modal-notes');
  notesEl.textContent   = song.notes;
  notesEl.style.display = song.notes ? 'block' : 'none';

  const audioEl = document.getElementById('modal-audio');
  if (song.audioUrl) {
    audioEl.src = song.audioUrl;
    audioEl.style.display = 'block';
  } else {
    audioEl.pause();
    audioEl.removeAttribute('src');
    audioEl.load();           // drop the previous song's audio
    audioEl.style.display = 'none';
  }

  const pages    = document.getElementById('pdf-pages');
  const noPdfMsg = document.getElementById('no-pdf-msg');
  const dlBtn    = document.getElementById('download-btn');
  const controls = document.getElementById('pdf-controls');

  history.pushState({}, '', `?song=${encodeURIComponent(song.title)}`);
  document.getElementById('modal-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  if (song.downloadUrl) {
    pages.style.display = 'block';
    noPdfMsg.style.display = 'none';
    dlBtn.href = song.downloadUrl;
    dlBtn.style.display = 'inline-block';
    controls.style.display = 'flex';
    renderPdf(song.downloadUrl);   // overlay is visible now, so width is measurable
  } else {
    pages.innerHTML = '';
    pages.style.display = 'none';
    noPdfMsg.style.display = 'flex';
    dlBtn.style.display = 'none';
    controls.style.display = 'none';
    currentPdfDoc = null;
  }
}

// ---- PDF rendering ----
let currentPdfDoc = null;   // keep the loaded doc so zoom re-renders without refetching
let pdfZoom       = 1;      // multiplier on the fit-to-column-width baseline
let pdfFitPage    = false;  // true = fit whole page in viewport instead of fit-width
const PDF_COLUMN_MAX = 780; // cap the reading column so the score isn't absurdly wide

// Fetch + load a PDF, then draw it. Zoom changes call drawPdf directly (no refetch).
async function renderPdf(url) {
  const token = ++pdfRenderToken;
  const container = document.getElementById('pdf-pages');
  container.innerHTML = '<div class="pdf-loading">乐谱加载中…</div>';
  pdfZoom = 1;
  pdfFitPage = false;
  updateZoomLabel();
  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    if (token !== pdfRenderToken) return;   // a newer song was opened; abandon this render
    currentPdfDoc = pdf;
    await drawPdf(token);
  } catch (e) {
    if (token !== pdfRenderToken) return;
    console.error('PDF render failed:', e);
    container.innerHTML = '<div class="pdf-loading">乐谱加载失败，请尝试下载。</div>';
  }
}

// Draw every page of the current doc at the current zoom, stacked for scrolling.
async function drawPdf(token = ++pdfRenderToken) {
  const pdf = currentPdfDoc;
  if (!pdf) return;
  const container = document.getElementById('pdf-pages');
  container.innerHTML = '';
  const dpr    = window.devicePixelRatio || 1;
  const availW = (container.clientWidth  || 800) - 32;   // minus horizontal padding
  const availH = (container.clientHeight || 600) - 48;   // minus vertical padding
  const colW   = Math.min(availW, PDF_COLUMN_MAX);
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    if (token !== pdfRenderToken) return;
    const base = page.getViewport({ scale: 1 });
    const fit  = pdfFitPage
      ? Math.min(availW / base.width, availH / base.height)   // whole page visible
      : (colW / base.width) * pdfZoom;                        // fill the reading column
    const viewport = page.getViewport({ scale: fit * dpr });
    const canvas   = document.createElement('canvas');
    canvas.className = 'pdf-page';
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width  = (base.width  * fit) + 'px';   // CSS size = fitted size (dpr is for sharpness only)
    canvas.style.height = (base.height * fit) + 'px';
    container.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  }
}

function changeZoom(delta) {
  if (!currentPdfDoc) return;
  pdfFitPage = false;
  pdfZoom = Math.min(3, Math.max(0.5, Math.round((pdfZoom + delta) * 100) / 100));
  updateZoomLabel();
  drawPdf();
}

function toggleFitPage() {
  if (!currentPdfDoc) return;
  pdfFitPage = !pdfFitPage;
  if (!pdfFitPage) pdfZoom = 1;
  updateZoomLabel();
  drawPdf();
}

function updateZoomLabel() {
  const el = document.getElementById('pdf-zoom-label');
  if (el) el.textContent = pdfFitPage ? '整页' : (pdfZoom === 1 ? '适合宽度' : Math.round(pdfZoom * 100) + '%');
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('modal-audio').pause();     // stop playback on close
  pdfRenderToken++;                                   // cancel any in-flight render
  currentPdfDoc = null;
  document.getElementById('pdf-pages').innerHTML = '';
  document.body.style.overflow = '';
  history.pushState({}, '', window.location.pathname);
}

// ---- Utils ----
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', init);
