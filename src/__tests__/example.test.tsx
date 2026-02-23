// 範例元件測試 — 驗證 Vitest + React Testing Library 安裝正確
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// 簡單的測試元件
function Greeting({ name }: { name: string }) {
    return <h1>你好，{name}！</h1>
}

describe('Vitest + React Testing Library 安裝驗證', () => {
    it('能正確 render React 元件', () => {
        render(<Greeting name="工務室" />)
        expect(screen.getByText('你好，工務室！')).toBeInTheDocument()
    })

    it('基本斷言正常運作', () => {
        expect(1 + 1).toBe(2)
        expect('電子白板').toContain('白板')
    })
})
