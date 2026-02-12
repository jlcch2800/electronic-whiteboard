-- 系統執行記錄表新增 old_data 和 new_data 欄位
-- 用於儲存排程/觸發器執行時的實際資料內容

ALTER TABLE system_execution_log 
ADD COLUMN IF NOT EXISTS old_data JSONB,
ADD COLUMN IF NOT EXISTS new_data JSONB;

-- 建議：更新現有的觸發器/排程邏輯，將實際異動資料寫入這兩個欄位
-- 例如：
-- INSERT INTO system_execution_log (date, table_name, log_level, message, old_data, new_data)
-- VALUES (CURRENT_DATE, 'vendor_today_work', 'Info', 'Schd-01 執行成功', OLD_ROW, NEW_ROW);
