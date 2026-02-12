-- Fix system_change_log column length issues
-- The error "value too long for type character varying(20)" indicates some columns are too short.
-- User requested to expand user_account (email) to 30 characters.

BEGIN;

-- 1. Alter user_account to VARCHAR(30)
ALTER TABLE system_change_log ALTER COLUMN user_account TYPE VARCHAR(30);

-- 2. Alter user_name to VARCHAR(30) to match
ALTER TABLE system_change_log ALTER COLUMN user_name TYPE VARCHAR(30);

-- 3. Alter user_unit to VARCHAR(30) to match
ALTER TABLE system_change_log ALTER COLUMN user_unit TYPE VARCHAR(30);

COMMIT;
