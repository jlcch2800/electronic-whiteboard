/**
 * Google reCAPTCHA v3 前端整合
 * 需求 H3：加入 reCAPTCHA 伺服端驗證
 */

declare global {
    interface Window {
        grecaptcha: {
            ready: (cb: () => void) => void
            execute: (siteKey: string, options: { action: string }) => Promise<string>
        }
    }
}

/** 檢查 site key 是否為有效值（排除已知的預設佔位符） */
function isValidSiteKey(key: string | undefined): key is string {
    if (!key || typeof key !== 'string') return false
    const placeholders = [
        'your-site-key',
        'your_site_key',
        'your-recaptcha-site-key',
        'placeholder',
        '6leixxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    ]
    const trimmedKey = key.trim().toLowerCase()
    return trimmedKey.length > 10 && !placeholders.includes(trimmedKey)
}

/** reCAPTCHA script 是否已載入 */
let scriptLoaded = false

/**
 * 動態載入 Google reCAPTCHA v3 script
 */
export function loadRecaptchaScript(): Promise<void> {
    if (scriptLoaded) return Promise.resolve()

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    if (!isValidSiteKey(siteKey)) {
        console.warn('[reCAPTCHA] NEXT_PUBLIC_RECAPTCHA_SITE_KEY 未設定或為佔位符，目前網域可能不支援')
        return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
        // 檢查是否已存在 script tag
        if (document.querySelector('script[src*="recaptcha"]')) {
            scriptLoaded = true
            resolve()
            return
        }

        const script = document.createElement('script')
        script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
        script.async = true
        script.defer = true
        script.onload = () => {
            scriptLoaded = true
            resolve()
        }
        script.onerror = () => {
            console.error('[reCAPTCHA] Script 載入失敗，請檢查網路連接或 Site Key 設定')
            reject(new Error('reCAPTCHA script 載入失敗'))
        }
        document.head.appendChild(script)
    })
}

/**
 * 執行 reCAPTCHA 並取得 token
 * @param action - 動作名稱（如 'login', 'register', 'forgot_password'）
 * @returns reCAPTCHA token 或 null（若未設定 site key）
 */
export async function executeRecaptcha(action: string): Promise<string | null> {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    if (!isValidSiteKey(siteKey)) {
        console.warn('[reCAPTCHA] 未偵測到有效的 NEXT_PUBLIC_RECAPTCHA_SITE_KEY，請確認 Vercel 環境變數')
        return null
    }

    try {
        await loadRecaptchaScript()

        return await new Promise((resolve, reject) => {
            if (!window.grecaptcha || !window.grecaptcha.ready) {
                return reject(new Error('reCAPTCHA 未能正確初始化'))
            }

            window.grecaptcha.ready(async () => {
                try {
                    const token = await window.grecaptcha.execute(siteKey, { action })
                    if (!token) {
                        return reject(new Error('未能取得驗證 Token，可能是網域限制或金鑰錯誤'))
                    }
                    resolve(token)
                } catch (err: any) {
                    console.error('[reCAPTCHA] 執行失敗:', err)
                    reject(new Error(err.message || '驗證執行中斷'))
                }
            })
        })
    } catch (err: any) {
        console.error('[reCAPTCHA] 流程錯誤:', err.message)
        throw err
    }
}

/**
 * 呼叫後端 API 驗證 reCAPTCHA token
 * @param token - 前端取得的 reCAPTCHA token
 * @param action - 預期的動作名稱
 * @returns 驗證是否通過
 */
export async function verifyRecaptchaToken(
    token: string,
    action: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch('/api/verify-recaptcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, action }),
        })
        return await response.json()
    } catch {
        return { success: false, error: 'reCAPTCHA 驗證請求失敗' }
    }
}
