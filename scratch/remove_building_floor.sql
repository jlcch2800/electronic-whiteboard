-- 1. 移除主要資料表欄位
ALTER TABLE public.vendor_today_work DROP COLUMN IF EXISTS building;
ALTER TABLE public.vendor_today_work DROP COLUMN IF EXISTS floor;

-- 2. 移除歷史資料表欄位
ALTER TABLE public.vendor_today_work_history DROP COLUMN IF EXISTS building;
ALTER TABLE public.vendor_today_work_history DROP COLUMN IF EXISTS floor;

-- 3. 更新歸檔 Function (Schd-01: 廠商今日施工異動至歷史記錄)
CREATE OR REPLACE FUNCTION process_schd_01_vendor_archive() RETURNS void AS $$
DECLARE
    moved_count INT;
    snapshot_data JSONB;
    v_today date := (now() AT TIME ZONE 'Asia/Taipei')::date;
BEGIN
    WITH moved_rows AS (
        DELETE FROM vendor_today_work
        WHERE work_date < v_today
        RETURNING *
    ),
    data_capture AS (
        SELECT jsonb_agg(to_jsonb(moved_rows)) as data, count(*) as cnt FROM moved_rows
    ),
    insert_op AS (
        INSERT INTO vendor_today_work_history (
            id, created_at, entry_status, work_date, arrival_time, departure_time,
            location, vendor_badge_id, head_count, vendor_name,
            vendor_contact, vendor_contact_phone, work_content, note,
            borrow_action, borrowed_items, lender_name, returned_items, receiver_name, ref_arrival_id
        )
        SELECT 
            id, created_at, entry_status, work_date, arrival_time, departure_time,
            location, vendor_badge_id, head_count, vendor_name,
            vendor_contact, vendor_contact_phone, work_content, note,
            borrow_action, borrowed_items, lender_name, returned_items, receiver_name, ref_arrival_id
        FROM moved_rows
    )
    SELECT data, cnt INTO snapshot_data, moved_count FROM data_capture;

    PERFORM log_execution('vendor_today_work', 'Info', 'Schd-01 執行成功: 歸檔 ' || COALESCE(moved_count, 0) || ' 筆資料', NULL, snapshot_data);

EXCEPTION WHEN OTHERS THEN
    PERFORM log_execution('vendor_today_work', 'Error', 'Schd-01 執行失敗: ' || SQLERRM);
    RAISE;
END;
$$ LANGUAGE plpgsql;
