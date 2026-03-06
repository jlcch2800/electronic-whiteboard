# 驗證 Excel 匯出格式

- [x] 啟動開發伺服器
- [/] 分析現有 Excel 匯出邏輯
    - [x] 搜尋 `xlsx` 和 `file-saver` 的使用位置
    - [x] 檢查 `SystemExecutionLogClient.tsx` (發現 Array Snapshot 匯出格式不正確，需修正)
    - [x] 檢查 `SystemChangeLogClient.tsx` (邏輯一致)
    - [x] 檢查 `WorkReportClient.tsx` (邏輯正確)
- [x] 修正 & 驗證匯出功能
    - [x] 修正 `SystemExecutionLogClient.tsx` 的 `handleExportDetail` 以支援陣列快照
    - [x] 驗證修正後的匯出
    - [x] 檢查欄位名稱翻譯 (Traditional Chinese)
    - [x] 檢查資料格式 (Date, boolean, etc.)
    - [x] 確保檔案下載正常
    - [ ] 檢查欄位名稱翻譯 (Traditional Chinese)
    - [ ] 檢查資料格式 (Date, boolean, etc.)
    - [ ] 確保檔案下載正常
