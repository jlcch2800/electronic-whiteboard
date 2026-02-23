/**
 * 前端密碼預處理工具 — SHA-256 + Key-stretching
 * 需求 H1：前端做 SHA-256 預處理後再傳給 Supabase
 * 需求 H7：Key-stretching，多次 SHA-256 迭代
 */

/** SHA-256 迭代次數（key-stretching） */
const HASH_ITERATIONS = 10000

/**
 * 固定後綴 — 讓 hex hash 滿足 Supabase Auth 密碼政策
 * （要求包含大寫字母 + 特殊符號，hex hash 本身只有 [0-9a-f]）
 * 此後綴不影響安全性，因為真正的密碼保護來自 SHA-256 迭代 + Supabase bcrypt
 */
const HASH_SUFFIX = '#A0'

/**
 * 將字串做一次 SHA-256 hash，回傳 hex string
 */
async function sha256(input: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 對密碼做 SHA-256 + Key-stretching（多次迭代）
 * 回傳最終 hash + 固定後綴，作為傳給 Supabase Auth 的「密碼」
 *
 * @param password - 使用者原始密碼
 * @param iterations - SHA-256 迭代次數，預設 10000
 * @returns hex hash + 後綴（如 "a3f2...#A0"）
 */
export async function hashPassword(
    password: string,
    iterations: number = HASH_ITERATIONS
): Promise<string> {
    let hash = await sha256(password)
    for (let i = 1; i < iterations; i++) {
        hash = await sha256(hash)
    }
    return hash + HASH_SUFFIX
}
