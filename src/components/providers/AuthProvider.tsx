// Auth Provider - handles auth state across the app
// 使用 onAuthStateChange 的 INITIAL_SESSION 事件初始化，避免 getSession 競爭問題
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/stores/useAppStore'

interface AuthContextType {
    user: User | null
    session: Session | null
    isLoading: boolean
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    isLoading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const supabase = createClient()
    const { setUser, setSession, setProfile, setLoading, isLoading } = useAppStore()
    const [user, setLocalUser] = useState<User | null>(null)
    const [session, setLocalSession] = useState<Session | null>(null)

    useEffect(() => {
        let mounted = true

        // 抑制 Supabase Auth navigator.locks 的 AbortError（開發模式 Strict Mode 造成）
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            if (event.reason?.name === 'AbortError' ||
                event.reason?.message?.includes('signal is aborted')) {
                event.preventDefault()
            }
        }
        window.addEventListener('unhandledrejection', handleUnhandledRejection)

        // 輔助函數：獲取使用者 profile
        const fetchProfile = async (userId: string) => {
            try {
                const { data: profile } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .single()

                if (mounted && profile) {
                    setProfile(profile as any)
                }
            } catch (error) {
                // 在開發模式下可能因為競爭而失敗，忽略
                if (error instanceof Error && error.name !== 'AbortError') {
                    console.error('Error fetching profile:', error)
                }
            }
        }

        // 使用 onAuthStateChange 處理所有 auth 狀態（包括初始狀態）
        // 註冊後會立即觸發 INITIAL_SESSION 事件
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return

                // 更新本地和全局狀態
                setLocalSession(session)
                setLocalUser(session?.user ?? null)
                setSession(session)
                setUser(session?.user ?? null)

                if (session?.user) {
                    // 使用 setTimeout 延遲 profile 獲取，避免與 auth 競爭
                    setTimeout(() => {
                        if (mounted) {
                            fetchProfile(session.user.id)
                        }
                    }, 0)
                } else {
                    setProfile(null)
                }

                // 無論成功或失敗，都設置 loading = false
                if (mounted) {
                    setLoading(false)
                }
            }
        )

        // 設置一個 fallback timeout，確保 loading 最終會結束
        const fallbackTimeout = setTimeout(() => {
            if (mounted && isLoading) {
                console.warn('Auth loading timeout, forcing loading = false')
                setLoading(false)
            }
        }, 5000)

        return () => {
            mounted = false
            subscription.unsubscribe()
            clearTimeout(fallbackTimeout)
            window.removeEventListener('unhandledrejection', handleUnhandledRejection)
        }
    }, []) // 空依賴數組，只在掛載時執行

    return (
        <AuthContext.Provider value={{ user, session, isLoading }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
