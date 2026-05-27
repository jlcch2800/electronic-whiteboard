/**
 * 系統異動紀錄 - Client-side 工具函式
 * Fire-and-forget 呼叫 /api/change-log 寫入異動紀錄
 */

interface ChangeLogParams {
    /** 動作類型 */
    actionType: 'Insert' | 'Update' | 'Delete'
    /** 異動的資料表名稱 */
    modifyTable: string
    /** 異動的紀錄 ID */
    modifyRecordId: string
    /** 舊資料（Update/Delete 時傳入） */
    oldData?: Record<string, any> | null
    /** 新資料（Insert/Update 時傳入） */
    newData?: Record<string, any> | null
}

/**
 * 寫入系統異動紀錄（非同步，不阻塞主流程）
 * 
 * @example
 * // 新增
 * logChangeRecord({ actionType: 'Insert', modifyTable: 'vendor_today_work', modifyRecordId: data.id, newData: payload })
 * 
 * // 修改
 * logChangeRecord({ actionType: 'Update', modifyTable: 'vendor_today_work', modifyRecordId: id, oldData: before, newData: after })
 * 
 * // 刪除
 * logChangeRecord({ actionType: 'Delete', modifyTable: 'vendor_today_work', modifyRecordId: id, oldData: deletedItem })
 */
export function logChangeRecord(params: ChangeLogParams): Promise<void> {
    return fetch('/api/change-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action_type: params.actionType,
            modify_table: params.modifyTable,
            modify_record_id: params.modifyRecordId,
            old_data: params.oldData || null,
            new_data: params.newData || null,
        }),
    }).then(async (res) => {
        if (!res.ok) {
            const errText = await res.text()
            console.warn(`[系統異動紀錄] 寫入失敗 (狀態碼 ${res.status}):`, errText)
        }
    }).catch((err) => {
        console.warn('[系統異動紀錄] 網路錯誤:', err)
    })
}

/**
 * 批次寫入刪除紀錄（用於一次刪除多筆資料的場景）
 * 
 * @param modifyTable - 資料表名稱
 * @param deletedItems - 被刪除的資料陣列（每筆需含 id）
 */
export function logBatchDeleteRecords(
    modifyTable: string,
    deletedItems: Array<Record<string, any>>
): Promise<void> {
    const promises = deletedItems.map((item) =>
        logChangeRecord({
            actionType: 'Delete',
            modifyTable,
            modifyRecordId: item.id,
            oldData: item,
        })
    )
    return Promise.all(promises).then(() => {})
}
