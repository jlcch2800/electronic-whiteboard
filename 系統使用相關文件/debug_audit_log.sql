-- ==========================================
-- 診斷腳本：檢查 Enum 設定與手動測試寫入
-- ==========================================

-- 1. 查看資料庫中 'action_type' 的實際定義值
-- 這可以幫助我們確認是 'Insert' (大寫) 還是 'insert' (小寫)
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'action_type'
ORDER BY e.enumsortorder;

-- 2. 手動測試寫入 (確保並非 RLS 或其他權限問題)
-- 我們會嘗試寫入一筆測試資料，並將結果顯示在 "Messages" 或 "Results" 分頁中
DO $$
DECLARE
    -- 嘗試宣告一個變數，若 Enum 值不對，這裡可能就會報錯
    -- 請注意：如果您的 DB Enum 是小寫，您需要手動修改下行的 'Insert' 為 'insert' 來測試
    test_enum_val public.action_type := 'Insert'; 
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
        'System Debug',
        test_enum_val, -- 使用上面設定的 Enum 值
        'debug_table',
        'debug_id',
        '{"status": "test"}'::jsonb,
        '{"status": "success"}'::jsonb
    );
    
    RAISE NOTICE '測試成功：已成功寫入一筆 system_change_log';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '測試失敗！錯誤原因：%', SQLERRM;
END $$;
