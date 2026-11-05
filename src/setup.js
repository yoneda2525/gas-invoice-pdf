/**
 * 見本用の「設定」「明細」「ひな形」シートを作る（GAS専用）。1回だけ実行。
 * データはすべてダミー。
 */

function setupDemo() {
  var ss = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();
  var detail = ss.getSheetByName('明細');
  if (detail && detail.getLastRow() > 1) {
    ui.alert('「明細」シートにデータがあるため、見本シートは作りません。\n' +
      '見本を作るときは、新しいスプレッドシートで実行してください。');
    return;
  }
  var answer = ui.alert('「設定」「明細」「ひな形」シートを見本の内容で作り直します。よろしいですか？',
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  setupSettings_(ss);
  setupDetail_(ss);
  setupTemplate_(ss);
  SpreadsheetApp.getUi().alert('見本シートを作りました。メニュー「請求書 → PDF作成」を試してください。');
}

function freshSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function setupSettings_(ss) {
  var s = freshSheet_(ss, '設定');
  s.getRange(1, 1, 5, 2).setValues([
    ['自社名', 'サンプル商事（ダミー）'],
    ['住所', '〒000-0000 架空県架空市1-2-3'],
    ['振込先', 'サンプル銀行 本店 普通 0000000 サンプルショウジ'],
    ['インボイス登録番号', 'T0000000000000'],
    ['保存フォルダ名', '請求書']
  ]);
  s.setColumnWidth(1, 160).setColumnWidth(2, 360);
}

function setupDetail_(ss) {
  var s = freshSheet_(ss, '明細');
  var header = ['請求番号', '請求日', '客名', '品目', '数量', '単価', '税率', '状態', 'PDFリンク'];
  var now = new Date();
  var d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 時刻なし
  var rows = [
    ['INV-0001', d, '株式会社ダミーA', 'Webサイト保守（月額）', 1, 30000, 0.1, '未作成', ''],
    ['INV-0002', d, 'ダミー食堂', '業務用食材', 10, 1250, 0.08, '未作成', ''],
    ['INV-0002', d, 'ダミー食堂', '配送料', 1, 1500, 0.1, '未作成', ''],
    ['INV-0003', d, 'ダミー工房', 'スプレッドシート自動化', 1, 15000, 0.1, '未作成', ''],
    ['INV-0003', d, 'ダミー工房', '初回値引き', 1, -1500, 0.1, '未作成', ''],
    ['INV-0004', d, 'ダミー書店', '', 1, 5000, 0.1, '未作成', '']
  ];
  s.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#eef2f7');
  s.getRange(2, 1, rows.length, header.length).setValues(rows);
  s.getRange('B2:B').setNumberFormat('yyyy/MM/dd');
  s.getRange('F2:F').setNumberFormat('#,##0');
  s.getRange('G2:G').setNumberFormat('0%');
  s.setFrozenRows(1);
  s.autoResizeColumns(1, header.length);
}

/** 「ひな形」シートだけを作り直す。明細・設定のデータには触らない。 */
function updateTemplate() {
  setupTemplate_(SpreadsheetApp.getActive());
  SpreadsheetApp.getUi().alert('「ひな形」シートを最新の見た目に作り直しました。');
}

function setupTemplate_(ss) {
  var s = freshSheet_(ss, 'ひな形');
  s.getRange('A1:G40').breakApart();
  s.setColumnWidth(1, 70).setColumnWidth(2, 220).setColumnWidth(3, 20)
    .setColumnWidth(4, 60).setColumnWidth(5, 110).setColumnWidth(6, 150).setColumnWidth(7, 110);
  s.getRange('A1:G1').merge().setValue('請　求　書').setFontSize(20)
    .setFontWeight('bold').setHorizontalAlignment('center');
  s.getRange('E2').setValue('請求番号');
  s.getRange('E3').setValue('請求日');
  s.getRange('B4').setFontSize(14).setFontWeight('bold');
  s.getRange('E7').setValue('登録番号');
  // 右上の値は文字として左寄せ（日付や番号が勝手に変換・右寄せされないように）
  s.getRange('F2:F7').setNumberFormat('@').setHorizontalAlignment('left');
  s.getRange('B6').setValue('下記のとおりご請求申し上げます。');
  s.getRange('A9').setValue('ご請求金額');
  s.getRange('B9').setFormula('=G33').setNumberFormat('"¥"#,##0').setFontSize(16).setFontWeight('bold');

  s.getRange('A11:G11').setValues([['No', '品目', '', '数量', '単価', '税率', '金額']])
    .setFontWeight('bold').setBackground('#eef2f7');
  for (var i = 0; i < 15; i++) s.getRange(12 + i, 1).setValue(i + 1);
  // 品目は B:C をつなげて1つの欄に（空き列をなくす）
  for (var r = 11; r <= 26; r++) s.getRange(r, 2, 1, 2).merge();
  // 税率は文字のまま中央に
  s.getRange('F11:F26').setHorizontalAlignment('center');
  s.getRange('F12:F26').setNumberFormat('@');
  s.getRange('A11:G26').setBorder(true, true, true, true, true, true);
  s.getRange('E12:E26').setNumberFormat('#,##0');
  s.getRange('G12:G26').setNumberFormat('#,##0');

  s.getRange('E28:E31').setValues([['10%対象 小計'], ['消費税（10%）'], ['8%対象 小計'], ['消費税（8%）']]);
  s.getRange('E33').setValue('合計').setFontWeight('bold');
  s.getRange('G28:G33').setNumberFormat('#,##0');
  s.getRange('G33').setFontWeight('bold');
  s.getRange('A34').setValue('※は軽減税率（8%）対象');
  s.getRange('A35').setValue('振込先');
  s.getRange('A1:G35').setFontFamily('Noto Sans JP');
  s.hideSheet();
}
