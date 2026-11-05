/**
 * ひな形に値を流し込み、PDFにしてDriveへ保存する（GAS専用）。
 */

var SHEET_TEMPLATE = 'ひな形';

var TEMPLATE_CELLS = {
  invoiceNo: 'F2',
  date: 'F3',
  customer: 'B4',
  companyName: 'F5',
  address: 'F6',
  invoiceRegNo: 'F7',
  lineFirstRow: 12,  // 明細 12〜26行
  lineCols: { item: 2, qty: 4, unitPrice: 5, taxRate: 6, amount: 7 }, // B,D,E,F,G
  subtotal10: 'G28',
  tax10: 'G29',
  subtotal8: 'G30',
  tax8: 'G31',
  total: 'G33',
  bankAccount: 'B35'
};

function formatDate_(ss, v) {
  return v instanceof Date
    ? Utilities.formatDate(v, ss.getSpreadsheetTimeZone(), 'yyyy/MM/dd')
    : String(v);
}

function rateLabel_(rate) {
  // 軽減税率(8%)の明細には ※ を付ける（インボイスの記載要件）
  return rate === 0.08 ? '8%※' : '10%';
}

function findRate_(totals, rate) {
  var hit = totals.byRate.filter(function (x) { return x.rate === rate; })[0];
  return hit || { subtotal: 0, tax: 0 };
}

function fillTemplate_(ss, sheet, settings, group, totals) {
  var c = TEMPLATE_CELLS;
  var first = group.rows[0];
  sheet.getRange(c.invoiceNo).setValue(group.invoiceNo);
  sheet.getRange(c.date).setValue(formatDate_(ss, first.date));
  sheet.getRange(c.customer).setValue(String(first.customer).trim() + ' 御中');
  sheet.getRange(c.companyName).setValue(settings.companyName);
  sheet.getRange(c.address).setValue(settings.address);
  sheet.getRange(c.invoiceRegNo).setValue(settings.invoiceRegNo);
  sheet.getRange(c.bankAccount).setValue(settings.bankAccount);

  group.rows.forEach(function (row, i) {
    var r = c.lineFirstRow + i;
    var rate = normalizeTaxRate(row.taxRate);
    sheet.getRange(r, c.lineCols.item).setValue(row.item);
    sheet.getRange(r, c.lineCols.qty).setValue(row.qty);
    sheet.getRange(r, c.lineCols.unitPrice).setValue(row.unitPrice);
    sheet.getRange(r, c.lineCols.taxRate).setValue(rateLabel_(rate));
    sheet.getRange(r, c.lineCols.amount).setValue(row.qty * row.unitPrice);
  });

  var r10 = findRate_(totals, 0.1);
  var r8 = findRate_(totals, 0.08);
  sheet.getRange(c.subtotal10).setValue(r10.subtotal);
  sheet.getRange(c.tax10).setValue(r10.tax);
  sheet.getRange(c.subtotal8).setValue(r8.subtotal);
  sheet.getRange(c.tax8).setValue(r8.tax);
  sheet.getRange(c.total).setValue(totals.total);
}

function exportSheetPdf_(ss, sheet, fileName) {
  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export' +
    '?format=pdf&gid=' + sheet.getSheetId() +
    '&portrait=true&size=A4&fitw=true&gridlines=false' +
    '&sheetnames=false&printtitle=false&pagenumbers=false';
  var res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('PDF化に失敗（HTTP ' + res.getResponseCode() + '）');
  }
  return res.getBlob().setName(fileName);
}

function getOrCreateFolder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/** 1請求分のPDFを作り、そのURLを返す。失敗時は例外。 */
function createInvoicePdf(ss, settings, group) {
  var template = ss.getSheetByName(SHEET_TEMPLATE);
  if (!template) throw new Error('「' + SHEET_TEMPLATE + '」シートがありません');
  var totals = calcTotals(group.rows);
  var fileName = makeFileName(group.invoiceNo, group.rows[0].customer);
  var copy = template.copyTo(ss).setName('tmp_' + Date.now());
  try {
    copy.showSheet();
    fillTemplate_(ss, copy, settings, group, totals);
    SpreadsheetApp.flush();
    var blob = exportSheetPdf_(ss, copy, fileName);
    var file = getOrCreateFolder_(settings.folderName).createFile(blob);
    return file.getUrl();
  } finally {
    ss.deleteSheet(copy);
  }
}
