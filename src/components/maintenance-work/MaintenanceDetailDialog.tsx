'use client'

import { format } from 'date-fns'
import { Activity } from 'lucide-react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'

// 完整的欄位中文對照表
const EXPORT_LABELS: Record<string, string> = {
    'id': 'ID',
    'created_at': '建立時間',
    'status': '狀態',
    // 步驟 1
    'request_date': '開單日',
    'cost_center': '成本中心',
    'maintain_content': '維修內容',
    'requester_name': '開單人',
    'work_order_id': '工單編號',
    'handler_name': '承辦人',
    'work_order_date': '接單日期',
    'maint_mgr_name': '工務單位主管',
    'maint_mgr_date': '工務單位主管日期',
    'printer_name': '印單人',
    'submit_date': '送呈日期',
    // 步驟 2
    'req_dept_mgr_name': '開單主管姓名',
    'req_dept_mgr_date': '開單主管日期',
    // 步驟 3
    'quote_user_name': '報價承辦人',
    'quote_user_date': '報價承辦人日期',
    // 步驟 4
    'vendor_name': '廠商',
    'amount': '金額',
    'dispatch_mgr_name': '發包單位主管',
    'dispatch_mgr_date': '發包單位主管日期',
    'dispatch_director_name': '發包部門主管',
    'dispatch_director_date': '發包部門主管日期',
    // 步驟 6
    'vice_dean_name': '副院長姓名',
    'vice_dean_date': '副院長日期',
    'dean_name': '院長姓名',
    'dean_date': '院長日期',
    // 步驟 7
    'project_order_id': '工程單編號',
    'plan_start_date': '施工預計開始日期',
    'plan_end_date': '施工預計結束日期',
    'procurement_name': '採購組姓名',
    'procurement_date': '採購組日期',
    'material_name': '資材室姓名',
    'material_date': '資材室日期',
    'rev_vice_dean_name': '審查-副院長姓名',
    'rev_vice_dean_date': '審查-副院長日期',
    'rev_dean_name': '審查-院長姓名',
    'rev_dean_date': '審查-院長日期',
    // 步驟 8
    'construct_end_date': '施工完成日期',
    // 步驟 9
    'accept_dept_mgr_name': '驗收-開單主管姓名',
    'accept_dept_mgr_date': '驗收-開單主管日期',
    // 步驟 10
    'installment_count': '分期',
    'installment_note': '分期說明',
    'accept_handler_name': '驗收-承辦人',
    'accept_handler_date': '驗收-承辦人日期',
    'accept_mgr_name': '驗收單位主管',
    'accept_mgr_date': '驗收單位主管日期',
    'accept_director_name': '驗收部門主管',
    'accept_director_date': '驗收部門主管日期',
    'is_contract': '是否為合約維修單',
    'contract_received_date': '紙本合約收到日期',
}

// ==========================================
// 統一字體與樣式設定，修改此處即可調整明細內所有字體大小與外觀
// ==========================================
const STYLES = {
    // 對話框標題 (例如：工務維修單單筆記錄明細)
    dialogTitle: "text-lg font-bold tracking-wider",

    // 各分組區塊標題 (例如：📋 設備開單基本資訊)
    groupTitle: "text-base font-bold tracking-wide",

    // 欄位名稱/標籤 (例如：工單編號、開單日)
    fieldLabel: "text-[14px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider",

    // 欄位數值/內容 (例如：工單編號的值、開單日的值)
    fieldValue: "text-[14px] font-semibold text-slate-700 dark:text-slate-200 break-all leading-relaxed font-mono",

    // 狀態 Badge 的字體大小與樣式
    badgeText: "bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[14px] py-0.5 px-2 tracking-wide rounded-md",

    // 待簽核 / 未填寫的字體大小與樣式
    pendingText: "text-[14px] text-slate-400/80 italic font-medium tracking-tight"
}

interface MaintenanceDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    viewingItem: any
    title?: string
    themeTopBar?: string          // 頂部細長裝飾條的 ClassName，例如 `absolute top-0 left-0 right-0 h-1.5 c.topBar`
    themeGradient?: string        // 頂部區塊的漸層 Class，預設為藍綠色漸層
    themeTextColor?: string       // 頂部圖示或高亮文字顏色，例如 text-teal-300
    themeSystemIdColor?: string   // SYSTEM ID 標籤的文字顏色，例如 text-teal-200
}

export function MaintenanceDetailDialog({
    open,
    onOpenChange,
    viewingItem,
    title = "工務維修單單筆記錄明細",
    themeTopBar,
    themeGradient = "from-blue-900 via-blue-800 to-teal-800",
    themeTextColor = "text-teal-300",
    themeSystemIdColor = "text-teal-200"
}: MaintenanceDetailDialogProps) {
    if (!viewingItem) return null

    const groups = [
        {
            title: "📋 設備開單基本資訊",
            iconColor: "text-blue-600 dark:text-blue-400",
            bgColor: "bg-blue-50/50 dark:bg-blue-950/20",
            borderColor: "border-blue-100 dark:border-blue-900/40",
            fields: ['work_order_id', 'status', 'request_date', 'cost_center', 'requester_name', 'printer_name', 'submit_date', 'created_at']
        },
        {
            title: "🔧 故障描述與承辦接單",
            iconColor: "text-amber-600 dark:text-amber-400",
            bgColor: "bg-amber-50/50 dark:bg-amber-950/20",
            borderColor: "border-amber-100 dark:border-amber-900/40",
            fields: ['maintain_content', 'handler_name', 'work_order_date', 'maint_mgr_name', 'maint_mgr_date', 'req_dept_mgr_name', 'req_dept_mgr_date']
        },
        {
            title: "💰 報價發包與行政簽核",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            bgColor: "bg-emerald-50/50 dark:bg-emerald-950/20",
            borderColor: "border-emerald-100 dark:border-emerald-900/40",
            fields: ['quote_user_name', 'quote_user_date', 'vendor_name', 'amount', 'dispatch_mgr_name', 'dispatch_mgr_date', 'dispatch_director_name', 'dispatch_director_date', 'vice_dean_name', 'vice_dean_date', 'dean_name', 'dean_date']
        },
        {
            title: "🏗️ 採購招標與工程審查",
            iconColor: "text-indigo-600 dark:text-indigo-400",
            bgColor: "bg-indigo-50/50 dark:bg-indigo-950/20",
            borderColor: "border-indigo-100 dark:border-indigo-900/40",
            fields: ['is_contract', 'contract_received_date', 'project_order_id', 'plan_start_date', 'plan_end_date', 'procurement_name', 'procurement_date', 'material_name', 'material_date', 'rev_vice_dean_name', 'rev_vice_dean_date', 'rev_dean_name', 'rev_dean_date']
        },
        {
            title: "✅ 施工完工與驗收簽章",
            iconColor: "text-teal-600 dark:text-teal-400",
            bgColor: "bg-teal-50/50 dark:bg-teal-950/20",
            borderColor: "border-teal-100 dark:border-teal-900/40",
            fields: ['construct_end_date', 'installment_count', 'installment_note', 'accept_dept_mgr_name', 'accept_dept_mgr_date', 'accept_handler_name', 'accept_handler_date', 'accept_mgr_name', 'accept_mgr_date', 'accept_director_name', 'accept_director_date']
        }
    ]

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-2 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
                {/* Header */}
                <div className={`bg-gradient-to-r ${themeGradient} text-white px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0 relative ${themeTopBar ? 'pt-5' : ''}`}>
                    {themeTopBar && <div className={`absolute top-0 left-0 right-0 h-1.5 ${themeTopBar}`} />}
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm shrink-0 border border-white/20">
                            <Activity className={`w-6 h-6 ${themeTextColor} animate-pulse`} />
                        </div>
                        <div>
                            <h2 className={STYLES.dialogTitle}>{title}</h2>
                        </div>
                    </div>
                    <div className="text-right hidden sm:block font-mono">
                        <span className={`text-[10px] ${themeSystemIdColor} block`}>SYSTEM ID</span>
                        <span className="text-xs text-slate-300 tracking-tighter opacity-90">{viewingItem.id}</span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10">
                    <div className="space-y-6">
                        {groups.map((group, gIdx) => (
                            <div
                                key={gIdx}
                                className={`rounded-xl border ${group.borderColor} ${group.bgColor} p-4 shadow-sm space-y-4 backdrop-blur-[2px] transition-all hover:shadow-md`}
                            >
                                <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                                    <span className={`${STYLES.groupTitle} ${group.iconColor}`}>
                                        {group.title}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3.5">
                                    {group.fields.map((key) => {
                                        const label = EXPORT_LABELS[key] || key;
                                        let rawVal = viewingItem[key];
                                        let isPending = false;
                                        let formattedVal = "";

                                        if (key === 'is_contract') {
                                            formattedVal = rawVal === true ? "合約" : "非合約";
                                            isPending = false;
                                        } else if (rawVal === null || rawVal === undefined || String(rawVal).trim() === "" || rawVal === "-") {
                                            isPending = true;
                                            formattedVal = "待簽核 / 未填寫";
                                        } else {
                                            if (key === 'amount') {
                                                formattedVal = `$${Number(rawVal).toLocaleString()}`;
                                            } else if (key === 'created_at') {
                                                try {
                                                    formattedVal = format(new Date(rawVal), 'yyyy-MM-dd HH:mm:ss');
                                                } catch (e) {
                                                    formattedVal = String(rawVal);
                                                }
                                            } else if (key === 'installment_count') {
                                                formattedVal = `${rawVal} 期`;
                                            } else {
                                                formattedVal = String(rawVal);
                                            }
                                        }

                                        return (
                                            <div
                                                key={key}
                                                className={`flex flex-col gap-1 pb-2 border-b border-dashed border-slate-200/50 dark:border-slate-800/40 last:border-b-0 ${key === 'maintain_content' ? 'sm:col-span-2 md:col-span-3' : ''
                                                    }`}
                                            >
                                                <span className={STYLES.fieldLabel}>
                                                    {label}
                                                </span>
                                                {key === 'status' ? (
                                                    <div className="pt-0.5">
                                                        <Badge className={STYLES.badgeText}>
                                                            {formattedVal}
                                                        </Badge>
                                                    </div>
                                                ) : isPending ? (
                                                    <span className={STYLES.pendingText}>
                                                        {formattedVal}
                                                    </span>
                                                ) : (
                                                    <span className={STYLES.fieldValue}>
                                                        {formattedVal}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex items-center justify-end border-t border-slate-200/60 dark:border-slate-800/80 shrink-0">
                    <AlertDialogAction
                        onClick={() => onOpenChange(false)}
                        className="bg-gradient-to-r from-blue-800 to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white text-xs font-bold tracking-wider px-6 py-2 rounded-xl transition-all shadow-md active:scale-95"
                    >
                        離開
                    </AlertDialogAction>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    )
}
