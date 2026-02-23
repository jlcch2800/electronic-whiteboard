/**
 * reCAPTCHA 後端驗證 API
 * 需求 H11：後端呼叫 Google 驗證 token
 */
import { NextRequest, NextResponse } from 'next/server'

/** reCAPTCHA 最低通過分數 */
const MIN_SCORE = 0.5

export async function POST(request: NextRequest) {
    try {
        const { token, action } = await request.json()

        if (!token || !action) {
            return NextResponse.json(
                { success: false, error: '缺少 token 或 action' },
                { status: 400 }
            )
        }

        const secretKey = process.env.RECAPTCHA_SECRET_KEY
        if (!secretKey) {
            // 如果未設定 secret key，直接放行（開發環境）
            console.warn('[reCAPTCHA] RECAPTCHA_SECRET_KEY 未設定，跳過驗證')
            return NextResponse.json({ success: true })
        }

        // 呼叫 Google reCAPTCHA siteverify API
        const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify'
        const response = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: secretKey,
                response: token,
            }),
        })

        const data = await response.json()

        // 檢查驗證結果
        if (!data.success) {
            return NextResponse.json(
                { success: false, error: 'reCAPTCHA 驗證失敗' },
                { status: 403 }
            )
        }

        // 檢查分數（v3）
        if (data.score !== undefined && data.score < MIN_SCORE) {
            return NextResponse.json(
                { success: false, error: `reCAPTCHA 分數過低：${data.score}` },
                { status: 403 }
            )
        }

        // 檢查 action 是否匹配
        if (data.action && data.action !== action) {
            return NextResponse.json(
                { success: false, error: 'reCAPTCHA action 不匹配' },
                { status: 403 }
            )
        }

        return NextResponse.json({ success: true, score: data.score })
    } catch (error: any) {
        console.error('[reCAPTCHA] 驗證錯誤:', error)
        return NextResponse.json(
            { success: false, error: '伺服器錯誤' },
            { status: 500 }
        )
    }
}
