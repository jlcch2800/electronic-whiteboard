// ThemeProvider — 管理 dark/light 主題
// 讀取 localStorage 或系統偏好，在 <html> 元素上切換 'dark' class
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
    theme: Theme
    resolvedTheme: 'light' | 'dark'
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'system',
    resolvedTheme: 'light',
    setTheme: () => { },
})

const STORAGE_KEY = 'whiteboard-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('system')
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

    // 初始化：從 localStorage 讀取或使用系統偏好
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
        if (stored && ['light', 'dark', 'system'].includes(stored)) {
            setThemeState(stored)
        }
    }, [])

    // 監聽系統偏好變化 + 套用主題
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

        const applyTheme = () => {
            let resolved: 'light' | 'dark'
            if (theme === 'system') {
                resolved = mediaQuery.matches ? 'dark' : 'light'
            } else {
                resolved = theme
            }
            setResolvedTheme(resolved)

            const root = document.documentElement
            if (resolved === 'dark') {
                root.classList.add('dark')
            } else {
                root.classList.remove('dark')
            }
        }

        applyTheme()

        // 監聽系統偏好即時變化
        const handler = () => {
            if (theme === 'system') applyTheme()
        }
        mediaQuery.addEventListener('change', handler)
        return () => mediaQuery.removeEventListener('change', handler)
    }, [theme])

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
        localStorage.setItem(STORAGE_KEY, newTheme)
    }

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)
