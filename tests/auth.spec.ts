// E2E 登入流程測試 — 管理員 + 一般人員
import { test, expect } from '@playwright/test';

// 從 .env.test 讀取帳密（由 playwright.config.ts 載入）
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;
const USER_EMAIL = process.env.TEST_USER_EMAIL!;
const USER_PASSWORD = process.env.TEST_USER_PASSWORD!;

test.describe('登入流程', () => {

    test('管理員帳號能成功登入', async ({ page }) => {
        await page.goto('/login');

        // 填寫帳密
        await page.getByPlaceholder('name@example.com').fill(ADMIN_EMAIL);
        await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);

        // 點擊登入
        await page.getByRole('button', { name: '登入' }).click();

        // 登入後應跳轉到首頁，並顯示系統管理選單（管理員才有）
        await page.waitForURL('/', { timeout: 15000 });
        await expect(page.getByText('系統管理')).toBeVisible({ timeout: 10000 });
    });

    test('一般人員帳號能成功登入', async ({ page }) => {
        await page.goto('/login');

        await page.getByPlaceholder('name@example.com').fill(USER_EMAIL);
        await page.getByPlaceholder('••••••••').fill(USER_PASSWORD);
        await page.getByRole('button', { name: '登入' }).click();

        // 登入後跳轉首頁，但不會顯示系統管理
        await page.waitForURL('/', { timeout: 15000 });
        await expect(page.getByText('首頁')).toBeVisible({ timeout: 10000 });
    });

    test('錯誤密碼登入失敗', async ({ page }) => {
        await page.goto('/login');

        await page.getByPlaceholder('name@example.com').fill(ADMIN_EMAIL);
        await page.getByPlaceholder('••••••••').fill('wrongpassword123');
        await page.getByRole('button', { name: '登入' }).click();

        // 應顯示錯誤訊息
        await expect(page.getByText('帳號或密碼錯誤')).toBeVisible({ timeout: 10000 });
    });
});
