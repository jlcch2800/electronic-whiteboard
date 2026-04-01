// 共用導覽列元件 — 替代 HomeClient / WhiteboardClient 中的重複導覽列
'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import {
    Users, HardHat, FileClock, ClipboardCheck, History, UserCog, Activity,
    LogOut, Home, Calendar, ChevronDown, FileText, RefreshCw, Menu, X, Lock,
    Sun, Moon, User, Settings
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { handleLogout as serverHandleLogout } from '@/actions/auth'
import { useAppStore } from '@/stores/useAppStore'
import { useTheme } from '@/components/providers/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
    DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu'

// 導覽項目定義
interface NavItem {
    label: string
    icon: any
    href?: string
    children?: { label: string; icon?: any; href: string }[]
}

// 所有導覽項目（不含系統管理，系統管理依角色動態顯示）
const NAV_ITEMS: NavItem[] = [
    { label: '首頁', icon: Home, href: '/' },
    {
        label: '今日-待處理', icon: Calendar, children: [
            { label: '廠商今日施工', href: '/vendor-work' },
            { label: '工務今日施工', href: '/engineering-work' },
            { label: '待處理工作', href: '/pending-work' },
            { label: 'All', href: '/dashboard' },
        ]
    },
    {
        label: '施工回報', icon: ClipboardCheck, children: [
            { label: '施工回報', icon: ClipboardCheck, href: '/work-report' },
            { label: '施工文件', icon: FileText, href: '/work-file' },
        ]
    },
    {
        label: '歷史記錄', icon: History, children: [
            { label: '廠商施工歷史', icon: Users, href: '/history/vendor' },
            { label: '工務施工歷史', icon: HardHat, href: '/history/engineering' },
            { label: '待處理工作歷史', icon: FileClock, href: '/history/pending' },
            { label: '施工回報歷史', icon: ClipboardCheck, href: '/history/report' },
        ]
    },
]

// 系統管理項目（僅 admin）
const ADMIN_ITEMS: NavItem = {
    label: '系統管理', icon: UserCog, children: [
        { label: '帳號管理', icon: UserCog, href: '/admin/users' },
        { label: '系統異動記錄', icon: Activity, href: '/admin/change-log' },
        { label: '系統執行記錄', icon: Activity, href: '/admin/execution-log' },
    ]
}

// 判斷路徑是否匹配（含子路徑）
function isPathActive(pathname: string, href?: string, children?: { href: string }[]): boolean {
    if (href) {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }
    if (children) {
        return children.some(c => pathname.startsWith(c.href))
    }
    return false
}

interface NavbarProps {
    /** 點擊重整按鈕時的 callback */
    onRefresh?: () => void
    /** 是否正在載入中 */
    loading?: boolean
}

export default function Navbar({ onRefresh, loading }: NavbarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const supabase = createClient()
    const { profile, isLoading: authLoading, logout: storeLogout } = useAppStore()
    const { theme, setTheme } = useTheme()

    // 時鐘
    const [currentTime, setCurrentTime] = useState<Date | null>(null)
    // 行動版選單開關
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        setCurrentTime(new Date())
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    // 路由變化時關閉行動選單
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    const handleLogout = async () => {
        if (profile?.id) {
            await serverHandleLogout(profile.id)
        }
        await supabase.auth.signOut()
        storeLogout()
        router.push('/login')
    }

    // 所有有效的導覽項目（含 admin）
    const allNavItems = profile?.role === 'admin'
        ? [...NAV_ITEMS, ADMIN_ITEMS]
        : NAV_ITEMS

    // === 桌面版單一導覽項目 ===
    const renderDesktopNavItem = (item: NavItem) => {
        const active = isPathActive(pathname, item.href, item.children)

        // 無子選單，直接連結
        if (item.href) {
            return (
                <Button
                    key={item.label}
                    variant="ghost"
                    className={`gap-2 active:scale-95 transition-all relative ${active
                        ? 'text-primary font-bold after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-primary after:rounded-full'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    onClick={() => router.push(item.href!)}
                >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                </Button>
            )
        }

        // 有子選單
        return (
            <DropdownMenu key={item.label}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={`gap-2 active:scale-95 transition-all relative ${active
                            ? 'text-primary font-bold after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-primary after:rounded-full'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                        <ChevronDown className="w-3 h-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {item.children!.map(child => (
                        <DropdownMenuItem
                            key={child.href}
                            onClick={() => router.push(child.href)}
                            className={pathname.startsWith(child.href) ? 'bg-accent font-semibold' : ''}
                        >
                            {child.icon && <child.icon className="w-4 h-4 mr-2" />}
                            {child.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    // === 行動版選單項目 ===
    const renderMobileNavItem = (item: NavItem) => {
        const active = isPathActive(pathname, item.href, item.children)

        if (item.href) {
            return (
                <button
                    key={item.label}
                    onClick={() => { router.push(item.href!); setMobileOpen(false) }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left w-full transition-colors ${active
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-foreground/70 hover:bg-accent'
                        }`}
                >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                </button>
            )
        }

        return (
            <div key={item.label} className="space-y-1">
                <div className={`flex items-center gap-3 px-4 py-2 text-xs font-bold uppercase tracking-wider ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                    <item.icon className="w-4 h-4" />
                    {item.label}
                </div>
                {item.children!.map(child => (
                    <button
                        key={child.href}
                        onClick={() => { router.push(child.href); setMobileOpen(false) }}
                        className={`flex items-center gap-3 pl-11 pr-4 py-2.5 rounded-xl text-left w-full transition-colors text-sm ${pathname.startsWith(child.href)
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-foreground/60 hover:bg-accent'
                            }`}
                    >
                        {child.icon && <child.icon className="w-4 h-4" />}
                        {child.label}
                    </button>
                ))}
            </div>
        )
    }

    return (
        <>
            {/* ========== 導覽列 ========== */}
            <header className="glass border-b border-border/50 px-4 lg:px-6 py-3 flex justify-between items-center shadow-card sticky top-0 z-50">
                {/* 左側：品牌 + 漢堡按鈕 */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* 漢堡按鈕 — 僅行動版 */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>

                    <h1
                        className="text-xl lg:text-2xl font-black cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2 shrink-0 whitespace-nowrap"
                        onClick={() => router.push('/')}
                    >
                        <span className="text-2xl">🏥</span>
                        <span className="text-gradient-primary whitespace-nowrap">工務室電子白板</span>
                    </h1>
                </div>

                {/* 中間：導覽項目 — 僅桌面版 */}
                <nav className="hidden lg:flex items-center gap-1 overflow-x-auto no-scrollbar mx-2">
                    {allNavItems.map(renderDesktopNavItem)}
                </nav>

                {/* 右側：時鐘 + 使用者下拉選單 */}
                <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                    {/* 時鐘 */}
                    <div className="hidden sm:block text-sm font-medium text-muted-foreground tabular-nums whitespace-nowrap" suppressHydrationWarning>
                        {currentTime ? format(currentTime, 'yyyy/MM/dd HH:mm') : ''}
                    </div>

                    {/* 使用者下拉選單 */}
                    {authLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="animate-pulse">
                                <div className="h-3 w-16 bg-muted rounded mb-1"></div>
                                <div className="h-4 w-20 bg-muted rounded"></div>
                            </div>
                        </div>
                    ) : profile ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="gap-2 active:scale-95 transition-all text-muted-foreground hover:text-foreground"
                                >
                                    <User className="w-4 h-4" />
                                    <span className="hidden sm:inline font-bold text-foreground">
                                        {profile.user_name}
                                    </span>
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                {/* 使用者角色資訊 */}
                                <DropdownMenuLabel className="flex items-center gap-2">
                                    <UserCog className="w-4 h-4" />
                                    <span>角色：{profile.role === 'admin' ? '系統管理員' : '一般使用者'}</span>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                {/* 修改密碼 */}
                                <DropdownMenuItem onClick={() => router.push('/change-password')}>
                                    <Lock className="w-4 h-4 mr-2" />
                                    修改密碼
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />

                                {/* 淺色模式 */}
                                <DropdownMenuItem onClick={() => setTheme('light')} className={theme === 'light' ? 'bg-accent font-semibold' : ''}>
                                    <Sun className="w-4 h-4 mr-2" />
                                    淺色模式
                                </DropdownMenuItem>

                                {/* 深色模式 */}
                                <DropdownMenuItem onClick={() => setTheme('dark')} className={theme === 'dark' ? 'bg-accent font-semibold' : ''}>
                                    <Moon className="w-4 h-4 mr-2" />
                                    深色模式
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />

                                {/* 重新整理 */}
                                {onRefresh && (
                                    <>
                                        <DropdownMenuItem onClick={onRefresh} disabled={loading}>
                                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                            重新整理
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}

                                {/* 登出 */}
                                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                                    <LogOut className="w-4 h-4 mr-2" />
                                    登出
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <div className="flex items-center gap-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="active:scale-95 transition-all text-muted-foreground hover:text-foreground mr-1">
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => setTheme('light')} className={theme === 'light' ? 'bg-accent font-semibold' : ''}>
                                        <Sun className="w-4 h-4 mr-2" />
                                        淺色模式
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setTheme('dark')} className={theme === 'dark' ? 'bg-accent font-semibold' : ''}>
                                        <Moon className="w-4 h-4 mr-2" />
                                        深色模式
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {onRefresh && (
                                        <DropdownMenuItem onClick={onRefresh} disabled={loading}>
                                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                            重新整理
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                                onClick={() => router.push('/login')}
                                size="sm"
                                className="active:scale-95 transition-transform"
                            >
                                登入
                            </Button>
                        </div>
                    )}
                </div>
            </header>

            {/* ========== 行動版側欄 Overlay ========== */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
                    {/* 半透明背景 */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

                    {/* 側欄面板 */}
                    <nav
                        className="absolute top-0 left-0 bottom-0 w-72 bg-card shadow-2xl p-4 pt-20 space-y-1 overflow-y-auto animate-in slide-in-from-left duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 使用者資訊 — 行動版 */}
                        {profile && (
                            <div className="mb-4 p-3 rounded-xl bg-accent/50">
                                <div className="text-xs text-muted-foreground">當前使用者</div>
                                <div className="text-sm font-bold text-foreground flex items-center gap-1 mt-0.5">
                                    {profile.user_name}
                                    <Badge variant={profile.role === 'admin' ? 'destructive' : 'secondary'} className="text-[10px]">
                                        {profile.role}
                                    </Badge>
                                </div>
                            </div>
                        )}

                        {allNavItems.map(renderMobileNavItem)}

                        <div className="pt-4 border-t border-border mt-4 space-y-1">
                            {profile && (
                                <>
                                    {/* 角色資訊 */}
                                    <div className="flex items-center gap-3 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        <UserCog className="w-4 h-4" />
                                        角色：{profile.role === 'admin' ? '系統管理員' : '一般使用者'}
                                    </div>

                                    {/* 修改密碼 */}
                                    <button
                                        onClick={() => { router.push('/change-password'); setMobileOpen(false) }}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground/70 hover:bg-accent w-full text-left transition-colors"
                                    >
                                        <Lock className="w-5 h-5" />
                                        修改密碼
                                    </button>
                                </>
                            )}

                            {/* 淺色模式 */}
                            <button
                                onClick={() => { setTheme('light'); setMobileOpen(false) }}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-colors ${theme === 'light' ? 'bg-primary/10 text-primary font-bold' : 'text-foreground/70 hover:bg-accent'}`}
                            >
                                <Sun className="w-5 h-5" />
                                淺色模式
                            </button>

                            {/* 深色模式 */}
                            <button
                                onClick={() => { setTheme('dark'); setMobileOpen(false) }}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-colors ${theme === 'dark' ? 'bg-primary/10 text-primary font-bold' : 'text-foreground/70 hover:bg-accent'}`}
                            >
                                <Moon className="w-5 h-5" />
                                深色模式
                            </button>

                            {/* 重新整理 */}
                            {onRefresh && (
                                <button
                                    onClick={() => { onRefresh(); setMobileOpen(false) }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground/70 hover:bg-accent w-full text-left transition-colors"
                                >
                                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                    重新整理
                                </button>
                            )}

                            <div className="border-t border-border my-2" />

                            {profile ? (
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/5 w-full text-left transition-colors"
                                >
                                    <LogOut className="w-5 h-5" />
                                    登出
                                </button>
                            ) : (
                                <button
                                    onClick={() => { router.push('/login'); setMobileOpen(false) }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-primary hover:bg-primary/5 w-full text-left transition-colors font-semibold"
                                >
                                    登入
                                </button>
                            )}
                        </div>
                    </nav>
                </div>
            )}
        </>
    )
}
