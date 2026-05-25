const state = {
  songs: [],
  activeSong: null,
  filters: {
    theme: new Set(),
    occasion: new Set(),
    key: new Set(),
    language: new Set(),
  },
  search: "",
};

const elements = {
  songList: document.getElementById("songList"),
  themeFilters: document.getElementById("themeFilters"),
  occasionFilters: document.getElementById("occasionFilters"),
  keyFilters: document.getElementById("keyFilters"),
  languageFilters: document.getElementById("languageFilters"),
  searchInput: document.getElementById("searchInput"),
  detailsPane: document.getElementById("detailsPane"),
};

function parseCsv(text) {
  const rows = [];
  const pattern = /(?:\s*"([^"]*(?:""[^"]*)*)"\s*|\s*([^,]*)\s*)(?:,|$)/g;
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return rows;

  const headers = [];
  let match;
  pattern.lastIndex = 0;
  let hLine = lines[0];
  while ((match = pattern.exec(hLine)) && !(match[1] === undefined && match[2] === undefined)) {
    headers.push((match[1] || match[2] || "").trim());
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const row = {};
    pattern.lastIndex = 0;
    let colIndex = 0;
    while ((match = pattern.exec(line)) && !(match[1] === undefined && match[2] === undefined)) {
      const value = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      row[headers[colIndex] || `COL_${colIndex}`] = value ? value.trim() : "";
      colIndex += 1;
    }
    rows.push(row);
  }
  return rows;
}

function parseTags(value) {
  if (!value) return [];
  return value
    .split(/[;,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDriveFileId(url) {
  if (!url) return null;
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{10,})/,
    /id=([a-zA-Z0-9_-]{10,})/,
    /open\?id=([a-zA-Z0-9_-]{10,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  if (/^[a-zA-Z0-9_-]{10,}$/.test(url)) return url;
  return null;
}

function getDrivePreviewUrl(link) {
  const id = getDriveFileId(link);
  if (!id) return link;
  return `https://drive.google.com/file/d/${id}/preview`;
}

function getDriveDownloadUrl(link) {
  const id = getDriveFileId(link);
  if (!id) return link;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

function normalizeSong(raw) {
  return {
    title: raw["Title"] || raw["名称"] || raw["Song"] || "",
    chineseTitle: raw["Chinese Title"] || raw["中文名称"] || raw["中文标题"] || "",
    key: raw["Key"] || raw["调性"] || "",
    theme: parseTags(raw["Theme"] || raw["主题"] || ""),
    occasion: parseTags(raw["Occasion"] || raw["场合"] || ""),
    language: (raw["Language"] || raw["语言"] || "").trim(),
    pdfLink: raw["PDF Link"] || raw["PDF 链接"] || raw["Pdf Link"] || "",
    notes: raw["Notes"] || raw["备注"] || "",
  };
}

function collectValues(songs, key) {
  const values = new Set();
  songs.forEach((song) => {
    const field = song[key];
    if (Array.isArray(field)) {
      field.forEach((item) => values.add(item));
    } else if (field) {
      values.add(field);
    }
  });
  return [...values].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function updateFilters(songs) {
  const themeValues = collectValues(songs, "theme");
  const occasionValues = collectValues(songs, "occasion");
  const keyValues = collectValues(songs, "key");
  const languageValues = collectValues(songs, "language");

  renderFilterButtons(themeValues, "theme", elements.themeFilters);
  renderFilterButtons(occasionValues, "occasion", elements.occasionFilters);
  renderFilterButtons(keyValues, "key", elements.keyFilters);
  renderFilterButtons(languageValues, "language", elements.languageFilters);
}

function renderFilterButtons(values, category, container) {
  container.innerHTML = "";
  if (values.length === 0) {
    container.innerHTML = `<span class="hint">暂无</span>`;
    return;
  }
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.textContent = value;
    if (state.filters[category].has(value)) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      if (state.filters[category].has(value)) {
        state.filters[category].delete(value);
      } else {
        state.filters[category].add(value);
      }
      renderSongList();
      renderSelectedSong();
      updateFilters(state.songs);
    });
    container.appendChild(button);
  });
}

function matchesFilters(song) {
  const { theme, occasion, key, language } = state.filters;
  if (theme.size && !song.theme.some((value) => theme.has(value))) return false;
  if (occasion.size && !song.occasion.some((value) => occasion.has(value))) return false;
  if (key.size && song.key && !key.has(song.key)) return false;
  if (language.size && song.language && !language.has(song.language)) return false;
  return true;
}

function matchesSearch(song) {
  if (!state.search) return true;
  const query = state.search.toLowerCase();
  const text = [song.title, song.chineseTitle, song.key, song.language, song.notes]
    .concat(song.theme, song.occasion)
    .join(" ")
    .toLowerCase();
  return text.includes(query);
}

function getFilteredSongs() {
  return state.songs.filter((song) => matchesFilters(song) && matchesSearch(song));
}

function renderSongList() {
  const songs = getFilteredSongs();
  elements.songList.innerHTML = "";
  if (songs.length === 0) {
    elements.songList.innerHTML = `<p class="hint">没有符合条件的歌曲。请调整筛选或搜索关键词。</p>`;
    return;
  }

  songs.forEach((song, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "song-card";
    if (state.activeSong === song) card.classList.add("active");

    card.innerHTML = `
      <h3>${song.title || "未命名歌曲"}</h3>
      <p>${song.chineseTitle || "无中文标题"}</p>
      <div class="meta-list">
        ${song.key ? `<span class="meta-pill">调：${song.key}</span>` : ""}
        ${song.language ? `<span class="meta-pill">语：${song.language}</span>` : ""}
      </div>
      <div class="meta-list">
        ${song.theme.map((item) => `<span class="meta-pill">${item}</span>`).join("")}
        ${song.occasion.map((item) => `<span class="meta-pill">${item}</span>`).join("")}
      </div>
    `;

    card.addEventListener("click", () => {
      state.activeSong = song;
      renderSongList();
      renderSelectedSong();
    });

    elements.songList.appendChild(card);
  });
}

function renderSelectedSong() {
  if (!state.activeSong) return;
  const song = state.activeSong;
  const previewUrl = getDrivePreviewUrl(song.pdfLink);
  const downloadUrl = getDriveDownloadUrl(song.pdfLink);

  elements.detailsPane.innerHTML = `
    <div class="details-inner">
      <div class="details-top">
        <div>
          <h3>${song.title || "未命名歌曲"}</h3>
          <p>${song.chineseTitle || "暂无中文标题"}</p>
        </div>
        <div class="details-actions">
          <a class="primary-button" href="${downloadUrl}" target="_blank" rel="noreferrer">下载 PDF</a>
        </div>
      </div>
      <div class="meta-list">
        ${song.key ? `<span class="meta-pill">调：${song.key}</span>` : ""}
        ${song.language ? `<span class="meta-pill">语：${song.language}</span>` : ""}
        ${song.theme.map((item) => `<span class="meta-pill">${item}</span>`).join("")}
        ${song.occasion.map((item) => `<span class="meta-pill">${item}</span>`).join("")}
      </div>
      <iframe class="pdf-frame" src="${previewUrl}"></iframe>
    </div>
  `;
}

function renderError(message) {
  elements.songList.innerHTML = `<p class="hint">${message}</p>`;
  elements.detailsPane.innerHTML = `<div class="details-empty"><p>${message}</p></div>`;
}

function registerEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderSongList();
  });
}

async function loadSongs() {
  if (!CONFIG.sheetCsvUrl || CONFIG.sheetCsvUrl.includes("REPLACE_WITH_YOUR_GOOGLE_SHEETS_CSV_URL")) {
    renderError("请先在 assets/js/config.js 中填写 Google Sheets 的 CSV 链接。\n参考 README 中的说明。");
    return;
  }

  try {
    const response = await fetch(CONFIG.sheetCsvUrl);
    if (!response.ok) throw new Error("无法加载 Google Sheets CSV。请确认链接已正确发布。");
    const csvText = await response.text();
    const rawRows = parseCsv(csvText);
    state.songs = rawRows.map(normalizeSong).filter((song) => song.title || song.chineseTitle);
    if (state.songs.length === 0) {
      renderError("未从 Google Sheets 读取到有效歌曲。请检查表格标题是否正确。支持标题：Title、Chinese Title、Key、Theme、Occasion、Language、PDF Link。");
      return;
    }
    updateFilters(state.songs);
    renderSongList();
  } catch (error) {
    renderError(error.message || "加载歌曲失败，请检查网络和配置。");
  }
}

function init() {
  registerEvents();
  loadSongs();
}

init();
