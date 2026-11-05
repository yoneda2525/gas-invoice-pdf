/**
 * メニュー登録と全体の流れ（GAS専用）。
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('請求書')
    .addItem('PDF作成', 'createInvoices')
    .addSeparator()
    .addItem('ひな形を最新にする', 'updateTemplate')
    .addItem('見本シートを作る', 'setupDemo')
    .addToUi();
}

function createInvoices() {
  var ss = SpreadsheetApp.getActive();
  var settings = readSettings(ss);
  var groups = groupByInvoice(readDetailRows(ss));
  var ok = 0;
  var ng = 0;

  groups.forEach(function (group) {
    var rowIndexes = group.rows.map(function (r) { return r.rowIndex; });
    var error = validateGroup(group);
    if (error) {
      writeStatus(ss, rowIndexes, error, null);
      ng++;
      return;
    }
    try {
      if (ok > 0) Utilities.sleep(EXPORT_INTERVAL_MS); // 連続PDF化の制限よけ
      var url = createInvoicePdf(ss, settings, group);
      writeStatus(ss, rowIndexes, DONE_STATUS, url);
      ok++;
    } catch (e) {
      writeStatus(ss, rowIndexes, 'エラー：' + (e && e.message ? e.message : e), null);
      ng++;
    }
  });

  SpreadsheetApp.getUi().alert('作成 ' + ok + '件、エラー ' + ng + '件');
}
