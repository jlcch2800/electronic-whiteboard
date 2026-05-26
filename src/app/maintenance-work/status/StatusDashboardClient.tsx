'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Activity, ArrowRight, ClipboardList, Clock, 
    CheckCircle2, AlertCircle, FileText, Hammer, 
    Send, ShieldCheck, ShoppingCart, UserCheck
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { MAINTENANCE_STATUS, STATUS_COLORS } from '@/lib/maintenance-constants'

interface SummaryItem {
    id: string
    request_date: string
    request_department: string
    maintain_content: string
    work_order_id: string
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

    // 顏色對應表 (擴充自 HomeClient)
    const colorMap: Record<string, any> = {
        blue: { bg: 'from-blue-50 to-white', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', border: 'border-blue-100', topBar: 'bg-blue-600' },
        sky: { bg: 'from-sky-50 to-white', iconBg: 'bg-sky-100', iconColor: 'text-sky-600', border: 'border-sky-100', topBar: 'bg-sky-600' },
        indigo: { bg: 'from-indigo-50 to-white', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', border: 'border-indigo-100', topBar: 'bg-indigo-600' },
        amber: { bg: 'from-amber-50 to-white', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', border: 'border-amber-100', topBar: 'bg-amber-600' },
        purple: { bg: 'from-purple-50 to-white', iconBg: 'bg-purple-100', iconColor: 'text-purple-600', border: 'border-purple-100', topBar: 'bg-purple-600' },
        violet: { bg: 'from-violet-50 to-white', iconBg: 'bg-violet-100', iconColor: 'text-violet-600', border: 'border-violet-100', topBar: 'bg-violet-600' },
        emerald: { bg: 'from-emerald-50 to-white', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', border: 'border-emerald-100', topBar: 'bg-emerald-600' },
        orange: { bg: 'from-orange-50 to-white', iconBg: 'bg-orange-100', iconColor: 'text-orange-600', border: 'border-orange-100', topBar: 'bg-orange-600' },
        cyan: { bg: 'from-cyan-50 to-white', iconBg: 'bg-cyan-100', iconColor: 'text-cyan-600', border: 'border-cyan-100', topBar: 'bg-cyan-600' },
        green: { bg: 'from-green-50 to-white', iconBg: 'bg-green-100', iconColor: 'text-green-600', border: 'border-green-100', topBar: 'bg-green-600' },
    }

    const c = colorMap[color] || colorMap.blue

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.4 }}
            onClick={() => {
                if (status === '已驗收') {
                    router.push('/maintenance-work/history')
                } else {
                    router.push(`/maintenance-work/status/${encodeURIComponent(status)}`)
                }
            }}
            className={`relative cursor-pointer group bg-gradient-to-br ${c.bg} rounded-xl border ${c.border} p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1`}
        >
            <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${c.topBar}`} />
            
            <div className="flex items-start gap-3 mb-4">
                <div className={`p-2 rounded-lg ${c.iconBg} ${c.iconColor} shrink-0`}>
                    <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-gray-700 leading-snug">{status}</h3>
            </div>

            <div className="flex items-baseline gap-1 mb-4 flex-wrap">
                <span className={`text-4xl font-black ${c.iconColor}`}>{animatedCount}</span>
                <span className="text-xs text-gray-400 font-medium mr-1">筆</span>
                {lastYearCount !== undefined && (
                    <span className="text-[10.5px] text-gray-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 inline-flex items-center shrink-0">
                        去年：{lastYearCount} 筆
                    </span>
                )}
            </div>

            <div className="space-y-2 mb-4">
                {isEmpty ? (
                    <p className="text-xs text-gray-400 italic">目前無此狀態的維修單</p>
                ) : (
                    recent.map((item, idx) => (
                        <div key={item.id} className="text-[11px] leading-tight text-gray-600 border-l-2 border-gray-100 pl-2">
                            <div className="flex justify-between text-gray-400 mb-0.5">
                                <span>
                                    {idx + 1}. {item.request_date}
                                </span>
                                <span className="font-medium text-gray-500">{item.request_department}</span>
                            </div>
                            <p className="truncate font-medium">{item.maintain_content}</p>
                        </div>
                    ))
                )}
            </div>

            <div className="flex items-center text-[11px] font-bold text-gray-400 group-hover:text-primary transition-colors mt-auto">
                點擊查看詳情
                <ArrowRight className="w-3 h-3 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
        </motion.div>
    )
}

export default function StatusDashboardClient() {
    const supabase = createClient()
    const [stats, setStats] = useState<StatusStat[]>([])
    const [loading, setLoading] = useState(true)

    const fetchStats = async () => {
        setLoading(true)
        try {
            // 1. 查詢活動表資料
            const { data: activeData, error: activeError } = await supabase
                .from('maintenance_work_orders')
                .select('id, status, request_date, request_department, maintain_content, work_order_id')
                .order('request_date', { ascending: false })

            if (activeError) throw activeError

            // 2. 查詢歷史表資料 (已驗收歸檔的資料)
            const { data: historyData, error: historyError } = await supabase
                .from('maintenance_work_orders_history')
                .select('id, status, request_date, request_department, maintain_content, work_order_id')
                .order('request_date', { ascending: false })

            if (historyError) throw historyError

            // 合併兩者
            const allData = [...(activeData || []), ...(historyData || [])]

            // 3. 計算去年的已驗收總筆數 (去年為今年減 1)
            const currentYear = new Date().getFullYear()
            const lastYear = currentYear - 1
            let lastYearHistoryCount = 0

            historyData?.forEach((item: any) => {
                if (item.request_date) {
                    const itemYear = new Date(item.request_date).getFullYear()
                    if (itemYear === lastYear) {
                        lastYearHistoryCount++
                    }
                }
            })

            // 處理統計數據
            const statsMap: Record<string, StatusStat> = {}
            MAINTENANCE_STATUS.forEach(s => {
                statsMap[s] = { status: s, count: 0, recent: [] }
            })

            // 注入去年的統計數值給已驗收狀態
            statsMap['已驗收'].lastYearCount = lastYearHistoryCount

            allData.forEach((item: any) => {
                const itemStatus = item.status || '已驗收'
                if (statsMap[itemStatus]) {
                    statsMap[itemStatus].count++
                    
                    // 已驗收卡片顯示最近 5 筆記錄，其他卡片顯示 3 筆
                    const limit = itemStatus === '已驗收' ? 5 : 3
                    if (statsMap[itemStatus].recent.length < limit) {
                        statsMap[itemStatus].recent.push({
                            id: item.id,
                            request_date: item.request_date,
                            request_department: item.request_department,
                            maintain_content: item.maintain_content,
                            work_order_id: item.work_order_id
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
        <div className="min-h-screen bg-slate-50/50 flex flex-col">
            <Navbar onRefresh={fetchStats} />

            <main className="max-w-7xl mx-auto px-6 py-8 w-full">
                <header className="mb-8">
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Activity className="w-7 h-7 text-primary" />
                        維修單狀態管理儀表板
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">追蹤各階段維修工單進度與簽核狀態</p>
                </header>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="h-48 bg-white rounded-xl border animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {stats.map((stat, index) => (
                            <StatusCard
                                key={stat.status}
                                status={stat.status}
                                count={stat.count}
                                recent={stat.recent}
                                color={STATUS_COLORS[stat.status]}
                                delay={index * 0.05}
                                lastYearCount={stat.lastYearCount}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
