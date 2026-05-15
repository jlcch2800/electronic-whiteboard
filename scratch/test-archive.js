const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // 使用 service role 繞過 RLS

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testArchiving() {
    const workOrderId = `T-${Date.now().toString().slice(-8)}`
    console.log(`Creating test order: ${workOrderId}`)

    // 1. 建立測試資料
    const { data: inserted, error: insertError } = await supabase
        .from('maintenance_work_orders')
        .insert({
            request_date: '2026-05-14',
            request_department: '測試部',
            cost_center: 'C001',
            maintain_content: '測試歸檔功能',
            requester_name: '測試員',
            work_order_id: workOrderId,
            handler_name: '李建賢',
            work_order_date: '2026-05-14',
            maint_mgr_name: '李建賢',
            maint_mgr_date: '2026-05-14',
            status: '維修部門驗收中' // 設定為最後一個階段的前一步
        })
        .select()
        .single()

    if (insertError) {
        console.error('Insert error:', insertError)
        return
    }

    console.log('Order created. Updating status to "已驗收"...')

    // 2. 更新狀態觸發歸檔
    const { error: updateError } = await supabase
        .from('maintenance_work_orders')
        .update({ status: '已驗收' })
        .eq('id', inserted.id)

    if (updateError) {
        console.error('Update error:', updateError)
        return
    }

    console.log('Status updated. Verifying archive...')

    // 3. 確認主表是否已刪除
    const { data: mainData } = await supabase
        .from('maintenance_work_orders')
        .select('id')
        .eq('id', inserted.id)
        .single()

    if (mainData) {
        console.error('FAILED: Record still exists in maintenance_work_orders')
    } else {
        console.log('SUCCESS: Record removed from main table')
    }

    // 4. 確認歷史表是否有資料
    const { data: histData } = await supabase
        .from('maintenance_work_orders_history')
        .select('id, work_order_id, status')
        .eq('id', inserted.id)
        .single()

    if (histData) {
        console.log('SUCCESS: Record found in history table:', histData)
    } else {
        console.error('FAILED: Record not found in history table')
    }
}

testArchiving()
