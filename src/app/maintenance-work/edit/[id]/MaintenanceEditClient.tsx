'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Activity, ArrowLeft, Save, CheckCircle2, AlertCircle,
    ChevronDown, ChevronRight, Lock, Unlock, Clock
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { logChangeRecord } from '@/lib/change-log'
import { useAuth } from '@/components/providers/AuthProvider'
import { useAppStore } from '@/stores/useAppStore'
import Navbar from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import {
    MAINTENANCE_STATUS, HANDLER_NAMES, MAINT_MGR_NAMES,
    DEFAULT_DIRECTOR_NAME, VICE_DEAN_NAMES, DEAN_NAMES
} from '@/lib/maintenance-constants'

interface MaintenanceEditClientProps {
    id: string
    initialData: any
}

export default function MaintenanceEditClient({ id, initialData }: MaintenanceEditClientProps) {
    const router = useRouter()
    const { user } = useAuth()
    const { profile } = useAppStore()
    const supabase = createClient()
    const isAdmin = profile?.role === 'admin'

    const [formData, setFormData] = useState(() => ({
        ...initialData,
        dispatch_director_name: initialData.dispatch_director_name || DEFAULT_DIRECTOR_NAME,
        accept_director_name: initialData.accept_director_name || DEFAULT_DIRECTOR_NAME
    }))
    const [lastSavedData, setLastSavedData] = useState(() => ({
        ...initialData,
        dispatch_director_name: initialData.dispatch_director_name || DEFAULT_DIRECTOR_NAME,
        accept_director_name: initialData.accept_director_name || DEFAULT_DIRECTOR_NAME
    }))
    const [loading, setLoading] = useState(false)
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

    // 取得當前狀態索引
    const currentStatusIndex = MAINTENANCE_STATUS.indexOf(formData.status)

    // 使用 state 記錄「基本資料階段」是否已完成，避免已存檔仍可修改或下一階段被鎖死
    const [section1Completed, setSection1Completed] = useState(
        !!(initialData.handler_name && initialData.work_order_date && initialData.maint_mgr_name && initialData.maint_mgr_date)
    )

    // 使用 state 記錄「開單主管簽核」是否已完成
    const [section2Completed, setSection2Completed] = useState(
        !!(initialData.req_dept_mgr_name && initialData.req_dept_mgr_date)
    )

    // 使用 state 記錄「報價階段」是否已完成，避免輸入時即時判定導致鎖死與自動收合/展開
    const [quoteCompleted, setQuoteCompleted] = useState(
        !!(initialData.quote_user_name && initialData.quote_user_date)
    )

    // 定義區塊是否可編輯
    const isSectionEditable = (sectionIndex: number) => {
        // 特殊邏輯：已驗收則全部不可編輯
        if (formData.status === '已驗收') return false

        // 特殊處理：「已轉維修單」與「開單主管簽核完成」
        if (formData.status === '已轉維修單' || formData.status === '開單主管簽核完成') {
            if (sectionIndex === 0) return !section1Completed
            if (sectionIndex === 1) return section1Completed && !section2Completed
            if (sectionIndex === 2) return section1Completed && section2Completed
            return false
        }

        // 特殊處理：「工務部門報價，主管簽核中」涵蓋 Section 3（報價）＋ Section 4（發包簽核）
        // 報價未完成 → Section 3 (index 2) 可編輯，Section 4 (index 3) 不可編輯
        // 報價已完成 → Section 3 (index 2) 唯讀，Section 4 (index 3) 可編輯
        if (formData.status === '工務部門報價，主管簽核中') {
            if (sectionIndex === 2) return !quoteCompleted
            if (sectionIndex === 3) return quoteCompleted
            return false
        }

        // 其他狀態：一對一映射
        // sectionIndex 對應：0=狀態1, 1=狀態2, 4=狀態5, 5=狀態6, 6=狀態7, 7=狀態8, 8=狀態9
        const statusMap: Record<string, number> = {
            '已轉維修單': 0,
            '開單主管簽核完成': 1,
            '院長室簽核中': 4,
            '採購發包簽核中': 5,
            '工務已發包': 6,
            '採購已發包': 6,
            '施工完成，開單單位驗收中': 7,
            '維修部門驗收中': 8,
        }

        const targetSection = statusMap[formData.status] ?? 0
        return sectionIndex === targetSection
    }

    // 初始化展開區塊
    useEffect(() => {
        // 特殊處理：「已轉維修單」或「開單主管簽核完成」依完成度決定展開
        if (formData.status === '已轉維修單' || formData.status === '開單主管簽核完成') {
            if (!section1Completed) {
                setOpenSections({ section1: true })
            } else if (!section2Completed) {
                setOpenSections({ section2: true })
            } else {
                setOpenSections({ section3: true })
            }
            return
        }
        // 特殊處理：報價階段依完成度決定展開 section3 或 section4
        if (formData.status === '工務部門報價，主管簽核中') {
            setOpenSections({ [quoteCompleted ? 'section4' : 'section3']: true })
            return
        }
        const statusMap: Record<string, string> = {
            '已轉維修單': 'section1',
            '開單主管簽核完成': 'section2',
            '院長室簽核中': 'section4_dean',
            '採購發包簽核中': 'section5',
            '工務已發包': 'section7',
            '採購已發包': 'section7',
            '施工完成，開單單位驗收中': 'section8',
            '維修部門驗收中': 'section9',
        }
        const activeSection = statusMap[formData.status] || 'section1'
        setOpenSections({ [activeSection]: true })
    }, [formData.status, section1Completed, section2Completed, quoteCompleted])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData((prev: any) => ({ ...prev, [name]: value }))
    }

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev: any) => ({ ...prev, [name]: value }))
    }

    // 驗證目前狀態的必填欄位
    const validateCurrentSection = (targetStatus?: string): string | null => {
        // 特別處理：目標狀態為「開單主管簽核完成」時
        if (targetStatus === '開單主管簽核完成') {
            // 如果是在狀態 2 區塊內進行的「開單主管簽核完成」儲存（原本狀態為開單主管簽核完成，或者基本資料已完成送審）
            if (formData.status === '開單主管簽核完成' || (formData.status === '已轉維修單' && section1Completed)) {
                if (!formData.req_dept_mgr_name) return '請輸入開單主管姓名'
                if (!formData.req_dept_mgr_date) return '請輸入開單主管日期'
                return null
            }
            // 否則，是在狀態 1 區塊內的「確認基本資料並送審」
            if (formData.status === '已轉維修單') {
                if (!formData.handler_name) return '請選擇承辦人'
                if (!formData.work_order_date) return '請輸入接單日期'
                if (!formData.maint_mgr_name) return '請選擇工務單位主管'
                if (!formData.maint_mgr_date) return '請輸入工務單位主管日期'
            }
            return null
        }

        switch (formData.status) {
            case '已轉維修單':
                if (!formData.handler_name) return '請選擇承辦人'
                if (!formData.work_order_date) return '請輸入接單日期'
                if (!formData.maint_mgr_name) return '請選擇工務單位主管'
                if (!formData.maint_mgr_date) return '請輸入工務單位主管日期'
                break
            case '開單主管簽核完成':
                if (!formData.req_dept_mgr_name) return '請輸入開單主管姓名'
                if (!formData.req_dept_mgr_date) return '請輸入開單主管日期'
                break
            case '工務部門報價，主管簽核中':
                if (!formData.quote_user_name) return '請選擇報價承辦人'
                if (!formData.quote_user_date) return '請輸入報價承辦人日期'
                break
            case '院長室簽核中':
                if (!formData.vice_dean_name) return '請選擇副院長'
                if (!formData.vice_dean_date) return '請輸入副院長日期'
                if (!formData.dean_name) return '請選擇院長'
                if (!formData.dean_date) return '請輸入院長日期'
                break
            case '採購發包簽核中':
                if (!formData.project_order_id) return '請輸入工程單編號'
                if (!formData.procurement_name) return '請輸入採購組姓名'
                if (!formData.procurement_date) return '請輸入採購組日期'
                if (!formData.material_name) return '請輸入資材室姓名'
                if (!formData.material_date) return '請輸入資材室日期'
                if (!formData.rev_vice_dean_name) return '請選擇審查-副院長'
                if (!formData.rev_vice_dean_date) return '請輸入審查-副院長日期'
                if (!formData.rev_dean_name) return '請選擇審查-院長'
                if (!formData.rev_dean_date) return '請輸入審查-院長日期'
                break
            case '工務已發包':
            case '採購已發包':
                if (!formData.construct_end_date) return '請輸入施工完成日期'
                break
            case '施工完成，開單單位驗收中':
                if (!formData.accept_dept_mgr_name) return '請輸入驗收-開單主管姓名'
                if (!formData.accept_dept_mgr_date) return '請輸入驗收-開單主管日期'
                break
            case '維修部門驗收中':
                if (!formData.accept_handler_name) return '請選擇驗收-承辦人'
                if (!formData.accept_handler_date) return '請輸入驗收-承辦人日期'
                if (!formData.accept_mgr_name) return '請選擇驗收-工務主管'
                if (!formData.accept_mgr_date) return '請輸入驗收-工務主管日期'
                if (!formData.accept_director_name) return '請輸入驗收工務主任姓名'
                if (!formData.accept_director_date) return '請輸入驗收工務主任日期'
                break
        }
        return null
    }

    // 儲存並前進狀態
    const handleSave = async (nextStatus?: string) => {
        // 狀態推進時必須驗證當前區塊必填欄位
        if (nextStatus) {
            const error = validateCurrentSection(nextStatus)
            if (error) {
                toast({ title: '驗證失敗', description: error, variant: 'destructive' })
                return
            }
        }

        setLoading(true)
        try {
            const oldData = { ...lastSavedData }
            const updateData = { ...formData }
            if (nextStatus) {
                updateData.status = nextStatus
            }

            const { error } = await supabase
                .from('maintenance_work_orders')
                .update(updateData)
                .eq('id', id)

            if (error) throw error

            // 寫入系統異動紀錄（使用 await 確保發送成功，防止頁面跳轉時 fetch 被瀏覽器取消）
            await logChangeRecord({
                actionType: 'Update',
                modifyTable: 'maintenance_work_orders',
                modifyRecordId: id,
                oldData: oldData,
                newData: updateData,
            })

            toast({ title: '儲存成功', description: nextStatus ? `狀態已更新為：${nextStatus}` : '資料已儲存' })

            if (nextStatus === '已驗收') {
                router.push('/maintenance-work/history')
            } else {
                setFormData(updateData)
                setLastSavedData(updateData)
                // 若是狀態1「已轉維修單」送審成功，更新 section1Completed 為 true
                if (formData.status === '已轉維修單' && nextStatus === '開單主管簽核完成') {
                    setSection1Completed(true)
                }
                // 若是狀態2「開單主管簽核完成」儲存成功，更新 section2Completed 為 true
                if (nextStatus === '開單主管簽核完成') {
                    setSection2Completed(true)
                }
                // 狀態3：工務部門報價主管簽核中，點擊「報價完成，送工務主管簽核」成功儲存後，更新 quoteCompleted 為 true
                if (formData.status === '工務部門報價，主管簽核中' && nextStatus === '工務部門報價，主管簽核中') {
                    setQuoteCompleted(true)
                }
            }
        } catch (err: any) {
            toast({ title: '儲存失敗', description: err.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    // 金額判定邏輯（含 Section 4 欄位驗證）
    const handleDispatchSignoff = async () => {
        // 驗證發包簽核區塊的必填欄位
        if (!formData.vendor_name) {
            toast({ title: '驗證失敗', description: '請輸入廠商名稱', variant: 'destructive' })
            return
        }
        const amount = Number(formData.amount)
        if (!amount || amount <= 0) {
            toast({ title: '驗證失敗', description: '請輸入有效的發包金額', variant: 'destructive' })
            return
        }
        if (amount <= 20000 && !formData.project_order_id) {
            toast({ title: '驗證失敗', description: '金額小於或等於 2 萬，工程單編號為必填', variant: 'destructive' })
            return
        }
        if (!formData.dispatch_mgr_name) {
            toast({ title: '驗證失敗', description: '請選擇發包-工務主管', variant: 'destructive' })
            return
        }
        if (!formData.dispatch_mgr_date) {
            toast({ title: '驗證失敗', description: '請輸入發包-工務主管日期', variant: 'destructive' })
            return
        }

        const threshold = 20000 // 寫死或從 system_settings 讀取
        const nextStatus = amount <= threshold ? '工務已發包' : '院長室簽核中'
        handleSave(nextStatus)
    }

    // 動態取得狀態 7（施工完成/已發包）的標題
    const getSection7Title = () => {
        if (formData.status === '工務已發包') {
            return '狀態 7：工務已發包'
        }
        if (formData.status === '採購已發包') {
            return '狀態 7：採購已發包'
        }
        // 若已完成施工，依據發包金額判斷當初是採購還是工務發包
        const isProcurement = Number(formData.amount) > 20000
        return `狀態 7：${isProcurement ? '採購' : '工務'}已發包`
    }

    const SectionHeader = ({ title, sectionKey, index }: { title: string, sectionKey: string, index: number }) => (
        <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800/60"
            onClick={() => setOpenSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
        >
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isSectionEditable(index) ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                    {index + 1}
                </div>
                <h3 className={`font-bold transition-colors ${isSectionEditable(index) ? 'text-slate-900 dark:text-white font-extrabold' : 'text-slate-500 dark:text-slate-400'}`}>
                    {title}
                </h3>
            </div>
            <div className="flex items-center gap-2">
                {isSectionEditable(index) ? (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5 whitespace-nowrap">
                        編輯中
                    </Badge>
                ) : (
                    <Lock className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                )}
                {openSections[sectionKey] ? (
                    <ChevronDown className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                )}
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
            <Navbar />

            <header className="bg-background/95 backdrop-blur-md border-b border-border/50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3 sticky top-0 z-50">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="px-2 h-9 shrink-0">
                        <ArrowLeft className="w-4 h-4 mr-1 shrink-0" />返回
                    </Button>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden xs:block" />
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <h1 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            維修單簽核作業
                        </h1>
                        <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-xs py-1 px-2.5 font-bold tracking-wide whitespace-nowrap flex-shrink-0">
                            {formData.status}
                        </Badge>
                    </div>
                </div>
                <div className="flex items-center w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={() => handleSave()} disabled={loading} className="w-full md:w-auto justify-center h-9 border-slate-300 dark:border-slate-200 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
                    </Button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8 w-full space-y-6">

                {/* 狀態 1: 已轉維修單 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="狀態 1：已轉維修單" sectionKey="section1" index={0} />
                    <AnimatePresence>
                        {openSections.section1 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>工單編號</Label>
                                        <Input name="work_order_id" value={formData.work_order_id} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>開單日</Label>
                                        <Input name="request_date" type="date" value={formData.request_date} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>開單部門</Label>
                                        <Input name="request_department" value={formData.request_department} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>成本中心</Label>
                                        <Input name="cost_center" value={formData.cost_center} disabled />
                                    </div>
                                    <div className="col-span-full space-y-2">
                                        <Label>維修內容</Label>
                                        <Textarea name="maintain_content" value={formData.maintain_content} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>開單人</Label>
                                        <Input name="requester_name" value={formData.requester_name} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>承辦人</Label>
                                        <Select value={formData.handler_name} onValueChange={(v) => handleSelectChange('handler_name', v)} disabled={!isSectionEditable(0)}>
                                            <SelectTrigger><SelectValue placeholder="請選擇承辦人" /></SelectTrigger>
                                            <SelectContent>{HANDLER_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>接單日期</Label>
                                        <Input name="work_order_date" type="date" value={formData.work_order_date} onChange={handleInputChange} disabled={!isSectionEditable(0)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>工務單位主管</Label>
                                        <Select value={formData.maint_mgr_name} onValueChange={(v) => handleSelectChange('maint_mgr_name', v)} disabled={!isSectionEditable(0)}>
                                            <SelectTrigger><SelectValue placeholder="請選擇主管" /></SelectTrigger>
                                            <SelectContent>{MAINT_MGR_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>工務單位主管日期</Label>
                                        <Input name="maint_mgr_date" type="date" value={formData.maint_mgr_date} onChange={handleInputChange} disabled={!isSectionEditable(0)} />
                                    </div>
                                    {isSectionEditable(0) && formData.status === '已轉維修單' && (
                                        <div className="col-span-full pt-4">
                                            <Button className="w-full" onClick={() => handleSave('開單主管簽核完成')}>確認基本資料並送審</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 2: 開單主管簽核完成 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="狀態 2：開單主管簽核完成" sectionKey="section2" index={1} />
                    <AnimatePresence>
                        {openSections.section2 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>開單主管姓名</Label>
                                        <Input name="req_dept_mgr_name" value={formData.req_dept_mgr_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(1)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>開單主管日期</Label>
                                        <Input name="req_dept_mgr_date" type="date" value={formData.req_dept_mgr_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(1)} />
                                    </div>
                                    {isSectionEditable(1) && (
                                        <div className="col-span-full pt-4">
                                            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleSave('開單主管簽核完成')}>開單主管簽核完成</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 3: 工務部門報價、主管簽核中 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="狀態 3：工務部門報價、主管簽核中" sectionKey="section3" index={2} />
                    <AnimatePresence>
                        {openSections.section3 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>報價承辦人</Label>
                                        <Select value={formData.quote_user_name || ''} onValueChange={(v) => handleSelectChange('quote_user_name', v)} disabled={!isSectionEditable(2)}>
                                            <SelectTrigger><SelectValue placeholder="選擇承辦人" /></SelectTrigger>
                                            <SelectContent>{HANDLER_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>報價承辦人日期</Label>
                                        <Input name="quote_user_date" type="date" value={formData.quote_user_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(2)} />
                                    </div>
                                    {isSectionEditable(2) && (
                                        <div className="col-span-full pt-4">
                                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => handleSave('工務部門報價，主管簽核中')}>報價完成，送工務主管簽核</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 4: 發包主管簽核 (含金額分歧邏輯) */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="狀態 4：發包主管簽核 (金額門檻判定)" sectionKey="section4" index={3} />
                    <AnimatePresence>
                        {openSections.section4 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>廠商</Label>
                                        <Input name="vendor_name" value={formData.vendor_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-orange-600 font-bold">金額 (≤ 2萬 走簡易流程)</Label>
                                        <Input name="amount" type="number" value={formData.amount || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} className="border-orange-200 focus:border-orange-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>發包-工務主管</Label>
                                        <Select value={formData.dispatch_mgr_name || ''} onValueChange={(v) => handleSelectChange('dispatch_mgr_name', v)} disabled={!isSectionEditable(3)}>
                                            <SelectTrigger><SelectValue placeholder="選擇主管" /></SelectTrigger>
                                            <SelectContent>{MAINT_MGR_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>發包-工務主管日期</Label>
                                        <Input name="dispatch_mgr_date" type="date" value={formData.dispatch_mgr_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>發包工務主任</Label>
                                        <Input name="dispatch_director_name" value={formData.dispatch_director_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>發包工務主任日期</Label>
                                        <Input name="dispatch_director_date" type="date" value={formData.dispatch_director_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
                                    </div>
                                    <div className="space-y-2 col-span-full">
                                        <Label>工程單編號 {Number(formData.amount) <= 20000 && <span className="text-red-500">*</span>}</Label>
                                        <Input name="project_order_id" value={formData.project_order_id || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
                                    </div>
                                    {isSectionEditable(3) && (
                                        <div className="col-span-full pt-4">
                                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleDispatchSignoff}>發包簽核完成 (系統將依金額判斷流程)</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 5: 院長室簽核 (僅金額 > 2萬顯示) */}
                {(Number(formData.amount) > 20000 || formData.status === '院長室簽核中') && (
                    <Card className="overflow-hidden border-slate-200 shadow-sm border-l-4 border-l-purple-500">
                        <SectionHeader title="狀態 5：院長室簽核 (金額 > 2萬)" sectionKey="section4_dean" index={4} />
                        <AnimatePresence>
                            {openSections.section4_dean && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>副院長姓名</Label>
                                            <Select value={formData.vice_dean_name || ''} onValueChange={(v) => handleSelectChange('vice_dean_name', v)} disabled={!isSectionEditable(4)}>
                                                <SelectTrigger><SelectValue placeholder="選擇副院長" /></SelectTrigger>
                                                <SelectContent>{VICE_DEAN_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>副院長日期</Label>
                                            <Input name="vice_dean_date" type="date" value={formData.vice_dean_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(4)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>院長姓名</Label>
                                            <Select value={formData.dean_name || ''} onValueChange={(v) => handleSelectChange('dean_name', v)} disabled={!isSectionEditable(4)}>
                                                <SelectTrigger><SelectValue placeholder="選擇院長" /></SelectTrigger>
                                                <SelectContent>{DEAN_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>院長日期</Label>
                                            <Input name="dean_date" type="date" value={formData.dean_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(4)} />
                                        </div>
                                        {isSectionEditable(4) && (
                                            <div className="col-span-full pt-4">
                                                <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => handleSave('採購發包簽核中')}>院長室核准完成，送採購發包</Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Card>
                )}

                {/* 狀態 6: 採購發包簽核中 (僅金額 > 2萬顯示) */}
                {(Number(formData.amount) > 20000 || formData.status === '採購發包簽核中') && (
                    <Card className="overflow-hidden border-slate-200 shadow-sm border-l-4 border-l-violet-500">
                        <SectionHeader title="狀態 6：採購發包簽核中" sectionKey="section5" index={5} />
                        <AnimatePresence>
                            {openSections.section5 && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>工程單編號</Label>
                                            <Input name="project_order_id" value={formData.project_order_id || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>採購組姓名</Label>
                                            <Input name="procurement_name" value={formData.procurement_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>採購組日期</Label>
                                            <Input name="procurement_date" type="date" value={formData.procurement_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>資材室姓名</Label>
                                            <Input name="material_name" value={formData.material_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>資材室日期</Label>
                                            <Input name="material_date" type="date" value={formData.material_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="col-span-full h-px bg-slate-100 my-2" />
                                        <div className="space-y-2">
                                            <Label>審查-副院長</Label>
                                            <Select value={formData.rev_vice_dean_name || ''} onValueChange={(v) => handleSelectChange('rev_vice_dean_name', v)} disabled={!isSectionEditable(5)}>
                                                <SelectTrigger><SelectValue placeholder="選擇副院長" /></SelectTrigger>
                                                <SelectContent>{VICE_DEAN_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>審查-副院長日期</Label>
                                            <Input name="rev_vice_dean_date" type="date" value={formData.rev_vice_dean_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>審查-院長</Label>
                                            <Select value={formData.rev_dean_name || ''} onValueChange={(v) => handleSelectChange('rev_dean_name', v)} disabled={!isSectionEditable(5)}>
                                                <SelectTrigger><SelectValue placeholder="選擇院長" /></SelectTrigger>
                                                <SelectContent>{DEAN_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>審查-院長日期</Label>
                                            <Input name="rev_dean_date" type="date" value={formData.rev_dean_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        {isSectionEditable(5) && (
                                            <div className="col-span-full pt-4">
                                                <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => handleSave('採購已發包')}>審查完成，採購已發包</Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Card>
                )}

                {/* 狀態 7: 施工已完成 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title={getSection7Title()} sectionKey="section7" index={6} />
                    <AnimatePresence>
                        {openSections.section7 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-full">
                                        <Label>施工完成日期</Label>
                                        <Input name="construct_end_date" type="date" value={formData.construct_end_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(6)} />
                                    </div>
                                    {isSectionEditable(6) && (
                                        <div className="col-span-full pt-4">
                                            <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => handleSave('施工完成，開單單位驗收中')}>施工完成，送開單單位驗收</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 8: 施工完成，開單單位驗收中 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="狀態 8：施工完成，開單單位驗收中" sectionKey="section8" index={7} />
                    <AnimatePresence>
                        {openSections.section8 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>驗收-開單主管姓名</Label>
                                        <Input name="accept_dept_mgr_name" value={formData.accept_dept_mgr_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(7)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收-開單主管日期</Label>
                                        <Input name="accept_dept_mgr_date" type="date" value={formData.accept_dept_mgr_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(7)} />
                                    </div>
                                    {isSectionEditable(7) && (
                                        <div className="col-span-full pt-4">
                                            <Button className="w-full bg-cyan-600 hover:bg-cyan-700" onClick={() => handleSave('維修部門驗收中')}>開單單位驗收完成，回傳工務驗收</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 9: 維修部門驗收中 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm border-b-4 border-b-green-500">
                    <SectionHeader title="狀態 9：維修部門驗收中" sectionKey="section9" index={8} />
                    <AnimatePresence>
                        {openSections.section9 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>驗收-承辦人</Label>
                                        <Select value={formData.accept_handler_name || ''} onValueChange={(v) => handleSelectChange('accept_handler_name', v)} disabled={!isSectionEditable(8)}>
                                            <SelectTrigger><SelectValue placeholder="選擇承辦人" /></SelectTrigger>
                                            <SelectContent>{HANDLER_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收-承辦人日期</Label>
                                        <Input name="accept_handler_date" type="date" value={formData.accept_handler_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(8)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收-工務主管</Label>
                                        <Select value={formData.accept_mgr_name || ''} onValueChange={(v) => handleSelectChange('accept_mgr_name', v)} disabled={!isSectionEditable(8)}>
                                            <SelectTrigger><SelectValue placeholder="選擇主管" /></SelectTrigger>
                                            <SelectContent>{MAINT_MGR_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收-工務主管日期</Label>
                                        <Input name="accept_mgr_date" type="date" value={formData.accept_mgr_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(8)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收工務主任</Label>
                                        <Input name="accept_director_name" value={formData.accept_director_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(8)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收工務主任日期</Label>
                                        <Input name="accept_director_date" type="date" value={formData.accept_director_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(8)} />
                                    </div>
                                    {isSectionEditable(8) && (
                                        <div className="col-span-full pt-4">
                                            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleSave('已驗收')}>
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                驗收完成 (將自動歸檔)
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

            </main>
        </div>
    )
}
