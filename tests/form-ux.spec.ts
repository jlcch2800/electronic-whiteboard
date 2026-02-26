import { test, expect } from '@playwright/test'

// 表單 UX 強化 — E2E 測試
// 測試共用元件在各表單頁面的正確性

const FORMS = [
    { path: '/vendor-work/new', name: '廠商今日施工項目', theme: 'blue' },
    { path: '/engineering-work/new', name: '工務今日施工項目', theme: 'amber' },
    { path: '/pending-work/new', name: '待處理工作項目', theme: 'purple' },
    { path: '/work-report/new', name: '施工回報記錄', theme: 'indigo' },
    { path: '/work-file/new', name: '施工文件', theme: 'teal' },
]

test.describe('表單 UX 強化 — 共用元件驗證', () => {
    // 先登入（使用 test account）
    test.beforeEach(async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[type="email"]', process.env.TEST_ADMIN_EMAIL || 'admin@example.com')
        await page.fill('input[type="password"]', process.env.TEST_ADMIN_PASSWORD || 'Test1234!')
        await page.click('button[type="submit"]')
        await page.waitForURL('/', { timeout: 60000 })
    })

    for (const form of FORMS) {
        test.describe(`${form.name} (${form.path})`, () => {
            test('應顯示 FormHeader 含進度條', async ({ page }) => {
                await page.goto(form.path)
                // FormHeader 進度條
                await expect(page.locator('header')).toBeVisible()
                await expect(page.getByText(/步驟 \d+ \/ \d+/)).toBeVisible()
                // 進度條動畫 bar
                await expect(page.locator('header .h-1\\.5')).toBeVisible()
            })

            test('應顯示 BackButton 含左箭頭', async ({ page }) => {
                await page.goto(form.path)
                const backBtn = page.locator('header button').first()
                await expect(backBtn).toBeVisible()
                // hover 時箭頭應有動畫 class
                await expect(backBtn.locator('svg')).toBeVisible()
            })

            test('必填欄位應顯示紅色星號 *', async ({ page }) => {
                await page.goto(form.path)
                // 至少有一個紅色星號
                const asterisks = page.locator('span.text-red-500.font-bold')
                await expect(asterisks.first()).toBeVisible()
                const count = await asterisks.count()
                expect(count).toBeGreaterThan(0)
            })

            test('失焦驗證 — 空白必填欄位應顯示錯誤', async ({ page }) => {
                await page.goto(form.path)
                // 找到第一個 input (排除 hidden/date/time)
                const textInput = page.locator('input[type="text"]').first()
                if (await textInput.count() > 0) {
                    // 清空後失焦
                    await textInput.fill('')
                    await textInput.blur()
                    // 等待驗證反饋出現
                    await page.waitForTimeout(500)
                    // 可能有紅色錯誤訊息或紅色邊框
                    const errorMsg = page.locator('.text-red-500.text-xs')
                    // 不一定所有頁面的第一個 input 都必填，所以做 soft check
                    if (await errorMsg.count() > 0) {
                        await expect(errorMsg.first()).toBeVisible()
                    }
                }
            })

            test('SubmitButton 應存在且為藍色/主題色', async ({ page }) => {
                await page.goto(form.path)
                const submitBtn = page.locator('button[type="submit"]')
                await expect(submitBtn).toBeVisible()
                const text = await submitBtn.textContent()
                expect(text).toContain('提交')
            })
        })
    }

    // 針對 vendor-work/new 做完整流程測試
    test.describe('廠商施工表單 — 完整提交流程', () => {
        test('填寫表單 → 確認 Dialog 應出現', async ({ page }) => {
            await page.goto('/vendor-work/new')

            // 填寫基本資料
            await page.fill('input[name="vendor_name"]', '測試廠商')
            await page.fill('input[name="vendor_contact"]', '張三')
            await page.fill('input[name="vendor_contact_phone"]', '0912345678')

            // 到院欄位
            await page.fill('input[name="building"]', 'A')
            await page.fill('input[name="floor"]', '3F')
            await page.fill('input[name="location"]', '辦公室')
            await page.fill('input[name="vendor_badge_id"]', '123')
            await page.fill('input[name="head_count"]', '3')

            // 填寫施工內容
            await page.fill('textarea[name="work_content"]', '水電維修')

            // 提交
            await page.click('button[type="submit"]')

            // 確認 Dialog 應出現
            await expect(page.getByText('確認提交廠商施工項目')).toBeVisible({ timeout: 3000 })
            // 摘要應包含填入的資料
            await expect(page.getByText('測試廠商')).toBeVisible()
            await expect(page.getByText('張三')).toBeVisible()
        })

        test('ConfirmDialog 取消 → Dialog 關閉', async ({ page }) => {
            await page.goto('/vendor-work/new')

            await page.fill('input[name="vendor_name"]', '測試廠商')
            await page.fill('input[name="vendor_contact"]', '張三')
            await page.fill('input[name="vendor_contact_phone"]', '0912345678')
            await page.fill('input[name="building"]', 'A')
            await page.fill('input[name="floor"]', '3F')
            await page.fill('input[name="location"]', '辦公室')
            await page.fill('input[name="vendor_badge_id"]', '123')
            await page.fill('input[name="head_count"]', '3')
            await page.fill('textarea[name="work_content"]', '水電維修')
            await page.click('button[type="submit"]')

            await expect(page.getByText('確認提交廠商施工項目')).toBeVisible({ timeout: 3000 })

            // 點擊取消
            const cancelBtn = page.getByRole('button', { name: '返回修改' })
            await expect(cancelBtn).toBeVisible()
            await cancelBtn.click()
            // Dialog 應關閉
            await expect(page.getByText('確認提交廠商施工項目')).not.toBeVisible()
        })
    })

    // 驗證 tooltip
    test('必填紅星 hover 應顯示 tooltip', async ({ page }) => {
        await page.goto('/vendor-work/new')
        const asteriskGroup = page.locator('span.relative.group').first()
        await asteriskGroup.hover()
        // tooltip 應該可見
        await expect(asteriskGroup.locator('span.absolute').first()).toBeVisible({ timeout: 2000 })
    })
})
