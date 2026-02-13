// 首頁 Server Component - 查詢統計數據並渲染 HomeClient
import { createClient } from '@/lib/supabase/server'
import HomeClient from './HomeClient'

// Force dynamic rendering (no prerendering at build time)
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // 查詢三張表的 count（使用 head: true 只取筆數，不取資料）
  const [vendorCount, engineeringCount, pendingCount] = await Promise.all([
    supabase
      .from('vendor_today_work')
      .select('*', { count: 'exact', head: true })
      .eq('work_date', today),
    supabase
      .from('engineering_today_work')
      .select('*', { count: 'exact', head: true })
      .lte('start_date', today)
      .gte('end_date', today),
    supabase
      .from('pending_work')
      .select('*', { count: 'exact', head: true })
      .lte('start_date', today)
      .gte('end_date', today),
  ])

  return (
    <HomeClient
      initialCounts={{
        vendor: vendorCount.count ?? 0,
        engineering: engineeringCount.count ?? 0,
        pending: pendingCount.count ?? 0,
      }}
    />
  )
}
