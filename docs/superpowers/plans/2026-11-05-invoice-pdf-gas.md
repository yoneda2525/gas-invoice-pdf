# 見本1：請求書PDF自動作成（GAS） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Googleスプレッドシートの明細から、インボイス対応の請求書PDFを請求番号ごとに自動作成するGASを作る。

**Architecture:** 計算・入力チェック・グループ化は純粋関数として `src/calc.js` に置き、Node標準テスト（`node:test`）でTDDする。シート読み書き（`sheet.js`）、PDF化（`pdf.js`）、全体の流れ（`main.js`）はGAS専用で、手動チェックリストで確認する。

**Tech Stack:** Google Apps Script（V8）、Node.js 22（`node:test`, `node:assert/strict`）。追加パッケージなし。

**Spec:** `docs/superpowers/specs/2026-11-05-invoice-pdf-gas-design.md`

## Global Constraints

- 追加パッケージを入れない（ネット制限あり）。テストは `node --test tests/` で回す。
- GASには `require` がない。`src/*.js` はグローバル関数として書く。`calc.js` だけ末尾に `if (typeof module !== 'undefined') module.exports = { ... };` を付ける。
- 税率は 10% と 8% のみ。内部表現は数値 `0.1` / `0.08`。
- 税額は税率ごとに1回だけ切り捨て（`Math.floor`）。
- 明細は1請求につき最大15行。
- 状態の値：`未作成` / `作成済み` / `エラー：…`（全角コロン）。
- ファイル名：`請求番号_客名.pdf`。
- ダミーデータのみ。本物の会社名・個人情報を使わない。

## Review Focus

1. 税率セルが数値 `0.1` でも文字列 `"10%"` でも来る → 両方受け付ける（Task 1 でテスト）。
2. 同じ請求番号で客名や請求日がちがう → その請求をエラーにする（Task 2 でテスト）。
3. 値引き行（単価がマイナス）→ 受け付けて小計から引く（Task 1 でテスト）。
4. 明細シートに完全な空行がある → エラーにせず黙って飛ばす（Task 2 でテスト）。
5. 客名に `/ \ : * ? " < > |` がある → ファイル名では `_` に置き換える（Task 2 でテスト）。

---

## 共通の型（`src/calc.js` で使う）

```js
// Row（明細1行）
{ rowIndex: number,     // シート上の行番号（1始まり）
  invoiceNo: string, date: Date|string, customer: string,
  item: string, qty: any, unitPrice: any, taxRate: any, status: string }

// Group
{ invoiceNo: string, rows: Row[] }

// Totals
{ byRate: [{ rate: number, subtotal: number, tax: number }], // rate降順（0.1→0.08）、行が無い税率は含めない
  subtotal: number, tax: number, total: number }
```

---

### Task 1: 金額計算 `calc.js`

**Files:**
- Create: `src/calc.js`
- Create: `tests/calc.test.js`
- Create: `package.json`（`{"name":"invoice-pdf-gas","private":true,"scripts":{"test":"node --test tests/"}}`）

**Interfaces:**
- Produces: `normalizeTaxRate(value: any): number|null`、`calcTotals(rows: Row[]): Totals`

- [ ] **Step 1: 失敗するテストを書く**

```js
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
```

- [ ] **Step 2: 失敗を確認** — Run: `npm test` / Expected: FAIL（`Cannot find module '../src/calc.js'`）

- [ ] **Step 3: `normalizeTaxRate` と `calcTotals` を `src/calc.js` に実装**
  小計は `qty * unitPrice` の合計（数値の検証は Task 2）。小数誤差を避けるため、税額は整数の百分率で `Math.floor(subtotal * pct / 100)`（`pct` は 10 か 8）と計算する。

- [ ] **Step 4: 通過を確認** — Run: `npm test` / Expected: 4 pass

- [ ] **Step 5: Commit** — `git add package.json src/calc.js tests/calc.test.js && git commit -m "feat: 税率別の金額計算"`

---

### Task 2: グループ化・入力チェック・ファイル名

**Files:**
- Modify: `src/calc.js`
- Modify: `tests/calc.test.js`

**Interfaces:**
- Consumes: `normalizeTaxRate`
- Produces:
  - `isBlankRow(row: Row): boolean`
  - `groupByInvoice(rows: Row[]): Group[]` — 空行を除き、状態が `未作成` の行だけを、最初に出た順で請求番号ごとにまとめる
  - `validateGroup(group: Group): string|null` — 問題なしなら `null`、あれば下表の文言
  - `makeFileName(invoiceNo: string, customer: string): string`

エラー文言（最初に見つかった1つを返す）：

| 条件 | 文言 |
|---|---|
| 必須欄が空（請求番号・請求日・客名・品目・数量・単価・税率） | `エラー：{列名}が空` |
| 数量が数でない | `エラー：数量が数ではありません` |
| 単価が数でない | `エラー：単価が数ではありません` |
| 税率が10%/8%以外 | `エラー：税率は10%か8%` |
| 明細が16行以上 | `エラー：明細が15行をこえています` |
| 同じ請求番号で客名がちがう | `エラー：同じ請求番号で客名がちがいます` |
| 同じ請求番号で請求日がちがう | `エラー：同じ請求番号で請求日がちがいます` |

- [ ] **Step 1: 失敗するテストを書く**

```js
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
```

- [ ] **Step 2: 失敗を確認** — Run: `npm test` / Expected: 新しい5件が FAIL
- [ ] **Step 3: 4関数を `src/calc.js` に実装し、`module.exports` に追加**
  請求日の比較は `Date` なら `getTime()`、文字列ならそのまま比較。数かどうかは `typeof v === 'number' && isFinite(v)`。
- [ ] **Step 4: 通過を確認** — Run: `npm test` / Expected: 9 pass
- [ ] **Step 5: Commit** — `git commit -am "feat: グループ化と入力チェック"`

---

### Task 3: シート読み書き `sheet.js`（GAS）

**Files:**
- Create: `src/sheet.js`
- Create: `docs/manual-test.md`（手動テストのチェックリスト。以降のタスクで追記）

**Interfaces:**
- Produces:
  - `readSettings(ss): {companyName, address, bankAccount, invoiceRegNo, folderName}` — 「設定」シートA列の項目名（自社名／住所／振込先／インボイス登録番号／保存フォルダ名）で引く
  - `readDetailRows(ss): Row[]` — 「明細」シート2行目以降。列順は設計書の表どおり（A〜I）
  - `writeStatus(ss, rowIndexes: number[], status: string, pdfUrl: string|null): void` — H列に状態、I列にリンク（null なら空のまま）

- [ ] **Step 1: 3関数を実装**（`getDataRange().getValues()` で一括読み、書き込みは行ごと `setValues`）
- [ ] **Step 2: `docs/manual-test.md` に確認項目を書く**
  - 設定シートの5項目が読める（`Logger.log(readSettings(...))`）
  - 明細3行が Row 3件になり、`rowIndex` がシートの行番号と一致
  - `writeStatus` でH列・I列が書かれる
- [ ] **Step 3: テスト用シートで手動確認し、チェックを付ける**
- [ ] **Step 4: Commit** — `git add src/sheet.js docs/manual-test.md && git commit -m "feat: シート読み書き"`

---

### Task 4: ひな形とPDF化 `pdf.js`（GAS）

**Files:**
- Create: `src/pdf.js`
- Modify: `docs/manual-test.md`

**Interfaces:**
- Consumes: `calcTotals`, `makeFileName`, `readSettings` の戻り値
- Produces: `createInvoicePdf(ss, settings, group: Group): string` — 作ったPDFのURLを返す。失敗時は例外を投げる。

**ひな形「ひな形」シートのセル位置**（`pdf.js` 冒頭に定数 `TEMPLATE_CELLS` として置く。ひな形シートもこの位置で作る）：

| 内容 | セル |
|---|---|
| 請求番号 / 請求日 | F2 / F3 |
| 客名（＋「御中」） | B4 |
| 自社名 / 住所 / 登録番号 | F5 / F6 / F7 |
| 明細（品目B・数量D・単価E・税率F・金額G） | 12〜26行 |
| 10%対象 小計 / 税額 | G28 / G29 |
| 8%対象 小計 / 税額 | G30 / G31 |
| 合計 | G33 |
| 振込先 | B35 |

- [ ] **Step 1: ひな形シートを作る**（見た目を整え、上の位置に枠を置く）
- [ ] **Step 2: `createInvoicePdf` を実装**
  手順：ひな形を `copyTo` → 値を埋める → `SpreadsheetApp.flush()` → そのシートだけを export URL（`format=pdf&gid=<sheetId>&portrait=true&size=A4&gridlines=false`）＋ `ScriptApp.getOAuthToken()` で `UrlFetchApp.fetch` → 保存フォルダ（無ければ作成）に `makeFileName` の名前で保存 → コピーしたシートを `finally` で削除 → `file.getUrl()` を返す。
- [ ] **Step 3: `docs/manual-test.md` に追記し、手動確認**
  - 10%のみ、8%混在、値引き行ありの3請求でPDFを作り、金額が Task 1 の計算と一致
  - フォルダが無い状態から作られる
  - 実行後、コピーしたシートが残っていない
- [ ] **Step 4: Commit** — `git commit -am "feat: ひな形からPDF作成"`（`git add src/pdf.js` も）

---

### Task 5: 全体の流れ `main.js` ＋ README

**Files:**
- Create: `src/main.js`
- Create: `README.md`
- Modify: `docs/manual-test.md`

**Interfaces:**
- Consumes: Task 1〜4 のすべて
- Produces: `onOpen()`（メニュー「請求書 → PDF作成」）、`createInvoices()`

- [ ] **Step 1: `createInvoices` を実装**
  `readSettings` → `readDetailRows` → `groupByInvoice` → 各 group で `validateGroup`。エラーなら全行に `writeStatus(..., エラー文言, null)`。OKなら `createInvoicePdf` を `try/catch` で呼び、成功で `作成済み`＋URL、例外なら `エラー：` ＋ `e.message`。1件こけても続ける。最後に `SpreadsheetApp.getUi().alert('作成 N件、エラー M件')`。
- [ ] **Step 2: `docs/manual-test.md` に追記し、手動確認**
  - 正常2件＋エラー1件で「作成 2件、エラー 1件」
  - もう一度実行しても、作成済みの請求は作り直されない
- [ ] **Step 3: README を書く** — できること、画面画像（PDFとシート）、導入手順（Apps Scriptエディタに `src/*.js` を貼る）、`npm test` の回し方、手動テストへのリンク、コピーして試せる見本シートのリンク欄。ダミーデータのみ。
- [ ] **Step 4: 全体確認** — Run: `npm test` / Expected: 9 pass。`docs/manual-test.md` の全項目にチェック。
- [ ] **Step 5: Commit** — `git add src/main.js README.md docs/manual-test.md && git commit -m "feat: メニューと全体の流れ、README"`
