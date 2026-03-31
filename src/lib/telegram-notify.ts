/**
 * Telegram 通知 - Client-side 格式化與發送工具
 * 提供訊息格式化函式和 fire-and-forget 發送
 */

// 排除的欄位（不顯示在通知訊息中）
const EXCLUDED_FIELDS = ['id', 'created_at']

// 特殊欄位值的中文轉換
const VALUE_TRANSFORMERS: Record<string, Record<string, string>> = {
    entry_status: { arrival: '到院', departure: '離院' },
    work_status: { completed: '完成', incomplete: '未完成', abnormal: '異常' },
}

// ═══════════════════════════════════
// 各模組欄位中文名稱對照表
// ═══════════════════════════════════

/** 廠商今日施工項目 - 欄位標籤 */
export const VENDOR_WORK_LABELS: Record<string, string> = {
    entry_status: '到院/離院',
    work_date: '施工日期',
    arrival_time: '到院時間',
    departure_time: '離院時間',
    vendor_name: '廠商名稱',
    vendor_badge_id: '廠商工作證號',
    vendor_contact: '廠商負責人員姓名',
    vendor_contact_phone: '廠商負責人員電話',
    building: '棟別',
    floor: '樓層',
    location: '施工地點',
    head_count: '施工人數',
    work_content: '施工內容',
    note: '備註',
}

/** 工務今日施工項目（施工回報）- 欄位標籤 */
export const WORK_REPORT_LABELS: Record<string, string> = {
    report_date: '日期',
    report_time: '時間',
    vendor_name: '廠商',
    work_location: '施工地點',
    engineering_contact: '工務負責人員',
    work_status: '施工狀態',
    work_content: '工作內容',
    note: '備註',
}

/** 待處理工作項目 - 欄位標籤 */
export const PENDING_WORK_LABELS: Record<string, string> = {
    start_date: '開始日期',
    end_date: '結束日期',
    time: '時間',
    vendor_name: '廠商',
    unit: '單位',
    engineering_contact: '工務負責人員',
    work_content: '內容',
    note: '備註',
}

/** 工務今日施工項目 - 欄位標籤 */
export const ENGINEERING_WORK_LABELS: Record<string, string> = {
    start_date: '開始日期',
    end_date: '結束日期',
    time: '時間',
    vendor_name: '廠商',
    unit: '單位',
    engineering_contact: '工務負責人員',
    work_content: '內容',
    note: '備註',
}

// ═══════════════════════════════════
// 格式化工具函式
// ═══════════════════════════════════

/**
 * 將欄位值轉換為可讀文字
 */
function formatValue(key: string, value: any): string {
    if (value === null || value === undefined || value === '') return '-'

    // 套用特殊值轉換
    if (VALUE_TRANSFORMERS[key]?.[value]) {
        return VALUE_TRANSFORMERS[key][value]
    }

    return String(value)
}

/**
 * 將資料物件格式化為「欄位名稱：欄位資料」的多行文字
 */
function formatFields(data: Record<string, any>, labels: Record<string, string>): string {
    return Object.entries(labels)
        .filter(([key]) => !EXCLUDED_FIELDS.includes(key))
        .map(([key, label]) => `• ${label}：${formatValue(key, data[key])}`)
        .join('\n')
}

/**
 * 取得台灣時間字串
 */
function getNowString(): string {
    return new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    })
}

// ═══════════════════════════════════
// 訊息格式化函式
// ═══════════════════════════════════

/**
 * 格式化「新增」通知訊息
 * @param module - 模組名稱（如「廠商今日施工項目」）
 * @param data - 新增的資料
 * @param labels - 欄位名稱對照表
 */
export function formatCreateMessage(
    module: string,
    data: Record<string, any>,
    labels: Record<string, string>
): string {
    const fields = formatFields(data, labels)
    return [
        `📋 【新增】${module}`,
        '━━━━━━━━━━━━━',
        fields,
        '━━━━━━━━━━━━━',
        `🕐 ${getNowString()}`,
    ].join('\n')
}

/**
 * 格式化「修改」通知訊息（含修改前後對照）
 * @param module - 模組名稱
 * @param before - 修改前的資料
 * @param after - 修改後的資料
 * @param labels - 欄位名稱對照表
 */
export function formatUpdateMessage(
    module: string,
    before: Record<string, any>,
    after: Record<string, any>,
    labels: Record<string, string>
): string {
    const fieldsText = Object.entries(labels)
        .filter(([key]) => !EXCLUDED_FIELDS.includes(key))
        .map(([key, label]) => {
            const beforeVal = formatValue(key, before[key]);
            const afterVal = formatValue(key, after[key]);
            
            // 值有變動時，特別標註與顯示對照
            if (beforeVal !== afterVal) {
                return `✍️ 【${label}】 (已修改)\n  ❌ 原本：${beforeVal}\n  ✅ 變更：${afterVal}`;
            }
            
            // 未變動的保留原樣
            return `• ${label}：${afterVal}`;
        })
        .join('\n\n');

    return [
        `✏️ 【修改】${module}`,
        '━━━━━━━━━━━━━',
        fieldsText,
        '━━━━━━━━━━━━━',
        `🕐 ${getNowString()}`,
    ].join('\n')
}

/**
 * 格式化「刪除」通知訊息（含每筆被刪除的完整資料）
 * @param module - 模組名稱
 * @param items - 被刪除的資料陣列
 * @param labels - 欄位名稱對照表
 */
export function formatDeleteMessage(
    module: string,
    items: Array<Record<string, any>>,
    labels: Record<string, string>
): string {
    const parts: string[] = [
        `🗑️ 【刪除】${module}`,
        '━━━━━━━━━━━━━',
        `已刪除 ${items.length} 筆資料`,
    ]

    items.forEach((item, index) => {
        if (items.length > 1) {
            parts.push(`\n── 第 ${index + 1} 筆 ──`)
        } else {
            parts.push('') // 空行分隔
        }
        parts.push(formatFields(item, labels))
    })

    parts.push('━━━━━━━━━━━━━')
    parts.push(`🕐 ${getNowString()}`)

    return parts.join('\n')
}

// ═══════════════════════════════════
// 發送函式（fire-and-forget）
// ═══════════════════════════════════

/**
 * 非同步發送 Telegram 通知（不阻塞主流程）
 * @param message - 已格式化的訊息文字
 */
export function sendTelegramNotify(message: string): void {
    fetch('/api/notify/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    }).catch((err) => {
        console.warn('[Telegram 通知] 發送失敗:', err)
    })
}
