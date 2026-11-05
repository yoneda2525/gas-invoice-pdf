/**
 * シートの読み書き（GAS専用）。
 */

var SHEET_SETTINGS = '設定';
var SHEET_DETAIL = '明細';
var COL_STATUS = 8; // H列
var COL_PDF = 9;    // I列

var SETTING_KEYS = {
  '自社名': 'companyName',
  '住所': 'address',
  '振込先': 'bankAccount',
  'インボイス登録番号': 'invoiceRegNo',
  '保存フォルダ名': 'folderName'
};

function getSheetOrThrow_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('「' + name + '」シートがありません');
  return sheet;
}

/** 「設定」シートA列の項目名でB列の値を引く。 */
function readSettings(ss) {
  var values = getSheetOrThrow_(ss, SHEET_SETTINGS).getDataRange().getValues();
  var settings = { companyName: '', address: '', bankAccount: '', invoiceRegNo: '', folderName: '請求書' };
  values.forEach(function (r) {
    var key = SETTING_KEYS[String(r[0]).trim()];
    if (key && String(r[1]).trim() !== '') settings[key] = String(r[1]).trim();
  });
  return settings;
}

/** 「明細」シート2行目以降を Row[] に。rowIndex はシートの行番号（1始まり）。 */
function readDetailRows(ss) {
  var values = getSheetOrThrow_(ss, SHEET_DETAIL).getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var v = values[i];
    rows.push({
      rowIndex: i + 1,
      invoiceNo: v[0], date: v[1], customer: v[2], item: v[3],
      qty: v[4], unitPrice: v[5], taxRate: v[6], status: v[7]
    });
  }
  return rows;
}

/** 指定行のH列に状態、I列にPDFリンク（null なら空）を書く。 */
function writeStatus(ss, rowIndexes, status, pdfUrl) {
  var sheet = getSheetOrThrow_(ss, SHEET_DETAIL);
  rowIndexes.forEach(function (rowIndex) {
    var link = pdfUrl ? '=HYPERLINK("' + pdfUrl + '","PDFを開く")' : '';
    sheet.getRange(rowIndex, COL_STATUS, 1, 2).setValues([[status, link]]);
  });
}
