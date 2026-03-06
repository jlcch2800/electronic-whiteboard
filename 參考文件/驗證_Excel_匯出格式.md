# 驗證 Excel 匯出格式

## 變更摘要

本任務主要目標是驗證並修正系統中的 Excel 匯出功能，特別針對「系統執行記錄」(System Execution Log) 中陣列快照資料的匯出格式進行了優化。

### 主要變更
1.  **修正 `SystemExecutionLogClient.tsx`**：
    *   更新 `handleExportDetail` 函式。
    *   增加對 `new_data` 為陣列（Array）時的判斷邏輯。
    *   將陣列資料轉換為易讀的表格格式匯出，包含自動產生的欄位標題與對應數值。
    *   修正了原先陣列資料被視為一般物件比對，導致 Excel 內容顯示不直觀的問題。

2.  **驗證其他組件**：
    *   確認 `SystemChangeLogClient.tsx` 的匯出邏輯適用於單筆異動比對，無須調整。
    *   確認 `WorkReportClient.tsx` 的匯出邏輯正常，無須調整。

## 驗證結果

### 1. 系統執行記錄 (System Execution Log)
- **測試項目**：匯出含有「待處理工作項目」(pending_work) 快照的執行記錄。
- **修正前**：Excel 明細頁面顯示為 JSON 索引 (0, 1, 2...) 與內容比對，難以閱讀。
- **修正後**：Excel 明細頁面顯示為標準表格，列出所有工作項目的欄位（如開始日期、結束日期、內容等），與 UI 顯示一致。

### 2. 系統異動記錄 (System Change Log)
- **測試項目**：匯出單筆資料異動（如修改使用者資料）。
- **結果**：Excel 正確顯示「變更前」與「變更後」的欄位值比對，功能正常。

### 3. 施工回報 (Work Report)
- **測試項目**：匯出施工回報列表。
- **結果**：Excel 列表正確顯示各筆回報的詳細資訊，欄位名稱與格式正確。

## 檔案列表

- `src/app/admin/execution-log/ExecutionLogClient.tsx` (Modified)
