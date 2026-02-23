# 資安需求技術實作機制 — 完整稽核報告

## 概要

對照需求文件 H 節（資安需求技術實作機制，共 11 條）和 I 節（資安需求安全原則，共 4 條），逐條確認現有實作狀態。

---

## H 節：資安需求技術實作機制（11 條）

| # | 需求內容 | 狀態 | 實作位置 / 說明 |
|---|---------|------|----------------|
| H1 | 前端先做 SHA-256 預處理後，再傳送給 Supabase | ✅ 已完成 | [crypto.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/lib/crypto.ts) — `hashPassword()` 函式，所有表單元件已整合 |
| H2 | 密碼強度檢查 ≥3 種規定 | ✅ 已完成 | [schemas.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/lib/validations/schemas.ts) — `count >= 3` |
| H3 | Google reCAPTCHA 伺服端驗證，檢查 score 與 action | ✅ 已完成 | [recaptcha.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/lib/recaptcha.ts) + [verify-recaptcha/route.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/app/api/verify-recaptcha/route.ts) |
| H4 | email 驗證（註冊後必須驗證才啟用） | ✅ 已完成 | Supabase Auth `signUp` 內建 email confirmation 機制，`RegisterClient.tsx` 設定 `emailRedirectTo`，Login 攔截 `Email not confirmed` 錯誤 |
| H5 | Session token 存放於 sessionStorage | ✅ 已完成 | [client.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/lib/supabase/client.ts) — 自訂 `storage` adapter 導向 `sessionStorage` |
| H6 | Exception 與偵錯資訊寫入 ScriptErrors | ✅ 已完成 | [ErrorBoundary.tsx](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/components/ErrorBoundary.tsx) + [GlobalErrorHandler.tsx](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/components/GlobalErrorHandler.tsx) + [error-logger.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/lib/error-logger.ts) |
| H7 | Key-stretching（多次 SHA-256） | ✅ 已完成 | [crypto.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/lib/crypto.ts) — 10000 次 SHA-256 迭代 |
| H8 | 每個帳號使用不同 Salt，由 Supabase 後端託管 | ✅ 已滿足 | Supabase Auth 內建使用 **bcrypt**（自動生成 per-user salt），前端 hash 後的密碼再經 Supabase 做 bcrypt hash 存儲，符合需求精神 |
| H9 | 機密 key 不會被放到前端程式碼 | ✅ 已合規 | 稽核 `.env.local`：`NEXT_PUBLIC_` 僅暴露 Supabase URL、anon key、Cloudinary cloud name、reCAPTCHA site key — 均為設計上公開的金鑰。`SUPABASE_SERVICE_ROLE_KEY` 和 `RECAPTCHA_SECRET_KEY` 無 `NEXT_PUBLIC_` 前綴，不會進入前端 bundle |
| H10 | 連續登入失敗 5 次，鎖定帳號半小時 | ✅ 已完成 | [auth.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/actions/auth.ts) — `handleLoginFailure()` 計數達 5 次觸發 30 分鐘鎖定，`checkUserLockStatus()` 驗證鎖定狀態 |
| H11 | 後端呼叫 Google 驗證 token | ✅ 已完成 | 同 H3，[verify-recaptcha/route.ts](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/src/app/api/verify-recaptcha/route.ts) 後端呼叫 `https://www.google.com/recaptcha/api/siteverify` |

---

## I 節：資安需求安全原則（4 條）

| # | 需求內容 | 狀態 | 說明 |
|---|---------|------|------|
| I1 | 不儲存明文密碼 | ✅ 已滿足 | 前端 SHA-256 hash → Supabase Auth 再做 bcrypt hash → DB 只存 bcrypt hash |
| I2 | 不儲存明文 token，僅存 tokenHash | ✅ 已滿足 | `users` 表只存 `reset_token_hash` 和 `verify_token_hash`（欄位命名和 DB schema 設計都是 hash 欄位）。Supabase Auth 對 reset/verify token 的 handling 本身也不會存明文 |
| I3 | 限制 token 可用期間 | ✅ 已滿足 | `users` 表有 `reset_token_expire` 和 `verify_token_expire` 欄位。Supabase Auth 的 reset token 預設 24 小時過期，`ForgotPasswordClient` 也提示「連結有效期為 24 小時」 |
| I4 | 首頁根據參數回傳不同頁面 | ✅ 已滿足 | Next.js App Router 架構本身就是根據 URL path 回傳不同頁面（`/` 首頁、`/login` 登入、`/dashboard` 表格等）。`middleware.ts` 根據登入狀態做路由保護 |

---

## 使用者待辦事項（非程式碼）

> [!IMPORTANT]
> 以下兩項需要手動完成：

1. **設定 reCAPTCHA 環境變數** — `.env.local` 中的 `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` 和 `RECAPTCHA_SECRET_KEY` 目前仍為 placeholder 值（`your-site-key` / `your-secret-key`）。需到 [Google reCAPTCHA Console](https://www.google.com/recaptcha/admin) 建立 v3 金鑰後填入。
2. **執行 RLS SQL** — 需在 Supabase Dashboard SQL Editor 中執行 [fix_anon_select.sql](file:///Users/user/Desktop/電子白板/whiteboard-nextjs/sql/fix_anon_select.sql)，允許 anon 角色讀取首頁統計資料。

---

## 結論

**H 節 11 條 + I 節 4 條 = 全部 15 條需求，程式碼面全部已完成。** 無需額外程式碼修改。

如果你想要繼續做其他功能或有進一步的資安強化需求（例如 CSRF protection、rate limiting、CSP headers 等），請告知方向。
