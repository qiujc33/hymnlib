const CONFIG = {
  // After publishing your Google Sheet as CSV:
  // File → Share → Publish to web → Sheet1 → CSV → copy link → paste here
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNihr9_fMK-UFsRZ4NH7Q9gfARwHJB8uFNj2Vm2JXKYGOlxX5-fLPLnbcOOhu7lg4E9zx_-qxNrxAP/pub?gid=0&single=true&output=csv',

  // ---------------------------------------------------------------
  // SHEET COLUMNS (row 1 must have exactly these headers):
  //   标题 | 英文标题 | 调 | 类型 | 主题 | 聚会环节 | 节期场合 | PDF链接 | 音频链接 | 备注
  //
  // PDF链接  → filename only, e.g.  主祷文.pdf      (served from scores/)
  // 音频链接 → filename only, e.g.  主祷文.mp3      (served from audio/, optional)
  // 主题/聚会环节/节期场合 → semicolon-separated, e.g.  神的属性;感恩
  // ---------------------------------------------------------------

  // TAG REFERENCE — use these exact tag names in the sheet.
  // Each tag maps to a short description; this doubles as the glossary shown in
  // the 标签参考 panel, so keep the descriptions reader-facing.
  //
  // Design: 主题 = WHAT the lyrics are about; 聚会环节 = WHERE the song normally
  //         functions in a service; 节期场合 = WHEN it has a specific season/occasion.
  TAGS: {
    类型: {
      '传统圣诗': '历史圣诗传统，通常以分节诗歌及固定曲调传唱',
      '现代敬拜': '现代会众敬拜曲目，通常采用主歌、副歌、桥段等结构',
    },
    主题: {
      '神的属性': '神的圣洁、荣耀、主权、慈爱、信实与配得',
      '创造护理': '神的创造、供应、保守与治理',
      '救恩恩典': '恩典、赦免、救赎、和好与新生命',
      '十架受难': '基督的受难、十字架、宝血与牺牲',
      '复活得胜': '基督复活并胜过罪与死亡',
      '圣灵': '圣灵的位格、同在、引导、果子与工作',
      '神的话语': '圣经、神的启示、聆听与遵行真道',
      '祷告亲近': '寻求、祈求、代祷、等候并与神相交',
      '认罪更新': '认罪、悔改、洁净与生命更新',
      '感恩': '感谢并记念神的恩典与作为',
      '信靠顺服': '倚靠、交托、顺服并安息于神',
      '盼望安慰': '患难中的安慰、忍耐与对神应许的盼望',
      '委身门徒': '献身、跟随基督、成圣、服事与门徒生命',
      '教会合一': '基督的身体、团契、彼此相爱与合一',
      '宣教福音': '见证、布道、差传、万民与传扬基督',
      '再临永恒': '基督再来、复活、审判、天家与永恒',
    },
    聚会环节: {
      '宣召开场': '招聚会众、宣告聚会目的并开始崇拜',
      '欢庆赞美': '以喜乐、宣告与感谢带领会众共同颂赞',
      '尊崇敬拜': '持续专注于神，以尊崇、亲近、祷告或降服回应',
      '安静祷告': '适合默想、认罪、祈求、代祷、等候或安静亲近',
      '证道回应': '在信息后引导悔改、信靠、顺服或委身',
      '奉献': '适合奉献时表达感恩、管家职分或献上生命与资源',
      '圣餐': '适合在圣餐前后记念基督并回应恩约',
      '差遣结束': '差遣会众进入见证、服事、门徒生活或结束聚会',
    },
    节期场合: {
      '将临期': '等候基督降临并预备迎接主',
      '圣诞节': '基督降生与道成肉身',
      '主显节': '基督向万民显现',
      '大斋期': '悔改、自省并预备纪念基督受难复活',
      '棕枝主日': '基督进入耶路撒冷并走向受难',
      '受难日': '纪念基督被钉十字架与受死',
      '复活节': '庆祝基督复活',
      '升天日': '基督升天并在天掌权',
      '圣灵降临节': '圣灵降临并建立、装备教会',
      '三一主日': '明确颂赞圣父、圣子、圣灵',
      '洗礼': '洗礼、新生命与信仰告白',
      '安息礼拜': '安息礼拜、哀伤、复活盼望与安葬',
    },
  },
};
