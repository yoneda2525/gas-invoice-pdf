# 手動テスト チェックリスト

Apps Script エディタで実行して確かめる。ダミーデータのみ使う。

## 準備
- [ ] 新しいスプレッドシートを作り、拡張機能 → Apps Script に `src/*.js` を全部貼る
- [ ] `setupDemo` を1回実行（権限を許可）。「設定」「明細」「ひな形」シートができる

## シート読み書き（sheet.js）
- [ ] `Logger.log(readSettings(SpreadsheetApp.getActive()))` で設定5項目が出る
- [ ] `Logger.log(readDetailRows(SpreadsheetApp.getActive()))` で明細の行数分の Row が出て、`rowIndex` がシートの行番号と一致
- [ ] `writeStatus(SpreadsheetApp.getActive(), [2], 'テスト', null)` で2行目のH列に「テスト」、I列が空

## PDF作成（pdf.js）
- [ ] 見本データで PDF を作り、金額が合う
  - INV-0001（10%のみ）：小計 30,000 / 税 3,000 / 合計 33,000
  - INV-0002（8%混在）：8%小計 12,500 / 税 1,000、10%小計 1,500 / 税 150、合計 15,150。食材の行に「8%※」
  - INV-0003（値引き行あり）：小計 13,500 / 税 1,350 / 合計 14,850
- [ ] 「請求書」フォルダが無い状態から作られる
- [ ] 実行後、`tmp_…` シートが残っていない
- [ ] PDFが A4 縦1枚に収まり、枠線（グリッド）が出ていない
