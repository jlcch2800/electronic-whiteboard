// E2E 登入流程測試 — 管理員 + 一般人員（適配升級版浮動標籤 UI）
import { test, expect } from '@playwright/test';

// 從 .env.test 讀取帳密（由 playwright.config.ts 載入）
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;
const USER_EMAIL = process.env.TEST_USER_EMAIL!;
const USER_PASSWORD = process.env.TEST_USER_PASSWORD!;

test.describe('登入流程', () => {

    test('管理員帳號能成功登入', async ({ page }) => {
        await page.goto('/login');

        // 使用 id 選取器，適配浮動標籤版的新 UI（無 placeholder）
        await page.locator('#email').fill(ADMIN_EMAIL);
        await page.locator('#password').fill(ADMIN_PASSWORD);

        // 點擊登入
        await page.getByRole('button', { name: '登入' }).click();

        // 登入後應跳轉到首頁，並顯示系統管理選單（管理員才有）
        await page.waitForURL('/', { timeout: 15000 });
        await expect(page.getByText('系統管理')).toBeVisible({ timeout: 10000 });
    });

    test('一般人員帳號能成功登入', async ({ page }) => {
        await page.goto('/login');

        await page.locator('#email').fill(USER_EMAIL);
        await page.locator('#password').fill(USER_PASSWORD);
        await page.getByRole('button', { name: '登入' }).click();

        // 登入後跳轉首頁，但不會顯示系統管理
        await page.waitForURL('/', { timeout: 15000 });
        await expect(page.getByText('首頁')).toBeVisible({ timeout: 10000 });
    });

    test('錯誤密碼登入失敗', async ({ page }) => {
        await page.goto('/login');

        await page.locator('#email').fill(ADMIN_EMAIL);
        await page.locator('#password').fill('wrongpassword123');
        await page.getByRole('button', { name: '登入' }).click();

        // 應顯示錯誤訊息
        await expect(page.getByText('帳號或密碼錯誤')).toBeVisible({ timeout: 10000 });
    });

    test('浮動標籤在輸入時正確浮起', async ({ page }) => {
        await page.goto('/login');

        // 確認初始狀態：標籤在中央位置
        const emailLabel = page.locator('label[for="email"]');
        await expect(emailLabel).toBeVisible();

        // 輸入文字後，標籤應浮動到頂部（class 包含 top-1）
        await page.locator('#email').fill('test@example.com');
        await page.locator('#email').blur();

        // 標籤的 top 位置應變為更小的值（浮動效果）
        const labelClass = await emailLabel.getAttribute('class');
        expect(labelClass).toContain('top-1');
    });

    test('記住我功能：勾選後 localStorage 儲存帳號', async ({ page }) => {
        await page.goto('/login');

        // 填寫帳號
        await page.locator('#email').fill(ADMIN_EMAIL);
        await page.locator('#password').fill(ADMIN_PASSWORD);

        // 勾選「記住我」
        await page.locator('#remember-me').click();

        // 登入
        await page.getByRole('button', { name: '登入' }).click();
        await page.waitForURL('/', { timeout: 15000 });

        // 回到登入頁，應能看到「最近登入」快捷帳號
        await page.goto('/login');
        await expect(page.getByText('最近登入')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(ADMIN_EMAIL)).toBeVisible({ timeout: 5000 });
    });
});
