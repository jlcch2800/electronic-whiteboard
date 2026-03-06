-- ==========================================
-- 自動化異動記錄 Trigger (Automation)
-- ==========================================

-- 建立通用觸發函數
CREATE OR REPLACE FUNCTION process_system_change_log() RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    u_unit VARCHAR;
    u_name VARCHAR;
    u_account VARCHAR;
    rec_id UUID;
    act_type enum_action_type;
    old_val JSONB := NULL;
    new_val JSONB := NULL;
BEGIN
    -- 嘗試取得當前使用者 ID (Supabase Auth)
    current_user_id := auth.uid();

    -- 如果是系統背景排程或無使用者情境，則略過 (或可設定為 System)
    IF current_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- 取得使用者詳細資訊
    SELECT unit, user_name, user_account INTO u_unit, u_name, u_account
    FROM public.users
    WHERE id = current_user_id;

    -- 判斷操作類型與受影響的 Record ID
    IF (TG_OP = 'DELETE') THEN
        rec_id := OLD.id;
        act_type := 'Delete';
        old_val := row_to_json(OLD); -- 將舊資料轉為 JSON
    ELSIF (TG_OP = 'UPDATE') THEN
        rec_id := NEW.id;
        act_type := 'Update';
        old_val := row_to_json(OLD); -- 將舊資料轉為 JSON
        new_val := row_to_json(NEW); -- 將新資料轉為 JSON
    ELSIF (TG_OP = 'INSERT') THEN
        rec_id := NEW.id;
        act_type := 'Insert';
        new_val := row_to_json(NEW); -- 將新資料轉為 JSON
    END IF;

    -- 寫入 Log
    INSERT INTO public.system_change_log (
        date,
        user_unit,
        user_name,
        user_account,
        action_type,
        modify_table,
        modify_record_id,
        old_data,
        new_data
    ) VALUES (
        CURRENT_DATE,
        u_unit,
        u_name,
        u_account,
        act_type,
        TG_TABLE_NAME,
        rec_id,
        old_val,
        new_val
    );

    RETURN NULL; -- AFTER Trigger 不需要回傳值
EXCEPTION WHEN OTHERS THEN
    -- 避免 Log 寫入失敗導致主交易失敗，這裡選擇忽略錯誤或記錄到 execution log
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 為主要資料表綁定 Trigger
-- 1. 廠商施工
DROP TRIGGER IF EXISTS trigger_log_vendor_today_work ON vendor_today_work;
CREATE TRIGGER trigger_log_vendor_today_work
AFTER INSERT OR UPDATE OR DELETE ON vendor_today_work
FOR EACH ROW EXECUTE FUNCTION process_system_change_log();

-- 2. 工務施工
DROP TRIGGER IF EXISTS trigger_log_engineering_today_work ON engineering_today_work;
CREATE TRIGGER trigger_log_engineering_today_work
AFTER INSERT OR UPDATE OR DELETE ON engineering_today_work
FOR EACH ROW EXECUTE FUNCTION process_system_change_log();

-- 3. 待辦事項
DROP TRIGGER IF EXISTS trigger_log_pending_work ON pending_work;
CREATE TRIGGER trigger_log_pending_work
AFTER INSERT OR UPDATE OR DELETE ON pending_work
FOR EACH ROW EXECUTE FUNCTION process_system_change_log();

-- 4. 施工回報
DROP TRIGGER IF EXISTS trigger_log_work_report ON work_report;
CREATE TRIGGER trigger_log_work_report
AFTER INSERT OR UPDATE OR DELETE ON work_report
FOR EACH ROW EXECUTE FUNCTION process_system_change_log();

-- 5. 使用者管理 (新增/修改/刪除帳號)
DROP TRIGGER IF EXISTS trigger_log_users ON users;
CREATE TRIGGER trigger_log_users
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION process_system_change_log();