/**
 * Telegram Bot API - Server-side 通知工具
 * 從環境變數讀取 BOT_TOKEN 和 CHAT_ID，呼叫 Telegram sendMessage API
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org'
// Telegram 單則訊息最大字元數
const MAX_MESSAGE_LENGTH = 4096

/**
 * 發送 Telegram 文字訊息
 * @param text - 訊息內容（純文字）
 * @returns 是否發送成功
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!token || !chatId) {
        console.warn('[Telegram] 缺少 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID 環境變數')
        return false
    }

    try {
        // 若訊息超過長度限制，分段發送
        const chunks = splitMessage(text, MAX_MESSAGE_LENGTH)

        for (const chunk of chunks) {
            const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: chunk,
                }),
            })

            if (!res.ok) {
                const errorBody = await res.text()
                console.error(`[Telegram] 發送失敗: ${res.status} - ${errorBody}`)
                return false
            }
        }

        return true
    } catch (error) {
        console.error('[Telegram] 發送例外:', error)
        return false
    }
}

/**
 * 將過長訊息分段
 */
function splitMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text]

    const chunks: string[] = []
    let remaining = text

    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining)
            break
        }

        // 找到最近的換行符作為分割點
        let splitIndex = remaining.lastIndexOf('\n', maxLength)
        if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
            splitIndex = maxLength
        }

        chunks.push(remaining.slice(0, splitIndex))
        remaining = remaining.slice(splitIndex).trimStart()
    }

    return chunks
}
