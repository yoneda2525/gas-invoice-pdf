/**
 * 請求書の計算・入力チェック（純粋関数のみ）。
 * GAS ではグローバル関数として、Node ではモジュールとして動く。
 */

var TAX_PERCENTS = [10, 8];

/** 税率を 0.1 / 0.08 にそろえる。使えない値なら null。 */
function normalizeTaxRate(value) {
  var pct = null;
  if (typeof value === 'number' && isFinite(value)) {
    // 0.1 のような割合でも、10 のような%の数字でも受け付ける
    pct = value >= 1 ? Math.round(value) : Math.round(value * 100);
  } else if (typeof value === 'string') {
    var m = value.trim().match(/^(\d+)\s*[%％]?$/);
    if (m) pct = Number(m[1]);
  }
  return TAX_PERCENTS.indexOf(pct) >= 0 ? pct / 100 : null;
}

/** 税率ごとの小計・税額（税率ごとに1回だけ切り捨て）と合計。 */
function calcTotals(rows) {
  var byPct = {};
  rows.forEach(function (row) {
    var pct = Math.round(normalizeTaxRate(row.taxRate) * 100);
    byPct[pct] = (byPct[pct] || 0) + Number(row.qty) * Number(row.unitPrice);
  });
  var byRate = TAX_PERCENTS
    .filter(function (pct) { return pct in byPct; })
    .map(function (pct) {
      var subtotal = byPct[pct];
      return { rate: pct / 100, subtotal: subtotal, tax: Math.floor(subtotal * pct / 100) };
    });
  var subtotal = byRate.reduce(function (s, x) { return s + x.subtotal; }, 0);
  var tax = byRate.reduce(function (s, x) { return s + x.tax; }, 0);
  return { byRate: byRate, subtotal: subtotal, tax: tax, total: subtotal + tax };
}

var DONE_STATUS = '作成済み';
var MAX_LINES = 15;
var REQUIRED = [
  ['invoiceNo', '請求番号'], ['date', '請求日'], ['customer', '客名'],
  ['item', '品目'], ['qty', '数量'], ['unitPrice', '単価'], ['taxRate', '税率']
];

function isEmpty(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

function isNum(v) {
  return typeof v === 'number' && isFinite(v);
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/** 日付を「年/月/日」で比べるための文字列に（時刻は無視）。 */
function dateKey(v) {
  if (v instanceof Date) {
    return v.getFullYear() + '/' + pad2(v.getMonth() + 1) + '/' + pad2(v.getDate());
  }
  var m = String(v).trim().match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  return m ? m[1] + '/' + pad2(Number(m[2])) + '/' + pad2(Number(m[3])) : String(v).trim();
}

/** 入力欄（状態以外）がすべて空の行。 */
function isBlankRow(row) {
  return REQUIRED.every(function (f) { return isEmpty(row[f[0]]); });
}

/**
 * 作成済み以外の行を、最初に出た順で請求番号ごとにまとめる。
 * 状態が空・未作成・エラーの行は対象（エラーは直して再実行できる）。
 */
function groupByInvoice(rows) {
  var groups = [];
  var index = {};
  rows.forEach(function (row) {
    if (isBlankRow(row) || String(row.status).trim() === DONE_STATUS) return;
    var key = String(row.invoiceNo).trim();
    if (!(key in index)) {
      index[key] = groups.length;
      groups.push({ invoiceNo: key, rows: [] });
    }
    groups[index[key]].rows.push(row);
  });
  return groups;
}

/** 問題なしなら null、あれば最初のエラー文言。 */
function validateGroup(group) {
  var rows = group.rows;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    for (var j = 0; j < REQUIRED.length; j++) {
      if (isEmpty(row[REQUIRED[j][0]])) return 'エラー：' + REQUIRED[j][1] + 'が空';
    }
    if (!isNum(row.qty)) return 'エラー：数量が数ではありません';
    if (!isNum(row.unitPrice)) return 'エラー：単価が数ではありません';
    if (normalizeTaxRate(row.taxRate) === null) return 'エラー：税率は10%か8%';
  }
  if (rows.length > MAX_LINES) return 'エラー：明細が' + MAX_LINES + '行をこえています';
  for (var k = 1; k < rows.length; k++) {
    if (String(rows[k].customer).trim() !== String(rows[0].customer).trim()) {
      return 'エラー：同じ請求番号で客名がちがいます';
    }
    if (dateKey(rows[k].date) !== dateKey(rows[0].date)) {
      return 'エラー：同じ請求番号で請求日がちがいます';
    }
  }
  return null;
}

/** `請求番号_客名.pdf`。ファイル名に使えない文字は _ に。 */
function makeFileName(invoiceNo, customer) {
  return (String(invoiceNo).trim() + '_' + String(customer).trim())
    .replace(/[\/\\:*?"<>|]/g, '_') + '.pdf';
}

if (typeof module !== 'undefined') {
  module.exports = {
    normalizeTaxRate: normalizeTaxRate, calcTotals: calcTotals,
    isBlankRow: isBlankRow, groupByInvoice: groupByInvoice,
    validateGroup: validateGroup, makeFileName: makeFileName
  };
}
