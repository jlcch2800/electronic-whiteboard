--在 CREATE FUNCTION 語句中加入 SET search_path = public，當您使用 SECURITY DEFINER 時，Function 會以「高權限管理者」的身分執行。
--如果不鎖定 search_path，駭客可以在自己的 Schema 中建立一個惡意的 users 表格或假 Function，
--然後誘騙您的 Admin Function 去讀取錯誤的物件，進而竊取權限。
--加上 SET search_path = public 可以強制 Function 只在 public schema 裡面找東西，杜絕這種攻擊。

--Supabase 的 Service Role Key 擁有最高權限，會自動繞過所有 RLS 規則。通常後端排程（如 Cron Jobs、Edge Functions）都是使用這把金鑰，因此不需要額外設定 Policy。
--如果您的排程是用某個員工帳號執行和使用一般 User Auth Token： 無法寫入，會被擋下。

--如果資料庫中已經存在舊的 Policy，若直接執行 CREATE POLICY 語法，Supabase 會報錯告訴您 "Policy already exists"。
--為了順利更新POLICY，需要執行一段「先刪除舊 Policy，再建立新 Policy」的語法。

-- 0. 啟用所有資料表的 RLS (ROW LEVEL SECURITY)
ALTER TABLE vendor_today_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_today_work_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_today_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_work_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_work_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_file ENABLE ROW LEVEL SECURITY;


-- 1. 建立 Helper Function 檢查是否為 Admin
-- 注意: 使用 SECURITY DEFINER 讓此函數能繞過 RLS 讀取 users 表的 role 欄位
-- 修正: 加上 SET search_path = public 以修復 Security Advisor Warning (Mutable Search Path)

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- 2. 設定 Users Table權限 (最重要)
-- Admin: 全部權限，Staff 只能讀自己的資料

DROP POLICY IF EXISTS "Admin All Users" ON users;
DROP POLICY IF EXISTS "Read Self Users" ON users;
DROP POLICY IF EXISTS "Update Self Users" ON users;

-- Admin: 全部權限，Staff 只能讀自己的資料
CREATE POLICY "Admin All Users" ON users FOR ALL USING (is_admin());

-- Staff/User: 只能讀取自己的資料
CREATE POLICY "Read Self Users" ON users FOR SELECT USING (auth.uid() = id);

-- Staff/User: 只能更新自己的資料 (如密碼、Email)
CREATE POLICY "Update Self Users" ON users FOR UPDATE USING (auth.uid() = id);


-- 3. [廠商施工表] vendor_today_work
--包含: vendor_today_work, engineering_today_work, pending_work, work_report, work_file
-- 規格: 廠商(Public)僅能 INSERT，不可 SELECT。員工可 SELECT/UPDATE，只有 Admin 能刪除。

DROP POLICY IF EXISTS "Public Insert Vendor" ON vendor_today_work;
DROP POLICY IF EXISTS "Staff Read Vendor" ON vendor_today_work;
DROP POLICY IF EXISTS "Staff Update Vendor" ON vendor_today_work;
DROP POLICY IF EXISTS "Admin Delete Vendor" ON vendor_today_work;

-- 廠商(Anon) 與 員工(Authenticated) 都可以新增
CREATE POLICY "Public Insert Vendor" ON vendor_today_work 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- 只有 員工(Authenticated) 可以讀取 (廠商看不到)
CREATE POLICY "Staff Read Vendor" ON vendor_today_work 
FOR SELECT 
TO authenticated 
USING (true);

-- 只有 員工(Authenticated) 可以修改
CREATE POLICY "Staff Update Vendor" ON vendor_today_work 
FOR UPDATE 
TO authenticated 
USING (true);

-- 管理員可刪除
CREATE POLICY "Admin Delete Vendor" ON vendor_today_work 
FOR DELETE 
USING (is_admin());


-- 4. [工務今日施工項目] engineering_today_work
DROP POLICY IF EXISTS "Staff Read Eng" ON engineering_today_work;
DROP POLICY IF EXISTS "Staff Insert Eng" ON engineering_today_work;
DROP POLICY IF EXISTS "Staff Update Eng" ON engineering_today_work;
DROP POLICY IF EXISTS "Admin Delete Eng" ON engineering_today_work;

CREATE POLICY "Staff Read Eng" ON engineering_today_work FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Insert Eng" ON engineering_today_work FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Staff Update Eng" ON engineering_today_work FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin Delete Eng" ON engineering_today_work FOR DELETE USING (is_admin());


-- 5. [待處理工作項目] pending_work
DROP POLICY IF EXISTS "Staff Read Pending" ON pending_work;
DROP POLICY IF EXISTS "Staff Insert Pending" ON pending_work;
DROP POLICY IF EXISTS "Staff Update Pending" ON pending_work;
DROP POLICY IF EXISTS "Admin Delete Pending" ON pending_work;

CREATE POLICY "Staff Read Pending" ON pending_work FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Insert Pending" ON pending_work FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Staff Update Pending" ON pending_work FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin Delete Pending" ON pending_work FOR DELETE USING (is_admin());


-- 6. [施工回報] work_report
DROP POLICY IF EXISTS "Staff Read Report" ON work_report;
DROP POLICY IF EXISTS "Staff Insert Report" ON work_report;
DROP POLICY IF EXISTS "Staff Update Report" ON work_report;
DROP POLICY IF EXISTS "Admin Delete Report" ON work_report;

CREATE POLICY "Staff Read Report" ON work_report FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Insert Report" ON work_report FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Staff Update Report" ON work_report FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin Delete Report" ON work_report FOR DELETE USING (is_admin());


-- 7. [施工文件] work_file
DROP POLICY IF EXISTS "Staff Read File" ON work_file;
DROP POLICY IF EXISTS "Staff Insert File" ON work_file;
DROP POLICY IF EXISTS "Staff Update File" ON work_file;
DROP POLICY IF EXISTS "Admin Delete File" ON work_file;

CREATE POLICY "Staff Read File" ON work_file FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Insert File" ON work_file FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Staff Update File" ON work_file FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin Delete File" ON work_file FOR DELETE USING (is_admin());


-- 8. [歷史資料表] _history 
-- 規格: 管理員擁有完整權限。這裡設定為：員工可讀(查詢用)，Public不可讀，管理員可刪除。
-- 後端排程若使用 Service Role Key 則不需要 Policy 即可寫入。

-- Vendor Today Work History
DROP POLICY IF EXISTS "Staff Read VendorHist" ON vendor_today_work_history;
DROP POLICY IF EXISTS "Admin Delete VendorHist" ON vendor_today_work_history;
CREATE POLICY "Staff Read VendorHist" ON vendor_today_work_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin Delete VendorHist" ON vendor_today_work_history FOR DELETE USING (is_admin());

-- Engineering Work History
DROP POLICY IF EXISTS "Staff Read EngHist" ON engineering_work_history;
DROP POLICY IF EXISTS "Admin Delete EngHist" ON engineering_work_history;
CREATE POLICY "Staff Read EngHist" ON engineering_work_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin Delete EngHist" ON engineering_work_history FOR DELETE USING (is_admin());

-- Pending Work History
DROP POLICY IF EXISTS "Staff Read PendingHist" ON pending_work_history;
DROP POLICY IF EXISTS "Admin Delete PendingHist" ON pending_work_history;
CREATE POLICY "Staff Read PendingHist" ON pending_work_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin Delete PendingHist" ON pending_work_history FOR DELETE USING (is_admin());

--  Work Report History
DROP POLICY IF EXISTS "Staff Read ReportHist" ON work_report_history;
DROP POLICY IF EXISTS "Admin Delete ReportHist" ON work_report_history;
CREATE POLICY "Staff Read ReportHist" ON work_report_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin Delete ReportHist" ON work_report_history FOR DELETE USING (is_admin());


-- 9. [系統異動紀錄] System Change Logs
-- 允許人員操作時寫入 Log (例如 Audit Trail)
DROP POLICY IF EXISTS "Staff Read ChangeLog" ON system_change_log;
DROP POLICY IF EXISTS "Staff Insert ChangeLog" ON system_change_log;
DROP POLICY IF EXISTS "Admin Delete ChangeLog" ON system_change_log;
CREATE POLICY "Staff Read ChangeLog" ON system_change_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Insert ChangeLog" ON system_change_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin Delete ChangeLog" ON system_change_log FOR DELETE USING (is_admin());


-- 10. [系統執行紀錄] System Execution Logs
-- 允許人員操作時寫入 Log (例如 Audit Trail)
DROP POLICY IF EXISTS "Staff Read ExecLog" ON system_execution_log;
DROP POLICY IF EXISTS "Staff Insert ExecLog" ON system_execution_log;
DROP POLICY IF EXISTS "Admin Delete ExecLog" ON system_execution_log;
CREATE POLICY "Staff Read ExecLog" ON system_execution_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Insert ExecLog" ON system_execution_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin Delete ExecLog" ON system_execution_log FOR DELETE USING (is_admin());


-- 11.自動化觸發器 (Triggers)
-- 當 Supabase Auth (auth.users) 新增使用者時，同步建立 public.users 基本資料
-- 修正: 加上 SET search_path = public 以修復 Security Advisor Warning
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    role,
    unit,
    user_name,
    user_account,
    password_hash,
    is_active
  )
  VALUES (
    new.id,
    new.email,
    'staff',                                               -- 預設權限
    '待補建',                                           -- 預設單位
    '新進人員',                                       -- 預設姓名
    split_part(new.email, '@', 1),      -- 預設帳號 (取 Email 前綴)
    'supabase_managed',                  -- 密碼由 Supabase Auth 管理
    true                                                 -- 預設啟用
  );
  RETURN new;
END;
$$;


-- 12.刪除舊的 Trigger (如果存在)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;


-- 13.建立 Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();