'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Package, AlertTriangle } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { sendTelegramNotify, formatUpdateMessage, VENDOR_WORK_LABELS } from '@/lib/telegram-notify'
import { logChangeRecord } from '@/lib/change-log'
import { formatItemsDisplay, validateOtherItemsSeparator } from '@/lib/utils'
import { vendorWorkSchema, type VendorWorkFormValues, BORROW_ITEM_OPTIONS } from '@/lib/validations/schemas'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

import FormField from '@/components/forms/FormField'
import FormHeader from '@/components/forms/FormHeader'
import BackButton from '@/components/forms/BackButton'
import SubmitButton from '@/components/forms/SubmitButton'
import ConfirmDialog from '@/components/forms/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const FIELD_LABELS: Record<string, string> = {
    entry_status: '到院/離院',
    work_date: '日期',
    arrival_time: '到院時間',
    departure_time: '離院時間',
    vendor_name: '廠商名稱',
    vendor_contact: '廠商負責人員',
    vendor_contact_phone: '負責人員電話',
    location: '施工地點',
    vendor_badge_id: '工作證號',
    head_count: '施工人數',
    work_content: '施工內容',
    note: '備註',
    borrow_action: '借用動作',
    lender_name: '借出人員',
    borrowed_items: '借出項目',
    receiver_name: '歸還人員',
    returned_items: '歸還項目',
}

export default function VendorEditClient({ initialData }: { initialData: any }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const isGuest = searchParams?.get('guest') === 'true'
    const supabase = createClient()
    const { toast } = useToast()

    const [isSuccess, setIsSuccess] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingData, setPendingData] = useState<VendorWorkFormValues | null>(null)
    const [mismatchWarning, setMismatchWarning] = useState<{ open: boolean; messages: string[]; allowSave: boolean }>({
        open: false,
        messages: [],
        allowSave: false
    })
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    // 借物 state：從 initialData 預填
    const initBorrowAction = initialData?.borrow_action || 'none'
    const [borrowAction, setBorrowAction] = useState<'borrow' | 'none'>(
        initialData?.entry_status === 'arrival' ? (initBorrowAction === 'borrow' ? 'borrow' : 'none') : 'none'
    )
    const [borrowedItems, setBorrowedItems] = useState<string[]>(initialData?.borrowed_items?.items || [])
    const [borrowedOtherText, setBorrowedOtherText] = useState(initialData?.borrowed_items?.other_text || '')
    const [lenderName, setLenderName] = useState(initialData?.lender_name || '')
    const [returnAction, setReturnAction] = useState<'return' | 'none'>(
        initialData?.entry_status === 'departure' ? (initBorrowAction === 'return' ? 'return' : 'none') : 'none'
    )
    const [returnedItems, setReturnedItems] = useState<string[]>(initialData?.returned_items?.items || [])
    const [returnedOtherText, setReturnedOtherText] = useState(initialData?.returned_items?.other_text || '')
    const [receiverName, setReceiverName] = useState(initialData?.receiver_name || '')

    const [originalBorrowedItems, setOriginalBorrowedItems] = useState<string[] | null>(null)
    const [originalBorrowedOtherText, setOriginalBorrowedOtherText] = useState('')

    useEffect(() => {
        const fetchOriginalArrival = async () => {
            if (initialData?.entry_status === 'departure' && initialData?.ref_arrival_id) {
                const { data } = await supabase
                    .from('vendor_today_work')
                    .select('borrowed_items, lender_name')
                    .eq('id', initialData.ref_arrival_id)
                    .single()
                if (data) {
                    setOriginalBorrowedItems((data.borrowed_items as any)?.items || [])
                    setOriginalBorrowedOtherText((data.borrowed_items as any)?.other_text || '')
                    setLenderName(data.lender_name || '')
                }
            }
        }
        fetchOriginalArrival()
    }, [initialData, supabase])

    const toggleItem = (item: string, list: string[], setList: (v: string[]) => void) => {
        setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item])
    }

    const defaultValues = {
        ...initialData,
        borrowed_items: initialData?.borrowed_items?.items || [],
        borrowed_other_text: initialData?.borrowed_items?.other_text || '',
        returned_items: initialData?.returned_items?.items || [],
        returned_other_text: initialData?.returned_items?.other_text || ''
    }

    const { register, handleSubmit, watch, trigger, setValue, formState: { errors, isSubmitting } } = useForm<VendorWorkFormValues>({
        resolver: zodResolver(vendorWorkSchema) as any,
        mode: 'onBlur',
        defaultValues
    })

    const entryStatus = watch('entry_status')

    const handleFieldBlur = useCallback((fieldName: string) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
        trigger(fieldName as any)
    }, [trigger])

    useEffect(() => {
        setValue('borrow_action', entryStatus === 'arrival' ? borrowAction : returnAction)
        setValue('borrowed_items', borrowedItems)
        setValue('borrowed_other_text', borrowedOtherText)
        setValue('lender_name', lenderName)
        setValue('returned_items', returnedItems)
        setValue('returned_other_text', returnedOtherText)
        setValue('receiver_name', receiverName)
        if (entryStatus === 'arrival' && borrowAction === 'borrow') {
            trigger(['borrowed_items', 'lender_name', 'borrowed_other_text'])
        }
        if (entryStatus === 'departure' && returnAction === 'return') {
            trigger(['returned_items', 'receiver_name', 'returned_other_text'])
        }
    }, [borrowAction, borrowedItems, borrowedOtherText, lenderName, returnAction, returnedItems, returnedOtherText, receiverName, entryStatus, setValue, trigger])

    const onPreSubmit = (data: VendorWorkFormValues) => {
        // 驗證「其他物品」的分隔符號
        if (entryStatus === 'arrival' && borrowAction === 'borrow' && borrowedItems.includes('其他')) {
            const validation = validateOtherItemsSeparator(borrowedOtherText)
            if (!validation.isValid) {
                toast({ title: '格式錯誤', description: validation.message, variant: 'destructive' })
                return
            }
        }
        if (entryStatus === 'departure' && returnAction === 'return' && returnedItems.includes('其他')) {
            const validation = validateOtherItemsSeparator(returnedOtherText)
            if (!validation.isValid) {
                toast({ title: '格式錯誤', description: validation.message, variant: 'destructive' })
                return
            }
        }

        setPendingData(data)
        if (data.entry_status === 'departure' && returnAction === 'return' && originalBorrowedItems !== null) {
            // 1. 比較標準項目
            const missingItems = originalBorrowedItems.filter(item => !returnedItems.includes(item))
            const extraItems = returnedItems.filter(item => !originalBorrowedItems.includes(item))
            
            // 2. 比較「其他」文字內容 (處理手動輸入的多個項目)
            const splitOther = (text: string) => text ? text.split(/[、,，\s\.]+/).map(s => s.trim()).filter(Boolean) : []
            const originalOtherList = splitOther(originalBorrowedOtherText)
            const currentOtherList = splitOther(returnedOtherText)
            
            const missingOthers = originalOtherList.filter(item => !currentOtherList.includes(item))
            const extraOthers = currentOtherList.filter(item => !originalOtherList.includes(item))

            const errorMsgs: string[] = []
            
            if (missingItems.length > 0) {
                errorMsgs.push(`尚未歸還: ${missingItems.join('、')}`)
            }
            if (missingOthers.length > 0) {
                errorMsgs.push(`尚未歸還 (其他): ${missingOthers.join('、')}`)
            }
            if (extraItems.length > 0) {
                errorMsgs.push(`未曾借出卻歸還: ${extraItems.join('、')}`)
            }
            if (extraOthers.length > 0) {
                errorMsgs.push(`未曾借出卻歸還 (其他): ${extraOthers.join('、')}`)
            }
            
            const hasMissing = missingItems.length > 0 || missingOthers.length > 0
            const hasExtra = extraItems.length > 0 || extraOthers.length > 0
            
            if (hasMissing || hasExtra) {
                setMismatchWarning({ 
                    open: true, 
                    messages: errorMsgs,
                    allowSave: !hasExtra // 只有在沒有「多餘歸還」的情況下才允許強行存檔（部分歸還）
                })
                return
            }
        }

        setShowConfirm(true)
    }

    const onConfirmSubmit = async (isPartialReturn = false) => {
        if (!pendingData) return
        setShowConfirm(false)
        try {
            const payload: any = { ...pendingData }
            if (pendingData.entry_status === 'arrival') {
                payload.departure_time = null
                payload.borrow_action = borrowAction
                payload.borrowed_items = borrowAction === 'borrow' ? { items: borrowedItems, other_text: borrowedOtherText } : null
                payload.lender_name = borrowAction === 'borrow' ? lenderName : null
                payload.returned_items = null
                payload.receiver_name = null
            } else {
                payload.arrival_time = null
                payload.location = null
                payload.vendor_badge_id = null
                payload.head_count = null
                payload.vendor_contact_phone = null
                payload.borrow_action = isPartialReturn ? 'partial_return' : returnAction
                payload.returned_items = (payload.borrow_action === 'return' || payload.borrow_action === 'partial_return') ? { items: returnedItems, other_text: returnedOtherText } : null
                payload.receiver_name = (payload.borrow_action === 'return' || payload.borrow_action === 'partial_return') ? receiverName : null
                
                if (payload.borrow_action === 'partial_return' && originalBorrowedItems) {
                    // 計算並存入「尚未歸還」的項目
                    const missing = originalBorrowedItems.filter(i => !returnedItems.includes(i))
                    const splitOther = (text: string) => text ? text.split(/[、,，\s\.]+/).map(s => s.trim()).filter(Boolean) : []
                    const originalOthers = splitOther(originalBorrowedOtherText)
                    const currentOthers = splitOther(returnedOtherText)
                    const missingOthers = originalOthers.filter(item => !currentOthers.includes(item))
                    
                    payload.borrowed_items = { 
                        items: missing, 
                        other_text: missingOthers.join('、') 
                    }
                    payload.lender_name = lenderName 
                } else {
                    payload.borrowed_items = null
                    payload.lender_name = null
                }
            }
            delete payload.borrowed_other_text
            delete payload.returned_other_text

            const { error } = await supabase.from('vendor_today_work').update(payload).eq('id', initialData.id)
            if (error) throw error

            sendTelegramNotify(formatUpdateMessage('廠商今日施工項目', initialData, payload, VENDOR_WORK_LABELS))
            logChangeRecord({ actionType: 'Update', modifyTable: 'vendor_today_work', modifyRecordId: initialData.id, oldData: initialData, newData: payload })

            setIsSuccess(true)
            toast({ title: '修改成功', description: '廠商施工項目已更新' })
            setTimeout(() => router.push(isGuest ? '/vendor-work-guest' : '/'), 1500)
        } catch (error: any) {
            toast({ title: '修改失敗', description: error.message, variant: 'destructive' })
        }
    }

    if (!initialData) return <div className="p-8 text-center text-muted-foreground">查無資料</div>

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
            <FormHeader title="廠商今日施工項目 - 修改" currentStep={3} totalSteps={3} themeColor="bg-blue-600">
                <BackButton />
            </FormHeader>

            <main className="max-w-3xl mx-auto p-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleSubmit(onPreSubmit, (e) => console.log(e))} className="space-y-6">
                        {/* 到院/離院（不可修改） */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">到院或離院 (不可修改)</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex gap-4 opacity-75 pointer-events-none">
                                    <div className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 ${entryStatus === 'arrival' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border'}`}>
                                        <span className="font-bold">到院</span>
                                    </div>
                                    <div className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 ${entryStatus === 'departure' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border'}`}>
                                        <span className="font-bold">離院</span>
                                    </div>
                                </div>
                                <input type="hidden" {...register('entry_status')} />
                            </CardContent>
                        </Card>

                        {/* 日期時間 */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="日期" required error={errors.work_date?.message} touched={touchedFields.work_date}>
                                        <Input type="date" {...register('work_date')} onBlur={() => handleFieldBlur('work_date')} />
                                    </FormField>
                                    <FormField label={entryStatus === 'arrival' ? '到院時間' : '離院時間'} required
                                        error={entryStatus === 'arrival' ? errors.arrival_time?.message : errors.departure_time?.message}
                                        touched={entryStatus === 'arrival' ? touchedFields.arrival_time : touchedFields.departure_time}>
                                        <Input type="time" {...register(entryStatus === 'arrival' ? 'arrival_time' : 'departure_time')}
                                            onBlur={() => handleFieldBlur(entryStatus === 'arrival' ? 'arrival_time' : 'departure_time')} />
                                    </FormField>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 廠商資訊 */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">廠商資訊</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField label="廠商名稱" required error={errors.vendor_name?.message} touched={touchedFields.vendor_name}>
                                    <Input {...register('vendor_name')} onBlur={() => handleFieldBlur('vendor_name')} />
                                </FormField>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="廠商負責人員" required error={errors.vendor_contact?.message} touched={touchedFields.vendor_contact}>
                                        <Input {...register('vendor_contact')} onBlur={() => handleFieldBlur('vendor_contact')} />
                                    </FormField>
                                    {entryStatus === 'arrival' && (
                                        <FormField label="負責人員電話" required error={errors.vendor_contact_phone?.message} touched={touchedFields.vendor_contact_phone}>
                                            <Input {...register('vendor_contact_phone')} onBlur={() => handleFieldBlur('vendor_contact_phone')} />
                                        </FormField>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 施工位置 */}
                        {entryStatus === 'arrival' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> 施工位置資訊</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField label="工作證號" required error={errors.vendor_badge_id?.message} touched={touchedFields.vendor_badge_id}>
                                            <Input type="number" {...register('vendor_badge_id')} onBlur={() => handleFieldBlur('vendor_badge_id')} />
                                        </FormField>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField label="施工地點" required error={errors.location?.message} touched={touchedFields.location}>
                                            <Input {...register('location')} onBlur={() => handleFieldBlur('location')} />
                                        </FormField>
                                        <FormField label="施工人數" required error={errors.head_count?.message} touched={touchedFields.head_count}>
                                            <Input type="number" {...register('head_count')} onBlur={() => handleFieldBlur('head_count')} />
                                        </FormField>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* 借物區塊 - 到院時顯示 */}
                        {entryStatus === 'arrival' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                            <Package className="w-4 h-4" />
                                            借物資訊
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex gap-3">
                                            {(['none', 'borrow'] as const).map(val => (
                                                <label key={val} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-bold ${
                                                    borrowAction === val
                                                        ? 'border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                        : 'border-border hover:border-amber-300'
                                                }`}>
                                                    <input type="radio" className="sr-only" checked={borrowAction === val} onChange={() => { setBorrowAction(val); if (val === 'none') { setBorrowedItems([]); setLenderName('') } }} />
                                                    {val === 'none' ? '未借物' : '已借物'}
                                                </label>
                                            ))}
                                        </div>
                                        {borrowAction === 'borrow' && (
                                            <>
                                                <div>
                                                    <p className="text-sm font-medium mb-2">借出項目 <span className="text-red-500">*</span></p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {BORROW_ITEM_OPTIONS.map(item => (
                                                            <label key={item} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all ${
                                                                borrowedItems.includes(item)
                                                                    ? 'border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                                    : 'border-border hover:border-amber-300 bg-background'
                                                            }`}>
                                                                <input type="checkbox" className="sr-only" checked={borrowedItems.includes(item)} onChange={() => toggleItem(item, borrowedItems, setBorrowedItems)} />
                                                                {item}
                                                            </label>
                                                        ))}
                                                    </div>
                                                    {(errors as any).borrowed_items && <p className="text-xs text-red-500 mt-1">{(errors as any).borrowed_items.message}</p>}
                                                </div>
                                                {borrowedItems.includes('其他') && (
                                                    <FormField label="其他物品說明" required error={errors.borrowed_other_text?.message}>
                                                        <Input value={borrowedOtherText} onChange={e => setBorrowedOtherText(e.target.value)} placeholder="請說明其他物品 (多個項目請以頓號「、」分隔)" />
                                                    </FormField>
                                                )}
                                                <FormField label="借出人員" required error={errors.lender_name?.message}>
                                                    <Input value={lenderName} onChange={e => setLenderName(e.target.value)} placeholder="請輸入負責借出的人員姓名" />
                                                </FormField>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* 歸還區塊 - 離院時顯示 */}
                        {entryStatus === 'departure' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                <Card className="border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                                            <Package className="w-4 h-4" />
                                            歸還資訊
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex gap-3">
                                            {(['none', 'return'] as const).map(val => (
                                                <label key={val} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-bold ${
                                                    returnAction === val
                                                        ? 'border-green-500 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                                        : 'border-border hover:border-green-300'
                                                }`}>
                                                    <input type="radio" className="sr-only" checked={returnAction === val} onChange={() => { setReturnAction(val); if (val === 'none') { setReturnedItems([]); setReceiverName('') } }} />
                                                    {val === 'none' ? '未借物' : '已歸還'}
                                                </label>
                                            ))}
                                        </div>
                                        {returnAction === 'return' && (
                                            <>
                                                <div>
                                                    <p className="text-sm font-medium mb-2">歸還項目 <span className="text-red-500">*</span></p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {BORROW_ITEM_OPTIONS.map(item => (
                                                            <label key={item} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all ${
                                                                returnedItems.includes(item)
                                                                    ? 'border-green-500 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                                                    : 'border-border hover:border-green-300 bg-background'
                                                            }`}>
                                                                <input type="checkbox" className="sr-only" checked={returnedItems.includes(item)} onChange={() => toggleItem(item, returnedItems, setReturnedItems)} />
                                                                {item}
                                                            </label>
                                                        ))}
                                                    </div>
                                                    {(errors as any).returned_items && <p className="text-xs text-red-500 mt-1">{(errors as any).returned_items.message}</p>}
                                                </div>
                                                {returnedItems.includes('其他') && (
                                                    <FormField label="其他物品說明" required error={errors.returned_other_text?.message}>
                                                        <Input value={returnedOtherText} onChange={e => setReturnedOtherText(e.target.value)} placeholder="請說明其他物品 (多個項目請以頓號「、」分隔)" />
                                                    </FormField>
                                                )}
                                                <FormField label="歸還人員" required error={errors.receiver_name?.message}>
                                                    <Input value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="請輸入負責點收歸還的人員姓名" />
                                                </FormField>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {/* 施工內容 */}
                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <FormField label="施工內容" required error={errors.work_content?.message} touched={touchedFields.work_content}>
                                    <Textarea {...register('work_content')} rows={4} onBlur={() => handleFieldBlur('work_content')} />
                                </FormField>
                                {entryStatus === 'arrival' && (
                                    <FormField label="備註" error={errors.note?.message} touched={touchedFields.note}>
                                        <Input {...register('note')} onBlur={() => handleFieldBlur('note')} />
                                    </FormField>
                                )}
                            </CardContent>
                        </Card>

                        <SubmitButton isSubmitting={isSubmitting} isSuccess={isSuccess} label="儲存修改" className="bg-blue-600 hover:bg-blue-700" />
                    </form>
                </motion.div>
            </main>

            <ConfirmDialog
                open={showConfirm}
                onConfirm={() => onConfirmSubmit(false)}
                onCancel={() => setShowConfirm(false)}
                title="確認儲存修改"
                data={pendingData ? {
                    ...pendingData,
                    entry_status: pendingData.entry_status === 'arrival' ? '到院' : pendingData.entry_status === 'departure' ? '離院' : pendingData.entry_status,
                    borrow_action: pendingData.borrow_action === 'borrow' ? '已借物' : pendingData.borrow_action === 'return' ? '歸還' : pendingData.borrow_action === 'partial_return' ? '部分未歸還' : pendingData.borrow_action === 'none' ? '未借物' : pendingData.borrow_action,
                    borrowed_items: formatItemsDisplay(pendingData.borrowed_items, pendingData.borrowed_other_text),
                    returned_items: formatItemsDisplay(pendingData.returned_items, pendingData.returned_other_text),
                } : {}}
                fieldLabels={FIELD_LABELS}
            />

            {/* 項目不符警示視窗 */}
            <Dialog open={mismatchWarning.open} onOpenChange={(open) => setMismatchWarning(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            歸還項目不符
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            您目前勾選的歸還項目與原借出項目有以下差異：
                            <ul className="list-disc pl-5 mt-2 space-y-1 text-red-600 font-medium">
                                {mismatchWarning.messages.map((msg, i) => (
                                    <li key={i}>{msg}</li>
                                ))}
                            </ul>
                            <p className="mt-4 text-sm text-muted-foreground font-medium">
                                {mismatchWarning.allowSave 
                                    ? "若確認部份物品暫時無法歸還，請點擊「已確認存檔」，系統將標記為「部份未歸還」。"
                                    : "因為你歸還了未曾借出的物品，請按返回修改按鈕，進行修改"
                                }
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setMismatchWarning(prev => ({ ...prev, open: false }))}>
                            返回修改
                        </Button>
                        {mismatchWarning.allowSave && (
                            <Button variant="destructive" onClick={() => {
                                setMismatchWarning(prev => ({ ...prev, open: false }))
                                onConfirmSubmit(true)
                            }}>
                                已確認存檔
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
