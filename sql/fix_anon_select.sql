-- ============================================================
-- RLS 修補：允許 anon 對三張主表做完整 CRUD
-- 廠商今日施工項目、工務今日施工項目、待處理工作項目
-- ============================================================
-- 請在 Supabase Dashboard > SQL Editor 中執行此腳本

-- ============================
-- 1. vendor_today_work
-- ============================

-- SELECT（若已存在則跳過）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'vendor_today_work'
        AND policyname = 'Anon can read vendor_today_work'
    ) THEN
        EXECUTE 'CREATE POLICY "Anon can read vendor_today_work" ON vendor_today_work FOR SELECT TO anon USING (true)';
    END IF;
END $$;

-- INSERT
CREATE POLICY "Anon can insert vendor_today_work"
ON vendor_today_work
FOR INSERT
TO anon
WITH CHECK (true);

-- UPDATE
CREATE POLICY "Anon can update vendor_today_work"
ON vendor_today_work
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "Anon can delete vendor_today_work"
ON vendor_today_work
FOR DELETE
TO anon
USING (true);

-- ============================
-- 2. engineering_today_work
-- ============================

-- SELECT（若已存在則跳過）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'engineering_today_work'
        AND policyname = 'Anon can read engineering_today_work'
    ) THEN
        EXECUTE 'CREATE POLICY "Anon can read engineering_today_work" ON engineering_today_work FOR SELECT TO anon USING (true)';
    END IF;
END $$;

-- INSERT
CREATE POLICY "Anon can insert engineering_today_work"
ON engineering_today_work
FOR INSERT
TO anon
WITH CHECK (true);

-- UPDATE
CREATE POLICY "Anon can update engineering_today_work"
ON engineering_today_work
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "Anon can delete engineering_today_work"
ON engineering_today_work
FOR DELETE
TO anon
USING (true);

-- ============================
-- 3. pending_work
-- ============================

-- SELECT（若已存在則跳過）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'pending_work'
        AND policyname = 'Anon can read pending_work'
    ) THEN
        EXECUTE 'CREATE POLICY "Anon can read pending_work" ON pending_work FOR SELECT TO anon USING (true)';
    END IF;
END $$;

-- INSERT
CREATE POLICY "Anon can insert pending_work"
ON pending_work
FOR INSERT
TO anon
WITH CHECK (true);

-- UPDATE
CREATE POLICY "Anon can update pending_work"
ON pending_work
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "Anon can delete pending_work"
ON pending_work
FOR DELETE
TO anon
USING (true);
