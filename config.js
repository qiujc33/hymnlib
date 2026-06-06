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

  // TAG REFERENCE — use these exact values in the sheet
  //
  // Design: 主题 = WHAT a song is about (the topical index, like a hymnal's
  //         subject index); 场合 = WHEN you'd sing it (church year + life events).
  //         Calendar seasons live in 场合 only, never as themes.
  TAGS: {
    类型: [
      '会众',   // Congregational worship song
      '诗班',   // Choir piece
      '礼仪',   // Liturgical — Lord's Prayer, doxology, call to worship, etc.
      '圣诗',   // Traditional hymn
      '现代',   // Contemporary worship song
    ],
    主题: [
      '敬拜',   // Worship & praise — adoration + celebration (merged: the line never held)
      '感恩',   // Thanksgiving / gratitude
      '信靠',   // Trust / faith / surrender
      '盼望',   // Hope / comfort
      '救恩',   // Salvation / gospel / grace
      '圣灵',   // Holy Spirit
      '认罪',   // Confession / repentance
      '呼召',   // Call / dedication / consecration
      '宣教',   // Mission / evangelism
    ],
    场合: [
      '将临期',       // Advent season
      '圣诞节',       // Christmas
      '大斋期',       // Lent
      '受难日',       // Good Friday
      '复活节',       // Easter
      '圣灵降临节',   // Pentecost
      '圣餐',         // Communion
      '洗礼',         // Baptism
      '婚礼',         // Wedding
      '葬礼',         // Funeral / memorial
    ],
  },
};
