-- 建立通用的系統執行記錄 Trigger Function
-- 此函數會自動擷取 OLD 和 NEW 資料，並呼叫 log_execution_with_details

CREATE OR REPLACE FUNCTION trigger_log_execution_details()
RETURNS TRIGGER AS $$
DECLARE
    v_message TEXT;
    v_old_data JSONB;
    v_new_data JSONB;
    v_table_name TEXT;
    v_action TEXT;
BEGIN
    v_table_name := TG_TABLE_NAME;
    v_action := TG_OP;

    -- 根據操作類型設定 old_data, new_data 和訊息
    IF (v_action = 'INSERT') THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        v_message := '新增資料：' || v_table_name;
    ELSIF (v_action = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_message := '更新資料：' || v_table_name;
        
        -- 優化：如果沒有實際資料變更，則不記錄 (可選)
        -- IF v_old_data = v_new_data THEN
        --     RETURN NEW;
        -- END IF;
    ELSIF (v_action = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_message := '刪除資料：' || v_table_name;
    END IF;

    -- 呼叫 logging function
    -- 注意：這裡 Log Level 預設為 'Info'
    PERFORM log_execution_with_details(
        v_table_name,
        'Info',
        v_message,
        v_old_data,
        v_new_data
    );

    -- Trigger 必須回傳內容
    IF (v_action = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 移除舊的 triggers (如果存在，避免重複)
DROP TRIGGER IF EXISTS log_execution_trigger ON vendor_today_work;
DROP TRIGGER IF EXISTS log_execution_trigger ON engineering_today_work;
DROP TRIGGER IF EXISTS log_execution_trigger ON pending_work;
DROP TRIGGER IF EXISTS log_execution_trigger ON work_report;

-- 綁定 Trigger 到資料表
-- 1. 廠商今日施工
CREATE TRIGGER log_execution_trigger
AFTER INSERT OR UPDATE OR DELETE ON vendor_today_work
FOR EACH ROW EXECUTE FUNCTION trigger_log_execution_details();

-- 2. 工務今日工作
CREATE TRIGGER log_execution_trigger
AFTER INSERT OR UPDATE OR DELETE ON engineering_today_work
FOR EACH ROW EXECUTE FUNCTION trigger_log_execution_details();

-- 3. 待處理工作
CREATE TRIGGER log_execution_trigger
AFTER INSERT OR UPDATE OR DELETE ON pending_work
FOR EACH ROW EXECUTE FUNCTION trigger_log_execution_details();

-- 4. 施工回報
CREATE TRIGGER log_execution_trigger
AFTER INSERT OR UPDATE OR DELETE ON work_report
FOR EACH ROW EXECUTE FUNCTION trigger_log_execution_details();

-- ==========================================
-- 歷史資料表 (History Tables) Triggers
-- ==========================================

-- 移除舊的 triggers (如果存在)
DROP TRIGGER IF EXISTS log_execution_trigger ON vendor_today_work_history;
DROP TRIGGER IF EXISTS log_execution_trigger ON engineering_work_history;
DROP TRIGGER IF EXISTS log_execution_trigger ON pending_work_history;
DROP TRIGGER IF EXISTS log_execution_trigger ON work_report_history;

-- 5. 廠商今日施工歷史檔
CREATE TRIGGER log_execution_trigger
AFTER INSERT OR UPDATE OR DELETE ON vendor_today_work_history
FOR EACH ROW EXECUTE FUNCTION trigger_log_execution_details();

-- 6. 工務今日工作歷史檔
CREATE TRIGGER log_execution_trigger
AFTER INSERT OR UPDATE OR DELETE ON engineering_work_history
FOR EACH ROW EXECUTE FUNCTION trigger_log_execution_details();

-- 7. 待處理工作歷史檔
CREATE TRIGGER log_execution_trigger
AFTER INSERT OR UPDATE OR DELETE ON pending_work_history
FOR EACH ROW EXECUTE FUNCTION trigger_log_execution_details();

-- 8. 施工回報歷史檔
CREATE TRIGGER log_execution_trigger
AFTER INSERT OR UPDATE OR DELETE ON work_report_history
FOR EACH ROW EXECUTE FUNCTION trigger_log_execution_details();
