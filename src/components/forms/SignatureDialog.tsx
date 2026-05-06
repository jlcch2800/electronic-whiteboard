'use client'

import { useRef, useEffect, useState } from 'react'
import SignaturePad from 'signature_pad'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2, Check, X, Undo2, Redo2, Eraser, Pencil } from 'lucide-react'

interface SignatureDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (signatureDataUrl: string) => void
    title?: string
}

export default function SignatureDialog({
    open,
    onOpenChange,
    onConfirm,
    title = '電子簽章'
}: SignatureDialogProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const signaturePadRef = useRef<SignaturePad | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isEraser, setIsEraser] = useState(false)
    const [strokes, setStrokes] = useState<any[]>([]) // 直接存儲筆劃數據
    const [redoStack, setRedoStack] = useState<any[]>([])

    // 初始化 SignaturePad
    useEffect(() => {
        if (open) {
            // 延遲一點點確保 Dialog 的動畫完成，且 DOM 尺寸穩定
            const timer = setTimeout(() => {
                if (!canvasRef.current) return

                const canvas = canvasRef.current
                
                // 建立實例，調整筆觸粗細以便於觀察
                const signaturePad = new SignaturePad(canvas, {
                    minWidth: 2, // 增加最小粗細
                    maxWidth: 5, // 增加最大粗細
                    penColor: 'black',
                    backgroundColor: 'rgba(255, 255, 255, 0)',
                })
                signaturePad.penColor = '#000000'
                
                // 監聽筆劃結束，同步筆劃數據
                const handleEndStroke = () => {
                    if (!signaturePadRef.current) return
                    const data = signaturePadRef.current.toData()
                    setStrokes(data)
                    setRedoStack([])
                }
                
                signaturePad.addEventListener('endStroke', handleEndStroke)

                signaturePadRef.current = signaturePad

                // 立即校正尺寸
                resizeCanvas()
                
                window.addEventListener('resize', resizeCanvas)
            }, 200) // 增加延遲到 200ms

            return () => {
                clearTimeout(timer)
                window.removeEventListener('resize', resizeCanvas)
                if (signaturePadRef.current) {
                    signaturePadRef.current.off()
                }
            }
        }
    }, [open])

    const resizeCanvas = () => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return
        
        // 取得物理像素比，處理 Retina 螢幕
        const ratio = Math.max(window.devicePixelRatio || 1, 1)
        
        // 設定畫布內部尺寸 (Buffer Size)
        canvas.width = container.offsetWidth * ratio
        canvas.height = container.offsetHeight * ratio
        
        // 縮放繪圖上下文，讓座標對齊
        const ctx = canvas.getContext('2d')
        if (ctx) {
            ctx.scale(ratio, ratio)
        }
        
        // 重新載入筆劃，避免 resize 清空畫布
        if (signaturePadRef.current && strokes.length > 0) {
            signaturePadRef.current.fromData(strokes)
        } else {
            signaturePadRef.current?.clear()
        }
    }

    const handleClear = () => {
        signaturePadRef.current?.clear()
        setStrokes([])
        setRedoStack([])
    }

    const handleUndo = () => {
        const pad = signaturePadRef.current
        if (pad && strokes.length > 0) {
            const newStrokes = [...strokes]
            const lastStroke = newStrokes.pop()
            if (lastStroke) setRedoStack(prev => [lastStroke, ...prev])
            
            setStrokes(newStrokes)
            pad.fromData(newStrokes)
        }
    }

    const handleRedo = () => {
        const pad = signaturePadRef.current
        if (pad && redoStack.length > 0) {
            const newRedoStack = [...redoStack]
            const strokeToRestore = newRedoStack.shift()
            if (strokeToRestore) {
                const newStrokes = [...strokes, strokeToRestore]
                setStrokes(newStrokes)
                pad.fromData(newStrokes)
            }
            setRedoStack(newRedoStack)
        }
    }

    const toggleEraser = () => {
        if (signaturePadRef.current) {
            const nextMode = !isEraser
            setIsEraser(nextMode)
            // 橡皮擦模式使用與背景相同的顏色模擬，或使用 destination-out
            // 由於 signature_pad 本身不直接支援橡皮擦，我們使用白色筆觸模擬
            signaturePadRef.current.penColor = nextMode ? '#FFFFFF' : '#000000'
            // 橡皮擦模式時增加粗細以便好擦
            signaturePadRef.current.minWidth = nextMode ? 10 : 2
            signaturePadRef.current.maxWidth = nextMode ? 20 : 5
        }
    }

    const handleConfirm = () => {
        if (signaturePadRef.current?.isEmpty()) {
            // 如果是空的，可以視為取消或提醒
            onOpenChange(false)
            return
        }
        const dataUrl = signaturePadRef.current?.toDataURL('image/png')
        if (dataUrl) {
            onConfirm(dataUrl)
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-16px)] sm:max-w-[600px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-none shadow-2xl">
                <DialogHeader className="p-4 border-b bg-slate-50 dark:bg-slate-800">
                    <DialogTitle>
                        <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="p-4 bg-slate-100 dark:bg-slate-950">
                    <div 
                        ref={containerRef}
                        className="relative w-full h-[300px] bg-white rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 shadow-inner overflow-hidden"
                    >
                        <canvas 
                            ref={canvasRef} 
                            className="w-full h-full touch-none cursor-crosshair bg-white dark:bg-white"
                            style={{ display: 'block', touchAction: 'none' }}
                        />
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none text-slate-400 text-xs font-medium opacity-50">
                            請在此區域內簽名
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-slate-50 dark:bg-slate-800 flex flex-col sm:flex-row justify-between gap-4">
                    {/* 左側工具欄：模式、復原、全清 */}
                    <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => isEraser && toggleEraser()}
                                className={`h-8 px-3 sm:px-4 rounded-lg transition-all ${!isEraser ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md font-bold" : "text-slate-500"}`}
                            >
                                <Pencil className="w-4 h-4 sm:mr-1.5" />
                                <span className="hidden xs:inline text-xs">畫筆</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => !isEraser && toggleEraser()}
                                className={`h-8 px-3 sm:px-4 rounded-lg transition-all ${isEraser ? "bg-amber-500 text-white hover:bg-amber-600 shadow-md font-bold" : "text-slate-500"}`}
                            >
                                <Eraser className="w-4 h-4 sm:mr-1.5" />
                                <span className="hidden xs:inline text-xs">橡皮擦</span>
                            </Button>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Button 
                                variant="outline" 
                                size="icon"
                                onClick={handleUndo}
                                disabled={strokes.length === 0}
                                className={`h-9 w-9 rounded-lg ${strokes.length > 0 ? "text-blue-600 border-blue-200" : ""}`}
                            >
                                <Undo2 className="w-4 h-4" />
                            </Button>
                            <Button 
                                variant="outline" 
                                size="icon"
                                onClick={handleRedo}
                                disabled={redoStack.length === 0}
                                className={`h-9 w-9 rounded-lg ${redoStack.length > 0 ? "text-blue-600 border-blue-200" : ""}`}
                            >
                                <Redo2 className="w-4 h-4" />
                            </Button>
                        </div>

                        <Button 
                            variant="outline" 
                            size="icon"
                            onClick={handleClear}
                            className="h-9 w-9 border-red-200 text-red-600 hover:bg-red-50 sm:hidden"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            onClick={handleClear}
                            className="h-9 hidden sm:flex border-red-200 text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            全清
                        </Button>
                    </div>

                    {/* 右側操作：取消、完成 */}
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)}
                            className="flex-1 sm:flex-none h-10 text-slate-500"
                        >
                            取消
                        </Button>
                        <Button 
                            onClick={handleConfirm}
                            className="flex-1 sm:flex-none h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 font-bold"
                        >
                            <Check className="w-4 h-4 mr-2" />
                            完成簽核
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
