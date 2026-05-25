const CONFIG = {
  // After publishing your Google Sheet as CSV:
  // File → Share → Publish to web → Sheet1 → CSV → copy link → paste here
  SHEET_CSV_URL: '',

  // ---------------------------------------------------------------
  // TAG REFERENCE — use these exact values when filling the sheet
  // Multiple tags in one cell: separate with semicolons, e.g. 敬拜;感恩
  // ---------------------------------------------------------------
  TAGS: {
    类型: [
      '会众',   // Congregational worship song
      '诗班',   // Choir piece
      '礼仪',   // Liturgical response (Lord's Prayer, doxology, call to worship, etc.)
    ],
    主题: [
      '敬拜',   // Adoration — songs about who God is
      '赞美',   // Praise — celebratory
      '感恩',   // Thanksgiving / gratitude
      '信靠',   // Trust / faith / surrender
      '盼望',   // Hope / comfort
      '救恩',   // Salvation / gospel / grace
      '圣灵',   // Holy Spirit
      '认罪',   // Confession / repentance
      '呼召',   // Call / dedication / consecration
      '降临',   // Incarnation / Christmas themes
      '复活',   // Resurrection / Easter themes
      '宣教',   // Mission / evangelism
    ],
    场合: [
      '主日崇拜',     // Sunday service
      '圣餐',         // Communion
      '将临期',       // Advent season
      '圣诞节',       // Christmas
      '大斋期',       // Lent
      '受难日',       // Good Friday
      '复活节',       // Easter
      '圣灵降临节',   // Pentecost
      '洗礼',         // Baptism
      '婚礼',         // Wedding
      '葬礼',         // Funeral / memorial
      '小组',         // Small group / cell group
    ],
  },
};
