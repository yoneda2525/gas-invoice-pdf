const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTaxRate, calcTotals } = require('../src/calc.js');

const r = (qty, unitPrice, taxRate) => ({ qty, unitPrice, taxRate });

test('normalizeTaxRate accepts number and string forms', () => {
  assert.equal(normalizeTaxRate(0.1), 0.1);
  assert.equal(normalizeTaxRate(0.08), 0.08);
  assert.equal(normalizeTaxRate('10%'), 0.1);
  assert.equal(normalizeTaxRate('8%'), 0.08);
  assert.equal(normalizeTaxRate(0.05), null);
  assert.equal(normalizeTaxRate(''), null);
});

test('10% only', () => {
  assert.deepEqual(calcTotals([r(1, 30000, 0.1)]), {
    byRate: [{ rate: 0.1, subtotal: 30000, tax: 3000 }],
    subtotal: 30000, tax: 3000, total: 33000 });
});

test('mixed rates, floor once per rate', () => {
  // 10%: 333+333=666 -> tax floor(66.6)=66 ; 8%: 125 -> floor(10)=10
  const t = calcTotals([r(1, 333, '10%'), r(1, 333, 0.1), r(1, 125, 0.08)]);
  assert.deepEqual(t.byRate, [
    { rate: 0.1, subtotal: 666, tax: 66 },
    { rate: 0.08, subtotal: 125, tax: 10 }]);
  assert.equal(t.total, 666 + 125 + 66 + 10);
});

test('discount line (negative unit price) reduces subtotal', () => {
  const t = calcTotals([r(1, 10000, 0.1), r(1, -1000, 0.1)]);
  assert.equal(t.subtotal, 9000);
  assert.equal(t.tax, 900);
});

const { isBlankRow, groupByInvoice, validateGroup, makeFileName } = require('../src/calc.js');
const row = (o = {}) => ({ rowIndex: 2, invoiceNo: 'INV-1', date: '2026/11/05',
  customer: '株式会社サンプル', item: '保守', qty: 1, unitPrice: 1000,
  taxRate: 0.1, status: '未作成', ...o });

test('groupByInvoice skips blank rows and non-pending rows, keeps order', () => {
  const blank = { rowIndex: 3, invoiceNo: '', date: '', customer: '', item: '',
    qty: '', unitPrice: '', taxRate: '', status: '' };
  const g = groupByInvoice([row({ invoiceNo: 'B' }), blank,
    row({ invoiceNo: 'A' }), row({ invoiceNo: 'B' }), row({ invoiceNo: 'C', status: '作成済み' })]);
  assert.deepEqual(g.map(x => [x.invoiceNo, x.rows.length]), [['B', 2], ['A', 1]]);
  assert.equal(isBlankRow(blank), true);
});

test('validateGroup returns null for valid group', () => {
  assert.equal(validateGroup({ invoiceNo: 'INV-1', rows: [row()] }), null);
});

test('validateGroup error messages', () => {
  const v = o => validateGroup({ invoiceNo: 'INV-1', rows: [row(o)] });
  assert.equal(v({ item: '' }), 'エラー：品目が空');
  assert.equal(v({ qty: 'abc' }), 'エラー：数量が数ではありません');
  assert.equal(v({ unitPrice: 'x' }), 'エラー：単価が数ではありません');
  assert.equal(v({ taxRate: '5%' }), 'エラー：税率は10%か8%');
});

test('validateGroup: over 15 rows, mixed customer, mixed date', () => {
  assert.equal(validateGroup({ invoiceNo: 'INV-1', rows: Array(16).fill(row()) }),
    'エラー：明細が15行をこえています');
  assert.equal(validateGroup({ invoiceNo: 'INV-1', rows: [row(), row({ customer: '別社' })] }),
    'エラー：同じ請求番号で客名がちがいます');
  assert.equal(validateGroup({ invoiceNo: 'INV-1', rows: [row(), row({ date: '2026/11/06' })] }),
    'エラー：同じ請求番号で請求日がちがいます');
});

test('makeFileName replaces unsafe chars', () => {
  assert.equal(makeFileName('INV-1', 'A/B:C*D'), 'INV-1_A_B_C_D.pdf');
});

test('groupByInvoice retries rows with empty or error status', () => {
  const g = groupByInvoice([row({ invoiceNo: 'X', status: '' }),
    row({ invoiceNo: 'Y', status: 'エラー：品目が空' })]);
  assert.deepEqual(g.map(x => x.invoiceNo), ['X', 'Y']);
});

test('normalizeTaxRate accepts plain 10 / 8 and "10"', () => {
  assert.equal(normalizeTaxRate(10), 0.1);
  assert.equal(normalizeTaxRate(8), 0.08);
  assert.equal(normalizeTaxRate('10'), 0.1);
  assert.equal(normalizeTaxRate(5), null);
});

test('validateGroup compares dates by calendar day', () => {
  const morning = new Date(2026, 10, 5, 9, 30);
  const midnight = new Date(2026, 10, 5);
  assert.equal(validateGroup({ invoiceNo: 'INV-1',
    rows: [row({ date: morning }), row({ date: midnight })] }), null);
  assert.equal(validateGroup({ invoiceNo: 'INV-1',
    rows: [row({ date: morning }), row({ date: '2026/11/05' })] }), null);
  assert.equal(validateGroup({ invoiceNo: 'INV-1',
    rows: [row({ date: morning }), row({ date: new Date(2026, 10, 6) })] }),
    'エラー：同じ請求番号で請求日がちがいます');
});
