--建立 ENUM (枚舉類型):
--資料一致性 (Data Integrity)：防止寫入髒資料（例如，有人手誤將 'staff' 寫成 'staf'，或者 'Error' 寫成 'err'）。
--可讀性與維護性：明確定義了該欄位只能有哪些值，讓接手的人一目了然。
--效能：在 PostgreSQL 中，ENUM 的儲存效率通常比長字串更好。


-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. 定義 ENUM 類型 (優化資料結構)
-- 狀態: 到院/離院
DO $$ BEGIN
    CREATE TYPE enum_entry_status AS ENUM ('arrival', 'departure');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 施工狀態: 完成/未完成/異常
DO $$ BEGIN
    CREATE TYPE enum_work_status AS ENUM ('completed', 'incomplete', 'abnormal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 角色: 管理員/員工
DO $$ BEGIN
    CREATE TYPE enum_role AS ENUM ('admin', 'staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 操作類型
DO $$ BEGIN
    CREATE TYPE enum_action_type AS ENUM ('Insert', 'Update', 'Delete', 'Login', 'Logout');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 系統訊息等級
DO $$ BEGIN
    CREATE TYPE enum_log_level AS ENUM ('Info', 'Warning', 'Error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 1. vendor_today_work (廠商今日施工項目)
CREATE TABLE vendor_today_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entry_status VARCHAR(10) NOT NULL CHECK (entry_status IN ('arrival', 'departure')),
  work_date DATE NOT NULL,
  arrival_time TIME,
  departure_time TIME,
  building VARCHAR(10),
  floor VARCHAR(10),
  location VARCHAR(20),
  vendor_badge_id INTEGER,
  head_count INTEGER,
  vendor_name VARCHAR(20) NOT NULL,
  vendor_contact VARCHAR(20),
  vendor_contact_phone VARCHAR(20),
  work_content TEXT,
  note TEXT
);

COMMENT ON TABLE vendor_today_work IS '廠商今日施工項目';
COMMENT ON COLUMN vendor_today_work.id IS '全域唯一識別碼';
COMMENT ON COLUMN vendor_today_work.created_at IS '建立時間';
COMMENT ON COLUMN vendor_today_work.entry_status IS '到院或離院 (arrival, departure)';
COMMENT ON COLUMN vendor_today_work.work_date IS '施工日期';
COMMENT ON COLUMN vendor_today_work.arrival_time IS '到院時間';
COMMENT ON COLUMN vendor_today_work.departure_time IS '離院時間';
COMMENT ON COLUMN vendor_today_work.building IS '棟別';
COMMENT ON COLUMN vendor_today_work.floor IS '樓層';
COMMENT ON COLUMN vendor_today_work.location IS '施工地點';
COMMENT ON COLUMN vendor_today_work.vendor_badge_id IS '廠商工作證號';
COMMENT ON COLUMN vendor_today_work.head_count IS '施工人數';
COMMENT ON COLUMN vendor_today_work.vendor_name IS '廠商名稱';
COMMENT ON COLUMN vendor_today_work.vendor_contact IS '廠商負責人員姓名';
COMMENT ON COLUMN vendor_today_work.vendor_contact_phone IS '廠商負責人員電話';
COMMENT ON COLUMN vendor_today_work.work_content IS '施工內容';
COMMENT ON COLUMN vendor_today_work.note IS '備註';

-- 1-1. vendor_today_work_history (廠商今日施工歷史記錄)
CREATE TABLE vendor_today_work_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entry_status VARCHAR(10) NOT NULL,
  work_date DATE NOT NULL,
  arrival_time TIME,
  departure_time TIME,
  building VARCHAR(10),
  floor VARCHAR(10),
  location VARCHAR(20),
  vendor_badge_id INTEGER,
  head_count INTEGER,
  vendor_name VARCHAR(20) NOT NULL,
  vendor_contact VARCHAR(20),
  vendor_contact_phone VARCHAR(20),
  work_content TEXT,
  note TEXT
);
COMMENT ON TABLE vendor_today_work_history IS '廠商今日施工歷史記錄';
COMMENT ON COLUMN vendor_today_work_history.id IS '全域唯一識別碼';
COMMENT ON COLUMN vendor_today_work_history.created_at IS '建立時間';
COMMENT ON COLUMN vendor_today_work_history.entry_status IS '到院或離院 (arrival, departure)';
COMMENT ON COLUMN vendor_today_work_history.work_date IS '施工日期';
COMMENT ON COLUMN vendor_today_work_history.arrival_time IS '到院時間';
COMMENT ON COLUMN vendor_today_work_history.departure_time IS '離院時間';
COMMENT ON COLUMN vendor_today_work_history.building IS '棟別';
COMMENT ON COLUMN vendor_today_work_history.floor IS '樓層';
COMMENT ON COLUMN vendor_today_work_history.location IS '施工地點';
COMMENT ON COLUMN vendor_today_work_history.vendor_badge_id IS '廠商工作證號';
COMMENT ON COLUMN vendor_today_work_history.head_count IS '施工人數';
COMMENT ON COLUMN vendor_today_work_history.vendor_name IS '廠商名稱';
COMMENT ON COLUMN vendor_today_work_history.vendor_contact IS '廠商負責人員姓名';
COMMENT ON COLUMN vendor_today_work_history.vendor_contact_phone IS '廠商負責人員電話';
COMMENT ON COLUMN vendor_today_work_history.work_content IS '施工內容';
COMMENT ON COLUMN vendor_today_work_history.note IS '備註';

-- 2. engineering_today_work (工務今日施工項目)
CREATE TABLE engineering_today_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  time TIME,
  vendor_name VARCHAR(20) NOT NULL,
  work_content TEXT NOT NULL,
  unit VARCHAR(20) NOT NULL,
  engineering_contact VARCHAR(20) NOT NULL,
  note TEXT
);

COMMENT ON TABLE engineering_today_work IS '工務今日施工項目';
COMMENT ON COLUMN engineering_today_work.id IS '全域唯一識別碼';
COMMENT ON COLUMN engineering_today_work.created_at IS '建立時間';
COMMENT ON COLUMN engineering_today_work.start_date IS '施工開始日期';
COMMENT ON COLUMN engineering_today_work.end_date IS '施工結束日期';
COMMENT ON COLUMN engineering_today_work.time IS '時間';
COMMENT ON COLUMN engineering_today_work.vendor_name IS '廠商';
COMMENT ON COLUMN engineering_today_work.work_content IS '內容';
COMMENT ON COLUMN engineering_today_work.unit IS '單位';
COMMENT ON COLUMN engineering_today_work.engineering_contact IS '工務負責人員';
COMMENT ON COLUMN engineering_today_work.note IS '備註';

-- 2-1. engineering_work_history (工務施工歷史記錄)
CREATE TABLE engineering_work_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  time TIME,
  vendor_name VARCHAR(20) NOT NULL,
  work_content TEXT NOT NULL,
  unit VARCHAR(20) NOT NULL,
  engineering_contact VARCHAR(20) NOT NULL,
  note TEXT
);
COMMENT ON TABLE engineering_work_history IS '工務施工歷史記錄';
COMMENT ON COLUMN engineering_work_history.id IS '全域唯一識別碼';
COMMENT ON COLUMN engineering_work_history.created_at IS '建立時間';
COMMENT ON COLUMN engineering_work_history.start_date IS '施工開始日期';
COMMENT ON COLUMN engineering_work_history.end_date IS '施工結束日期';
COMMENT ON COLUMN engineering_work_history.time IS '時間';
COMMENT ON COLUMN engineering_work_history.vendor_name IS '廠商';
COMMENT ON COLUMN engineering_work_history.work_content IS '內容';
COMMENT ON COLUMN engineering_work_history.unit IS '單位';
COMMENT ON COLUMN engineering_work_history.engineering_contact IS '工務負責人員';
COMMENT ON COLUMN engineering_work_history.note IS '備註';

-- 3. pending_work (待處理工作項目)
CREATE TABLE pending_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  time TIME,
  vendor_name VARCHAR(20) NOT NULL,
  work_content TEXT NOT NULL,
  unit VARCHAR(20) NOT NULL,
  engineering_contact VARCHAR(20) NOT NULL,
  note TEXT
);

COMMENT ON TABLE pending_work IS '待處理工作項目';
COMMENT ON COLUMN pending_work.id IS '全域唯一識別碼';
COMMENT ON COLUMN pending_work.created_at IS '建立時間';
COMMENT ON COLUMN pending_work.start_date IS '施工開始日期';
COMMENT ON COLUMN pending_work.end_date IS '施工結束日期';
COMMENT ON COLUMN pending_work.time IS '時間';
COMMENT ON COLUMN pending_work.vendor_name IS '廠商';
COMMENT ON COLUMN pending_work.work_content IS '內容';
COMMENT ON COLUMN pending_work.unit IS '單位';
COMMENT ON COLUMN pending_work.engineering_contact IS '工務負責人員';
COMMENT ON COLUMN pending_work.note IS '備註';

-- 3-1. pending_work_history (待處理工作歷史記錄)
CREATE TABLE pending_work_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  time TIME,
  vendor_name VARCHAR(20) NOT NULL,
  work_content TEXT NOT NULL,
  unit VARCHAR(20) NOT NULL,
  engineering_contact VARCHAR(20) NOT NULL,
  note TEXT
);
COMMENT ON TABLE pending_work_history IS '待處理工作歷史記錄';
COMMENT ON COLUMN pending_work_history.id IS '全域唯一識別碼';
COMMENT ON COLUMN pending_work_history.created_at IS '建立時間';
COMMENT ON COLUMN pending_work_history.start_date IS '施工開始日期';
COMMENT ON COLUMN pending_work_history.end_date IS '施工結束日期';
COMMENT ON COLUMN pending_work_history.time IS '時間';
COMMENT ON COLUMN pending_work_history.vendor_name IS '廠商';
COMMENT ON COLUMN pending_work_history.work_content IS '內容';
COMMENT ON COLUMN pending_work_history.unit IS '單位';
COMMENT ON COLUMN pending_work_history.engineering_contact IS '工務負責人員';
COMMENT ON COLUMN pending_work_history.note IS '備註';

-- 4. work_report (施工回報記錄)
CREATE TABLE work_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  report_date DATE NOT NULL,
  report_time TIME,
  vendor_name VARCHAR(20) NOT NULL,
  work_location VARCHAR(20) NOT NULL,
  engineering_contact VARCHAR(20) NOT NULL,
  work_content TEXT NOT NULL,
  work_status VARCHAR(20) NOT NULL,
  note TEXT
);

COMMENT ON TABLE work_report IS '施工回報記錄';
COMMENT ON COLUMN work_report.id IS '全域唯一識別碼';
COMMENT ON COLUMN work_report.created_at IS '建立時間';
COMMENT ON COLUMN work_report.report_date IS '施工回報日期';
COMMENT ON COLUMN work_report.report_time IS '時間';
COMMENT ON COLUMN work_report.vendor_name IS '廠商';
COMMENT ON COLUMN work_report.work_location IS '施工地點';
COMMENT ON COLUMN work_report.engineering_contact IS '工務室人員';
COMMENT ON COLUMN work_report.work_content IS '工作內容';
COMMENT ON COLUMN work_report.work_status IS '施工狀態 (完成/未完成/異常)';
COMMENT ON COLUMN work_report.note IS '備註';

-- 4-1. work_report_history (施工回報歷史記錄)
CREATE TABLE work_report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  report_date DATE NOT NULL,
  report_time TIME,
  vendor_name VARCHAR(20) NOT NULL,
  work_location VARCHAR(20) NOT NULL,
  engineering_contact VARCHAR(20) NOT NULL,
  work_content TEXT NOT NULL,
  work_status VARCHAR(20) NOT NULL,
  note TEXT
);
COMMENT ON TABLE work_report_history IS '施工回報歷史記錄';
COMMENT ON COLUMN work_report_history.id IS '全域唯一識別碼';
COMMENT ON COLUMN work_report_history.created_at IS '建立時間';
COMMENT ON COLUMN work_report_history.report_date IS '施工回報日期';
COMMENT ON COLUMN work_report_history.report_time IS '時間';
COMMENT ON COLUMN work_report_history.vendor_name IS '廠商';
COMMENT ON COLUMN work_report_history.work_location IS '施工地點';
COMMENT ON COLUMN work_report_history.engineering_contact IS '工務室人員';
COMMENT ON COLUMN work_report_history.work_content IS '工作內容';
COMMENT ON COLUMN work_report_history.work_status IS '施工狀態 (完成/未完成/異常)';
COMMENT ON COLUMN work_report_history.note IS '備註';

-- 5. users (帳號管理)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unit VARCHAR(20) NOT NULL,
  user_name VARCHAR(20) NOT NULL,
  user_account VARCHAR(20) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff')),
  email VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  last_failed_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  reset_token_hash TEXT,
  reset_token_expire TIMESTAMPTZ,
  verify_token_hash TEXT,
  verify_token_expire TIMESTAMPTZ
);

COMMENT ON TABLE users IS '帳號管理';
COMMENT ON COLUMN users.id IS '使用者 ID (對應 auth.users.id)';
COMMENT ON COLUMN users.created_at IS '建立時間';
COMMENT ON COLUMN users.unit IS '單位';
COMMENT ON COLUMN users.user_name IS '姓名';
COMMENT ON COLUMN users.user_account IS '帳號';
COMMENT ON COLUMN users.password_hash IS '密碼(雜湊值不存明文)';
COMMENT ON COLUMN users.role IS '使用者群組 (admin, staff)';
COMMENT ON COLUMN users.email IS 'e-mail';
COMMENT ON COLUMN users.is_active IS '是否啟用';
COMMENT ON COLUMN users.failed_attempts IS '失敗計次';
COMMENT ON COLUMN users.last_failed_at IS '最後失敗時間';
COMMENT ON COLUMN users.locked_until IS '鎖定解除時間';
COMMENT ON COLUMN users.reset_token_hash IS '重設密碼 Token Hash';
COMMENT ON COLUMN users.reset_token_expire IS '重設密碼 Token 到期時間';
COMMENT ON COLUMN users.verify_token_hash IS '驗證 Token';
COMMENT ON COLUMN users.verify_token_expire IS '驗證 Token 到期時間';

-- 6. system_change_log (系統異動記錄)
CREATE TABLE system_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date DATE NOT NULL,
  user_unit VARCHAR(20),
  user_name VARCHAR(20),
  user_account VARCHAR(20),
  action_type VARCHAR(20) NOT NULL,
  modify_table VARCHAR(50) NOT NULL,
  modify_record_id UUID NOT NULL
);

COMMENT ON TABLE system_change_log IS '系統異動記錄';
COMMENT ON COLUMN system_change_log.id IS '全域唯一識別碼';
COMMENT ON COLUMN system_change_log.created_at IS '建立時間';
COMMENT ON COLUMN system_change_log.date IS '發生日期';
COMMENT ON COLUMN system_change_log.user_unit IS '單位(操作者)';
COMMENT ON COLUMN system_change_log.user_name IS '姓名(操作者)';
COMMENT ON COLUMN system_change_log.user_account IS '帳號(操作者)';
COMMENT ON COLUMN system_change_log.action_type IS '操作方式 (Insert/Update/Delete/Login/Logout)';
COMMENT ON COLUMN system_change_log.modify_table IS '異動資料表';
COMMENT ON COLUMN system_change_log.modify_record_id IS '異動項目的 UUID';

-- 7. system_execution_log (系統執行記錄)
CREATE TABLE system_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date DATE NOT NULL,
  table_name VARCHAR(30),
  log_level VARCHAR(10) NOT NULL CHECK (log_level IN ('Info', 'Warning', 'Error')),
  message TEXT
);

COMMENT ON TABLE system_execution_log IS '系統執行記錄';
COMMENT ON COLUMN system_execution_log.id IS '全域唯一識別碼';
COMMENT ON COLUMN system_execution_log.created_at IS '建立時間';
COMMENT ON COLUMN system_execution_log.date IS '日期';
COMMENT ON COLUMN system_execution_log.table_name IS '資料表名稱';
COMMENT ON COLUMN system_execution_log.log_level IS '類別 (Info, Warning, Error)';
COMMENT ON COLUMN system_execution_log.message IS '執行內容或錯誤訊息';

-- 8. work_file (施工文件)
CREATE TABLE work_file (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date DATE NOT NULL,
  vendor_name VARCHAR(20),
  work_item VARCHAR(30),
  uploader_name VARCHAR(20) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  image_url TEXT NOT NULL,
  video_url TEXT,
  note TEXT
);

COMMENT ON TABLE work_file IS '施工文件';
COMMENT ON COLUMN work_file.id IS '全域唯一識別碼';
COMMENT ON COLUMN work_file.created_at IS '建立時間';
COMMENT ON COLUMN work_file.date IS '日期(文件上傳)';
COMMENT ON COLUMN work_file.vendor_name IS '廠商名稱';
COMMENT ON COLUMN work_file.work_item IS '施工項目(名稱)';
COMMENT ON COLUMN work_file.uploader_name IS '上傳人員(姓名)';
COMMENT ON COLUMN work_file.description IS '說明(文件描述)';
COMMENT ON COLUMN work_file.file_url IS '文件(Cloudinary URL)';
COMMENT ON COLUMN work_file.image_url IS '照片(Cloudinary URL)';
COMMENT ON COLUMN work_file.video_url IS '影片(Cloudinary URL)';
COMMENT ON COLUMN work_file.note IS '備註';