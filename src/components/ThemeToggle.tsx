// Dark Mode 切換按鈕 — 三態切換（淺色 / 深色 / 系統）
'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 relative overflow-hidden"
                >
                    <Sun className={`h-4 w-4 transition-all duration-300 ${resolvedTheme === 'dark'
                            ? 'rotate-90 scale-0 opacity-0'
                            : 'rotate-0 scale-100 opacity-100'
                        }`} />
                    <Moon className={`absolute h-4 w-4 transition-all duration-300 ${resolvedTheme === 'dark'
                            ? 'rotate-0 scale-100 opacity-100'
                            : '-rotate-90 scale-0 opacity-0'
                        }`} />
                    <span className="sr-only">切換主題</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={() => setTheme('light')}
                    className={theme === 'light' ? 'bg-accent font-semibold' : ''}
                >
                    <Sun className="w-4 h-4 mr-2" />
                    淺色模式
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme('dark')}
                    className={theme === 'dark' ? 'bg-accent font-semibold' : ''}
                >
                    <Moon className="w-4 h-4 mr-2" />
                    深色模式
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme('system')}
                    className={theme === 'system' ? 'bg-accent font-semibold' : ''}
                >
                    <Monitor className="w-4 h-4 mr-2" />
                    跟隨系統
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
