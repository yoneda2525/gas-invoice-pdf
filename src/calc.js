/**
 * 請求書の計算・入力チェック（純粋関数のみ）。
 * GAS ではグローバル関数として、Node ではモジュールとして動く。
 */

var TAX_PERCENTS = [10, 8];

/** 税率を 0.1 / 0.08 にそろえる。使えない値なら null。 */
function normalizeTaxRate(value) {
  var pct = null;
  if (typeof value === 'number' && isFinite(value)) {
    pct = Math.round(value * 100);
  } else if (typeof value === 'string') {
    var m = value.trim().match(/^(\d+)\s*[%％]$/);
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

if (typeof module !== 'undefined') {
  module.exports = { normalizeTaxRate: normalizeTaxRate, calcTotals: calcTotals };
}
