// ConfirmDialog — 提交前摘要確認 Dialog
'use client'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle, X } from 'lucide-react'

interface ConfirmDialogProps {
    /** 是否開啟 */
    open: boolean
    /** 確認後回呼 */
    onConfirm: () => void
    /** 取消回呼 */
    onCancel: () => void
    /** 標題（預設「確認提交」） */
    title?: string
    /** 表單資料 key-value */
    data: Record<string, any>
    /** 欄位名稱對照表（key → 中文名稱） */
    fieldLabels: Record<string, string>
}

export default function ConfirmDialog({
    open,
    onConfirm,
    onCancel,
    title = '確認提交',
    data,
    fieldLabels,
}: ConfirmDialogProps) {
    // 過濾出有對照表的欄位，並按照 fieldLabels 的順序排列
    const entries = Object.keys(fieldLabels)
        .filter((key) => key in data)
        .map((key) => ({
            label: fieldLabels[key],
            value: data[key],
        }))

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        請確認以下資料是否正確，確認後將送出。
                    </DialogDescription>
                </DialogHeader>

                {/* 摘要列表 */}
                <div className="space-y-2 py-4">
                    {entries.map(({ label, value }, i) => (
                        <div
                            key={i}
                            className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
                        >
                            <span className="text-sm font-medium text-muted-foreground min-w-[100px] shrink-0">
                                {label}
                            </span>
                            <span className={`text-sm flex-1 ${value === null || value === undefined || value === ''
                                    ? 'text-muted-foreground/50 italic'
                                    : 'text-foreground'
                                }`}>
                                {value === null || value === undefined || value === ''
                                    ? '未填寫'
                                    : String(value)}
                            </span>
                        </div>
                    ))}
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        className="gap-1"
                    >
                        <X className="w-4 h-4" />
                        返回修改
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        className="gap-1"
                    >
                        <CheckCircle className="w-4 h-4" />
                        確認送出
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
