// 首頁 Client Component - Hero Section + 統計卡片
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Users, HardHat, FileClock,
    ArrowRight, Plus
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

interface RecentItem {
    id: string
    vendor_name: string
    work_content: string | null
    location?: string | null
    start_date?: string
    end_date?: string
    unit?: string
}

// Cloudinary 背景圖 URL
const HERO_BG_URL = 'https://res.cloudinary.com/dzup404bt/image/upload/v1771733639/SCR-20260222-kxyc-_dzo3aj.png'
// 手機版背景圖 URL
const HERO_BG_MOBILE_URL = 'https://res.cloudinary.com/dzup404bt/image/upload/v1775028875/SCR-20260401-nhqa-_ycra9y.png'

interface HomeClientProps {
    initialCounts: {
        vendor: number
        engineering: number
        pending: number
    }
    initialPendingRecent: RecentItem[]
    initialVendorRecent: RecentItem[]
    initialEngineeringRecent: RecentItem[]
    today: string
}

// 計數動畫 Hook
function useCountUp(target: number, duration: number = 1200) {
    const [count, setCount] = useState(0)
    const rafRef = useRef<number | null>(null)

    useEffect(() => {
        const startTime = performance.now()
        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)
            // easeOutCubic
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

// 各卡片的空狀態文案
const EMPTY_STATE_MESSAGES: Record<string, string> = {
    blue: '今日暫無廠商工作',
    amber: '今日暫無工務室排程',
    purple: '目前無預定工作',
}

// 統計卡片元件
function StatCard({
    icon: Icon,
    label,
    count,
    color,
    href,
    newHref,
    delay,
    className,
    recentItems,
    todayStr
}: {
    icon: any
    label: string
    count: number
    color: string
    href: string
    newHref: string
    delay: number
    className?: string
    /** 最近資料條列 */
    recentItems?: RecentItem[]
    /** 今日日期字串 YYYY-MM-DD */
    todayStr?: string
}) {
    const router = useRouter()
    const animatedCount = useCountUp(count, 1500)
    const isEmpty = count === 0

    // 色彩設定：圖標容器使用主題色淺色背景 + 深色 icon
    const colorMap: Record<string, {
        bg: string
        iconBg: string
        iconColor: string
        border: string
        badge: string
        hover: string
        topBar: string
        accent: string
        countColor: string
        linkColor: string
        addBtnBg: string
        addBtnHover: string
    }> = {
        blue: {
            bg: 'from-blue-50 to-white',
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            border: 'border-blue-100',
            badge: 'bg-blue-500',
            hover: 'hover:border-blue-300 hover:shadow-blue-200/40',
            topBar: 'bg-gradient-to-r from-blue-600 to-blue-400',
            accent: 'text-blue-600',
            countColor: 'text-blue-600',
            linkColor: 'text-blue-500 group-hover:text-blue-600',
            addBtnBg: 'bg-blue-500 hover:bg-blue-600',
            addBtnHover: 'shadow-blue-500/25',
        },
        amber: {
            bg: 'from-amber-50 to-white',
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            border: 'border-amber-100',
            badge: 'bg-amber-500',
            hover: 'hover:border-amber-300 hover:shadow-amber-200/40',
            topBar: 'bg-gradient-to-r from-amber-500 to-amber-400',
            accent: 'text-amber-600',
            countColor: 'text-amber-600',
            linkColor: 'text-amber-500 group-hover:text-amber-600',
            addBtnBg: 'bg-amber-500 hover:bg-amber-600',
            addBtnHover: 'shadow-amber-500/25',
        },
        purple: {
            bg: 'from-purple-50 to-white',
            iconBg: 'bg-purple-100',
            iconColor: 'text-purple-600',
            border: 'border-purple-100',
            badge: 'bg-purple-500',
            hover: 'hover:border-purple-300 hover:shadow-purple-200/40',
            topBar: 'bg-gradient-to-r from-purple-500 to-purple-400',
            accent: 'text-purple-600',
            countColor: 'text-purple-600',
            linkColor: 'text-purple-500 group-hover:text-purple-600',
            addBtnBg: 'bg-purple-500 hover:bg-purple-600',
            addBtnHover: 'shadow-purple-500/25',
        }
    }

    const c = colorMap[color] || colorMap.blue

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.6, ease: 'easeOut' }}
            onClick={() => router.push(href)}
            className={`
                relative cursor-pointer group overflow-hidden
                bg-gradient-to-br ${c.bg}
                backdrop-blur-xl bg-white/90
                rounded-2xl border ${c.border} ${c.hover}
                p-6 pt-8 shadow-lg
                transition-all duration-300 ease-out
                hover:-translate-y-2 hover:shadow-2xl
                active:scale-[0.98] active:shadow-lg
                ${className || ''}
            `}
        >
            {/* 頂部色條 */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${c.topBar}`} />

            {/* 裝飾圓點 */}
            <div className={`absolute top-5 right-4 w-2 h-2 rounded-full ${c.badge} animate-pulse`} />

            {/* 圖標 + 標題 */}
            <div className="flex items-center gap-3 mb-5">
                <div className={`p-3 rounded-xl ${c.iconBg} ${c.iconColor} shadow-sm`}>
                    <Icon className="w-6 h-6" />
                </div>
                {/* 卡片標題字型大小調整為 14pt */}
                <h3 className="text-[14pt] font-semibold text-gray-700">{label}</h3>
            </div>

            {/* 數字 / 空狀態 (皆調整為置中顯示) */}
            {isEmpty ? (
                <div className="mb-1 text-center">
                    <div className="flex items-baseline justify-center gap-2">
                        <span className="text-4xl font-black text-gray-300 tabular-nums tracking-tight">0</span>
                        <span className="text-base font-medium text-gray-400">筆</span>
                    </div>
                    {/* 調整空狀態提示文字大小為 13pt */}
                    <p className="text-[13pt] text-gray-500 mt-2">{EMPTY_STATE_MESSAGES[color]}</p>
                </div>
            ) : (
                <div className="flex items-baseline justify-center gap-2 mb-1">
                    <span className={`text-5xl font-black ${c.countColor} tabular-nums tracking-tight`}>
                        {animatedCount}
                    </span>
                    <span className="text-base font-medium text-gray-500">筆</span>
                </div>
            )}

            {/* 最近7天條列清單 */}
            {recentItems && recentItems.length > 0 && (
                <ul className="mt-3 mb-1 space-y-1.5">
                    {recentItems.map((item, index) => (
                        <li
                            key={item.id}
                            className="flex items-start gap-2 text-[13pt] text-gray-600 leading-snug"
                        >
                            {/* 流水號編號 */}
                            <span className={`mt-0.5 font-bold shrink-0 ${c.accent} w-4`}>
                                {index + 1}.
                            </span>
                            <span>
                                {color === 'blue' && (
                                    <>
                                        <span className="font-bold text-gray-700 mr-1">{item.vendor_name}</span>
                                        {item.location && <span className="text-gray-500 mr-1">({item.location})</span>}
                                        <span className="break-all text-gray-700">{item.work_content}</span>
                                    </>
                                )}
                                {color === 'amber' && (
                                    <>
                                        {item.end_date !== todayStr && (
                                            <span className="font-mono text-gray-500 mr-1.5">{item.end_date}</span>
                                        )}
                                        <span className="font-bold text-gray-700 mr-1">{item.vendor_name}</span>
                                        {item.unit && <span className="text-gray-500 mr-1">({item.unit})</span>}
                                        <span className="break-all text-gray-700">{item.work_content}</span>
                                    </>
                                )}
                                {color === 'purple' && (
                                    <>
                                        <span className="font-mono text-gray-500 mr-1.5">{item.start_date}</span>
                                        <span className="font-bold text-gray-700 mr-1">{item.vendor_name}</span>
                                        {item.unit && <span className="text-gray-500 mr-1">({item.unit})</span>}
                                        <span className="break-all text-gray-700">{item.work_content}</span>
                                    </>
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {recentItems && recentItems.length === 0 && (
                <p className="mt-2 text-[13pt] text-gray-400">
                    {/* 調整空狀態提示文字大小為 13pt */}
                    近7天無新增事項
                </p>
            )}

            {/* 底部操作列：查看詳情 + 新增按鈕 */}
            <div className="mt-3 flex items-center justify-between">
                <div className={`text-sm font-medium flex items-center gap-1 ${c.linkColor} transition-colors`}>
                    點擊查看詳情
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        router.push(newHref)
                    }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${c.addBtnBg} shadow-md ${c.addBtnHover} transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95`}
                >
                    <Plus className="w-3.5 h-3.5" />
                    新增
                </button>
            </div>
        </motion.div>
    )
}

export default function HomeClient({ initialCounts, initialPendingRecent, initialVendorRecent, initialEngineeringRecent, today }: HomeClientProps) {
    const supabase = createClient()
    const [counts, setCounts] = useState(initialCounts)
    const [pendingRecent, setPendingRecent] = useState<RecentItem[]>(initialPendingRecent)
    const [vendorRecent, setVendorRecent] = useState<RecentItem[]>(initialVendorRecent)
    const [engineeringRecent, setEngineeringRecent] = useState<RecentItem[]>(initialEngineeringRecent)
    const [todayStr, setTodayStr] = useState<string>(today)

    // 重新整理統計數據
    const refreshCounts = async () => {
        // 使用台灣時區取得今天日期
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
        // 最近7天起始日
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
        const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

        const [v, e, p, pRecent, vRecent, eRecent] = await Promise.all([
            supabase.from('vendor_today_work').select('*', { count: 'exact', head: true }).eq('work_date', today),
            supabase.from('engineering_today_work').select('*', { count: 'exact', head: true }).lte('start_date', today).gte('end_date', today),
            // pending_work 只看 end_date >= today（尚未過期），不限 start_date
            supabase.from('pending_work').select('*', { count: 'exact', head: true }).gte('end_date', today),
            // 最近7天內開始的事項
            supabase.from('pending_work').select('id, start_date, vendor_name, unit, work_content').gte('start_date', sevenDaysAgoStr).order('start_date', { ascending: true }).limit(10),
            supabase.from('vendor_today_work').select('id, vendor_name, location, work_content').eq('work_date', today).order('work_date', { ascending: true }).limit(10),
            supabase.from('engineering_today_work').select('id, end_date, vendor_name, unit, work_content').lte('start_date', today).gte('end_date', today).order('start_date', { ascending: true }).limit(10),
        ])
        setCounts({
            vendor: v.count ?? 0,
            engineering: e.count ?? 0,
            pending: p.count ?? 0,
        })
        setPendingRecent(pRecent.data?.map((i: any) => ({ id: i.id, start_date: i.start_date, vendor_name: i.vendor_name, unit: i.unit, work_content: i.work_content })) ?? [])
        setVendorRecent(vRecent.data?.map((i: any) => ({ id: i.id, vendor_name: i.vendor_name, location: i.location, work_content: i.work_content })) ?? [])
        setEngineeringRecent(eRecent.data?.map((i: any) => ({ id: i.id, end_date: i.end_date, vendor_name: i.vendor_name, unit: i.unit, work_content: i.work_content })) ?? [])
    }

    // 每次進入首頁時自動重新查詢最新數據，避免 Router Cache 導致舊數據
    useEffect(() => {
        setTodayStr(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }))
        refreshCounts()

        // 設定每 3 分鐘自動更新一次筆數
        const interval = setInterval(() => {
            refreshCounts()
        }, 180000)

        return () => clearInterval(interval)
    }, [])

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* ===== 共用導覽列 ===== */}
            <Navbar onRefresh={refreshCounts} />

            {/* ===== Hero Section ===== */}
            <section className="relative overflow-hidden bg-background">
                {/* 背景圖片容器 — 根據裝置寬度切換專用圖片 */}
                <div className="relative w-full h-[35vh] md:h-[40vh] lg:h-[45vh] overflow-hidden">
                    {/* 手機版背景圖 */}
                    <img
                        src={HERO_BG_MOBILE_URL}
                        alt="工務室電子白板背景-行動版"
                        className="block md:hidden w-full h-full object-cover object-center"
                    />
                    {/* 桌面版背景圖 */}
                    <img
                        src={HERO_BG_URL}
                        alt="工務室電子白板背景-區域版"
                        className="hidden md:block w-full h-full object-cover object-top"
                    />
                    {/* 底部漸層過渡 */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 md:h-24 bg-gradient-to-t from-background to-transparent" />
                </div>
            </section>

            {/* ===== 統計卡片區 ===== */}
            <section className="max-w-7xl mx-auto px-6 -mt-6 relative z-20 w-full">
                {/* Statistics Cards - 改為垂直堆疊 (Vertical stacking on mobile) */}
                <div className="flex flex-col md:grid md:grid-cols-3 gap-6 pb-2 md:pb-0 -mx-6 px-6 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                    <StatCard
                        icon={Users}
                        label="廠商今日工作項目"
                        count={counts.vendor}
                        color="blue"
                        href="/vendor-work"
                        newHref="/vendor-work/new"
                        delay={0.3}
                        className="w-[85vw] shrink-0 snap-center md:w-auto"
                        recentItems={vendorRecent}
                    />
                    <StatCard
                        icon={HardHat}
                        label="工務室今日排程項目"
                        count={counts.engineering}
                        color="amber"
                        href="/engineering-work"
                        newHref="/engineering-work/new"
                        delay={0.45}
                        className="w-[85vw] shrink-0 snap-center md:w-auto"
                        recentItems={engineeringRecent}
                        todayStr={todayStr}
                    />
                    <StatCard
                        icon={FileClock}
                        label="預定工作項目"
                        count={counts.pending}
                        color="purple"
                        href="/pending-work"
                        newHref="/pending-work/new"
                        delay={0.6}
                        className="w-[85vw] shrink-0 snap-center md:w-auto"
                        recentItems={pendingRecent}
                    />
                </div>
            </section>

            {/* ===== 系統資訊 ===== */}
            <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.8 }}
                className="max-w-5xl mx-auto px-6 py-10 w-full"
            >
                <div className="text-center text-sm text-muted-foreground space-y-1">
                    <p>佳里奇美醫院 工務室電子白板管理系統</p>
                    <p>ChiMei Hospital, Chiali — Engineering Division Dashboard</p>
                </div>
            </motion.section>

            {/* Spacer */}
            <div className="flex-1" />
        </div>
    )
}
