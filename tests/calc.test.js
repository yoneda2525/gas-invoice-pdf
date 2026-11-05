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
