# 電子白板頁面美化 — 工作清單

## Phase 0 — 自動化測試基礎建設
- [x] 0.1 安裝 Vitest + React Testing Library
- [x] 0.2 安裝 Playwright（含瀏覽器引擎）
- [x] 0.3 建立設定檔（`vitest.config.ts`、`playwright.config.ts`）
- [x] 0.4 新增 npm scripts（`test`、`test:e2e`、`test:e2e:ui`）
- [x] 0.5 範例測試驗證通過

## Phase 1 — 基礎架構
- [x] 1.1 抽出共用 `<Navbar />` 元件
- [x] 1.2 升級 `globals.css` 色彩系統（品牌色）
- [x] 1.3 行動版漢堡選單
- [x] 1.4 導覽項目 Active 狀態指示

## Phase 2 — 表格體驗升級
- [x] 2.1 分頁器元件
    - [x] 儀表板與今日施工相關表格
    - [x] 歷史資料 (`/history/*`)
    - [x] 施工回報 (`/work-report`)
    - [x] 施工文件 (`/work-file`)
    - [x] 帳號管理 (`/admin/users`)
    - [x] 系統異動紀錄 (`/admin/change-log`)
    - [x] 系統執行紀錄 (`/admin/execution-log`)
- [x] 2.2 欄位排序功能
- [x] 2.3 表格工具列重排
- [x] 2.4 空狀態視覺美化（EmptyState 元件）
- [x] 2.5 行末操作 Dropdown

## Phase 3 — 表單 UX 強化
- [ ] 3.1 即時驗證回饋 UI
- [ ] 3.2 提交成功動畫
- [ ] 3.3 表單 Header 步驟引導

## Phase 4 — 動畫與轉場
- [ ] 4.1 Skeleton Screen 骨架屏
- [ ] 4.2 頁面轉場動畫
- [ ] 4.3 按鈕微互動強化

## Phase 5 — 登入 / 註冊頁面
- [ ] 5.1 登入頁雙欄佈局
- [ ] 5.2 浮動標籤動畫
- [ ] 5.3 密碼強度指示（註冊頁）

## Phase 6 — 響應式補完
- [ ] 6.1 表格→卡片式切換（行動版）
- [ ] 6.2 搜尋工具可折疊
- [ ] 6.3 全頁面小螢幕測試與修正
