const CONFIG = {
  // 将下面的 URL 替换为已经“发布到网站”的 Google Sheets CSV 链接：
  // 例如：https://docs.google.com/spreadsheets/d/e/XXXXXXXXXXXXXX/pub?output=csv
  sheetCsvUrl: "REPLACE_WITH_YOUR_GOOGLE_SHEETS_CSV_URL",

  // Google Drive PDF 预览图链接的默认文本。
  sheetInstruction: {
    title: "请先创建 Google Sheet，并将其“发布到网站”作为 CSV。",
    body: "每首歌一行，列标题必须包含 Title、Chinese Title、Key、Theme、Occasion、Language、PDF Link。标签建议用分号 ; 分隔。"
  }
};
