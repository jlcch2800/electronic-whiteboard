// 首頁 Server Component - 查詢統計數據並渲染 HomeClient
import { createClient } from '@/lib/supabase/server'
import HomeClient from './HomeClient'

// Force dynamic rendering (no prerendering at build time)
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  // 使用台灣時區取得今天日期，避免 UTC 時差導致查錯日期
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  // 最近7天的起始日期（含今天往前推6天）
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

  // 查詢三張表的 count + 條列資料，全部併行
  const [
    vendorCount,
    engineeringCount,
    pendingCount,
    pendingRecent,
    vendorRecent,
    engineeringRecent,
  ] = await Promise.all([
    supabase
      .from('vendor_today_work')
      .select('*', { count: 'exact', head: true })
      .eq('work_date', today),
    supabase
      .from('engineering_today_work')
      .select('*', { count: 'exact', head: true })
      .lte('start_date', today)
      .gte('end_date', today),
    // pending_work 只檢查 end_date >= today（尚未過期的待辦），不限制 start_date
    supabase
      .from('pending_work')
      .select('*', { count: 'exact', head: true })
      .gte('end_date', today),
    // 最近7天內開始的預定事項（供首頁條列顯示）
    supabase
      .from('pending_work')
      .select('id, start_date, vendor_name, unit, work_content')
      .gte('start_date', sevenDaysAgoStr)
      .order('start_date', { ascending: true })
      .limit(10),
    // 廠商今日工作條列
    supabase
      .from('vendor_today_work')
      .select('id, vendor_name, location, work_content')
      .eq('work_date', today)
      .order('work_date', { ascending: true })
      .limit(10),
    // 工務今日排程條列（今日有效中）
    supabase
      .from('engineering_today_work')
      .select('id, end_date, vendor_name, unit, work_content')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: true })
      .limit(10),
  ])

  return (
    <HomeClient
      initialCounts={{
        vendor: vendorCount.count ?? 0,
        engineering: engineeringCount.count ?? 0,
        pending: pendingCount.count ?? 0,
      }}
      initialPendingRecent={pendingRecent.data ?? []}
      initialVendorRecent={vendorRecent.data ?? []}
      initialEngineeringRecent={engineeringRecent.data ?? []}
      today={today}
    />
  )
}
