# 匿名使用者權限開放與 Session 修復

## 變更摘要

本次工作開放了三個核心表格（廠商今日施工、工務今日施工、待處理工作）的完整 CRUD 權限給未登入使用者，並修復了已登入使用者被重導到登入頁的 session 問題。

---

## 已完成的變更

### 1. RLS 策略更新
- **檔案**：[fix_anon_select.sql](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/sql/fix_anon_select.sql)
- 新增 `anon` role 的 INSERT / UPDATE / DELETE 權限，涵蓋 `vendor_today_work`、`engineering_today_work`、`pending_work` 三張表

### 2. Middleware 路由保護調整
- **檔案**：[middleware.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/lib/supabase/middleware.ts)
- 移除 `/engineering-work` 和 `/pending-work` 的保護，允許匿名存取

### 3. Dashboard 頁面（WhiteboardClient.tsx）
- **檔案**：[WhiteboardClient.tsx](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/app/WhiteboardClient.tsx)
- 移除三個表格的 `isLoggedIn` guard
- 選取 checkbox、修改、刪除、匯出按鈕現在未登入也可操作

### 4. 三個獨立頁面
- [VendorWorkClient.tsx](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/app/vendor-work/VendorWorkClient.tsx)
- [EngineeringWorkClient.tsx](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/app/engineering-work/EngineeringWorkClient.tsx)
- [PendingWorkClient.tsx](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/app/pending-work/PendingWorkClient.tsx)
- 同樣移除所有 `isLoggedIn` guard，讓未登入使用者也能使用修改/刪除/匯出/選取功能

### 5. Session 管理修復
- **檔案**：[client.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/lib/supabase/client.ts)
- **問題**：自訂 `sessionStorageAdapter` 將 session token 存在 `sessionStorage`，導致 middleware（server-side）無法透過 cookie 讀取 session → 已登入用戶被重導到登入頁
- **修復**：移除自訂 storage adapter，恢復 `@supabase/ssr` 預設 cookie-based session 管理

### 6. 其他安全性修改（先前完成）
- `crypto.ts` / `crypto-server.ts`：SHA-256 雜湊加上 `#A0` 後綴以符合 Supabase 密碼策略
- `recaptcha.ts`：加入 placeholder key 檢查，防止用無效 key 載入 reCAPTCHA

---

## 驗證結果

| 項目 | 狀態 |
|------|------|
| `/vendor-work` 未登入顯示修改/刪除/匯出按鈕 | ✅ |
| `/engineering-work` 未登入顯示修改/刪除/匯出按鈕 | ✅ |
| `/pending-work` 未登入顯示修改/刪除/匯出按鈕 | ✅ |
| `/dashboard` 三表 checkbox 未登入可用 | ✅ |
| 已登入使用者可存取受保護頁面（歷史記錄、系統管理） | ✅ |
| Session 透過 cookie 正確傳遞到 middleware | ✅ |

---

## 使用者需手動操作

1. **執行 RLS SQL**：在 Supabase Dashboard 執行 `sql/fix_anon_select.sql`
2. **設定 reCAPTCHA key**：`.env.local` 中替換 placeholder 為實際金鑰
3. **重新登入**：因 session storage 機制變更，需重新登入一次
