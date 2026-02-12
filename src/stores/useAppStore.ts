// Global App Store
'use client'
import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'

// User profile from public.users table
interface UserProfile {
    id: string
    unit: string
    user_name: string
    user_account: string
    role: 'admin' | 'staff'
    email: string
    is_active: boolean
}

interface AppState {
    // Auth State
    user: User | null
    session: Session | null
    profile: UserProfile | null
    isLoading: boolean

    // Actions
    setUser: (user: User | null) => void
    setSession: (session: Session | null) => void
    setProfile: (profile: UserProfile | null) => void
    setLoading: (loading: boolean) => void
    logout: () => void
}

export const useAppStore = create<AppState>((set) => ({
    user: null,
    session: null,
    profile: null,
    isLoading: true,

    setUser: (user) => set({ user }),
    setSession: (session) => set({ session }),
    setProfile: (profile) => set({ profile }),
    setLoading: (isLoading) => set({ isLoading }),
    logout: () => set({ user: null, session: null, profile: null }),
}))
