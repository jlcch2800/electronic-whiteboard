-- ==========================================
-- 最終版系統排程與函數設定檔 (Final Cron Setup v2)
-- ==========================================
-- 包含：
-- 1. System Execution Log 的資料表欄位擴充 (Old/New Data)
-- 2. 增強版 Log 函數 (支援快照)
-- 3. 增強版排程處理函數 (Schd-01 ~ Schd-05)
-- 4. 補救與監控排程 (Schd-06)
-- 5. pg_cron 排程設定
-- ==========================================

-- 1. 啟用 pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 新增詳細資料欄位 (若尚未存在)
ALTER TABLE public.system_execution_log
ADD COLUMN IF NOT EXISTS old_data JSONB,
ADD COLUMN IF NOT EXISTS new_data JSONB;

-- 3. 更新共用的 Log 記錄函數 (增強版 - 5個參數)
CREATE OR REPLACE FUNCTION log_execution(
    p_table_name TEXT, 
    p_level TEXT, 
    p_message TEXT,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO system_execution_log (date, table_name, log_level, message, old_data, new_data)
    VALUES (CURRENT_DATE, p_table_name, p_level, p_message, p_old_data, p_new_data);
END;
$$ LANGUAGE plpgsql;

-- 4. Schd-01: 廠商今日施工異動至歷史記錄 (增強版)
-- 條件: work_date < 當日
-- 動作: Copy + Delete
CREATE OR REPLACE FUNCTION process_schd_01_vendor_archive() RETURNS void AS $$
DECLARE
    moved_count INT;
    snapshot_data JSONB;
BEGIN -- 開始交易 (CTE Delete + Insert 是原子的)
    WITH moved_rows AS (
        DELETE FROM vendor_today_work
        WHERE work_date < CURRENT_DATE
        RETURNING *
    ),
    data_capture AS (
        SELECT jsonb_agg(to_jsonb(moved_rows)) as data, count(*) as cnt FROM moved_rows
    ),
    insert_op AS (
        INSERT INTO vendor_today_work_history (
            id, created_at, entry_status, work_date, arrival_time, departure_time,
            building, floor, location, vendor_badge_id, head_count, vendor_name,
            vendor_contact, vendor_contact_phone, work_content, note
        )
        SELECT 
            id, created_at, entry_status, work_date, arrival_time, departure_time,
            building, floor, location, vendor_badge_id, head_count, vendor_name,
            vendor_contact, vendor_contact_phone, work_content, note
        FROM moved_rows
    )
    SELECT data, cnt INTO snapshot_data, moved_count FROM data_capture;

-- 記錄成功 Log
    PERFORM log_execution('vendor_today_work', 'Info', 'Schd-01 執行成功: 歸檔 ' || COALESCE(moved_count, 0) || ' 筆資料', NULL, snapshot_data);

EXCEPTION WHEN OTHERS THEN
-- 記錄失敗 Log
    PERFORM log_execution('vendor_today_work', 'Error', 'Schd-01 執行失敗: ' || SQLERRM);
    RAISE; -- 拋出錯誤以便讓重試機制偵測
END;
$$ LANGUAGE plpgsql;

-- 5. Schd-02: 施工回報異動至歷史記錄 (增強版)
-- 條件: report_date < 當日
-- 動作: Copy + Delete
CREATE OR REPLACE FUNCTION process_schd_02_report_archive() RETURNS void AS $$
DECLARE
    moved_count INT;
    snapshot_data JSONB;
BEGIN
    WITH moved_rows AS (
        DELETE FROM work_report
        WHERE report_date < CURRENT_DATE
        RETURNING *
    ),
    data_capture AS (
        SELECT jsonb_agg(to_jsonb(moved_rows)) as data, count(*) as cnt FROM moved_rows
    ),
    insert_op AS (
        INSERT INTO work_report_history (
            id, created_at, report_date, report_time, vendor_name, 
            work_location, engineering_contact, work_status, work_content, note
        )
        SELECT 
            id, created_at, report_date, report_time, vendor_name, 
            work_location, engineering_contact, work_status, work_content, note
        FROM moved_rows
    )
    SELECT data, cnt INTO snapshot_data, moved_count FROM data_capture;

    PERFORM log_execution('work_report', 'Info', 'Schd-02 執行成功: 歸檔 ' || COALESCE(moved_count, 0) || ' 筆資料', NULL, snapshot_data);

EXCEPTION WHEN OTHERS THEN
    PERFORM log_execution('work_report', 'Error', 'Schd-02 執行失敗: ' || SQLERRM);
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- 6. Schd-03: 工務今日施工異動至歷史記錄 (增強版)
-- 條件: end_date < 當日
-- 動作: Copy + Delete
CREATE OR REPLACE FUNCTION process_schd_03_engineering_archive() RETURNS void AS $$
DECLARE
    moved_count INT;
    snapshot_data JSONB;
BEGIN
    WITH moved_rows AS (
        DELETE FROM engineering_today_work
        WHERE end_date < CURRENT_DATE
        RETURNING *
    ),
    data_capture AS (
        SELECT jsonb_agg(to_jsonb(moved_rows)) as data, count(*) as cnt FROM moved_rows
    ),
    insert_op AS (
        INSERT INTO engineering_work_history (
            id, created_at, start_date, end_date, time, vendor_name, 
            unit, engineering_contact, work_content, note
        )
        SELECT 
            id, created_at, start_date, end_date, time, vendor_name, 
            unit, engineering_contact, work_content, note
        FROM moved_rows
    )
    SELECT data, cnt INTO snapshot_data, moved_count FROM data_capture;

    PERFORM log_execution('engineering_today_work', 'Info', 'Schd-03 執行成功: 歸檔 ' || COALESCE(moved_count, 0) || ' 筆資料', NULL, snapshot_data);

EXCEPTION WHEN OTHERS THEN
    PERFORM log_execution('engineering_today_work', 'Error', 'Schd-03 執行失敗: ' || SQLERRM);
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- 7. Schd-04: 待處理工作異動至工務今日施工 (增強版)
-- 條件: start_date <= 當日
-- 動作: Copy + Delete (從 Pending 移動到 Active)
CREATE OR REPLACE FUNCTION process_schd_04_pending_to_active() RETURNS void AS $$
DECLARE
    moved_count INT;
    snapshot_data JSONB;
BEGIN
    WITH moved_rows AS (
        DELETE FROM pending_work
        WHERE start_date <= CURRENT_DATE
        RETURNING *
    ),
    data_capture AS (
        SELECT jsonb_agg(to_jsonb(moved_rows)) as data, count(*) as cnt FROM moved_rows
    ),
    insert_op AS (
        INSERT INTO engineering_today_work (
            id, created_at, start_date, end_date, time, vendor_name, 
            unit, engineering_contact, work_content, note
        )
        SELECT 
            id, created_at, start_date, end_date, time, vendor_name, 
            unit, engineering_contact, work_content, note
        FROM moved_rows
    )
    SELECT data, cnt INTO snapshot_data, moved_count FROM data_capture;

    PERFORM log_execution('pending_work', 'Info', 'Schd-04 執行成功: 啟用 ' || COALESCE(moved_count, 0) || ' 筆待辦事項', NULL, snapshot_data);

EXCEPTION WHEN OTHERS THEN
    PERFORM log_execution('pending_work', 'Error', 'Schd-04 執行失敗: ' || SQLERRM);
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- 8. Schd-05: 待處理工作異動至歷史記錄 (快照) (增強版)
-- 條件: start_date > 當日 (未來的工作)
-- 動作: Copy Only (Snapshot)
-- 注意: 因為是快照，必須產生新的 ID 以避免主鍵衝突，但內容保持一致

CREATE OR REPLACE FUNCTION process_schd_05_pending_snapshot() RETURNS void AS $$
DECLARE
    copied_count INT;
    snapshot_data JSONB;
BEGIN -- 這裡只做 INSERT，不 DELETE (Copy Only)
    WITH inserted_rows AS (
        INSERT INTO pending_work_history (
            id, created_at, start_date, end_date, time, vendor_name, 
            unit, engineering_contact, work_content, note
        )
        SELECT 
            gen_random_uuid(), -- 生成新 ID 作為快照 ID
            now(),             -- 快照時間
            start_date, end_date, time, vendor_name, 
            unit, engineering_contact, work_content, note
        FROM pending_work
        WHERE start_date > CURRENT_DATE
        RETURNING *
    ),
    data_capture AS (
        SELECT jsonb_agg(to_jsonb(inserted_rows)) as data, count(*) as cnt FROM inserted_rows
    )
    SELECT data, cnt INTO snapshot_data, copied_count FROM data_capture;

    PERFORM log_execution('pending_work', 'Info', 'Schd-05 執行成功: 建立 ' || COALESCE(copied_count, 0) || ' 筆快照', NULL, snapshot_data);

EXCEPTION WHEN OTHERS THEN
    PERFORM log_execution('pending_work', 'Error', 'Schd-05 執行失敗: ' || SQLERRM);
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- 9. Schd-06: 排程重試機制
-- 邏輯: 檢查系統記錄中過去 10 分鐘內是否有 'Error'，若有則重新執行對應的 Function
CREATE OR REPLACE FUNCTION process_schd_06_retry_monitor() RETURNS void AS $$
DECLARE
    failed_record RECORD;
BEGIN -- 搜尋過去 10 分鐘內的錯誤記錄
    FOR failed_record IN 
        SELECT message 
        FROM system_execution_log 
        WHERE log_level = 'Error' 
          AND created_at > (now() - INTERVAL '10 minutes')
    LOOP -- 簡單的字串比對來決定重跑哪個流程
        IF failed_record.message LIKE '%Schd-01%' THEN
            PERFORM log_execution('System', 'Warning', 'Schd-06: 偵測到 Schd-01 失敗，嘗試重跑...');
            PERFORM process_schd_01_vendor_archive();
        ELSIF failed_record.message LIKE '%Schd-02%' THEN
            PERFORM log_execution('System', 'Warning', 'Schd-06: 偵測到 Schd-02 失敗，嘗試重跑...');
            PERFORM process_schd_02_report_archive();
        ELSIF failed_record.message LIKE '%Schd-03%' THEN
            PERFORM log_execution('System', 'Warning', 'Schd-06: 偵測到 Schd-03 失敗，嘗試重跑...');
            PERFORM process_schd_03_engineering_archive();
        ELSIF failed_record.message LIKE '%Schd-04%' THEN
            PERFORM log_execution('System', 'Warning', 'Schd-06: 偵測到 Schd-04 失敗，嘗試重跑...');
            PERFORM process_schd_04_pending_to_active();
        ELSIF failed_record.message LIKE '%Schd-05%' THEN
            PERFORM log_execution('System', 'Warning', 'Schd-06: 偵測到 Schd-05 失敗，嘗試重跑...');
            PERFORM process_schd_05_pending_snapshot();
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------------------------
-- 設定 Cron Schedule
-- 注意: Supabase 的 cron 預設是 UTC 時間。
-- 台灣時間 (GMT+8) 00:00 等於 UTC 16:00 (前一天)。
-- 修正重點: 使用 SELECT cron.unschedule(jobid) FROM cron.job ...
-- 這能確保只有當排程真的存在時才執行刪除，避免 'could not find valid entry' 錯誤
-----------------------------------------------------------------------------

-- 10. 設定 Cron Schedule
-- 清除舊排程(避免重複)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'Schd-01-Vendor-Archive';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'Schd-02-Report-Archive';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'Schd-03-Engineering-Archive';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'Schd-04-Pending-Migration';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'Schd-05-Pending-Snapshot';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'Schd-06-Retry-Monitor-1';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'Schd-06-Retry-Monitor-2';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'Schd-06-Retry-Monitor-3';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'Schd-06-Retry-Monitor-4';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'Schd-06-Retry-Monitor-5';

-- 11.設定新排程 (UTC 時間，台灣 +8)
-- 1. Schd-01: 台灣 00:00 (UTC 16:00)
SELECT cron.schedule('Schd-01-Vendor-Archive', '0 16 * * *', $$SELECT process_schd_01_vendor_archive()$$);

-- 2. Schd-02: 台灣 00:15 (UTC 16:15)
SELECT cron.schedule('Schd-02-Report-Archive', '15 16 * * *', $$SELECT process_schd_02_report_archive()$$);

-- 3. Schd-03: 台灣 00:30 (UTC 16:30)
SELECT cron.schedule('Schd-03-Engineering-Archive', '30 16 * * *', $$SELECT process_schd_03_engineering_archive()$$);

-- 4. Schd-04: 台灣 00:45 (UTC 16:45)
SELECT cron.schedule('Schd-04-Pending-Migration', '45 16 * * *', $$SELECT process_schd_04_pending_to_active()$$);

-- 5. Schd-05: 台灣 01:00 (UTC 17:00)
SELECT cron.schedule('Schd-05-Pending-Snapshot', '0 17 * * *', $$SELECT process_schd_05_pending_snapshot()$$);

-- 12.重試機制 
-- Schd-06: 重試機制 (台灣時間 00:05, 00:20, 00:35, 00:50, 01:05)
-- 對應 UTC: 16:05, 16:20, 16:35, 16:50, 17:05
SELECT cron.schedule('Schd-06-Retry-Monitor-1', '5 16 * * *', $$SELECT process_schd_06_retry_monitor()$$);
SELECT cron.schedule('Schd-06-Retry-Monitor-2', '20 16 * * *', $$SELECT process_schd_06_retry_monitor()$$);
SELECT cron.schedule('Schd-06-Retry-Monitor-3', '35 16 * * *', $$SELECT process_schd_06_retry_monitor()$$);
SELECT cron.schedule('Schd-06-Retry-Monitor-4', '50 16 * * *', $$SELECT process_schd_06_retry_monitor()$$);
SELECT cron.schedule('Schd-06-Retry-Monitor-5', '5 17 * * *', $$SELECT process_schd_06_retry_monitor()$$);
