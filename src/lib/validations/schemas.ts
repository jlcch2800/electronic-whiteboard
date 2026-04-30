// Validation Schemas for Forms
import * as z from 'zod'

// Password Strength Validation (需符合至少3種規則)
const passwordSchema = z.string()
    .min(8, '密碼至少需要8個字元')
    .refine((val) => {
        let count = 0
        if (/[a-z]/.test(val)) count++
        if (/[A-Z]/.test(val)) count++
        if (/[0-9]/.test(val)) count++
        if (/[!@#$%^&*(),.?":{}|<>]/.test(val)) count++
        return count >= 3
    }, '密碼需符合至少 3 項條件：大寫、小寫、數字、特殊符號')

// Login Form
export const loginSchema = z.object({
    email: z.string().email('請輸入有效的 Email'),
    password: z.string().min(1, '請輸入密碼'),
    recaptchaToken: z.string().optional(),
})
export type LoginFormValues = z.infer<typeof loginSchema>

// Register Form
export const registerSchema = z.object({
    unit: z.string().min(1, '請輸入單位'),
    user_name: z.string().min(1, '請輸入姓名'),
    user_account: z.string().min(1, '請輸入帳號'),
    password: passwordSchema,
    confirmPassword: z.string(),
    email: z.string().email('請輸入有效的 Email'),
    recaptchaToken: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: '密碼不一致',
    path: ['confirmPassword'],
})
export type RegisterFormValues = z.infer<typeof registerSchema>

// Forgot Password Form
export const forgotPasswordSchema = z.object({
    email: z.string().email('請輸入有效的 Email'),
    recaptchaToken: z.string().optional(),
})
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

// Vendor Work Form (廠商今日施工)
// 必填：日期、到院/離院時間、廠商名稱、廠商負責人員、施工內容、負責人電話、棟別、樓層、地點、工作證號、人數
// 非必填：到院/離院狀態、備註

/** 可借用/歸還的物品清單 */
export const BORROW_ITEM_OPTIONS = [
    '1號施工卡', '2號施工卡', '3號施工卡', '4號施工卡',
    '5號施工卡', '6號施工卡', '施工母卡', '8F電信機房鑰匙',
    '推車', '樓梯', '其他',
] as const

export const vendorWorkSchema = z.object({
    entry_status: z.enum(['arrival', 'departure']),
    work_date: z.string().min(1, '請選擇日期'),
    arrival_time: z.string().nullable().optional(),
    departure_time: z.string().nullable().optional(),
    building: z.string().nullable().optional(),
    floor: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    vendor_badge_id: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? null : Number(val),
        z.number().nullable().optional()
    ),
    head_count: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? null : Number(val),
        z.number().nullable().optional()
    ),
    vendor_name: z.string().min(1, '請輸入廠商名稱'),
    vendor_contact: z.string().min(1, '請輸入廠商負責人員'),
    vendor_contact_phone: z.string().nullable().optional(),
    work_content: z.string().min(1, '請輸入施工內容'),
    note: z.string().nullable().optional(),
    // 借物功能相關欄位
    borrow_action: z.enum(['borrow', 'return', 'none', 'partial_return']).nullable().optional(),
    borrowed_items: z.array(z.string()).nullable().optional(),
    borrowed_other_text: z.string().nullable().optional(),
    lender_name: z.string().nullable().optional(),
    returned_items: z.array(z.string()).nullable().optional(),
    returned_other_text: z.string().nullable().optional(),
    receiver_name: z.string().nullable().optional(),
    ref_arrival_id: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
    if (data.entry_status === 'arrival') {
        // 到院時驗證
        if (!data.arrival_time) {
            ctx.addIssue({ code: 'custom', message: '請輸入到院時間', path: ['arrival_time'] })
        }
        if (!data.building || data.building.trim() === '') {
            ctx.addIssue({ code: 'custom', message: '請輸入棟別', path: ['building'] })
        }
        if (!data.floor || data.floor.trim() === '') {
            ctx.addIssue({ code: 'custom', message: '請輸入樓層', path: ['floor'] })
        }
        if (!data.location || data.location.trim() === '') {
            ctx.addIssue({ code: 'custom', message: '請輸入施工地點', path: ['location'] })
        }
        if (!data.vendor_badge_id) {
            ctx.addIssue({ code: 'custom', message: '請輸入工作證號', path: ['vendor_badge_id'] })
        }
        if (!data.head_count) {
            ctx.addIssue({ code: 'custom', message: '請輸入施工人數', path: ['head_count'] })
        }
        if (!data.vendor_contact_phone || data.vendor_contact_phone.trim() === '') {
            ctx.addIssue({ code: 'custom', message: '請輸入負責人員電話', path: ['vendor_contact_phone'] })
        }
        // 借物時：借出人員必填；且若勾選「其他」，需輸入說明
        if (data.borrow_action === 'borrow') {
            if (!data.lender_name || data.lender_name.trim() === '') {
                ctx.addIssue({ code: 'custom', message: '請輸入借出人員', path: ['lender_name'] })
            }
            if (!data.borrowed_items || data.borrowed_items.length === 0) {
                ctx.addIssue({ code: 'custom', message: '請至少選擇一項借用物品', path: ['borrowed_items'] })
            }
            if (data.borrowed_items?.includes('其他') && !data.borrowed_other_text?.trim()) {
                ctx.addIssue({ code: 'custom', message: '請輸入其他物品說明', path: ['borrowed_other_text'] })
            }
        }
    } else {
        // 離院時驗證
        if (!data.departure_time) {
            ctx.addIssue({ code: 'custom', message: '請輸入離院時間', path: ['departure_time'] })
        }
        // 歸還時：歸還人員必填；且若勾選「其他」，需輸入說明
        if (data.borrow_action === 'return') {
            if (!data.receiver_name || data.receiver_name.trim() === '') {
                ctx.addIssue({ code: 'custom', message: '請輸入歸還人員', path: ['receiver_name'] })
            }
            if (!data.returned_items || data.returned_items.length === 0) {
                ctx.addIssue({ code: 'custom', message: '請至少選擇一項歸還物品', path: ['returned_items'] })
            }
            if (data.returned_items?.includes('其他') && !data.returned_other_text?.trim()) {
                ctx.addIssue({ code: 'custom', message: '請輸入其他物品說明', path: ['returned_other_text'] })
            }
        }
    }
})
export type VendorWorkFormValues = z.infer<typeof vendorWorkSchema>

// Engineering Work Form (工務今日施工)
export const engineeringWorkSchema = z.object({
    start_date: z.string().min(1, '請選擇開始日期'),
    end_date: z.string().min(1, '請選擇結束日期'),
    time: z.string().min(1, '請輸入時間'),
    vendor_name: z.string().min(1, '請輸入廠商'),
    unit: z.string().min(1, '請輸入單位'),
    engineering_contact: z.string().min(1, '請輸入工務負責人員'),
    work_content: z.string().min(1, '請輸入內容'),
    note: z.string().nullable().optional(),
})
export type EngineeringWorkFormValues = z.infer<typeof engineeringWorkSchema>

// Pending Work Form (待處理工作)
export const pendingWorkSchema = z.object({
    start_date: z.string().min(1, '請選擇開始日期'),
    end_date: z.string().min(1, '請選擇結束日期'),
    time: z.string().min(1, '請輸入時間'),
    vendor_name: z.string().min(1, '請輸入廠商'),
    unit: z.string().min(1, '請輸入單位'),
    engineering_contact: z.string().min(1, '請輸入工務負責人員'),
    work_content: z.string().min(1, '請輸入內容'),
    note: z.string().nullable().optional(),
})
export type PendingWorkFormValues = z.infer<typeof pendingWorkSchema>

// Work Report Form (施工回報)
export const workReportSchema = z.object({
    report_date: z.string().min(1, '請選擇日期'),
    report_time: z.string().min(1, '請輸入時間'),
    vendor_name: z.string().min(1, '請輸入廠商'),
    work_location: z.string().min(1, '請輸入施工地點'),
    engineering_contact: z.string().min(1, '請輸入工務負責人員'),
    work_status: z.enum(['completed', 'incomplete', 'abnormal']),
    work_content: z.string().min(1, '請輸入工作內容'),
    note: z.string().optional(),
})
export type WorkReportFormValues = z.infer<typeof workReportSchema>

// User Management Form (帳號管理)
// 注意：密碼驗證在元件中根據 isEdit 狀態動態處理
export const userManagementSchema = z.object({
    unit: z.string().min(1, '請輸入單位'),
    user_name: z.string().min(1, '請輸入姓名'),
    user_account: z.string().min(1, '請輸入帳號'),
    password: z.string().optional(), // 密碼：新增必填，修改選填
    confirmPassword: z.string().optional(), // 確認密碼
    role: z.enum(['admin', 'staff']),
    email: z.string().email('請輸入有效的 Email'),
    is_active: z.boolean(),
    // Lockout info
    failed_attempts: z.number().nullable().optional(),
    last_failed_at: z.string().nullable().optional(),
    locked_until: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
    // 如果有密碼，驗證密碼強度
    if (data.password && data.password.length > 0) {
        if (data.password.length < 8) {
            ctx.addIssue({ code: 'custom', message: '密碼至少需要8個字元', path: ['password'] })
        } else {
            let count = 0
            if (/[a-z]/.test(data.password)) count++
            if (/[A-Z]/.test(data.password)) count++
            if (/[0-9]/.test(data.password)) count++
            if (/[!@#$%^&*(),.?":{}|<>]/.test(data.password)) count++
            if (count < 3) {
                ctx.addIssue({ code: 'custom', message: '密碼需符合至少 3 項條件：大寫、小寫、數字、特殊符號', path: ['password'] })
            }
        }
        // 驗證確認密碼
        if (data.password !== data.confirmPassword) {
            ctx.addIssue({ code: 'custom', message: '密碼不一致', path: ['confirmPassword'] })
        }
    }
})
export type UserManagementFormValues = z.infer<typeof userManagementSchema>

// Work File Form (施工文件)
export const workFileSchema = z.object({
    date: z.string().min(1, '請選擇日期'),
    vendor_name: z.string().optional(),
    work_item: z.string().optional(),
    uploader_name: z.string().min(1, '請輸入上傳人員'),
    description: z.string().optional(),
    folder_name: z.string().min(1, '請輸入資料夾名稱'),
    file_url: z.string().optional(),
    image_url: z.string().optional(),
    video_url: z.string().optional(),
    note: z.string().optional(),
}).refine(data => (data.file_url && data.file_url.length > 0) || (data.image_url && data.image_url.length > 0), {
    message: '文件與照片請至少擇一上傳',
    path: ['file_url'], // 優先顯示在文件欄位，或兩者都顯示
})
export type WorkFileFormValues = z.infer<typeof workFileSchema>
