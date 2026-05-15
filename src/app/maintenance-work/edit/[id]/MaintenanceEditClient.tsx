'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Activity, ArrowLeft, Save, CheckCircle2, AlertCircle,
    ChevronDown, ChevronRight, Lock, Unlock, Clock
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
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
    const { user, profile } = useAuth()
    const supabase = createClient()
    const isAdmin = profile?.role === 'admin'

    const [formData, setFormData] = useState(initialData)
    const [loading, setLoading] = useState(false)
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

    // 取得當前狀態索引
    const currentStatusIndex = MAINTENANCE_STATUS.indexOf(formData.status)

    // 定義區塊是否可編輯
    const isSectionEditable = (sectionIndex: number) => {
        // 特殊邏輯：已驗收則全部不可編輯
        if (formData.status === '已驗收') return false
        
        // 根據目前狀態判斷對應區塊
        const statusMap: Record<string, number> = {
            '已轉維修單': 1, // Step 2 簽核中
            '開單主管簽核完成': 2, // Step 3 報價中
            '工務部門報價，主管簽核中': 3, // Step 4 發包簽核中
            '院長室簽核中': 4, // Step 6 院長室簽核中
            '採購發包簽核中': 5, // Step 7 採購簽核中
            '廠商施工中': 6, // Step 8 施工中
            '已發包': 6, // Step 8 施工中
            '開單單位驗收中': 7, // Step 9 驗收中
            '維修部門驗收中': 8, // Step 10 驗收中
        }
        
        // 簡化判定：若該區塊索引等於目前狀態應對應的區塊，則可編輯
        // 且過去的區塊皆為唯讀
        const targetSection = statusMap[formData.status] ?? 0
        
        // Admin 可以修改所有欄位（防呆除外）
        if (isAdmin) return true
        
        return sectionIndex === targetSection
    }

    // 初始化展開區塊
    useEffect(() => {
        const statusMap: Record<string, string> = {
            '已轉維修單': 'section2',
            '開單主管簽核完成': 'section3',
            '工務部門報價，主管簽核中': 'section4',
            '院長室簽核中': 'section4_dean',
            '採購發包簽核中': 'section5',
            '廠商施工中': 'section7',
            '已發包': 'section7',
            '開單單位驗收中': 'section8',
            '維修部門驗收中': 'section9',
        }
        const activeSection = statusMap[formData.status] || 'section1'
        setOpenSections({ [activeSection]: true })
    }, [formData.status])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    // 儲存並前進狀態
    const handleSave = async (nextStatus?: string) => {
        setLoading(true)
        try {
            const updateData = { ...formData }
            if (nextStatus) {
                updateData.status = nextStatus
            }

            const { error } = await supabase
                .from('maintenance_work_orders')
                .update(updateData)
                .eq('id', id)

            if (error) throw error

            toast({ title: '儲存成功', description: nextStatus ? `狀態已更新為：${nextStatus}` : '資料已儲存' })
            
            if (nextStatus === '已驗收') {
                router.push('/maintenance-work/history')
            } else {
                setFormData(updateData)
            }
        } catch (err: any) {
            toast({ title: '儲存失敗', description: err.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    // 金額判定邏輯
    const handleDispatchSignoff = async () => {
        const threshold = 20000 // 寫死或從 system_settings 讀取
        const amount = Number(formData.amount)
        if (!amount || amount <= 0) {
            toast({ title: '驗證失敗', description: '請輸入有效的發包金額', variant: 'destructive' })
            return
        }

        const nextStatus = amount <= threshold ? '廠商施工中' : '院長室簽核中'
        handleSave(nextStatus)
    }

    const SectionHeader = ({ title, sectionKey, index }: { title: string, sectionKey: string, index: number }) => (
        <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
            onClick={() => setOpenSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
        >
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isSectionEditable(index) ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {index + 1}
                </div>
                <h3 className="font-bold text-slate-700">{title}</h3>
            </div>
            <div className="flex items-center gap-2">
                {isSectionEditable(index) ? <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5">編輯中</Badge> : <Lock className="w-3 h-3 text-slate-300" />}
                {openSections[sectionKey] ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Navbar />

            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4 mr-1" />返回
                    </Button>
                    <div className="h-6 w-px bg-slate-200" />
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        維修單簽核作業
                        <Badge variant="outline" className="ml-2 bg-orange-50 text-orange-600 border-orange-200">
                            {formData.status}
                        </Badge>
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleSave()} disabled={loading}>
                        <Save className="w-4 h-4 mr-2" />僅儲存不變更狀態
                    </Button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8 w-full space-y-6">
                
                {/* 步驟 1: 報修基本資料 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="步驟 1：報修基本資料" sectionKey="section1" index={0} />
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
                                        <Input name="request_date" type="date" value={formData.request_date} onChange={handleInputChange} disabled={!isSectionEditable(0)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>開單部門</Label>
                                        <Input name="request_department" value={formData.request_department} onChange={handleInputChange} disabled={!isSectionEditable(0)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>成本中心</Label>
                                        <Input name="cost_center" value={formData.cost_center} onChange={handleInputChange} disabled={!isSectionEditable(0)} />
                                    </div>
                                    <div className="col-span-full space-y-2">
                                        <Label>維修內容</Label>
                                        <Textarea name="maintain_content" value={formData.maintain_content} onChange={handleInputChange} disabled={!isSectionEditable(0)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>開單人</Label>
                                        <Input name="requester_name" value={formData.requester_name} onChange={handleInputChange} disabled={!isSectionEditable(0)} />
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

                {/* 步驟 2: 開單主管簽核 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="步驟 2：開單單位主管簽核" sectionKey="section2" index={1} />
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
                                            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleSave('工務部門報價，主管簽核中')}>主管簽核完成，進入報價階段</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 步驟 3: 工務部門報價 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="步驟 3：工務部門報價" sectionKey="section3" index={2} />
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
                                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => handleSave('工務部門報價，主管簽核中')}>報價完成，送發包簽核</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 步驟 4: 發包主管簽核 (含金額分歧邏輯) */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="步驟 4：發包主管簽核 (金額門檻判定)" sectionKey="section4" index={3} />
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
                                        <Input name="dispatch_director_name" value={formData.dispatch_director_name || DEFAULT_DIRECTOR_NAME} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>發包工務主任日期</Label>
                                        <Input name="dispatch_director_date" type="date" value={formData.dispatch_director_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
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

                {/* 步驟 6: 院長室簽核 (僅金額 > 2萬顯示) */}
                {(Number(formData.amount) > 20000 || formData.status === '院長室簽核中' || formData.vice_dean_name) && (
                    <Card className="overflow-hidden border-slate-200 shadow-sm border-l-4 border-l-purple-500">
                        <SectionHeader title="步驟 6：院長室簽核 (金額 > 2萬)" sectionKey="section4_dean" index={4} />
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

                {/* 步驟 7: 採購發包簽核 (僅金額 > 2萬顯示) */}
                {(Number(formData.amount) > 20000 || formData.status === '採購發包簽核中' || formData.project_order_id) && (
                    <Card className="overflow-hidden border-slate-200 shadow-sm border-l-4 border-l-violet-500">
                        <SectionHeader title="步驟 7：採購與資材簽核" sectionKey="section5" index={5} />
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
                                                <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => handleSave('已發包')}>審查完成，正式發包</Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Card>
                )}

                {/* 步驟 8: 施工完成 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="步驟 8：施工完成" sectionKey="section7" index={6} />
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
                                            <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => handleSave('開單單位驗收中')}>施工完成，送開單單位驗收</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 步驟 9: 開單單位驗收 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                    <SectionHeader title="步驟 9：開單單位驗收" sectionKey="section8" index={7} />
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

                {/* 步驟 10: 維修部門驗收 */}
                <Card className="overflow-hidden border-slate-200 shadow-sm border-b-4 border-b-green-500">
                    <SectionHeader title="步驟 10：維修部門(工務)驗收" sectionKey="section9" index={8} />
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
                                        <Input name="accept_director_name" value={formData.accept_director_name || DEFAULT_DIRECTOR_NAME} onChange={handleInputChange} disabled={!isSectionEditable(8)} />
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
