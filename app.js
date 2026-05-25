// ---- State ----
let allSongs = [];
let activeFilters = {};
let searchQuery = '';

// ---- Init ----
async function init() {
  if (!CONFIG.SHEET_CSV_URL) {
    showState('setup');
    return;
  }
  try {
    allSongs = await fetchSongs();
    showState('loaded');
    renderFilters();
    renderSongs();
    setupSearch();
    setupModal();
    setupTagReference();
  } catch (e) {
    console.error('Failed to load songs:', e);
    showState('error');
  }
}

function showState(state) {
  document.getElementById('loading-state').style.display = state === 'loading' ? 'block' : 'none';
  document.getElementById('error-state').style.display   = state === 'error'   ? 'block' : 'none';
  document.getElementById('setup-state').style.display   = state === 'setup'   ? 'block' : 'none';
  document.getElementById('song-grid').style.display     = state === 'loaded'  ? 'grid'  : 'none';
}

// ---- Fetch & parse ----
async function fetchSongs() {
  const res = await fetch(CONFIG.SHEET_CSV_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim());

  return lines.slice(1)
    .map(line => {
      const values = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (values[i] || '').trim(); });

      const split = val => val ? val.split(';').map(t => t.trim()).filter(Boolean) : [];

      const pdfLink = obj['PDF链接'] || '';
      const driveId = extractDriveId(pdfLink);

      return {
        title:     obj['标题']    || '',
        titleEn:   obj['英文标题'] || '',
        key:       obj['调']      || '',
        type:      obj['类型']    || '',
        themes:    split(obj['主题']),
        occasions: split(obj['场合']),
        notes:     obj['备注']    || '',
        pdfLink,
        driveId,
        previewUrl:  driveId ? `https://drive.google.com/file/d/${driveId}/preview` : pdfLink,
        downloadUrl: driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : pdfLink,
      };
    })
    .filter(s => s.title);
}

function parseCSVLine(line) {
  const result = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(field); field = '';
    } else {
      field += c;
    }
  }
  result.push(field);
  return result;
}

function extractDriveId(url) {
  if (!url) return null;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// ---- Filters ----
function getTagsForCategory(category) {
  const set = new Set();
  allSongs.forEach(song => {
    const values =
      category === 'type'     ? (song.type     ? [song.type]     : []) :
      category === 'theme'    ? song.themes :
      category === 'occasion' ? song.occasions :
      category === 'key'      ? (song.key       ? [song.key]      : []) :
      [];
    values.forEach(v => set.add(v));
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
}

function renderFilters() {
  const container = document.getElementById('filters-section');
  container.innerHTML = '';

  const categories = [
    { id: 'type',     label: '类型' },
    { id: 'theme',    label: '主题' },
    { id: 'occasion', label: '场合' },
    { id: 'key',      label: '调'   },
  ];

  categories.forEach(({ id, label }) => {
    const tags = getTagsForCategory(id);
    if (tags.length === 0) return;

    activeFilters[id] = new Set();

    const group = document.createElement('div');
    group.className = 'filter-group';

    const labelEl = document.createElement('span');
    labelEl.className = 'filter-label';
    labelEl.textContent = label;
    group.appendChild(labelEl);

    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'filter-tags';

    tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'tag-btn';
      btn.textContent = tag;
      btn.addEventListener('click', () => toggleFilter(id, tag, btn));
      tagsDiv.appendChild(btn);
    });

    group.appendChild(tagsDiv);
    container.appendChild(group);
  });

  document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
}

function toggleFilter(category, tag, btn) {
  if (activeFilters[category].has(tag)) {
    activeFilters[category].delete(tag);
    btn.classList.remove('active');
  } else {
    activeFilters[category].add(tag);
    btn.classList.add('active');
  }
  updateClearButton();
  renderSongs();
}

function clearFilters() {
  Object.keys(activeFilters).forEach(cat => activeFilters[cat].clear());
  document.querySelectorAll('.tag-btn.active').forEach(b => b.classList.remove('active'));
  searchQuery = '';
  document.getElementById('search-input').value = '';
  updateClearButton();
  renderSongs();
}

function updateClearButton() {
  const hasActive = Object.values(activeFilters).some(s => s.size > 0) || searchQuery;
  document.getElementById('clear-filters-btn').style.display = hasActive ? 'inline' : 'none';
}

function songMatchesFilters(song) {
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    if (!song.title.toLowerCase().includes(q) && !song.titleEn.toLowerCase().includes(q)) return false;
  }
  if (activeFilters.type     && activeFilters.type.size     > 0 && !activeFilters.type.has(song.type))                       return false;
  if (activeFilters.theme    && activeFilters.theme.size    > 0 && !song.themes.some(t => activeFilters.theme.has(t)))        return false;
  if (activeFilters.occasion && activeFilters.occasion.size > 0 && !song.occasions.some(t => activeFilters.occasion.has(t))) return false;
  if (activeFilters.key      && activeFilters.key.size      > 0 && !activeFilters.key.has(song.key))                         return false;
  return true;
}

// ---- Render songs ----
function renderSongs() {
  const grid = document.getElementById('song-grid');
  const filtered = allSongs.filter(songMatchesFilters);

  document.getElementById('results-count').textContent = `共 ${filtered.length} 首`;

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="no-results">没有找到符合条件的诗歌</div>';
    return;
  }

  grid.innerHTML = '';
  filtered.forEach(song => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const tags = [
      song.type ? `<span class="song-tag type-tag">${esc(song.type)}</span>` : '',
      song.key  ? `<span class="song-tag key-tag">${esc(song.key)}</span>`   : '',
      ...song.themes.map(t    => `<span class="song-tag">${esc(t)}</span>`),
      ...song.occasions.map(t => `<span class="song-tag">${esc(t)}</span>`),
    ].join('');

    card.innerHTML = `
      <div class="song-card-title">${esc(song.title)}</div>
      ${song.titleEn ? `<div class="song-card-en">${esc(song.titleEn)}</div>` : ''}
      <div class="song-card-tags">${tags}</div>
    `;

    card.addEventListener('click', () => openModal(song));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(song); });
    grid.appendChild(card);
  });
}

// ---- Search ----
function setupSearch() {
  const input = document.getElementById('search-input');
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = input.value.trim();
      updateClearButton();
      renderSongs();
    }, 200);
  });
}

// ---- Tag Reference Panel ----
function setupTagReference() {
  const btn = document.getElementById('tag-ref-btn');
  const panel = document.getElementById('tag-reference');

  if (!CONFIG.TAGS) return;

  // Populate panel
  panel.innerHTML = Object.entries(CONFIG.TAGS).map(([category, tags]) => `
    <div class="ref-group">
      <span class="ref-label">${esc(category)}</span>
      <div class="ref-tags">${tags.map(t => `<span class="ref-tag">${esc(t)}</span>`).join('')}</div>
    </div>
  `).join('');

  btn.addEventListener('click', () => {
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    btn.textContent = isOpen ? '标签参考 ▾' : '标签参考 ▴';
  });
}

// ---- Modal ----
function setupModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function openModal(song) {
  document.getElementById('modal-title-cn').textContent = song.title;

  const enEl = document.getElementById('modal-title-en');
  enEl.textContent = song.titleEn;
  enEl.style.display = song.titleEn ? 'block' : 'none';

  const tagsEl = document.getElementById('modal-tags');
  tagsEl.innerHTML = [
    song.type ? `<span class="song-tag type-tag">${esc(song.type)}</span>` : '',
    song.key  ? `<span class="song-tag key-tag">${esc(song.key)}</span>`   : '',
    ...song.themes.map(t    => `<span class="song-tag">${esc(t)}</span>`),
    ...song.occasions.map(t => `<span class="song-tag">${esc(t)}</span>`),
  ].join('');

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

  document.getElementById('modal-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('pdf-frame').src = '';
  document.body.style.overflow = '';
}

// ---- Utils ----
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
