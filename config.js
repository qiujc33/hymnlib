const CONFIG = {
  // After publishing your Google Sheet as CSV:
  // File → Share → Publish to web → Sheet1 → CSV → copy link → paste here
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNihr9_fMK-UFsRZ4NH7Q9gfARwHJB8uFNj2Vm2JXKYGOlxX5-fLPLnbcOOhu7lg4E9zx_-qxNrxAP/pub?gid=0&single=true&output=csv',

  // ---------------------------------------------------------------
  // SHEET COLUMNS (row 1 must have exactly these headers):
  //   标题 | 英文标题 | 调 | 类型 | 主题 | 场合 | PDF链接 | 备注
  //
  // PDF链接  → filename only, e.g.  主祷文.pdf
  // 主题/场合 → semicolon-separated, e.g.  敬拜;感恩
  // ---------------------------------------------------------------

  // TAG REFERENCE — use these exact tag names in the sheet.
  // Each tag maps to a short description; this doubles as the glossary shown in
  // the 标签参考 panel, so keep the descriptions reader-facing.
  //
  // Design: 主题 = WHAT a song is about (the topical index, like a hymnal's
  //         subject index); 场合 = WHEN you'd sing it (church year + life events).
  //         Calendar seasons live in 场合 only, never as themes.
  TAGS: {
    类型: {
      '圣诗': '传统圣诗',
      '现代': '现代敬拜诗歌',
    },
    主题: {
      '敬拜': '敬拜赞美、尊崇神',
      '感恩': '感谢、数算主恩',
      '信靠': '信心、交托、顺服',
      '盼望': '盼望与安慰',
      '救恩': '救恩、福音、恩典',
      '圣灵': '圣灵的同在与工作',
      '认罪': '认罪与悔改',
      '呼召': '呼召、奉献、委身',
      '宣教': '宣教与布道',
    },
    场合: {
      '降临节':     '将临期（圣诞前四周）',
      '圣诞节':     '圣诞节',
      '大斋期':     '预苦期（复活节前四十天）',
      '受难日':     '受难日，纪念主受难',
      '复活节':     '复活节',
      '圣灵降临节': '圣灵降临节（五旬节）',
      '圣餐':       '圣餐礼',
      '洗礼':       '洗礼',
      '婚礼':       '婚礼',
      '葬礼':       '安息礼拜、追思',
    },
  },
};
