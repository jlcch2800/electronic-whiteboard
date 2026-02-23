/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        // 使用 jsdom 模擬瀏覽器環境
        environment: 'jsdom',
        // 全域引入 testing-library 的 matchers（toBeInTheDocument 等）
        setupFiles: ['./src/__tests__/setup.ts'],
        // 測試檔案路徑 pattern
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        // 排除 Playwright E2E 測試
        exclude: ['tests/**', 'node_modules/**'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
