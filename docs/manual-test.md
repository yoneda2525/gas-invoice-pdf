# 手動テスト チェックリスト

Apps Script エディタで実行して確かめる。ダミーデータのみ使う。

## 準備
- [ ] 新しいスプレッドシートを作り、拡張機能 → Apps Script に `src/*.js` を全部貼る
- [ ] `setupDemo` を1回実行（権限を許可）。「設定」「明細」「ひな形」シートができる

## シート読み書き（sheet.js）
- [ ] `Logger.log(readSettings(SpreadsheetApp.getActive()))` で設定5項目が出る
- [ ] `Logger.log(readDetailRows(SpreadsheetApp.getActive()))` で明細の行数分の Row が出て、`rowIndex` がシートの行番号と一致
- [ ] `writeStatus(SpreadsheetApp.getActive(), [2], 'テスト', null)` で2行目のH列に「テスト」、I列が空
