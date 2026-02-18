// 首頁 Client Component - Hero Section + 統計卡片
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import {
    Users, HardHat, FileClock, ClipboardCheck, History, UserCog, Activity,
    LogOut, Home, Calendar, ChevronDown, FileText, RefreshCw,
    ArrowRight, Plus
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { handleLogout as serverHandleLogout } from '@/actions/auth'
import { useAppStore } from '@/stores/useAppStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'

// Cloudinary 背景圖 URL
const HERO_BG_URL = 'https://res.cloudinary.com/dzup404bt/image/upload/v1771430467/SCR-20260218-uqvg%E6%8B%B7%E8%B2%9D_kwiqmj.png'

interface HomeClientProps {
    initialCounts: {
        vendor: number
        engineering: number
        pending: number
    }
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
    blue: '今日暫無廠商施工',
    amber: '今日暫無工務施工',
    purple: '目前無待處理事項',
}

// 統計卡片元件
function StatCard({
    icon: Icon,
    label,
    count,
    color,
    href,
    newHref,
    delay
}: {
    icon: any
    label: string
    count: number
    color: string
    href: string
    newHref: string
    delay: number
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
            topBar: 'bg-gradient-to-r from-blue-500 to-blue-400',
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
                <h3 className="text-base font-semibold text-slate-700">{label}</h3>
            </div>

            {/* 數字 / 空狀態 */}
            {isEmpty ? (
                <div className="mb-1">
                    <span className="text-4xl font-black text-slate-300 tabular-nums tracking-tight">0</span>
                    <span className="text-base font-medium text-slate-300 ml-2">筆</span>
                    <p className="text-sm text-slate-400 mt-2">{EMPTY_STATE_MESSAGES[color]}</p>
                </div>
            ) : (
                <div className="flex items-baseline gap-2 mb-1">
                    <span className={`text-5xl font-black ${c.countColor} tabular-nums tracking-tight`}>
                        {animatedCount}
                    </span>
                    <span className="text-base font-medium text-slate-400">筆</span>
                </div>
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

export default function HomeClient({ initialCounts }: HomeClientProps) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const { profile, isLoading: authLoading, logout: storeLogout } = useAppStore()

    const [counts, setCounts] = useState(initialCounts)
    // 使用 null 初始化避免 SSR/Client hydration mismatch
    const [currentTime, setCurrentTime] = useState<Date | null>(null)

    // 時鐘 — 精簡到分鐘，每 60 秒更新
    useEffect(() => {
        setCurrentTime(new Date())
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 60000)
        return () => clearInterval(timer)
    }, [])

    const handleLogout = async () => {
        if (profile?.id) {
            await serverHandleLogout(profile.id)
        }
        await supabase.auth.signOut()
        storeLogout()
        router.push('/login')
    }

    // 重新整理統計數據
    const refreshCounts = async () => {
        const today = new Date().toISOString().split('T')[0]
        const [v, e, p] = await Promise.all([
            supabase.from('vendor_today_work').select('*', { count: 'exact', head: true }).eq('work_date', today),
            supabase.from('engineering_today_work').select('*', { count: 'exact', head: true }).lte('start_date', today).gte('end_date', today),
            supabase.from('pending_work').select('*', { count: 'exact', head: true }).lte('start_date', today).gte('end_date', today),
        ])
        setCounts({
            vendor: v.count ?? 0,
            engineering: e.count ?? 0,
            pending: p.count ?? 0,
        })
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* ===== 導覽列 ===== */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-black text-slate-800">🏥 工務室電子白板</h1>
                </div>

                <div className="flex items-center gap-4">
                    {/* 時鐘 — 精簡為 yyyy/MM/dd HH:mm */}
                    <div className="text-base font-medium text-slate-600 tabular-nums" suppressHydrationWarning>
                        {currentTime ? format(currentTime, 'yyyy/MM/dd HH:mm') : ''}
                    </div>

                    {/* 首頁 */}
                    <Button variant="ghost" className="gap-2 active:scale-95 transition-transform" onClick={() => router.push('/')}>
                        <Home className="w-4 h-4" />
                        首頁
                    </Button>

                    {/* 今日-待處理 Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2 active:scale-95 transition-transform">
                                <Calendar className="w-4 h-4" />
                                今日-待處理
                                <ChevronDown className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => router.push('/vendor-work')}>廠商今日施工</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/engineering-work')}>工務今日施工</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/pending-work')}>待處理工作</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/dashboard')}>All</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* 施工回報 */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2 active:scale-95 transition-transform">
                                <ClipboardCheck className="w-4 h-4" />
                                施工回報
                                <ChevronDown className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => router.push('/work-report')}>
                                <ClipboardCheck className="w-4 h-4 mr-2" /> 施工回報
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/work-file')}>
                                <FileText className="w-4 h-4 mr-2" /> 施工文件
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* 歷史記錄 */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2 active:scale-95 transition-transform">
                                <History className="w-4 h-4" />
                                歷史記錄
                                <ChevronDown className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => router.push('/history/vendor')}>
                                <Users className="w-4 h-4 mr-2" /> 廠商施工歷史
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/history/engineering')}>
                                <HardHat className="w-4 h-4 mr-2" /> 工務施工歷史
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/history/pending')}>
                                <FileClock className="w-4 h-4 mr-2" /> 待處理工作歷史
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/history/report')}>
                                <ClipboardCheck className="w-4 h-4 mr-2" /> 施工回報歷史
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* 系統管理 */}
                    {profile?.role === 'admin' && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="gap-2 active:scale-95 transition-transform">
                                    <UserCog className="w-4 h-4" />
                                    系統管理
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => router.push('/admin/users')}>
                                    <UserCog className="w-4 h-4 mr-2" /> 帳號管理
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push('/admin/change-log')}>
                                    <Activity className="w-4 h-4 mr-2" /> 系統異動記錄
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push('/admin/execution-log')}>
                                    <Activity className="w-4 h-4 mr-2" /> 系統執行記錄
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    <div className="h-6 w-px bg-slate-200" />

                    {/* 使用者資訊 */}
                    {authLoading ? (
                        <div className="flex items-center gap-3">
                            <div className="animate-pulse">
                                <div className="h-3 w-16 bg-slate-200 rounded mb-1"></div>
                                <div className="h-4 w-24 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    ) : profile ? (
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-xs text-slate-400">當前使用者</div>
                                <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                    {profile.user_name}
                                    <Badge variant={profile.role === 'admin' ? 'destructive' : 'secondary'} className="text-[10px]">
                                        {profile.role}
                                    </Badge>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1 text-red-600 border-red-200 hover:bg-red-50 active:scale-95 transition-transform">
                                <LogOut className="w-3 h-3" /> 登出
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => router.push('/login')} className="active:scale-95 transition-transform">登入</Button>
                    )}

                    <Button variant="outline" size="sm" onClick={refreshCounts} className="active:scale-95 transition-transform">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </header>

            {/* ===== Hero Section ===== */}
            <section className="relative overflow-hidden" style={{ height: '40vh' }}>
                {/* 背景圖片 — 完整呈現 */}
                <div className="absolute inset-0">
                    <img
                        src={HERO_BG_URL}
                        alt="工務室電子白板背景"
                        className="w-full h-full object-cover object-top"
                    />
                    {/* 底部漸層過渡 */}
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-50 to-transparent" />
                </div>
            </section>

            {/* ===== 統計卡片區 ===== */}
            <section className="max-w-5xl mx-auto px-6 -mt-6 relative z-20 w-full">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        icon={Users}
                        label="廠商今日施工項目"
                        count={counts.vendor}
                        color="blue"
                        href="/vendor-work"
                        newHref="/vendor-work/new"
                        delay={0.3}
                    />
                    <StatCard
                        icon={HardHat}
                        label="工務今日施工項目"
                        count={counts.engineering}
                        color="amber"
                        href="/engineering-work"
                        newHref="/engineering-work/new"
                        delay={0.45}
                    />
                    <StatCard
                        icon={FileClock}
                        label="待處理工作項目"
                        count={counts.pending}
                        color="purple"
                        href="/pending-work"
                        newHref="/pending-work/new"
                        delay={0.6}
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
                <div className="text-center text-sm text-slate-400 space-y-1">
                    <p>佳里奇美醫院 工務室電子白板管理系統</p>
                    <p>Chi Mei Hospital, Chiali — Engineering Division Dashboard</p>
                </div>
            </motion.section>

            {/* Spacer */}
            <div className="flex-1" />
        </div>
    )
}
