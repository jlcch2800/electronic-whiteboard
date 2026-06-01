// 閒置自動登出監聽器 — 當使用者閒置超過 5 分鐘自動執行安全登出
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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

    // 訂閱 zustand store 的最新值
    useEffect(() => {
        const unsub = useAppStore.subscribe((state) => {
            profileRef.current = state.profile
            storeLogoutRef.current = state.logout
        })
        return unsub
    }, [])

    // 自動登出核心邏輯
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

    // 主要 effect：監聽使用者操作事件，管理閒置計時器
    useEffect(() => {
        // 重設計時器
        const resetTimer = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
            // 僅在已登入時啟動計時器
            if (profileRef.current) {
                timerRef.current = setTimeout(performAutoLogout, IDLE_TIMEOUT)
            }
        }

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
        const events = ['mousemove', 'mousedown', 'click', 'keydown', 'scroll', 'touchstart']
        events.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true })
        })

        // 清除所有偵聽器與計時器
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
            events.forEach(event => {
                window.removeEventListener(event, handleActivity)
            })
        }
    }, [performAutoLogout])

    // 此元件不渲染任何 UI
    return null
}
