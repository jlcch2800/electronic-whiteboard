// 電子白板 E2E 測試範例 — 驗證 Playwright 安裝正確
import { test, expect } from '@playwright/test';

test('首頁能正常載入', async ({ page }) => {
  await page.goto('/');

  // 檢查頁面標題
  await expect(page).toHaveTitle(/工務室電子白板/);

  // 檢查統計卡片存在
  await expect(page.getByText('廠商今日施工項目')).toBeVisible();
  await expect(page.getByText('工務今日施工項目')).toBeVisible();
  await expect(page.getByText('待處理工作項目')).toBeVisible();
});

test('導覽列顯示正確', async ({ page }) => {
  await page.goto('/');

  // 檢查品牌標題
  await expect(page.getByText('工務室電子白板')).toBeVisible();

  // 檢查導覽項目存在
  await expect(page.getByText('首頁')).toBeVisible();
  await expect(page.getByText('今日-待處理')).toBeVisible();
});

test('登入頁面能正常載入', async ({ page }) => {
  await page.goto('/login');

  // 檢查登入表單
  await expect(page.getByText('登入系統')).toBeVisible();
  await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
});
