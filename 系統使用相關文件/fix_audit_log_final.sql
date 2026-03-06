-- ==========================================
-- 修正腳本 v2 (Final Fix)
-- 修正項目：
-- 1. Trigger 函數：將 action_type 改為 TEXT (解決 Enum 不存在問題)
-- 2. Trigger 函數：modify_record_id 直接寫入 UUID (解決轉型問題)
-- 3. 測試區塊：使用合法的 UUID 格式進行測試 (解決 'test_id' 格式錯誤)
-- ==========================================

CREATE OR REPLACE FUNCTION process_system_change_log() RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    u_unit VARCHAR;
    u_name VARCHAR;
    u_account VARCHAR;
    rec_id UUID;
    act_type TEXT; -- [修正] 改用 TEXT
    old_val JSONB := NULL;
    new_val JSONB := NULL;
BEGIN
    -- 嘗試取得當前使用者 ID (Supabase Auth)
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        u_name := 'System';
    ELSE
        SELECT unit, user_name, user_account INTO u_unit, u_name, u_account
        FROM public.users
        WHERE id = current_user_id;
    END IF;

    -- 判斷操作類型與受影響的 Record ID
    IF (TG_OP = 'DELETE') THEN
        rec_id := OLD.id;
        act_type := 'Delete';
        old_val := row_to_json(OLD)::JSONB;
        old_val := old_val - 'password_hash' - 'reset_token_hash' - 'verify_token_hash';
        
    ELSIF (TG_OP = 'UPDATE') THEN
        rec_id := NEW.id;
        act_type := 'Update';
        old_val := row_to_json(OLD)::JSONB;
        new_val := row_to_json(NEW)::JSONB;
        old_val := old_val - 'password_hash' - 'reset_token_hash' - 'verify_token_hash';
        new_val := new_val - 'password_hash' - 'reset_token_hash' - 'verify_token_hash';

    ELSIF (TG_OP = 'INSERT') THEN
        rec_id := NEW.id;
        act_type := 'Insert';
        new_val := row_to_json(NEW)::JSONB;
        new_val := new_val - 'password_hash' - 'reset_token_hash' - 'verify_token_hash';
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
        rec_id, -- [修正] 直接傳入 UUID，不轉型為 text
        old_val,
        new_val
    );

    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Log Trigger Error: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 驗證修正後的寫入
DO $$
BEGIN
    INSERT INTO public.system_change_log (
        date,
        user_name,
        action_type,
        modify_table,
        modify_record_id,
        old_data,
        new_data
    ) VALUES (
        CURRENT_DATE,
        'Fix Test v2',
        'Insert', 
        'debug_table',
        '00000000-0000-0000-0000-000000000000', -- [修正] 使用合法的 UUID 格式 (Nil UUID)
        NULL,
        '{"status": "fixed_v2"}'::jsonb
    );
END $$;
