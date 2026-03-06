-- ==========================================
-- 手動測試排程功能腳本 (manual_test_schedule.sql)
-- 用途：手動插入測試資料、執行排程函數、並驗證結果
-- ==========================================

-- 步驟 1: 準備測試資料
-- ------------------------------------------
-- 我們插入符合各個排程觸發條件的資料 (例如日期設為昨天或今天)

-- [Test Data 1] 廠商今日施工 (昨天) -> 待會執行 Schd-01 後應該被歸檔
INSERT INTO vendor_today_work (
    work_date, vendor_name, entry_status, work_content, note
) VALUES (
    CURRENT_DATE - INTERVAL '1 day', -- 昨天
    '測試廠商-A',
    'arrival',
    '測試 Schd-01 歸檔',
    '這筆資料應該移動到 History'
);

-- [Test Data 2] 施工回報 (昨天) -> 待會執行 Schd-02 後應該被歸檔
INSERT INTO work_report (
    report_date, vendor_name, work_location, engineering_contact, work_status, work_content
) VALUES (
    CURRENT_DATE - INTERVAL '1 day', -- 昨天
    '測試廠商-B',
    'B棟2F',
    '測試員',
    'completed',
    '測試 Schd-02 歸檔'
);

-- [Test Data 3] 工務今日施工 (昨天結束) -> 待會執行 Schd-03 後應該被歸檔
INSERT INTO engineering_today_work (
    start_date, end_date, vendor_name, unit, engineering_contact, work_content
) VALUES (
    CURRENT_DATE - INTERVAL '2 days',
    CURRENT_DATE - INTERVAL '1 day', -- 昨天結束
    '測試廠商-C',
    '工務室',
    '測試員',
    '測試 Schd-03 歸檔'
);

-- [Test Data 4] 待處理工作 (今天開始) -> 待會執行 Schd-04 後應該移入 Active
INSERT INTO pending_work (
    start_date, end_date, vendor_name, unit, engineering_contact, work_content, note
) VALUES (
    CURRENT_DATE, -- 今天
    CURRENT_DATE + INTERVAL '1 day',
    '測試廠商-D',
    '營繕組',
    '測試員',
    '測試 Schd-04 (Pending->Active)',
    '應該消失在 pending, 出現在 engineering_today，隔天歸檔到工務施工歷史紀錄'
);

-- [Test Data 5] 待處理工作 (明天開始) -> 待會執行 Schd-05 後應該產生快照
INSERT INTO pending_work (
    start_date, end_date, vendor_name, unit, engineering_contact, work_content, note
) VALUES (
    CURRENT_DATE + INTERVAL '1 day', -- 明天
    CURRENT_DATE + INTERVAL '2 days',
    '測試廠商-E',
    '資訊室',
    '測試員',
    '測試 Schd-05 (Snapshot)',
    '應該留在 pending, 並在待處理 history 增加一筆'
);


-- 步驟 2: 手動執行排程函數
-- ------------------------------------------
-- 請在 Supabase SQL Editor 中選取下列指令執行 (可單行執行)

SELECT process_schd_01_vendor_archive();

SELECT process_schd_02_report_archive();

SELECT process_schd_03_engineering_archive();

SELECT process_schd_04_pending_to_active();

SELECT process_schd_05_pending_snapshot();


-- 步驟 3: 驗證結果
-- ------------------------------------------

-- 1. 檢查系統執行 Log (最重要的驗證)
-- 應該要看到 5 筆新記錄，message 顯示 "執行成功: 歸檔 X 筆資料" 且 old_data/new_data 有 JSON 內容
SELECT * FROM system_execution_log ORDER BY created_at DESC LIMIT 10;

-- 2. 檢查各歷史資料表是否真的有資料
SELECT * FROM vendor_today_work_history WHERE vendor_name = '測試廠商-A';
SELECT * FROM work_report_history WHERE vendor_name = '測試廠商-B';
SELECT * FROM engineering_work_history WHERE vendor_name = '測試廠商-C';

-- 3. 檢查 Schd-04 (Pending -> Active)
SELECT * FROM engineering_today_work WHERE vendor_name = '測試廠商-D'; -- 應該要有資料
SELECT * FROM pending_work WHERE vendor_name = '測試廠商-D'; -- 應該無資料

-- 4. 檢查 Schd-05 (Snapshot)
SELECT * FROM pending_work WHERE vendor_name = '測試廠商-E'; -- 應該還在
SELECT * FROM pending_work_history WHERE vendor_name = '測試廠商-E'; -- 應該要有快照
