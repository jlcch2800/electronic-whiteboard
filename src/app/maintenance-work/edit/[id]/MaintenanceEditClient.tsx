'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import {
    MAINTENANCE_STATUS, HANDLER_NAMES, MAINT_MGR_NAMES,
    DEFAULT_DIRECTOR_NAME, VICE_DEAN_NAMES, DEAN_NAMES
} from '@/lib/maintenance-constants'

interface MaintenanceEditClientProps {
    id: string
    initialData: any
}

interface InstallmentItem {
    content: string
    amount: string
    date: string
    handler: string
}

const parseInstallmentNote = (note: string, count: number): InstallmentItem[] => {
    const list: InstallmentItem[] = Array.from({ length: count }, () => ({
        content: '',
        amount: '',
        date: '',
        handler: ''
    }))

    if (!note) return list

    // 以換行符拆分
    const lines = note.split('\n')
    
    // 正則表達式匹配：第1期合約訂定請款內容:訂金，請款金額:100000，請款日期:115年6月2日，經辦人:蔡先生．
    const regex = /第\s*\d+\s*期合約訂定請款內容\s*:\s*(.*?)，請款金額\s*:\s*(.*?)，請款日期\s*:\s*(.*?)，經辦人\s*:\s*([^．]+)．?/

    for (let i = 0; i < Math.min(lines.length, count); i++) {
        if (!lines[i]) continue
        const match = lines[i].match(regex)
        if (match) {
            const rawDate = match[3] ? match[3].trim() : ''
            // 將日期中的斜線 '/' 自動轉換為橫線 '-'，以確保相容 HTML5 date input 要求的 YYYY-MM-DD 格式
            const formattedDate = rawDate.replace(/\//g, '-')

            list[i] = {
                content: match[1] ? match[1].trim() : '',
                amount: match[2] ? match[2].trim() : '',
                date: formattedDate,
                handler: match[4] ? match[4].trim() : ''
            }
        }
    }
    return list
}

const stringifyInstallments = (list: InstallmentItem[]): string => {
    return list
        .map((item, index) => {
            const content = item.content || ''
            const amount = item.amount || ''
            const date = item.date || ''
            const handler = item.handler || ''
            // 跳過尚未填寫任何內容的期數，不寫入資料庫
            if (!content && !amount && !date && !handler) return null
            return `第${index + 1}期合約訂定請款內容:${content}，請款金額:${amount}，請款日期:${date}，經辦人:${handler}．`
        })
        .filter(Boolean)
        .join('\n')
}

export default function MaintenanceEditClient({ id, initialData }: MaintenanceEditClientProps) {
    const router = useRouter()
    const isFirstLoad = useRef(true)
    const { user } = useAuth()
    const { profile } = useAppStore()
    const supabase = createClient()
    const isAdmin = profile?.role === 'admin'

    const [formData, setFormData] = useState<any>(() => ({
        ...initialData,
        dispatch_director_name: initialData.dispatch_director_name || DEFAULT_DIRECTOR_NAME,
        accept_director_name: initialData.accept_director_name || DEFAULT_DIRECTOR_NAME,
        installment_count: initialData.installment_count !== undefined && initialData.installment_count !== null ? initialData.installment_count : null,
        installment_note: initialData.installment_note || '',
        printer_name: initialData.printer_name || '',
        submit_date: initialData.submit_date || '',
    }))
    const [lastSavedData, setLastSavedData] = useState<any>(() => ({
        ...initialData,
        dispatch_director_name: initialData.dispatch_director_name || DEFAULT_DIRECTOR_NAME,
        accept_director_name: initialData.accept_director_name || DEFAULT_DIRECTOR_NAME,
        installment_count: initialData.installment_count !== undefined && initialData.installment_count !== null ? initialData.installment_count : null,
        installment_note: initialData.installment_note || '',
        printer_name: initialData.printer_name || '',
        submit_date: initialData.submit_date || '',
    }))
    const [otherSelected, setOtherSelected] = useState<Record<string, boolean>>({})

    const isOtherSelected = (fieldKey: string, currentValue: string, defaultOptions: readonly string[]) => {
        if (otherSelected[fieldKey]) return true
        if (currentValue && !defaultOptions.includes(currentValue)) return true
        return false
    }

    const [loading, setLoading] = useState(false)
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

    const [installmentList, setInstallmentList] = useState<InstallmentItem[]>([])

    // 當 profile 載入且角色是 staff 時，自動將印單人、承辦人、報價及驗收承辦人預設填入自己（若原本為空）
    useEffect(() => {
        if (profile?.role === 'staff' && profile?.user_name) {
            setFormData((prev: any) => {
                const updates: any = {}
                const otherUpdates: Record<string, boolean> = {}
                const isCustomName = !HANDLER_NAMES.includes(profile.user_name)

                if (!prev.printer_name) {
                    updates.printer_name = profile.user_name
                    if (isCustomName) otherUpdates.printer_name = true
                }
                if (!prev.handler_name) {
                    updates.handler_name = profile.user_name
                    if (isCustomName) otherUpdates.handler_name = true
                }
                if (!prev.quote_user_name) {
                    updates.quote_user_name = profile.user_name
                    if (isCustomName) otherUpdates.quote_user_name = true
                }
                if (!prev.accept_handler_name) {
                    updates.accept_handler_name = profile.user_name
                    if (isCustomName) otherUpdates.accept_handler_name = true
                }

                if (Object.keys(otherUpdates).length > 0) {
                    setOtherSelected(prevOther => ({ ...prevOther, ...otherUpdates }))
                }
                
                if (Object.keys(updates).length > 0) {
                    return { ...prev, ...updates }
                }
                return prev
            })
        }
    }, [profile])

    // 初始化載入分期資訊
    useEffect(() => {
        const count = Number(formData.installment_count) || 0
        if (count >= 2) {
            setInstallmentList(parseInstallmentNote(formData.installment_note, count))
        } else {
            setInstallmentList([])
        }
    }, [initialData])

    // 當期數改變時的處理函數
    const handleInstallmentCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        if (val === '') {
            setFormData((prev: any) => ({ ...prev, installment_count: null, installment_note: '' }))
            setInstallmentList([])
            return
        }
        
        const count = parseInt(val, 10)
        if (isNaN(count)) return

        setFormData((prev: any) => {
            const nextNote = count >= 2 ? prev.installment_note : ''
            return { ...prev, installment_count: count, installment_note: nextNote }
        })

        if (count >= 2) {
            setInstallmentList(prev => {
                const newList = Array.from({ length: count }, (_, i) => {
                    return prev[i] || { content: '', amount: '', date: '', handler: '' }
                })
                const noteStr = stringifyInstallments(newList)
                setFormData((prevForm: any) => ({ ...prevForm, installment_note: noteStr }))
                return newList
            })
        } else {
            setInstallmentList([])
        }
    }

    // 當每一期的欄位變更時
    const handleInstallmentItemChange = (index: number, field: keyof InstallmentItem, value: string) => {
        setInstallmentList(prev => {
            const newList = [...prev]
            newList[index] = { ...newList[index], [field]: value }
            const noteStr = stringifyInstallments(newList)
            setFormData((prevForm: any) => ({ ...prevForm, installment_note: noteStr }))
            return newList
        })
    }

    // 取得當前尚未填寫完成的第一個期數索引
    const getActiveIndex = () => {
        const count = Number(formData.installment_count) || 0
        const savedList = parseInstallmentNote(lastSavedData.installment_note, count)
        for (let i = 0; i < count; i++) {
            const item = savedList[i]
            if (!item.content || !item.amount || !item.date || !item.handler) {
                return i
            }
        }
        return count
    }

    // 取得當前狀態索引
    const currentStatusIndex = MAINTENANCE_STATUS.indexOf(formData.status)

    // 使用 state 記錄「基本資料階段」是否已完成，避免已存檔仍可修改或下一階段被鎖死
    const [section1Completed, setSection1Completed] = useState(
        !!(initialData.handler_name && initialData.work_order_date && initialData.maint_mgr_name && initialData.maint_mgr_date && initialData.printer_name && initialData.submit_date)
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
        // sectionIndex 對應：0=狀態1, 1=狀態2, 4=狀態5, 5=狀態6, 6=狀態7, 7=狀態8, 8=狀態9, 9=狀態10
        const statusMap: Record<string, number> = {
            '已轉維修單': 0,
            '開單主管簽核完成': 1,
            '院長室簽核中': 4,
            '採購發包簽核中': 5,
            '工務已發包': 6,
            '採購已發包': 6,
            '廠商施工中': 7,
            '施工完成，開單單位驗收中': 8,
            '維修部門驗收中': 9,
        }

        const targetSection = statusMap[formData.status] ?? 0
        return sectionIndex === targetSection
    }

    // 初始化展開區塊與自動滾動
    useEffect(() => {
        let activeSection = 'section1'
        // 特殊處理：「已轉維修單」或「開單主管簽核完成」依完成度決定展開
        if (formData.status === '已轉維修單' || formData.status === '開單主管簽核完成') {
            if (!section1Completed) {
                activeSection = 'section1'
            } else if (!section2Completed) {
                activeSection = 'section2'
            } else {
                activeSection = 'section3'
            }
        } else if (formData.status === '工務部門報價，主管簽核中') {
            // 特殊處理：報價階段依完成度決定展開 section3 或 section4
            activeSection = quoteCompleted ? 'section4' : 'section3'
        } else {
            const statusMap: Record<string, string> = {
                '已轉維修單': 'section1',
                '開單主管簽核完成': 'section2',
                '院長室簽核中': 'section4_dean',
                '採購發包簽核中': 'section5',
                '工務已發包': 'section7',
                '採購已發包': 'section7',
                '廠商施工中': 'section7_construct',
                '施工完成，開單單位驗收中': 'section8',
                '維修部門驗收中': 'section9',
            }
            activeSection = statusMap[formData.status] || 'section1'
        }

        setOpenSections({ [activeSection]: true })

        // 僅在首次載入頁面時自動滾動
        if (isFirstLoad.current) {
            isFirstLoad.current = false
            setTimeout(() => {
                const el = document.getElementById(`card-${activeSection}`)
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
            }, 300)
        }
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
                return null
            }
            // 否則，是在狀態 1 區塊內的「確認基本資料並送審」
            if (formData.status === '已轉維修單') {
                if (!formData.handler_name) return '請選擇承辦人'
                if (!formData.work_order_date) return '請輸入接單日期'
                if (!formData.maint_mgr_name) return '請選擇工務單位主管'
                if (!formData.maint_mgr_date) return '請輸入工務單位主管日期'
                if (!formData.printer_name) return '請輸入印單人姓名'
                if (!formData.submit_date) return '請輸入送呈日期'
            }
            return null
        }

        // 特別處理：目標狀態為「工務部門報價，主管簽核中」時，驗證報價區塊必填欄位
        if (targetStatus === '工務部門報價，主管簽核中') {
            if (!formData.quote_user_name) return '請選擇報價承辦人'
            if (!formData.quote_user_date) return '請輸入報價承辦人日期'
            return null
        }

        switch (formData.status) {
            case '已轉維修單':
                if (!formData.handler_name) return '請選擇承辦人'
                if (!formData.work_order_date) return '請輸入接單日期'
                if (!formData.maint_mgr_name) return '請選擇工務單位主管'
                if (!formData.maint_mgr_date) return '請輸入工務單位主管日期'
                if (!formData.printer_name) return '請輸入印單人姓名'
                if (!formData.submit_date) return '請輸入送呈日期'
                break
            case '開單主管簽核完成':
                if (!formData.req_dept_mgr_name) return '請輸入開單主管姓名'
                break
            case '工務部門報價，主管簽核中':
                if (!formData.quote_user_name) return '請選擇報價承辦人'
                if (!formData.quote_user_date) return '請輸入報價承辦人日期'
                break
            case '院長室簽核中':
                if (!formData.vice_dean_name) return '請選擇副院長'
                if (!formData.dean_name) return '請選擇院長'
                break
            case '採購發包簽核中':
                if (!formData.procurement_name) return '請輸入採購組姓名'
                if (!formData.material_name) return '請輸入資材室姓名'
                if (!formData.rev_vice_dean_name) return '請選擇審查-副院長'
                // 金額大於 20 萬時，審查-院長為必填
                if (Number(formData.amount) > 200000) {
                    if (!formData.rev_dean_name) return '請選擇審查-院長'
                }
                break
            case '工務已發包':
            case '採購已發包':
                if (!formData.project_order_id) return '請輸入工程單編號'
                if (!formData.plan_start_date) return '請輸入施工預計開始日期'
                if (!formData.plan_end_date) return '請輸入施工預計結束日期'
                break
            case '廠商施工中':
                if (!formData.construct_end_date) return '請輸入施工完成日期'
                break
            case '施工完成，開單單位驗收中':
                if (!formData.accept_dept_mgr_name) return '請輸入驗收-開單主管姓名'
                break
            case '維修部門驗收中': {
                const count = formData.installment_count
                if (count === null || count === undefined || isNaN(Number(count))) {
                    return '請輸入分期期數'
                }
                const numCount = Number(count)
                if (numCount < 0) {
                    return '分期期數不能為負數'
                }
                if (numCount >= 2) {
                    for (let i = 0; i < installmentList.length; i++) {
                        const item = installmentList[i]
                        if (!item.content) return `請輸入第 ${i + 1} 期的請款內容`
                        if (!item.amount) return `請輸入第 ${i + 1} 期的請款金額`
                        if (!item.date) return `請輸入第 ${i + 1} 期的請款日期`
                        if (!item.handler) return `請輸入第 ${i + 1} 期的經辦人`
                    }
                }
                if (!formData.accept_handler_name) return '請選擇驗收-承辦人'
                if (!formData.accept_handler_date) return '請輸入驗收-承辦人日期'
                if (!formData.accept_mgr_name) return '請選擇驗收單位主管'
                if (!formData.accept_mgr_date) return '請輸入驗收單位主管日期'
                if (!formData.accept_director_name) return '請輸入驗收部門主管姓名'
                if (!formData.accept_director_date) return '請輸入驗收部門主管日期'
                break
            }
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
        } else {
            // 僅儲存不變更狀態時的特殊驗證：若在狀態 10 且分期 >= 2，必須驗證當前正在填寫的這一期是否已填寫完整
            if (formData.status === '維修部門驗收中' && formData.installment_count !== null && Number(formData.installment_count) >= 2) {
                const activeIndex = getActiveIndex()
                const count = Number(formData.installment_count)
                if (activeIndex < count) {
                    const item = installmentList[activeIndex]
                    if (!item || !item.content || !item.amount || !item.date || !item.handler) {
                        toast({ 
                            title: '驗證失敗', 
                            description: `請完整填寫第 ${activeIndex + 1} 期的分期明細（內容、金額、請款日期、經辦人），方可進行儲存。`, 
                            variant: 'destructive' 
                        })
                        return
                    }
                }
            }
        }

        setLoading(true)
        try {
            const oldData = { ...lastSavedData }
            const updateData = { ...formData }
            if (nextStatus) {
                updateData.status = nextStatus
            }

            // 清理空字串，將 "" 轉換為 null 避免 PostgreSQL 日期/數值等欄位寫入時發生 invalid input syntax 錯誤
            const cleanData = { ...updateData }
            Object.keys(cleanData).forEach((key) => {
                if (cleanData[key] === '') {
                    cleanData[key] = null
                }
            })

            const { error } = await supabase
                .from('maintenance_work_orders')
                .update(cleanData)
                .eq('id', id)

            if (error) throw error

            // 寫入系統異動紀錄（使用 await 確保發送成功，防止頁面跳轉時 fetch 被瀏覽器取消）
            const finalOldData: Record<string, any> = {}
            const finalNewData: Record<string, any> = {}
            let hasChanges = false

            // 輔助函式：判斷是否皆為空值（排除 null, undefined, 空字串造成的型態雜訊）
            const isEmptyEquivalent = (val: any) => {
                return val === undefined || val === null || val === ''
            }

            Object.keys(cleanData).forEach((key) => {
                if (['updated_at', 'created_at'].includes(key)) return
                
                const oldVal = oldData[key]
                const newVal = cleanData[key]

                // 若皆為等價空值，視為未修改
                if (isEmptyEquivalent(oldVal) && isEmptyEquivalent(newVal)) return

                if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                    finalOldData[key] = oldVal
                    finalNewData[key] = newVal
                    hasChanges = true
                }
            })

            // 僅在有實質異動時才寫入紀錄
            if (hasChanges) {
                await logChangeRecord({
                    actionType: 'Update',
                    modifyTable: 'maintenance_work_orders',
                    modifyRecordId: id,
                    oldData: finalOldData,
                    newData: finalNewData,
                })
            }

            toast({ title: '儲存成功', description: nextStatus ? `狀態已更新為：${nextStatus}` : '資料已儲存' })

            if (nextStatus === '已驗收') {
                router.push('/maintenance-work/history')
            } else {
                setFormData(cleanData)
                setLastSavedData(cleanData)
                // 更新狀態區塊的完成度 (以實際填寫的資料為準，避免 React 異步狀態更新延遲造成判斷錯誤)
                if (
                    cleanData.handler_name &&
                    cleanData.work_order_date &&
                    cleanData.maint_mgr_name &&
                    cleanData.maint_mgr_date &&
                    cleanData.printer_name &&
                    cleanData.submit_date
                ) {
                    setSection1Completed(true)
                }
                if (cleanData.req_dept_mgr_name && cleanData.req_dept_mgr_date) {
                    setSection2Completed(true)
                }
                if (cleanData.quote_user_name && cleanData.quote_user_date) {
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
        if (!formData.dispatch_mgr_name) {
            toast({ title: '驗證失敗', description: '請選擇發包單位主管', variant: 'destructive' })
            return
        }
        if (!formData.dispatch_mgr_date) {
            toast({ title: '驗證失敗', description: '請輸入發包單位主管日期', variant: 'destructive' })
            return
        }
        if (!formData.dispatch_director_name) {
            toast({ title: '驗證失敗', description: '請輸入發包部門主管姓名', variant: 'destructive' })
            return
        }
        if (!formData.dispatch_director_date) {
            toast({ title: '驗證失敗', description: '請輸入發包部門主管日期', variant: 'destructive' })
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

    const activeIndex = getActiveIndex()

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
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8 w-full space-y-6">

                {/* 狀態 1: 已轉維修單 */}
                <Card id="card-section1" className="overflow-hidden border-sky-400/40 dark:border-sky-500/30 shadow-sm border-l-4 border-l-sky-400">
                    <SectionHeader title="狀態 1：已轉維修單" sectionKey="section1" index={0} />
                    <AnimatePresence>
                        {openSections.section1 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>工單編號 <span className="text-red-500">*</span></Label>
                                        <Input name="work_order_id" value={formData.work_order_id} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>開單日 <span className="text-red-500">*</span></Label>
                                        <Input name="request_date" type="date" value={formData.request_date} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>成本中心 <span className="text-red-500">*</span></Label>
                                        <Input name="cost_center" value={formData.cost_center} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>開單人 <span className="text-red-500">*</span></Label>
                                        <Input name="requester_name" value={formData.requester_name} disabled />
                                    </div>
                                    <div className="col-span-full space-y-2">
                                        <Label>維修內容 <span className="text-red-500">*</span></Label>
                                        <Textarea name="maintain_content" value={formData.maintain_content} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>印單人 <span className="text-red-500">*</span></Label>
                                        <Select 
                                            value={isOtherSelected('printer_name', formData.printer_name, HANDLER_NAMES) ? '其他' : (formData.printer_name || '')} 
                                            onValueChange={(v) => {
                                                if (v === '其他') {
                                                    setOtherSelected(prev => ({ ...prev, printer_name: true }))
                                                    setFormData((prev: any) => ({ ...prev, printer_name: '' }))
                                                } else {
                                                    setOtherSelected(prev => ({ ...prev, printer_name: false }))
                                                    setFormData((prev: any) => ({ ...prev, printer_name: v }))
                                                }
                                            }} 
                                            disabled={!isSectionEditable(0)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="請選擇印單人" /></SelectTrigger>
                                            <SelectContent>
                                                {HANDLER_NAMES.map(name => (
                                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                                ))}
                                                <SelectItem value="其他">其他</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {isOtherSelected('printer_name', formData.printer_name, HANDLER_NAMES) && (
                                            <Input
                                                placeholder="請輸入印單人姓名"
                                                value={formData.printer_name || ''}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, printer_name: e.target.value }))}
                                                disabled={!isSectionEditable(0)}
                                                className="mt-2"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>承辦人 <span className="text-red-500">*</span></Label>
                                        <Select 
                                            value={isOtherSelected('handler_name', formData.handler_name, HANDLER_NAMES) ? '其他' : (formData.handler_name || '')} 
                                            onValueChange={(v) => {
                                                if (v === '其他') {
                                                    setOtherSelected(prev => ({ ...prev, handler_name: true }))
                                                    setFormData((prev: any) => ({ ...prev, handler_name: '' }))
                                                } else {
                                                    setOtherSelected(prev => ({ ...prev, handler_name: false }))
                                                    setFormData((prev: any) => ({ ...prev, handler_name: v }))
                                                }
                                            }} 
                                            disabled={!isSectionEditable(0)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="請選擇承辦人" /></SelectTrigger>
                                            <SelectContent>
                                                {HANDLER_NAMES.map(name => (
                                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                                ))}
                                                <SelectItem value="其他">其他</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {isOtherSelected('handler_name', formData.handler_name, HANDLER_NAMES) && (
                                            <Input
                                                placeholder="請輸入承辦人姓名"
                                                value={formData.handler_name || ''}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, handler_name: e.target.value }))}
                                                disabled={!isSectionEditable(0)}
                                                className="mt-2"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>接單日期 <span className="text-red-500">*</span></Label>
                                        <Input name="work_order_date" type="date" value={formData.work_order_date} onChange={handleInputChange} disabled={!isSectionEditable(0)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>工務單位主管 <span className="text-red-500">*</span></Label>
                                        <Select 
                                            value={isOtherSelected('maint_mgr_name', formData.maint_mgr_name, MAINT_MGR_NAMES) ? '其他' : (formData.maint_mgr_name || '')} 
                                            onValueChange={(v) => {
                                                if (v === '其他') {
                                                    setOtherSelected(prev => ({ ...prev, maint_mgr_name: true }))
                                                    setFormData((prev: any) => ({ ...prev, maint_mgr_name: '' }))
                                                } else {
                                                    setOtherSelected(prev => ({ ...prev, maint_mgr_name: false }))
                                                    setFormData((prev: any) => ({ ...prev, maint_mgr_name: v }))
                                                }
                                            }} 
                                            disabled={!isSectionEditable(0)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="請選擇主管" /></SelectTrigger>
                                            <SelectContent>
                                                {MAINT_MGR_NAMES.map(n => (
                                                    <SelectItem key={n} value={n}>{n}</SelectItem>
                                                ))}
                                                <SelectItem value="其他">其他</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {isOtherSelected('maint_mgr_name', formData.maint_mgr_name, MAINT_MGR_NAMES) && (
                                            <Input
                                                placeholder="請輸入工務單位主管姓名"
                                                value={formData.maint_mgr_name || ''}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, maint_mgr_name: e.target.value }))}
                                                disabled={!isSectionEditable(0)}
                                                className="mt-2"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>工務單位主管日期 <span className="text-red-500">*</span></Label>
                                        <Input name="maint_mgr_date" type="date" value={formData.maint_mgr_date} onChange={handleInputChange} disabled={!isSectionEditable(0)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>送呈日期 <span className="text-red-500">*</span></Label>
                                        <Input name="submit_date" type="date" value={formData.submit_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(0)} />
                                    </div>
                                    {isSectionEditable(0) && (
                                        <div className="col-span-full pt-4 flex flex-col sm:flex-row gap-3">
                                            {formData.status === '已轉維修單' && (
                                                <Button className="flex-1" onClick={() => handleSave('開單主管簽核完成')}>確認基本資料並送審</Button>
                                            )}
                                            <Button variant="outline" className={formData.status === '已轉維修單' ? "flex-1 border-slate-300 dark:border-slate-700" : "w-full border-slate-300 dark:border-slate-700"} onClick={() => handleSave()} disabled={loading}>
                                                <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 2: 開單主管簽核完成 */}
                <Card id="card-section2" className="overflow-hidden border-rose-400/40 dark:border-rose-500/30 shadow-sm border-l-4 border-l-rose-400">
                    <SectionHeader title="狀態 2：開單主管簽核完成" sectionKey="section2" index={1} />
                    <AnimatePresence>
                        {openSections.section2 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>開單主管姓名 <span className="text-red-500">*</span></Label>
                                        <Input name="req_dept_mgr_name" value={formData.req_dept_mgr_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(1)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>開單主管日期</Label>
                                        <Input name="req_dept_mgr_date" type="date" value={formData.req_dept_mgr_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(1)} />
                                    </div>
                                    {isSectionEditable(1) && (
                                        <div className="col-span-full pt-4 flex flex-col sm:flex-row gap-3">
                                            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => handleSave('開單主管簽核完成')}>開單主管簽核完成</Button>
                                            <Button variant="outline" className="flex-1 border-slate-300 dark:border-slate-700" onClick={() => handleSave()} disabled={loading}>
                                                <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 3: 工務部門報價、主管簽核中 */}
                <Card id="card-section3" className="overflow-hidden border-violet-400/40 dark:border-violet-500/30 shadow-sm border-l-4 border-l-violet-400">
                    <SectionHeader title="狀態 3：工務部門報價、主管簽核中" sectionKey="section3" index={2} />
                    <AnimatePresence>
                        {openSections.section3 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>報價承辦人 <span className="text-red-500">*</span></Label>
                                        <Select 
                                            value={isOtherSelected('quote_user_name', formData.quote_user_name, HANDLER_NAMES) ? '其他' : (formData.quote_user_name || '')} 
                                            onValueChange={(v) => {
                                                if (v === '其他') {
                                                    setOtherSelected(prev => ({ ...prev, quote_user_name: true }))
                                                    setFormData((prev: any) => ({ ...prev, quote_user_name: '' }))
                                                } else {
                                                    setOtherSelected(prev => ({ ...prev, quote_user_name: false }))
                                                    setFormData((prev: any) => ({ ...prev, quote_user_name: v }))
                                                }
                                            }} 
                                            disabled={!isSectionEditable(2)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="選擇承辦人" /></SelectTrigger>
                                            <SelectContent>
                                                {HANDLER_NAMES.map(name => (
                                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                                ))}
                                                <SelectItem value="其他">其他</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {isOtherSelected('quote_user_name', formData.quote_user_name, HANDLER_NAMES) && (
                                            <Input
                                                placeholder="請輸入報價承辦人姓名"
                                                value={formData.quote_user_name || ''}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, quote_user_name: e.target.value }))}
                                                disabled={!isSectionEditable(2)}
                                                className="mt-2"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>報價承辦人日期 <span className="text-red-500">*</span></Label>
                                        <Input name="quote_user_date" type="date" value={formData.quote_user_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(2)} />
                                    </div>
                                    {isSectionEditable(2) && (
                                        <div className="col-span-full pt-4 flex flex-col sm:flex-row gap-3">
                                            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => handleSave('工務部門報價，主管簽核中')}>報價完成，送工務主管簽核</Button>
                                            <Button variant="outline" className="flex-1 border-slate-300 dark:border-slate-700" onClick={() => handleSave()} disabled={loading}>
                                                <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 4: 發包主管簽核 (含金額分歧邏輯) */}
                <Card id="card-section4" className="overflow-hidden border-pink-400/40 dark:border-pink-500/30 shadow-sm border-l-4 border-l-pink-400">
                    <SectionHeader title="狀態 4：發包主管簽核 (金額門檻判定)" sectionKey="section4" index={3} />
                    <AnimatePresence>
                        {openSections.section4 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>廠商 <span className="text-red-500">*</span></Label>
                                        <Input name="vendor_name" value={formData.vendor_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-orange-600 font-bold">金額 (≤ 2萬 走簡易流程) <span className="text-red-500">*</span></Label>
                                        <Input name="amount" type="number" value={formData.amount || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} className="border-orange-200 focus:border-orange-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>發包單位主管 <span className="text-red-500">*</span></Label>
                                        <Select 
                                            value={isOtherSelected('dispatch_mgr_name', formData.dispatch_mgr_name, MAINT_MGR_NAMES) ? '其他' : (formData.dispatch_mgr_name || '')} 
                                            onValueChange={(v) => {
                                                if (v === '其他') {
                                                    setOtherSelected(prev => ({ ...prev, dispatch_mgr_name: true }))
                                                    setFormData((prev: any) => ({ ...prev, dispatch_mgr_name: '' }))
                                                } else {
                                                    setOtherSelected(prev => ({ ...prev, dispatch_mgr_name: false }))
                                                    setFormData((prev: any) => ({ ...prev, dispatch_mgr_name: v }))
                                                }
                                            }} 
                                            disabled={!isSectionEditable(3)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="選擇主管" /></SelectTrigger>
                                            <SelectContent>
                                                {MAINT_MGR_NAMES.map(n => (
                                                    <SelectItem key={n} value={n}>{n}</SelectItem>
                                                ))}
                                                <SelectItem value="其他">其他</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {isOtherSelected('dispatch_mgr_name', formData.dispatch_mgr_name, MAINT_MGR_NAMES) && (
                                            <Input
                                                placeholder="請輸入發包單位主管姓名"
                                                value={formData.dispatch_mgr_name || ''}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, dispatch_mgr_name: e.target.value }))}
                                                disabled={!isSectionEditable(3)}
                                                className="mt-2"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>發包單位主管日期 <span className="text-red-500">*</span></Label>
                                        <Input name="dispatch_mgr_date" type="date" value={formData.dispatch_mgr_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>發包部門主管 <span className="text-red-500">*</span></Label>
                                        <Input name="dispatch_director_name" value={formData.dispatch_director_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>發包部門主管日期 <span className="text-red-500">*</span></Label>
                                        <Input name="dispatch_director_date" type="date" value={formData.dispatch_director_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(3)} />
                                    </div>
                                    {isSectionEditable(3) && (
                                        <div className="col-span-full pt-4 flex flex-col sm:flex-row gap-3">
                                            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleDispatchSignoff}>發包簽核完成 (系統將依金額判斷流程)</Button>
                                            <Button variant="outline" className="flex-1 border-slate-300 dark:border-slate-700" onClick={() => handleSave()} disabled={loading}>
                                                <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 5: 院長室簽核 (僅金額 > 2萬顯示) */}
                {(Number(formData.amount) > 20000 || formData.status === '院長室簽核中') && (
                    <Card id="card-section4_dean" className="overflow-hidden border-blue-500/40 dark:border-blue-600/30 shadow-sm border-l-4 border-l-blue-500">
                        <SectionHeader title="狀態 5：院長室簽核 (金額 > 2萬)" sectionKey="section4_dean" index={4} />
                        <AnimatePresence>
                            {openSections.section4_dean && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>副院長姓名 <span className="text-red-500">*</span></Label>
                                            <Select 
                                                value={isOtherSelected('vice_dean_name', formData.vice_dean_name, VICE_DEAN_NAMES) ? '其他' : (formData.vice_dean_name || '')} 
                                                onValueChange={(v) => {
                                                    if (v === '其他') {
                                                        setOtherSelected(prev => ({ ...prev, vice_dean_name: true }))
                                                        setFormData((prev: any) => ({ ...prev, vice_dean_name: '' }))
                                                    } else {
                                                        setOtherSelected(prev => ({ ...prev, vice_dean_name: false }))
                                                        setFormData((prev: any) => ({ ...prev, vice_dean_name: v }))
                                                    }
                                                }} 
                                                disabled={!isSectionEditable(4)}
                                            >
                                                <SelectTrigger><SelectValue placeholder="選擇副院長" /></SelectTrigger>
                                                <SelectContent>
                                                    {VICE_DEAN_NAMES.map(n => (
                                                        <SelectItem key={n} value={n}>{n}</SelectItem>
                                                    ))}
                                                    <SelectItem value="其他">其他</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {isOtherSelected('vice_dean_name', formData.vice_dean_name, VICE_DEAN_NAMES) && (
                                                <Input
                                                    placeholder="請輸入副院長姓名"
                                                    value={formData.vice_dean_name || ''}
                                                    onChange={(e) => setFormData((prev: any) => ({ ...prev, vice_dean_name: e.target.value }))}
                                                    disabled={!isSectionEditable(4)}
                                                    className="mt-2"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>副院長日期</Label>
                                            <Input name="vice_dean_date" type="date" value={formData.vice_dean_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(4)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>院長姓名 <span className="text-red-500">*</span></Label>
                                            <Select 
                                                value={isOtherSelected('dean_name', formData.dean_name, DEAN_NAMES) ? '其他' : (formData.dean_name || '')} 
                                                onValueChange={(v) => {
                                                    if (v === '其他') {
                                                        setOtherSelected(prev => ({ ...prev, dean_name: true }))
                                                        setFormData((prev: any) => ({ ...prev, dean_name: '' }))
                                                    } else {
                                                        setOtherSelected(prev => ({ ...prev, dean_name: false }))
                                                        setFormData((prev: any) => ({ ...prev, dean_name: v }))
                                                    }
                                                }} 
                                                disabled={!isSectionEditable(4)}
                                            >
                                                <SelectTrigger><SelectValue placeholder="選擇院長" /></SelectTrigger>
                                                <SelectContent>
                                                    {DEAN_NAMES.map(n => (
                                                        <SelectItem key={n} value={n}>{n}</SelectItem>
                                                    ))}
                                                    <SelectItem value="其他">其他</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {isOtherSelected('dean_name', formData.dean_name, DEAN_NAMES) && (
                                                <Input
                                                    placeholder="請輸入院長姓名"
                                                    value={formData.dean_name || ''}
                                                    onChange={(e) => setFormData((prev: any) => ({ ...prev, dean_name: e.target.value }))}
                                                    disabled={!isSectionEditable(4)}
                                                    className="mt-2"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>院長日期</Label>
                                            <Input name="dean_date" type="date" value={formData.dean_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(4)} />
                                        </div>
                                        {isSectionEditable(4) && (
                                            <div className="col-span-full pt-4 flex flex-col sm:flex-row gap-3">
                                                <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => handleSave('採購發包簽核中')}>院長室核准完成，送採購發包</Button>
                                                <Button variant="outline" className="flex-1 border-slate-300 dark:border-slate-700" onClick={() => handleSave()} disabled={loading}>
                                                    <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
                                                </Button>
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
                    <Card id="card-section5" className="overflow-hidden border-amber-700/40 dark:border-amber-600/30 shadow-sm border-l-4 border-l-amber-700">
                        <SectionHeader title="狀態 6：採購發包簽核中" sectionKey="section5" index={5} />
                        <AnimatePresence>
                            {openSections.section5 && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>採購組姓名 <span className="text-red-500">*</span></Label>
                                            <Input name="procurement_name" value={formData.procurement_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>採購組日期</Label>
                                            <Input name="procurement_date" type="date" value={formData.procurement_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>資材室姓名 <span className="text-red-500">*</span></Label>
                                            <Input name="material_name" value={formData.material_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>資材室日期</Label>
                                            <Input name="material_date" type="date" value={formData.material_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="col-span-full h-px bg-slate-100 my-2" />
                                        <div className="space-y-2">
                                            <Label>審查-副院長 <span className="text-red-500">*</span></Label>
                                            <Select 
                                                value={isOtherSelected('rev_vice_dean_name', formData.rev_vice_dean_name, VICE_DEAN_NAMES) ? '其他' : (formData.rev_vice_dean_name || '')} 
                                                onValueChange={(v) => {
                                                    if (v === '其他') {
                                                        setOtherSelected(prev => ({ ...prev, rev_vice_dean_name: true }))
                                                        setFormData((prev: any) => ({ ...prev, rev_vice_dean_name: '' }))
                                                    } else {
                                                        setOtherSelected(prev => ({ ...prev, rev_vice_dean_name: false }))
                                                        setFormData((prev: any) => ({ ...prev, rev_vice_dean_name: v }))
                                                    }
                                                }} 
                                                disabled={!isSectionEditable(5)}
                                            >
                                                <SelectTrigger><SelectValue placeholder="選擇副院長" /></SelectTrigger>
                                                <SelectContent>
                                                    {VICE_DEAN_NAMES.map(n => (
                                                        <SelectItem key={n} value={n}>{n}</SelectItem>
                                                    ))}
                                                    <SelectItem value="其他">其他</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {isOtherSelected('rev_vice_dean_name', formData.rev_vice_dean_name, VICE_DEAN_NAMES) && (
                                                <Input
                                                    placeholder="請輸入審查副院長姓名"
                                                    value={formData.rev_vice_dean_name || ''}
                                                    onChange={(e) => setFormData((prev: any) => ({ ...prev, rev_vice_dean_name: e.target.value }))}
                                                    disabled={!isSectionEditable(5)}
                                                    className="mt-2"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>審查-副院長日期</Label>
                                            <Input name="rev_vice_dean_date" type="date" value={formData.rev_vice_dean_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>
                                                審查-院長 {Number(formData.amount) > 200000 && <span className="text-red-500">*</span>}
                                            </Label>
                                            <Select 
                                                value={isOtherSelected('rev_dean_name', formData.rev_dean_name, DEAN_NAMES) ? '其他' : (formData.rev_dean_name || '')} 
                                                onValueChange={(v) => {
                                                    if (v === '其他') {
                                                        setOtherSelected(prev => ({ ...prev, rev_dean_name: true }))
                                                        setFormData((prev: any) => ({ ...prev, rev_dean_name: '' }))
                                                    } else {
                                                        setOtherSelected(prev => ({ ...prev, rev_dean_name: false }))
                                                        setFormData((prev: any) => ({ ...prev, rev_dean_name: v }))
                                                    }
                                                }} 
                                                disabled={!isSectionEditable(5)}
                                            >
                                                <SelectTrigger><SelectValue placeholder="選擇院長" /></SelectTrigger>
                                                <SelectContent>
                                                    {DEAN_NAMES.map(n => (
                                                        <SelectItem key={n} value={n}>{n}</SelectItem>
                                                    ))}
                                                    <SelectItem value="其他">其他</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {isOtherSelected('rev_dean_name', formData.rev_dean_name, DEAN_NAMES) && (
                                                <Input
                                                    placeholder="請輸入審查院長姓名"
                                                    value={formData.rev_dean_name || ''}
                                                    onChange={(e) => setFormData((prev: any) => ({ ...prev, rev_dean_name: e.target.value }))}
                                                    disabled={!isSectionEditable(5)}
                                                    className="mt-2"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>審查-院長日期</Label>
                                            <Input name="rev_dean_date" type="date" value={formData.rev_dean_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(5)} />
                                        </div>
                                        {isSectionEditable(5) && (
                                            <div className="col-span-full pt-4 flex flex-col sm:flex-row gap-3">
                                                <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={() => handleSave('採購已發包')}>審查完成，採購已發包</Button>
                                                <Button variant="outline" className="flex-1 border-slate-300 dark:border-slate-700" onClick={() => handleSave()} disabled={loading}>
                                                    <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Card>
                )}

                {/* 狀態 7: 工務已發包 / 採購已發包 */}
                <Card id="card-section7" className={`overflow-hidden shadow-sm border-l-4 ${Number(formData.amount) > 20000 ? 'border-yellow-400/40 dark:border-yellow-500/30 border-l-yellow-400' : 'border-pink-400/40 dark:border-pink-500/30 border-l-pink-400'}`}>
                    <SectionHeader title={getSection7Title()} sectionKey="section7" index={6} />
                    <AnimatePresence>
                        {openSections.section7 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-full">
                                        <Label>工程單編號 <span className="text-red-500">*</span></Label>
                                        <Input name="project_order_id" value={formData.project_order_id || ''} onChange={handleInputChange} disabled={!isSectionEditable(6)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>施工預計開始日期 <span className="text-red-500">*</span></Label>
                                        <Input name="plan_start_date" type="date" value={formData.plan_start_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(6)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>施工預計結束日期 <span className="text-red-500">*</span></Label>
                                        <Input name="plan_end_date" type="date" value={formData.plan_end_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(6)} />
                                    </div>
                                    {isSectionEditable(6) && (
                                        <div className="col-span-full pt-4 flex flex-col sm:flex-row gap-3">
                                            <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={() => handleSave('廠商施工中')}>
                                                維修單狀態進入廠商施工中
                                            </Button>
                                            <Button variant="outline" className="flex-1 border-slate-300 dark:border-slate-700" onClick={() => handleSave()} disabled={loading}>
                                                <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 8: 廠商施工中 */}
                <Card id="card-section7_construct" className="overflow-hidden border-lime-600/40 dark:border-lime-500/30 shadow-sm border-l-4 border-l-lime-600">
                    <SectionHeader title="狀態 8：廠商施工中" sectionKey="section7_construct" index={7} />
                    <AnimatePresence>
                        {openSections.section7_construct && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-full">
                                        <Label>施工完成日期 <span className="text-red-500">*</span></Label>
                                        <Input name="construct_end_date" type="date" value={formData.construct_end_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(7)} />
                                    </div>
                                    {isSectionEditable(7) && (
                                        <div className="col-span-full pt-4 flex flex-col sm:flex-row gap-3">
                                            <Button className="flex-1 bg-rose-600 hover:bg-rose-700 text-white" onClick={() => handleSave('施工完成，開單單位驗收中')}>
                                                施工完成，送開單單位驗收
                                            </Button>
                                            <Button variant="outline" className="flex-1 border-slate-300 dark:border-slate-700" onClick={() => handleSave()} disabled={loading}>
                                                <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 9: 施工完成，開單單位驗收中 */}
                <Card id="card-section8" className="overflow-hidden border-orange-400/40 dark:border-orange-500/30 shadow-sm border-l-4 border-l-orange-400">
                    <SectionHeader title="狀態 9：施工完成，開單單位驗收中" sectionKey="section8" index={8} />
                    <AnimatePresence>
                        {openSections.section8 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>驗收-開單主管姓名 <span className="text-red-500">*</span></Label>
                                        <Input name="accept_dept_mgr_name" value={formData.accept_dept_mgr_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(8)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收-開單主管日期</Label>
                                        <Input name="accept_dept_mgr_date" type="date" value={formData.accept_dept_mgr_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(8)} />
                                    </div>
                                    {isSectionEditable(8) && (
                                        <div className="col-span-full pt-4 flex flex-col sm:flex-row gap-3">
                                            <Button className="flex-1 bg-cyan-600 hover:bg-cyan-700" onClick={() => handleSave('維修部門驗收中')}>
                                                開單單位驗收完成，回傳工務驗收
                                            </Button>
                                            <Button variant="outline" className="flex-1 border-slate-300 dark:border-slate-700" onClick={() => handleSave()} disabled={loading}>
                                                <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* 狀態 10: 維修部門驗收中 */}
                <Card id="card-section9" className="overflow-hidden border-green-500/40 dark:border-green-600/30 shadow-sm border-l-4 border-l-green-500">
                    <SectionHeader title="狀態 10：維修部門驗收中" sectionKey="section9" index={9} />
                    <AnimatePresence>
                        {openSections.section9 && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>分期 <span className="text-red-500">*</span></Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                name="installment_count"
                                                type="number"
                                                min={0}
                                                value={formData.installment_count !== null && formData.installment_count !== undefined ? formData.installment_count : ''}
                                                onChange={handleInstallmentCountChange}
                                                disabled={!isSectionEditable(9) || (lastSavedData.installment_count !== null && lastSavedData.installment_count !== undefined)}
                                                placeholder="請輸入分期期數"
                                                className="flex-1"
                                            />
                                            {formData.installment_count !== null && Number(formData.installment_count) >= 2 && (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" type="button" className="shrink-0 h-10 border-slate-300 dark:border-slate-700">
                                                            顯示全部分期
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border-0 shadow-2xl bg-gradient-to-b from-white to-teal-50/30 dark:from-slate-950 dark:to-teal-950/20">
                                                        <DialogHeader className="pb-4 border-b border-teal-100 dark:border-teal-900/30">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                                                                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <DialogTitle className="text-lg font-extrabold text-slate-800 dark:text-white">
                                                                        全部分期紀錄
                                                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                                                                            共 {formData.installment_count} 期
                                                                        </span>
                                                                    </DialogTitle>
                                                                    <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                                        以下為所有已填寫並儲存的分期明細紀錄（內容無法修改）
                                                                    </DialogDescription>
                                                                </div>
                                                            </div>
                                                        </DialogHeader>
                                                        <div className="space-y-3 mt-4">
                                                            {installmentList.map((item, index) => {
                                                                if (index >= activeIndex) return null;
                                                                return (
                                                                    <div key={index} className="relative rounded-xl border border-teal-100 dark:border-teal-900/30 bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                                                                        {/* 左側色條 */}
                                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-400 to-emerald-500" />
                                                                        <div className="pl-5 pr-4 py-3">
                                                                            <div className="flex items-center gap-2 mb-3">
                                                                                <div className="w-6 h-6 rounded-full bg-teal-500/10 flex items-center justify-center text-[10px] font-extrabold text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                                                                                    {index + 1}
                                                                                </div>
                                                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">第 {index + 1} 期</span>
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
                                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                                                                    已存檔鎖定
                                                                                </span>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                                                <div className="space-y-1">
                                                                                    <div className="text-[10px] font-semibold text-sky-600/80 dark:text-sky-400/80 uppercase tracking-wider">請款內容</div>
                                                                                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200 bg-teal-50/50 dark:bg-teal-950/20 rounded-lg px-2.5 py-1.5 border border-teal-100/80 dark:border-teal-900/30 truncate" title={item.content || ''}>
                                                                                        {item.content || '—'}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <div className="text-[10px] font-semibold text-sky-600/80 dark:text-sky-400/80 uppercase tracking-wider">請款金額</div>
                                                                                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200 bg-teal-50/50 dark:bg-teal-950/20 rounded-lg px-2.5 py-1.5 border border-teal-100/80 dark:border-teal-900/30">
                                                                                        {item.amount ? `${Number(item.amount).toLocaleString()} 元` : '—'}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <div className="text-[10px] font-semibold text-sky-600/80 dark:text-sky-400/80 uppercase tracking-wider">請款日期</div>
                                                                                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200 bg-teal-50/50 dark:bg-teal-950/20 rounded-lg px-2.5 py-1.5 border border-teal-100/80 dark:border-teal-900/30">
                                                                                        {item.date || '—'}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <div className="text-[10px] font-semibold text-sky-600/80 dark:text-sky-400/80 uppercase tracking-wider">經辦人</div>
                                                                                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200 bg-teal-50/50 dark:bg-teal-950/20 rounded-lg px-2.5 py-1.5 border border-teal-100/80 dark:border-teal-900/30">
                                                                                        {item.handler || '—'}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                            {activeIndex === 0 && (
                                                                <div className="text-center py-10">
                                                                    <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center mx-auto mb-3">
                                                                        <svg className="w-7 h-7 text-teal-300 dark:text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0v3.375m0-3.375a1.125 1.125 0 01-1.125 1.125H9.75" />
                                                                        </svg>
                                                                    </div>
                                                                    <p className="text-sm font-medium text-slate-400 dark:text-slate-500">目前尚無已填寫並儲存的分期紀錄</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* 當期數為負數時的提示 */}
                                    {formData.installment_count !== null && Number(formData.installment_count) < 0 && (
                                        <div className="col-span-full text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-3 rounded-md border border-red-200 dark:border-red-800/30">
                                            系統提示：請勿輸入負數
                                        </div>
                                    )}

                                    {/* 當期數為 0 時的提示 */}
                                    {formData.installment_count !== null && Number(formData.installment_count) === 0 && (
                                        <div className="col-span-full text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                                            系統提示：已輸入為「0」期，代表無分期，無需填寫分期說明。
                                        </div>
                                    )}

                                    {/* 當期數為 1 時的提示 */}
                                    {formData.installment_count !== null && Number(formData.installment_count) === 1 && (
                                        <div className="col-span-full text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-800/30">
                                            系統提示：已輸入為「1」期，無需填寫分期說明。
                                        </div>
                                    )}

                                    {/* 當期數 >= 2 時，動態呈現每一期的填寫欄位 */}
                                    {formData.installment_count !== null && Number(formData.installment_count) >= 2 && (
                                        <div className="col-span-full space-y-4 border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/30">
                                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                                                分期明細填寫 (共 {formData.installment_count} 期) <span className="text-red-500">*</span>
                                            </h4>
                                            <div className="space-y-3">
                                                {installmentList.map((item, index) => {
                                                    // 1. 第二期以後的期數（相對於當前正在填寫的 activeIndex + 1 之後的期數）完全不顯示
                                                    if (index > activeIndex + 1) {
                                                        return null
                                                    }

                                                    // 2. 已經存檔且鎖定的前幾期，只顯示前一期的紀錄以供參考
                                                    if (index < activeIndex) {
                                                        if (index !== activeIndex - 1) {
                                                            return null
                                                        }
                                                        return (
                                                            <div key={index} className="flex justify-between items-center p-2 px-3 bg-slate-50/70 dark:bg-slate-900/10 border border-slate-100 dark:border-slate-800 rounded-md text-[11px] text-slate-500">
                                                                <span className="font-bold">第 {index + 1} 期 (前一期參考 🔒 已存檔鎖定)</span>
                                                                <span className="font-medium text-slate-600 dark:text-slate-400">
                                                                    內容: {item.content || '無'} | 金額: {item.amount || 0}元 | 請款日期: {item.date || '無'} | 經辦: {item.handler || '無'}
                                                                </span>
                                                            </div>
                                                        )
                                                    }

                                                    // 3. 只有當前正在編輯的 activeIndex 這一期，和未來的下一期 activeIndex + 1 會顯示完整的輸入框
                                                    return (
                                                        <div key={index} className={`grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 border rounded-md shadow-sm transition-all ${index === activeIndex ? 'bg-white dark:bg-slate-900 border-primary/20 ring-1 ring-primary/10' : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-80'}`}>
                                                            <div className="col-span-full font-bold text-xs text-primary/80 flex justify-between">
                                                                <span>第 {index + 1} 期 {index > activeIndex ? ' (尚未開放)' : ' (編輯中)'}</span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[11px] text-slate-500">請款內容 <span className="text-red-500">*</span></Label>
                                                                <Input
                                                                    type="text"
                                                                    placeholder="例如: 訂金"
                                                                    value={item.content}
                                                                    onChange={(e) => handleInstallmentItemChange(index, 'content', e.target.value)}
                                                                    disabled={!isSectionEditable(9) || index !== activeIndex}
                                                                    className="h-8 text-xs"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[11px] text-slate-500">請款金額 (元) <span className="text-red-500">*</span></Label>
                                                                <Input
                                                                    type="text"
                                                                    placeholder="例如: 100000"
                                                                    value={item.amount}
                                                                    onChange={(e) => handleInstallmentItemChange(index, 'amount', e.target.value)}
                                                                    disabled={!isSectionEditable(9) || index !== activeIndex}
                                                                    className="h-8 text-xs"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[11px] text-slate-500">請款日期 <span className="text-red-500">*</span></Label>
                                                                <Input
                                                                    type="date"
                                                                    value={item.date}
                                                                    onChange={(e) => handleInstallmentItemChange(index, 'date', e.target.value)}
                                                                    disabled={!isSectionEditable(9) || index !== activeIndex}
                                                                    className="h-8 text-xs"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[11px] text-slate-500">經辦人 <span className="text-red-500">*</span></Label>
                                                                <Select
                                                                    value={isOtherSelected(`installment_handler_${index}`, item.handler, HANDLER_NAMES) ? '其他' : (item.handler || '')}
                                                                    onValueChange={(val) => {
                                                                        if (val === '其他') {
                                                                            setOtherSelected(prev => ({ ...prev, [`installment_handler_${index}`]: true }))
                                                                            handleInstallmentItemChange(index, 'handler', '')
                                                                        } else {
                                                                            setOtherSelected(prev => ({ ...prev, [`installment_handler_${index}`]: false }))
                                                                            handleInstallmentItemChange(index, 'handler', val)
                                                                        }
                                                                    }}
                                                                    disabled={!isSectionEditable(9) || index !== activeIndex}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                                                        <SelectValue placeholder="選擇經辦人" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {HANDLER_NAMES.map(name => (
                                                                            <SelectItem key={name} value={name} className="text-xs">
                                                                                {name}
                                                                            </SelectItem>
                                                                        ))}
                                                                        <SelectItem value="其他" className="text-xs">其他</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                {isOtherSelected(`installment_handler_${index}`, item.handler, HANDLER_NAMES) && (
                                                                    <Input
                                                                        placeholder="請輸入經辦人姓名"
                                                                        value={item.handler || ''}
                                                                        onChange={(e) => handleInstallmentItemChange(index, 'handler', e.target.value)}
                                                                        disabled={!isSectionEditable(9) || index !== activeIndex}
                                                                        className="h-8 text-xs mt-1.5"
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label>驗收-承辦人 <span className="text-red-500">*</span></Label>
                                        <Select 
                                            value={isOtherSelected('accept_handler_name', formData.accept_handler_name, HANDLER_NAMES) ? '其他' : (formData.accept_handler_name || '')} 
                                            onValueChange={(v) => {
                                                if (v === '其他') {
                                                    setOtherSelected(prev => ({ ...prev, accept_handler_name: true }))
                                                    setFormData((prev: any) => ({ ...prev, accept_handler_name: '' }))
                                                } else {
                                                    setOtherSelected(prev => ({ ...prev, accept_handler_name: false }))
                                                    setFormData((prev: any) => ({ ...prev, accept_handler_name: v }))
                                                }
                                            }} 
                                            disabled={!isSectionEditable(9)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="選擇承辦人" /></SelectTrigger>
                                            <SelectContent>
                                                {HANDLER_NAMES.map(name => (
                                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                                ))}
                                                <SelectItem value="其他">其他</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {isOtherSelected('accept_handler_name', formData.accept_handler_name, HANDLER_NAMES) && (
                                            <Input
                                                placeholder="請輸入驗收承辦人姓名"
                                                value={formData.accept_handler_name || ''}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, accept_handler_name: e.target.value }))}
                                                disabled={!isSectionEditable(9)}
                                                className="mt-2"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收-承辦人日期 <span className="text-red-500">*</span></Label>
                                        <Input name="accept_handler_date" type="date" value={formData.accept_handler_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(9)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收單位主管 <span className="text-red-500">*</span></Label>
                                        <Select 
                                            value={isOtherSelected('accept_mgr_name', formData.accept_mgr_name, MAINT_MGR_NAMES) ? '其他' : (formData.accept_mgr_name || '')} 
                                            onValueChange={(v) => {
                                                if (v === '其他') {
                                                    setOtherSelected(prev => ({ ...prev, accept_mgr_name: true }))
                                                    setFormData((prev: any) => ({ ...prev, accept_mgr_name: '' }))
                                                } else {
                                                    setOtherSelected(prev => ({ ...prev, accept_mgr_name: false }))
                                                    setFormData((prev: any) => ({ ...prev, accept_mgr_name: v }))
                                                }
                                            }} 
                                            disabled={!isSectionEditable(9)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="選擇主管" /></SelectTrigger>
                                            <SelectContent>
                                                {MAINT_MGR_NAMES.map(n => (
                                                    <SelectItem key={n} value={n}>{n}</SelectItem>
                                                ))}
                                                <SelectItem value="其他">其他</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {isOtherSelected('accept_mgr_name', formData.accept_mgr_name, MAINT_MGR_NAMES) && (
                                            <Input
                                                placeholder="請輸入驗收單位主管姓名"
                                                value={formData.accept_mgr_name || ''}
                                                onChange={(e) => setFormData((prev: any) => ({ ...prev, accept_mgr_name: e.target.value }))}
                                                disabled={!isSectionEditable(9)}
                                                className="mt-2"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收單位主管日期 <span className="text-red-500">*</span></Label>
                                        <Input name="accept_mgr_date" type="date" value={formData.accept_mgr_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(9)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收部門主管 <span className="text-red-500">*</span></Label>
                                        <Input name="accept_director_name" value={formData.accept_director_name || ''} onChange={handleInputChange} disabled={!isSectionEditable(9)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>驗收部門主管日期 <span className="text-red-500">*</span></Label>
                                        <Input name="accept_director_date" type="date" value={formData.accept_director_date || ''} onChange={handleInputChange} disabled={!isSectionEditable(9)} />
                                    </div>
                                    {isSectionEditable(9) && (
                                        <div className="col-span-full pt-4 flex flex-col sm:flex-row gap-3">
                                            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleSave('已驗收')}>
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                驗收完成 (將自動歸檔)
                                            </Button>
                                            <Button variant="outline" className="flex-1 border-slate-300 dark:border-slate-700" onClick={() => handleSave()} disabled={loading}>
                                                <Save className="w-4 h-4 mr-2 shrink-0" />僅儲存不變更狀態
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
