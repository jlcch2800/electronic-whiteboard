'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Activity, ArrowRight, ClipboardList, Clock,
    CheckCircle2, AlertCircle, FileText, Hammer,
    Send, ShieldCheck, ShoppingCart, UserCheck, Wrench
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { MAINTENANCE_STATUS, STATUS_COLORS } from '@/lib/maintenance-constants'
import { Badge } from '@/components/ui/badge'

interface SummaryItem {
    id: string
    request_date: string
    maintain_content: string
    work_order_id: string
    cost_center: string
}

interface StatusStat {
    status: string
    count: number
    recent: SummaryItem[]
    lastYearCount?: number
}

// 計數動畫 Hook
function useCountUp(target: number, duration: number = 1000) {
    const [count, setCount] = useState(0)
    const rafRef = useRef<number | null>(null)

    useEffect(() => {
        const startTime = performance.now()
        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(eased * target))
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate)
            }
        }
        rafRef.current = requestAnimationFrame(animate)
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [target, duration])

    return count
}

// 狀態圖標對應
const STATUS_ICONS: Record<string, any> = {
    '已轉維修單': FileText,
    '開單主管簽核完成': UserCheck,
    '工務部門報價，主管簽核中': ClipboardList,
    '工務已發包': Hammer,
    '院長室簽核中': ShieldCheck,
    '採購發包簽核中': ShoppingCart,
    '採購已發包': Send,
    '廠商施工中': Wrench,
    '施工完成，開單單位驗收中': Clock,
    '維修部門驗收中': Activity,
    '已驗收': CheckCircle2
}

function StatusCard({
    status,
    count,
    recent,
    color,
    delay,
    lastYearCount
}: {
    status: string
    count: number
    recent: SummaryItem[]
    color: string
    delay: number
    lastYearCount?: number
}) {
    const router = useRouter()
    const animatedCount = useCountUp(count)
    const Icon = STATUS_ICONS[status] || AlertCircle
    const isEmpty = count === 0

    // 顏色對應表 (中飽和度漸層設計)
    const colorMap: Record<string, any> = {
        'Pastel blue': { bg: 'from-sky-100 via-sky-50/30 to-white', iconBg: 'bg-sky-100', iconColor: 'text-sky-700', border: 'border-sky-200/60', topBar: 'bg-sky-400' },
        'Dusty rose': { bg: 'from-rose-100/80 via-rose-50/20 to-white', iconBg: 'bg-rose-100', iconColor: 'text-rose-700', border: 'border-rose-200/60', topBar: 'bg-rose-400' },
        'Dusty Lavender': { bg: 'from-violet-100 via-violet-50/30 to-white', iconBg: 'bg-violet-100', iconColor: 'text-violet-700', border: 'border-violet-200/60', topBar: 'bg-violet-400' },
        'Pink': { bg: 'from-pink-100 via-pink-50/30 to-white', iconBg: 'bg-pink-100', iconColor: 'text-pink-700', border: 'border-pink-200/60', topBar: 'bg-pink-400' },
        'blue': { bg: 'from-blue-100 via-blue-50/30 to-white', iconBg: 'bg-blue-100', iconColor: 'text-blue-700', border: 'border-blue-200/60', topBar: 'bg-blue-500' },
        'cinnamon': { bg: 'from-amber-100 via-rose-50/20 to-white', iconBg: 'bg-amber-100', iconColor: 'text-amber-800', border: 'border-amber-200/50', topBar: 'bg-amber-700' },
        'yellow': { bg: 'from-yellow-100 via-yellow-50/30 to-white', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-700', border: 'border-yellow-200/60', topBar: 'bg-yellow-400' },
        'olive': { bg: 'from-lime-100/70 via-stone-100/20 to-white', iconBg: 'bg-lime-100', iconColor: 'text-lime-800', border: 'border-lime-200/60', topBar: 'bg-lime-600' },
        'Peach': { bg: 'from-orange-100 via-rose-50/20 to-white', iconBg: 'bg-orange-100/80', iconColor: 'text-orange-700', border: 'border-orange-200/60', topBar: 'bg-orange-400' },
        'Sage Green': { bg: 'from-emerald-100 via-emerald-50/30 to-white', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700', border: 'border-emerald-200/60', topBar: 'bg-emerald-400' },
    }

    const c = colorMap[color] || colorMap['Pastel blue']

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.4 }}
            onClick={() => {
                router.push(`/maintenance-work/status/${encodeURIComponent(status)}`)
            }}
            className={`relative cursor-pointer group bg-gradient-to-br ${c.bg} rounded-xl border ${c.border} p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1`}
        >
            <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${c.topBar}`} />

            <div className="flex items-start gap-3 mb-4">
                <div className={`p-2 rounded-lg ${c.iconBg} ${c.iconColor} shrink-0`}>
                    <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-[14pt] font-bold text-gray-700 leading-snug">{status}</h3>
            </div>

            <div className="flex items-baseline gap-1 mb-4 flex-wrap">
                <span className={`text-4xl font-black ${c.iconColor}`}>{animatedCount}</span>
                <span className="text-xs text-gray-400 font-medium mr-1">筆</span>
            </div>

            <div className="space-y-2 mb-4">
                {isEmpty ? (
                    <p className="text-[13pt] text-gray-400 italic">目前無此狀態的維修單</p>
                ) : (
                    recent.map((item, idx) => (
                        <div key={item.id} className="text-[13pt] leading-normal text-gray-600 border-l-2 border-gray-100 pl-2">
                            <div className="flex justify-between text-gray-600 font-medium mb-0.5">
                                <span>
                                    {idx + 1}. {item.request_date} {item.cost_center ? `| ${item.cost_center}` : ''}
                                </span>
                            </div>
                            <p className="truncate font-medium">{item.maintain_content}</p>
                        </div>
                    ))
                )}
            </div>

            <div className="flex items-center text-[13pt] font-bold text-gray-400 group-hover:text-primary transition-colors mt-auto">
                點擊查看詳情
                <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
            </div>
        </motion.div>
    )
}

export default function StatusDashboardClient() {
    const router = useRouter()
    const supabase = createClient()
    const [stats, setStats] = useState<StatusStat[]>([])
    const [loading, setLoading] = useState(true)

    const fetchStats = async () => {
        setLoading(true)
        try {
            // 1. 查詢活動表資料
            const { data: activeData, error: activeError } = await supabase
                .from('maintenance_work_orders')
                .select('id, status, request_date, maintain_content, work_order_id, cost_center')
                .order('request_date', { ascending: false })

            if (activeError) throw activeError

            // 2. 查詢歷史表資料 (已驗收歸檔的資料)
            const { data: historyData, error: historyError } = await supabase
                .from('maintenance_work_orders_history')
                .select('id, status, request_date, maintain_content, work_order_id, cost_center')
                .order('request_date', { ascending: false })

            if (historyError) throw historyError

            // 合併兩者
            const allData = [...(activeData || []), ...(historyData || [])]

            // 3. 計算今年與去年的已驗收總筆數
            const currentYear = new Date().getFullYear()
            let thisYearHistoryCount = 0

            historyData?.forEach((item: any) => {
                if (item.request_date) {
                    const itemYear = new Date(item.request_date).getFullYear()
                    if (itemYear === currentYear) {
                        thisYearHistoryCount++
                    }
                }
            })

            // 處理統計數據
            const statsMap: Record<string, StatusStat> = {}
            MAINTENANCE_STATUS.forEach(s => {
                statsMap[s] = { status: s, count: 0, recent: [] }
            })

            // 注入今年的已驗收統計數值
            statsMap['已驗收'].count = thisYearHistoryCount

            allData.forEach((item: any) => {
                const itemStatus = item.status || '已驗收'
                if (itemStatus === '已驗收') {
                    // 已驗收卡片不顯示簡易維修單資料，亦不在此疊加（因已在上面計算好今年驗收數）
                    return
                }
                if (statsMap[itemStatus]) {
                    statsMap[itemStatus].count++

                    const limit = 3
                    if (statsMap[itemStatus].recent.length < limit) {
                        statsMap[itemStatus].recent.push({
                            id: item.id,
                            request_date: item.request_date,
                            maintain_content: item.maintain_content,
                            work_order_id: item.work_order_id,
                            cost_center: item.cost_center
                        })
                    }
                }
            })

            setStats(Object.values(statsMap))
        } catch (err) {
            console.error('Failed to fetch status stats:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()
    }, [])

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col">
            <Navbar onRefresh={fetchStats} />

            <main className="max-w-7xl mx-auto px-6 py-8 w-full">
                <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                            <Activity className="w-7 h-7 text-primary" />
                            維修單狀態管理儀表板
                            {!loading && (
                                <Badge
                                    variant="outline"
                                    className="ml-2 bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 text-sm py-1 px-3 font-bold cursor-pointer hover:bg-green-100 transition-colors"
                                    onClick={() => router.push('/maintenance-work/history')}
                                >
                                    今年已驗收：{stats.find(s => s.status === '已驗收')?.count ?? 0} 筆
                                </Badge>
                            )}
                        </h1>
                        <p className="text-slate-400 dark:text-slate-400 text-sm mt-1">追蹤各階段維修單進度與簽核狀態</p>
                    </div>
                </header>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="h-48 bg-white rounded-xl border animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {stats.filter(stat => stat.status !== '已驗收').map((stat, index) => (
                            <StatusCard
                                key={stat.status}
                                status={stat.status}
                                count={stat.count}
                                recent={stat.recent}
                                color={STATUS_COLORS[stat.status]}
                                delay={index * 0.05}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
