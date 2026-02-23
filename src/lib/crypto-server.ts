/**
 * 後端密碼預處理工具 — SHA-256 + Key-stretching（Node.js 環境）
 * 與前端 crypto.ts 使用相同演算法，確保一致性
 */

import { createHash } from 'crypto'

/** SHA-256 迭代次數（key-stretching）— 必須與前端一致 */
const HASH_ITERATIONS = 10000

/** 固定後綴 — 必須與前端 crypto.ts 的 HASH_SUFFIX 一致 */
const HASH_SUFFIX = '#A0'

/**
 * 將字串做一次 SHA-256 hash，回傳 hex string（Node.js 版）
 */
function sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex')
}

/**
 * 對密碼做 SHA-256 + Key-stretching（多次迭代）
 * 回傳最終 hash + 固定後綴，與前端 hashPassword 結果一致
 *
 * @param password - 使用者原始密碼
 * @param iterations - SHA-256 迭代次數，預設 10000
 * @returns hex hash + 後綴（如 "a3f2...#A0"）
 */
export function hashPasswordServer(
    password: string,
    iterations: number = HASH_ITERATIONS
): string {
    let hash = sha256(password)
    for (let i = 1; i < iterations; i++) {
        hash = sha256(hash)
    }
    return hash + HASH_SUFFIX
}
