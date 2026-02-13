// 首頁 Client Component - Hero Section + 統計卡片
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import {
    Users, HardHat, FileClock, ClipboardCheck, History, UserCog, Activity,
    LogOut, Home, Calendar, ChevronDown, FileText, RefreshCw
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

// Cloudinary 圖片 URL
const COMPANY_LOGO_URL = 'https://res.cloudinary.com/dzup404bt/image/upload/v1770888486/%E5%85%AC%E5%8F%B8%E5%90%8D%E7%A8%B1_sms2oc.png'
const WHITEBOARD_TEXT_URL = 'https://res.cloudinary.com/dzup404bt/image/upload/v1770888437/%E5%B7%A5%E5%8B%99%E5%AE%A4%E9%9B%BB%E5%AD%90%E7%99%BD%E6%9D%BF_%E6%96%87%E5%AD%97_rfypqa.png'
const HERO_BG_URL = 'https://res.cloudinary.com/dzup404bt/image/upload/v1770889696/%E5%B7%A5%E5%8B%99%E5%AE%A4%E9%9B%BB%E5%AD%90%E7%99%BD%E6%9D%BF_%E5%BA%95%E5%9C%96_%E8%88%8A%E7%89%88_ckbx9g.png'

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

// 統計卡片元件
function StatCard({
    icon: Icon,
    label,
    count,
    color,
    href,
    delay
}: {
    icon: any
    label: string
    count: number
    color: string
    href: string
    delay: number
}) {
    const router = useRouter()
    const animatedCount = useCountUp(count, 1500)

    const colorMap: Record<string, { bg: string; icon: string; border: string; badge: string; hover: string }> = {
        blue: {
            bg: 'from-blue-500/10 to-blue-600/5',
            icon: 'text-blue-500',
            border: 'border-blue-200/50',
            badge: 'bg-blue-500',
            hover: 'hover:border-blue-300 hover:shadow-blue-100/50'
        },
        amber: {
            bg: 'from-amber-500/10 to-amber-600/5',
            icon: 'text-amber-500',
            border: 'border-amber-200/50',
            badge: 'bg-amber-500',
            hover: 'hover:border-amber-300 hover:shadow-amber-100/50'
        },
        purple: {
            bg: 'from-purple-500/10 to-purple-600/5',
            icon: 'text-purple-500',
            border: 'border-purple-200/50',
            badge: 'bg-purple-500',
            hover: 'hover:border-purple-300 hover:shadow-purple-100/50'
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
                relative cursor-pointer group
                bg-gradient-to-br ${c.bg}
                backdrop-blur-xl bg-white/80
                rounded-2xl border ${c.border} ${c.hover}
                p-6 shadow-lg hover:shadow-xl
                transition-all duration-300 hover:-translate-y-1
            `}
        >
            {/* 裝飾圓點 */}
            <div className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full ${c.badge} animate-pulse`} />

            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl bg-white/80 shadow-sm ${c.icon}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-600">{label}</h3>
            </div>

            <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-slate-800 tabular-nums tracking-tight">
                    {animatedCount}
                </span>
                <span className="text-base font-medium text-slate-400">筆</span>
            </div>

            <div className="mt-3 text-sm text-slate-400 group-hover:text-slate-500 transition-colors">
                點擊查看詳情 →
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

    // 時鐘
    useEffect(() => {
        setCurrentTime(new Date())
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
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
                    {/* 時鐘 */}
                    <div className="text-base font-medium text-slate-600 tabular-nums" suppressHydrationWarning>
                        {currentTime ? format(currentTime, 'yyyy/MM/dd HH:mm:ss') : ''}
                    </div>

                    {/* 首頁 */}
                    <Button variant="ghost" className="gap-2" onClick={() => router.push('/')}>
                        <Home className="w-4 h-4" />
                        首頁
                    </Button>

                    {/* 今日-待處理 Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2">
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
                            <Button variant="ghost" className="gap-2">
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
                            <Button variant="ghost" className="gap-2">
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
                                <Button variant="ghost" className="gap-2">
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
                            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1 text-red-600 border-red-200 hover:bg-red-50">
                                <LogOut className="w-3 h-3" /> 登出
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => router.push('/login')}>登入</Button>
                    )}

                    <Button variant="outline" size="sm" onClick={refreshCounts}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </header>

            {/* ===== Hero Section ===== */}
            <section className="relative overflow-hidden">
                {/* 背景圖片 */}
                <div className="absolute inset-0">
                    <img
                        src={HERO_BG_URL}
                        alt="工務室電子白板背景"
                        className="w-full h-full object-cover"
                    />
                    {/* 漸層遮罩 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-800/75 to-slate-900/65" />
                    {/* 底部漸層過渡 */}
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-50 to-transparent" />
                </div>

                {/* Hero 內容 */}
                <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 md:py-24">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                        {/* 左側：公司名稱 Logo */}
                        <motion.div
                            initial={{ opacity: 0, x: -40 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="flex-shrink-0"
                        >
                            <img
                                src={COMPANY_LOGO_URL}
                                alt="奇美醫療財團法人 佳里奇美醫院"
                                className="h-20 md:h-28 w-auto drop-shadow-[0_4px_20px_rgba(255,255,255,0.3)]"
                            />
                        </motion.div>

                        {/* 分隔線 */}
                        <motion.div
                            initial={{ opacity: 0, scaleY: 0 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            transition={{ delay: 0.4, duration: 0.5 }}
                            className="hidden md:block w-px h-24 bg-gradient-to-b from-transparent via-white/40 to-transparent"
                        />

                        {/* 右側：工務室電子白板文字 */}
                        <motion.div
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                            className="flex-shrink-0"
                        >
                            <img
                                src={WHITEBOARD_TEXT_URL}
                                alt="工務室電子白板"
                                className="h-16 md:h-24 w-auto drop-shadow-[0_4px_20px_rgba(255,255,255,0.3)]"
                            />
                        </motion.div>
                    </div>

                    {/* 副標題 */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.6 }}
                        className="text-center mt-8 text-white/60 text-base md:text-lg tracking-widest font-light"
                    >
                        施工管理 ・ 進度追蹤 ・ 即時掌握
                    </motion.p>
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
                        delay={0.3}
                    />
                    <StatCard
                        icon={HardHat}
                        label="工務今日施工項目"
                        count={counts.engineering}
                        color="amber"
                        href="/engineering-work"
                        delay={0.45}
                    />
                    <StatCard
                        icon={FileClock}
                        label="待處理工作項目"
                        count={counts.pending}
                        color="purple"
                        href="/pending-work"
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
