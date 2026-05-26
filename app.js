// ---- State ----
let allSongs   = [];
let activeFilters = {};
let searchQuery   = '';
let viewMode      = 'grid'; // 'grid' | 'list'
let setlist       = [];     // session-only, resets on close
let dragSrcIndex  = null;

// ---- Init ----
async function init() {
  if (!CONFIG.SHEET_CSV_URL) { showState('setup'); return; }
  try {
    allSongs = await fetchSongs();
    showState('loaded');
    renderFilters();
    renderSongs();
    setupSearch();
    setupModal();
    setupTagReference();
    setupViewToggle();
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
    const split = val => val ? val.split(';').map(t => t.trim()).filter(Boolean) : [];
    const file = obj['PDF链接'] || '';
    return {
      title:     obj['标题']    || '',
      titleEn:   obj['英文标题'] || '',
      key:       obj['调']      || '',
      type:      obj['类型']    || '',
      themes:    split(obj['主题']),
      occasions: split(obj['场合']),
      notes:     obj['备注']    || '',
      file,
      previewUrl:  file ? `scores/${file}` : '',
      downloadUrl: file ? `scores/${file}` : '',
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
function getTagsForCategory(cat) {
  const set = new Set();
  allSongs.forEach(s => {
    const vals = cat === 'type' ? (s.type ? [s.type] : [])
      : cat === 'theme'    ? s.themes
      : cat === 'occasion' ? s.occasions
      : cat === 'key'      ? (s.key ? [s.key] : [])
      : [];
    vals.forEach(v => set.add(v));
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
}

function renderFilters() {
  const container = document.getElementById('filters-section');
  container.innerHTML = '';
  [{ id: 'type', label: '类型' }, { id: 'theme', label: '主题' },
   { id: 'occasion', label: '场合' }, { id: 'key', label: '调' }]
  .forEach(({ id, label }) => {
    const tags = getTagsForCategory(id);
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
      btn.textContent = tag;
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
  renderSongs();
}

function clearFilters() {
  Object.keys(activeFilters).forEach(c => activeFilters[c].clear());
  document.querySelectorAll('.tag-btn.active').forEach(b => b.classList.remove('active'));
  searchQuery = '';
  document.getElementById('search-input').value = '';
  updateClearButton();
  renderSongs();
}

function updateClearButton() {
  const has = Object.values(activeFilters).some(s => s.size > 0) || searchQuery;
  document.getElementById('clear-filters-btn').style.display = has ? 'inline' : 'none';
}

function songMatches(song) {
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    if (!song.title.toLowerCase().includes(q) && !song.titleEn.toLowerCase().includes(q)) return false;
  }
  if (activeFilters.type     ?.size > 0 && !activeFilters.type.has(song.type))                        return false;
  if (activeFilters.theme    ?.size > 0 && !song.themes.some(t => activeFilters.theme.has(t)))        return false;
  if (activeFilters.occasion ?.size > 0 && !song.occasions.some(t => activeFilters.occasion.has(t))) return false;
  if (activeFilters.key      ?.size > 0 && !activeFilters.key.has(song.key))                          return false;
  return true;
}

// ---- Render songs ----
function renderSongs() {
  const filtered = allSongs.filter(songMatches);
  document.getElementById('results-count').textContent = `共 ${filtered.length} 首`;
  viewMode === 'grid' ? renderGrid(filtered) : renderList(filtered);
}

function tagPills(song) {
  return [
    song.type ? `<span class="song-tag type-tag">${esc(song.type)}</span>` : '',
    song.key  ? `<span class="song-tag key-tag">${esc(song.key)}</span>`   : '',
    ...song.themes.map(t    => `<span class="song-tag">${esc(t)}</span>`),
    ...song.occasions.map(t => `<span class="song-tag">${esc(t)}</span>`),
  ].join('');
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
      <div class="song-card-title">${esc(song.title)}</div>
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
            <td class="song-row-title">${esc(song.title)}</td>
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
    row.addEventListener('click', e => {
      if (e.target.closest('.add-setlist-btn')) return;
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
  renderSongs();
}

// ---- Search ----
function setupSearch() {
  const input = document.getElementById('search-input');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { searchQuery = input.value.trim(); updateClearButton(); renderSongs(); }, 200);
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
function setupTagReference() {
  const btn   = document.getElementById('tag-ref-btn');
  const panel = document.getElementById('tag-reference');
  if (!CONFIG.TAGS) return;
  panel.innerHTML = Object.entries(CONFIG.TAGS).map(([cat, tags]) => `
    <div class="ref-group">
      <span class="ref-label">${esc(cat)}</span>
      <div class="ref-tags">${tags.map(t => `<span class="ref-tag">${esc(t)}</span>`).join('')}</div>
    </div>
  `).join('');
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
  if (setlist.length === 0) {
    btn.style.display = 'none';
  } else {
    btn.textContent = `选曲 (${setlist.length})`;
    btn.style.display = 'inline-block';
  }
}

function renderSetlistPanel() {
  const panel = document.getElementById('setlist-panel');
  const body  = document.getElementById('setlist-body');
  if (!setlist.length) {
    body.innerHTML = '<p class="setlist-empty">尚未选择诗歌</p>';
    document.getElementById('setlist-download').style.display = 'none';
    return;
  }
  document.getElementById('setlist-download').style.display = 'inline-block';
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
    item.addEventListener('dragstart', e => { dragSrcIndex = i; item.classList.add('dragging'); });
    item.addEventListener('dragend',   () => item.classList.remove('dragging'));
    item.addEventListener('dragover',  e => e.preventDefault());
    item.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcIndex === null || dragSrcIndex === i) return;
      const moved = setlist.splice(dragSrcIndex, 1)[0];
      setlist.splice(i, 0, moved);
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
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: '诗歌顺序.pdf' });
    a.click();
    URL.revokeObjectURL(a.href);
  } finally {
    btn.textContent = '下载合并PDF';
    btn.disabled = false;
  }
}

// ---- Modal ----
function setupModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeSetlistPanel(); } });

  // Setlist FAB + panel
  document.getElementById('setlist-fab').addEventListener('click', () => {
    renderSetlistPanel();
    document.getElementById('setlist-panel').classList.add('open');
  });
  document.getElementById('setlist-panel-close').addEventListener('click', closeSetlistPanel);
  document.getElementById('setlist-download').addEventListener('click', downloadSetlistPDF);
  document.getElementById('setlist-overlay').addEventListener('click', closeSetlistPanel);
}

function closeSetlistPanel() {
  document.getElementById('setlist-panel').classList.remove('open');
}

function openModal(song) {
  document.getElementById('modal-title-cn').textContent = song.title;
  const enEl = document.getElementById('modal-title-en');
  enEl.textContent   = song.titleEn;
  enEl.style.display = song.titleEn ? 'block' : 'none';

  document.getElementById('modal-tags').innerHTML = tagPills(song);

  const notesEl = document.getElementById('modal-notes');
  notesEl.textContent   = song.notes;
  notesEl.style.display = song.notes ? 'block' : 'none';

  const frame    = document.getElementById('pdf-frame');
  const noPdfMsg = document.getElementById('no-pdf-msg');
  const dlBtn    = document.getElementById('download-btn');
  if (song.previewUrl) {
    frame.src = song.previewUrl;
    frame.style.display = 'block';
    noPdfMsg.style.display = 'none';
    dlBtn.href = song.downloadUrl;
    dlBtn.style.display = 'inline-block';
  } else {
    frame.src = '';
    frame.style.display = 'none';
    noPdfMsg.style.display = 'flex';
    dlBtn.style.display = 'none';
  }

  history.pushState({}, '', `?song=${encodeURIComponent(song.title)}`);
  document.getElementById('modal-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('pdf-frame').src = '';
  document.body.style.overflow = '';
  history.pushState({}, '', window.location.pathname);
}

// ---- Utils ----
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', init);
