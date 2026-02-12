-- 建立系統執行記錄輔助函數
-- 用於讓排程或觸發器方便地寫入詳細執行記錄
--
-- 參數說明：
-- p_table_name: 關聯的資料表名稱 (e.g., 'vendor_today_work', 'engineering_today_work')
-- p_log_level: 記錄等級 ('Info', 'Warning', 'Error') - 必須符合 log_level enum
-- p_message: 執行訊息或摘要
-- p_old_data: 變更前資料 (JSONB)，選填
-- p_new_data: 變更後資料 (JSONB)，選填
--
-- 回傳：
-- 新增記錄的 UUID

CREATE OR REPLACE FUNCTION log_execution_with_details(
    p_table_name TEXT,
    p_log_level TEXT,
    p_message TEXT,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_level_text TEXT;
BEGIN
    -- 驗證並標準化 Log Level
    -- 由於資料庫可能未定義 log_level Enum 型別，這裡使用 TEXT 處理，並確保值為有效選項
    IF p_log_level IN ('Info', 'Warning', 'Error') THEN
        v_level_text := p_log_level;
    ELSE
        -- 若提供無效等級，預設為 Info 並在訊息中註記
        v_level_text := 'Info';
        p_message := p_message || ' (Invalid Log Level provided: ' || p_log_level || ')';
    END IF;

    -- 插入資料
    -- 若 system_execution_log.log_level 欄位實際上是 Enum，PostgreSQL 通常會自動將合法的 Text 轉型。
    -- 若仍有型別錯誤，可能需要明確轉型 (例如 ::"LogLevel" 或 ::public.log_level)，視實際定義而定。
    INSERT INTO system_execution_log (
        date,
        table_name,
        log_level,
        message,
        old_data,
        new_data
    ) VALUES (
        CURRENT_DATE,
        p_table_name,
        v_level_text::text, -- 嘗試以 text 寫入，讓資料庫處理轉型
        p_message,
        p_old_data,
        p_new_data
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;
