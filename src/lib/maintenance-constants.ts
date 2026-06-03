// 工務維修單管理系統 - 常數定義

/**
 * 維修流程狀態清單 (依流程順序)
 */
export const MAINTENANCE_STATUS = [
    '已轉維修單',
    '開單主管簽核完成',
    '工務部門報價，主管簽核中',
    '工務已發包',
    '院長室簽核中',
    '採購發包簽核中',
    '採購已發包',
    '廠商施工中',
    '施工完成，開單單位驗收中',
    '維修部門驗收中',
    '已驗收'
] as const

export type MaintenanceStatus = typeof MAINTENANCE_STATUS[number]

/**
 * 承辦人/報價承辦人/驗收承辦人 選項值 (依姓名筆畫排序)
 */
export const HANDLER_NAMES = [
    '李建賢', '周禹良', '林坤宏', '林鑫宏', '陳冠博',
    '黃永男', '楊盈慶', '楊竣欽', '廖文傑', '蔡明憬',
    '謝為紘', '蘇建勳', '蘇匯元'
].sort() // 預設 sort 會依據 Unicode，對於中文筆畫大致正確，若需精確筆畫需特殊套件，此處採基本排序

/**
 * 工務單位主管 選項值
 */
export const MAINT_MGR_NAMES = ['李建賢', '黃永男'].sort()

/**
 * 工務主任 預設值
 */
export const DEFAULT_DIRECTOR_NAME = '楊竣欽'

/**
 * 院長室 簽核人
 */
export const VICE_DEAN_NAMES = ['邵詩媛', '王哲川'].sort()
export const DEAN_NAMES = ['田宇峯']

/**
 * 狀態卡片顏色對應
 */
export const STATUS_COLORS: Record<string, string> = {
    '已轉維修單': 'blue',
    '開單主管簽核完成': 'sky',
    '工務部門報價，主管簽核中': 'indigo',
    '工務已發包': 'amber',
    '院長室簽核中': 'purple',
    '採購發包簽核中': 'violet',
    '採購已發包': 'emerald',
    '廠商施工中': 'rose',
    '施工完成，開單單位驗收中': 'orange',
    '維修部門驗收中': 'cyan',
    '已驗收': 'green'
}
