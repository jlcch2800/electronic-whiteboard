-- Drop triggers that automatically log all table changes to system_execution_log
-- This prevents user actions (CRUD) from appearing in the System Execution Log (cron job log)

-- 1. Vendor Today Work
DROP TRIGGER IF EXISTS log_execution_trigger ON vendor_today_work;
DROP TRIGGER IF EXISTS log_execution_trigger ON vendor_today_work_history;

-- 2. Engineering Today Work
DROP TRIGGER IF EXISTS log_execution_trigger ON engineering_today_work;
DROP TRIGGER IF EXISTS log_execution_trigger ON engineering_work_history;

-- 3. Pending Work
DROP TRIGGER IF EXISTS log_execution_trigger ON pending_work;
DROP TRIGGER IF EXISTS log_execution_trigger ON pending_work_history;

-- 4. Work Report
DROP TRIGGER IF EXISTS log_execution_trigger ON work_report;
DROP TRIGGER IF EXISTS log_execution_trigger ON work_report_history;
