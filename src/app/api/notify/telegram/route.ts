/**
 * Telegram 通知 API Route
 * POST /api/notify/telegram
 * Body: { message: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json()

        if (!message || typeof message !== 'string') {
            return NextResponse.json(
                { error: '缺少 message 參數' },
                { status: 400 }
            )
        }

        const success = await sendTelegramMessage(message)

        return NextResponse.json({ success })
    } catch (error) {
        console.error('[API /notify/telegram] 錯誤:', error)
        return NextResponse.json(
            { error: '內部錯誤', success: false },
            { status: 500 }
        )
    }
}
