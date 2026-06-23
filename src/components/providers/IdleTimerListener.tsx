// 閒置自動登出監聯器 — 當使用者閒置超過 5 分鐘自動執行安全登出
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { handleLogout as serverHandleLogout } from '@/actions/auth'
import { useAppStore } from '@/stores/useAppStore'
import { useToast } from '@/hooks/use-toast'

// 閒置時間上限：5 分鐘 (5 * 60 * 1000 ms)
// 閒置10秒 const IDLE_TIMEOUT = 10 * 1000
const IDLE_TIMEOUT = 5 * 60 * 1000

// 節流間隔：1 秒，避免高頻事件（mousemove、scroll）重複重設計時器
const THROTTLE_MS = 1000

export default function IdleTimerListener() {
    const router = useRouter()
    const pathname = usePathname() // 偵測 Next.js client-side 路由切換
    const supabase = createClient()
    const { toast } = useToast()

    // 使用 ref 取得最新 profile，避免 useEffect 因 profile 變化而重複註冊
    const profileRef = useRef(useAppStore.getState().profile)
    const storeLogoutRef = useRef(useAppStore.getState().logout)

    // 計時器 ref
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // 上次活動時間戳，用於節流
    const lastActiveRef = useRef<number>(Date.now())
    // 防止重複登出
    const isLoggingOutRef = useRef(false)

    // 用 ref 儲存 performAutoLogout，避免 useEffect 因函式引用變化而重複清除/重掛
    const performAutoLogoutRef = useRef<() => Promise<void>>()

    // 訂閱 zustand store 的最新值
    useEffect(() => {
        const unsub = useAppStore.subscribe((state) => {
            profileRef.current = state.profile
            storeLogoutRef.current = state.logout
        })
        return unsub
    }, [])

    // 自動登出核心邏輯 — 穩定引用，不依賴 react hooks 的引用變化
    const performAutoLogout = useCallback(async () => {
        // 防止重複觸發
        if (isLoggingOutRef.current) return
        isLoggingOutRef.current = true

        const profile = profileRef.current

        try {
            // 1. 伺服器端記錄登出日誌
            if (profile?.id) {
                await serverHandleLogout(profile.id)
            }
        } catch (err) {
            console.error('Auto logout logging error:', err)
        }

        // 2. Supabase 登出
        await supabase.auth.signOut()
        // 3. 清除 Zustand 全域狀態
        storeLogoutRef.current()
        // 4. Toast 提醒使用者
        toast({
            title: '安全登出提示',
            description: '由於您的帳號已閒置超過 5 分鐘，系統已將您自動登出。',
            variant: 'destructive',
        })
        // 5. 導向登入頁面
        router.push('/login')
    }, [router, supabase, toast])

    // 將最新的 performAutoLogout 放進 ref，讓 timer callback 永遠拿到最新版
    useEffect(() => {
        performAutoLogoutRef.current = performAutoLogout
    }, [performAutoLogout])

    // 重設計時器 — 使用 ref 呼叫登出函式，避免 stale closure
    const resetTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }
        // 僅在已登入時啟動計時器
        if (profileRef.current) {
            timerRef.current = setTimeout(() => {
                performAutoLogoutRef.current?.()
            }, IDLE_TIMEOUT)
        }
    }, [])

    // 路由切換時重設計時器 — 這是關鍵修正！
    // Next.js client-side navigation (Link / router.push) 不會產生 window click 等 DOM 事件，
    // 但 pathname 會變化，所以我們在 pathname 變化時重設計時器。
    useEffect(() => {
        if (isLoggingOutRef.current) return
        if (!profileRef.current) return

        lastActiveRef.current = Date.now()
        resetTimer()
    }, [pathname, resetTimer])

    // 主要 effect：監聯使用者操作事件，管理閒置計時器
    useEffect(() => {
        // 使用者操作事件處理器（含節流）
        const handleActivity = () => {
            // 若已在登出流程，忽略操作
            if (isLoggingOutRef.current) return
            // 若尚未登入，不處理
            if (!profileRef.current) return

            const now = Date.now()
            if (now - lastActiveRef.current > THROTTLE_MS) {
                lastActiveRef.current = now
                resetTimer()
            }
        }

        // 初始化計時器
        resetTimer()

        // 要偵測的使用者操作事件清單
        // 使用 capture: true 在捕獲階段攔截，避免子元件 stopPropagation 導致偵測失敗
        const events = ['mousemove', 'mousedown', 'click', 'keydown', 'scroll', 'touchstart']
        events.forEach(event => {
            window.addEventListener(event, handleActivity, { capture: true, passive: true })
        })

        // 頁面可見度變化（使用者從其他分頁切回來）
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleActivity()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // 視窗取得焦點
        const handleFocus = () => handleActivity()
        window.addEventListener('focus', handleFocus)

        // 清除所有偵聽器與計時器
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
            events.forEach(event => {
                window.removeEventListener(event, handleActivity, { capture: true })
            })
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleFocus)
        }
    }, [resetTimer])

    // 此元件不渲染任何 UI
    return null
}
