'use client'

import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import {
    addDays, differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval,
    eachYearOfInterval, endOfMonth, endOfWeek, endOfYear, format, isValid, isWeekend, max as maxDate,
    min as minDate, parseISO, startOfDay, startOfMonth, startOfWeek
} from 'date-fns'
import { CalendarClock, AlertTriangle, Crosshair } from 'lucide-react'
import { Button } from '@/components/ui/button'

/* =====================================================================
 * 型別定義
 * ===================================================================== */

/** 甘特圖所需的維修單欄位（由專案管理頁傳入） */
export interface GanttOrder {
    id: string
    work_order_id: string
    status: string
    work_order_date: string
    request_date?: string | null
    plan_start_date?: string | null
    plan_end_date?: string | null
    construct_end_date?: string | null
    maintain_content?: string | null
    vendor_name?: string | null
    handler_name?: string | null
    maintenance_project_category_id?: string | null
    maintenance_project_sub_category_id?: string | null
    // 審查日期
    rev_dean_date?: string | null
    rev_vice_dean_date?: string | null
    material_date?: string | null
}

/** 甘特圖所需的專案主項目欄位 */
export interface GanttCategory {
    id: string
    maintenance_category_name: string
}

/** 甘特圖所需的專案次項目欄位 */
export interface GanttSubCategory {
    id: string
    maintenance_project_id?: string
    maintenance_project_category_id: string
    maintenance_sub_category_name: string
}

/** 甘特圖進度分類 */
export type GanttProgress = 'not_started' | 'in_progress' | 'completed'

/** 時間軸解析度 */
export type GanttScale = 'day' | 'week' | 'month'

export interface ProjectGanttChartProps {
    categories: GanttCategory[]
    subCategories?: GanttSubCategory[]
    orders: GanttOrder[]
    /** 點擊工單進度條時觸發（導向編輯頁） */
    onOrderClick?: (orderId: string) => void
    /** 受控時間軸尺度 */
    scale?: GanttScale
    onScaleChange?: (scale: GanttScale) => void
    /** 是否填滿垂直可用高度（全螢幕彈窗使用） */
    fillHeight?: boolean
    /** 右上角自訂額外按鈕（例如匯出按鈕） */
    extraActions?: React.ReactNode
}

/* =====================================================================
 * 常數
 * ===================================================================== */

/** 左側固定欄寬度 (px) */
const LEFT_W = 300
/** 表頭高度 (px)：上層 26 + 下層 30 */
const HEADER_TOP_H = 26
const HEADER_BOTTOM_H = 30
/** 工單列高度 (px) */
const ROW_H = 44
/** 主項目分組列高度 (px) */
const GROUP_H = 38
/** 次項目分組列高度 (px) */
const SUB_GROUP_H = 34
/** 各解析度下每日寬度 (px) - 縮減至極限以減少水平捲動距離 */
const PX_PER_DAY: Record<GanttScale, number> = { day: 20, week: 6.5, month: 1.6 }

/** 完成類狀態：施工完成後進入驗收即視為完成 */
const COMPLETED_STATUSES = ['施工完成，開單單位驗收中', '維修部門驗收中', '已驗收']
/** 進行中狀態：已發包或廠商施工中 */
const IN_PROGRESS_STATUSES = ['工務已發包', '採購已發包', '廠商施工中']

/** 進度分類對應樣式（藍：尚未開始 / 紅：進行中 / 綠：完成） */
export const GANTT_PROGRESS_STYLE: Record<GanttProgress, {
    label: string
    bar: string
    dot: string
    chip: string
}> = {
    not_started: {
        label: '尚未開始',
        bar: 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-blue-500/30 ring-blue-600/40 text-white',
        dot: 'bg-blue-500',
        chip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50'
    },
    in_progress: {
        label: '進行中',
        bar: 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/30 ring-red-600/40 text-white',
        dot: 'bg-red-500',
        chip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50'
    },
    completed: {
        label: '完成',
        bar: 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30 ring-emerald-600/40 text-white',
        dot: 'bg-emerald-500',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
    }
}

/* =====================================================================
 * 工具函式
 * ===================================================================== */

/**
 * 依維修單狀態判斷甘特圖進度分類
 * @param status 維修單狀態字串
 */
export function getGanttProgress(status: string): GanttProgress {
    if (COMPLETED_STATUSES.includes(status)) return 'completed'
    if (IN_PROGRESS_STATUSES.includes(status)) return 'in_progress'
    return 'not_started'
}

/**
 * 安全解析 yyyy-MM-dd / ISO 日期字串，無效則回傳 null
 * @param value 日期字串
 */
function safeParse(value?: string | null): Date | null {
    if (!value) return null
    const d = parseISO(value)
    return isValid(d) ? startOfDay(d) : null
}

/** 尚未開始階段資料（開單日、審查日期名稱、審查日期、天數） */
export interface NotStartedPhaseData {
    orderDate: Date | null
    reviewDate: Date | null
    reviewLabel: string // '審查-院長日期' | '審查-副院長日期' | '資材室日期' | '無審查日期'
    days: number | null
    startDate: Date
    endDate: Date | null
    hasRange: boolean
}

/** 進行中 / 施工階段資料 */
export interface InProgressPhaseData {
    startDate: Date
    endDate: Date
    durationDays: number
    isCompleted: boolean
}

/** 計算後的甘特任務項目 */
interface GanttTask {
    order: GanttOrder
    /** 是否具備預計施工開始日期 */
    hasPlanStart: boolean
    /** 時間軸定位基準日 */
    anchorDate: Date
    /** 施工開始日期（僅 hasPlanStart 為 true 時有值，否則為 null） */
    startDate: Date | null
    /** 施工結束日期（施工完成日或預計結束日，無則為 null） */
    endDate: Date | null
    /** 工期天數（無則為 null） */
    durationDays: number | null
    progress: GanttProgress
    /** 是否逾期：未完成且預計結束日早於今天 */
    overdue: boolean
    /** 尚未開始階段 (開單日 ~ 審查完成日) */
    notStartedPhase: NotStartedPhaseData | null
    /** 進行中/施工階段 (施工預計開始日 ~ 施工預計結束日) */
    inProgressPhase: InProgressPhaseData | null
}

/**
 * 將維修單轉為甘特任務
 * - 尚未開始階段 (notStartedPhase)：
 *   開單日 ~ 審查日期 (依順序：院長 > 副院長 > 資材室)；無審查日期則為單點/膠囊
 * - 進行中/施工階段 (inProgressPhase)：
 *   施工預計開始日期 ~ 施工預計結束日期 (或實際施工完成日)
 * @param order 維修單資料
 * @param today 今日日期
 */
function toTask(order: GanttOrder, today: Date): GanttTask | null {
    const progress = getGanttProgress(order.status)
    const planStart = safeParse(order.plan_start_date)
    const planEnd = safeParse(order.plan_end_date)
    const overdue = progress !== 'completed' && !!planEnd && planEnd < today
    const workOrderDate = safeParse(order.work_order_date) ?? safeParse(order.request_date)

    // 1、解析尚未開始階段資訊 (開單日、審查日期名稱、審查日期、天數)
    const deanDate = safeParse(order.rev_dean_date)
    const viceDeanDate = safeParse(order.rev_vice_dean_date)
    const materialDate = safeParse(order.material_date)

    let reviewDate: Date | null = null
    let reviewLabel = '無審查日期'

    if (deanDate) {
        reviewDate = deanDate
        reviewLabel = '審查-院長日期'
    } else if (viceDeanDate) {
        reviewDate = viceDeanDate
        reviewLabel = '審查-副院長日期'
    } else if (materialDate) {
        reviewDate = materialDate
        reviewLabel = '資材室日期'
    }

    let notStartedPhase: NotStartedPhaseData | null = null
    if (workOrderDate) {
        if (reviewDate) {
            let end = reviewDate
            if (end < workOrderDate) end = workOrderDate
            const days = differenceInCalendarDays(end, workOrderDate) + 1
            notStartedPhase = {
                orderDate: workOrderDate,
                reviewDate,
                reviewLabel,
                days,
                startDate: workOrderDate,
                endDate: end,
                hasRange: true
            }
        } else {
            notStartedPhase = {
                orderDate: workOrderDate,
                reviewDate: null,
                reviewLabel: '無審查日期',
                days: null,
                startDate: workOrderDate,
                endDate: null,
                hasRange: false
            }
        }
    }

    // 2、解析進行中 / 施工階段資訊
    let inProgressPhase: InProgressPhaseData | null = null
    if (planStart) {
        const realEnd = safeParse(order.construct_end_date) ?? planEnd
        let end = realEnd ?? planStart
        if (end < planStart) end = planStart
        const days = differenceInCalendarDays(end, planStart) + 1
        inProgressPhase = {
            startDate: planStart,
            endDate: end,
            durationDays: days,
            isCompleted: progress === 'completed'
        }
    }

    // 若既無開單日又無施工開始日，退回 null
    const anchor = inProgressPhase?.startDate ?? notStartedPhase?.startDate ?? workOrderDate ?? planStart
    if (!anchor) return null

    return {
        order,
        hasPlanStart: !!planStart,
        anchorDate: anchor,
        startDate: inProgressPhase?.startDate ?? notStartedPhase?.startDate ?? null,
        endDate: inProgressPhase?.endDate ?? notStartedPhase?.endDate ?? null,
        durationDays: inProgressPhase?.durationDays ?? notStartedPhase?.days ?? null,
        progress,
        overdue,
        notStartedPhase,
        inProgressPhase
    }
}

/** 時間軸刻度片段 */
interface Segment {
    key: string
    label: string
    left: number
    width: number
    weekend?: boolean
}

/**
 * 將時間單位清單轉為刻度片段
 */
function buildSegments(
    units: Date[],
    getEnd: (d: Date) => Date,
    getLabel: (d: Date) => string,
    rangeStart: Date,
    rangeEnd: Date,
    px: number
): Segment[] {
    return units.map((u) => {
        const s = maxDate([u, rangeStart])
        const e = minDate([getEnd(u), rangeEnd])
        return {
            key: u.toISOString(),
            label: getLabel(u),
            left: differenceInCalendarDays(s, rangeStart) * px,
            width: (differenceInCalendarDays(e, s) + 1) * px
        }
    })
}

/* =====================================================================
 * 主元件
 * ===================================================================== */

export default function ProjectGanttChart({
    categories,
    subCategories = [],
    orders,
    onOrderClick,
    scale: controlledScale,
    onScaleChange,
    fillHeight = false,
    extraActions
}: ProjectGanttChartProps) {
    const [internalScale, setInternalScale] = useState<GanttScale>('week')
    const scale = controlledScale !== undefined ? controlledScale : internalScale
    const setScale = (s: GanttScale) => {
        setInternalScale(s)
        onScaleChange?.(s)
    }
    const [hover, setHover] = useState<{
        type: 'task_not_started'
        task: GanttTask
        x: number
        y: number
    } | {
        type: 'task_in_progress'
        task: GanttTask
        x: number
        y: number
    } | {
        type: 'subGroup'
        name: string
        startDate: Date | null
        endDate: Date | null
        durationDays: number | null
        progress: GanttProgress
        doneCount: number
        totalCount: number
        x: number
        y: number
    } | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    const today = useMemo(() => startOfDay(new Date()), [])
    const px = PX_PER_DAY[scale]

    /** 任務轉換 */
    const { tasks, skipped } = useMemo(() => {
        const list: GanttTask[] = []
        let skippedCount = 0
        orders.forEach((o) => {
            const t = toTask(o, today)
            if (t) list.push(t)
            else skippedCount++
        })
        list.sort((a, b) => a.anchorDate.getTime() - b.anchorDate.getTime())
        return { tasks: list, skipped: skippedCount }
    }, [orders, today])

    /** 依主項目與次項目分組 */
    const groups = useMemo(() => {
        const catIds = new Set(categories.map((c) => c.id))
        const result = categories.map((c) => {
            const cTasks = tasks.filter((t) => t.order.maintenance_project_category_id === c.id)
            const cSubs = (subCategories || []).filter((s) => s.maintenance_project_category_id === c.id)
            const subIdSet = new Set(cSubs.map((s) => s.id))

            // 建立次項目列表
            const subGroups: {
                id: string
                name: string
                tasks: GanttTask[]
                startDate: Date | null
                endDate: Date | null
                durationDays: number | null
                progress: GanttProgress
                doneCount: number
                totalCount: number
            }[] = []

            cSubs.forEach((sub) => {
                const subTasks = cTasks.filter((t) => t.order.maintenance_project_sub_category_id === sub.id)
                // 只有當次項目有工單時才顯示在甘特圖中
                if (subTasks.length > 0) {
                    const doneCount = subTasks.filter((t) => t.progress === 'completed').length
                    const totalCount = subTasks.length

                    let subProgress: GanttProgress = 'not_started'
                    if (totalCount > 0) {
                        if (doneCount === totalCount) {
                            subProgress = 'completed'
                        } else if (subTasks.some((t) => t.progress === 'in_progress') || doneCount > 0) {
                            subProgress = 'in_progress'
                        }
                    }

                    // 計算該次項目的時程跨度
                    const dates: Date[] = []
                    subTasks.forEach((t) => {
                        if (t.startDate) dates.push(t.startDate)
                        if (t.endDate) dates.push(t.endDate)
                        if (!t.startDate && !t.endDate) dates.push(t.anchorDate)
                    })
                    const sStart = dates.length > 0 ? minDate(dates) : null
                    const sEnd = dates.length > 0 ? maxDate(dates) : null
                    const sDuration = sStart && sEnd ? differenceInCalendarDays(sEnd, sStart) + 1 : null

                    subGroups.push({
                        id: sub.id,
                        name: sub.maintenance_sub_category_name,
                        tasks: subTasks,
                        startDate: sStart,
                        endDate: sEnd,
                        durationDays: sDuration,
                        progress: subProgress,
                        doneCount,
                        totalCount
                    })
                }
            })

            // 屬於該主項目但未指定次項目的工單
            const directTasks = cTasks.filter((t) => !t.order.maintenance_project_sub_category_id || !subIdSet.has(t.order.maintenance_project_sub_category_id))

            // 主項目整體時程
            const allDates: Date[] = []
            cTasks.forEach((t) => {
                if (t.startDate) allDates.push(t.startDate)
                if (t.endDate) allDates.push(t.endDate)
                if (!t.startDate && !t.endDate) allDates.push(t.anchorDate)
            })
            const cStart = allDates.length > 0 ? minDate(allDates) : null
            const cEnd = allDates.length > 0 ? maxDate(allDates) : null

            return {
                id: c.id,
                name: c.maintenance_category_name,
                tasks: cTasks,
                subGroups,
                directTasks,
                startDate: cStart,
                endDate: cEnd,
                doneCount: cTasks.filter((t) => t.progress === 'completed').length,
                totalCount: cTasks.length
            }
        })

        // 未指定專案主項目之工單
        const uncategorizedTasks = tasks.filter(
            (t) => !t.order.maintenance_project_category_id || !catIds.has(t.order.maintenance_project_category_id)
        )
        if (uncategorizedTasks.length > 0) {
            const allDates: Date[] = []
            uncategorizedTasks.forEach((t) => {
                if (t.startDate) allDates.push(t.startDate)
                if (t.endDate) allDates.push(t.endDate)
                if (!t.startDate && !t.endDate) allDates.push(t.anchorDate)
            })
            result.push({
                id: '__uncategorized__',
                name: '未指定專案主項目',
                tasks: uncategorizedTasks,
                subGroups: [],
                directTasks: uncategorizedTasks,
                startDate: allDates.length > 0 ? minDate(allDates) : null,
                endDate: allDates.length > 0 ? maxDate(allDates) : null,
                doneCount: uncategorizedTasks.filter((t) => t.progress === 'completed').length,
                totalCount: uncategorizedTasks.length
            })
        }

        return result.filter((g) => g.tasks.length > 0)
    }, [categories, subCategories, tasks])

    /** 時間軸範圍：週與月尺度擴充兩端安全留白，以確保進度條兩側日期標籤完整可見不被截斷 */
    const range = useMemo(() => {
        if (tasks.length === 0) return null
        const allDates: Date[] = []
        tasks.forEach((t) => {
            allDates.push(t.anchorDate)
            if (t.notStartedPhase?.startDate) allDates.push(t.notStartedPhase.startDate)
            if (t.notStartedPhase?.endDate) allDates.push(t.notStartedPhase.endDate)
            if (t.inProgressPhase?.startDate) allDates.push(t.inProgressPhase.startDate)
            if (t.inProgressPhase?.endDate) allDates.push(t.inProgressPhase.endDate)
        })
        const padDays = scale === 'month' ? 35 : scale === 'week' ? 14 : 1
        const rawStart = addDays(minDate(allDates), -padDays)
        const rawEnd = addDays(maxDate(allDates), padDays + 2)
        if (scale === 'month') return { start: startOfMonth(rawStart), end: endOfMonth(rawEnd) }
        if (scale === 'week') {
            return { start: startOfWeek(rawStart, { weekStartsOn: 1 }), end: endOfWeek(rawEnd, { weekStartsOn: 1 }) }
        }
        return { start: rawStart, end: rawEnd }
    }, [tasks, scale])

    const timelineW = range ? (differenceInCalendarDays(range.end, range.start) + 1) * px : 0

    /** 表頭刻度 */
    const { topSegments, bottomSegments } = useMemo(() => {
        if (!range) return { topSegments: [] as Segment[], bottomSegments: [] as Segment[] }
        const interval = { start: range.start, end: range.end }
        if (scale === 'day') {
            return {
                topSegments: buildSegments(eachMonthOfInterval(interval), endOfMonth, (d) => format(d, 'yyyy 年 M 月'), range.start, range.end, px),
                bottomSegments: eachDayOfInterval(interval).map((d) => ({
                    key: d.toISOString(),
                    label: format(d, 'd'),
                    left: differenceInCalendarDays(d, range.start) * px,
                    width: px,
                    weekend: isWeekend(d)
                }))
            }
        }
        if (scale === 'week') {
            return {
                topSegments: buildSegments(eachMonthOfInterval(interval), endOfMonth, (d) => format(d, 'yyyy/MM'), range.start, range.end, px),
                bottomSegments: buildSegments(
                    eachWeekOfInterval(interval, { weekStartsOn: 1 }),
                    (d) => endOfWeek(d, { weekStartsOn: 1 }),
                    (d) => format(d, 'M/d'),
                    range.start, range.end, px
                )
            }
        }
        return {
            topSegments: buildSegments(eachYearOfInterval(interval), endOfYear, (d) => format(d, 'yyyy 年'), range.start, range.end, px),
            bottomSegments: buildSegments(eachMonthOfInterval(interval), endOfMonth, (d) => format(d, 'M月'), range.start, range.end, px)
        }
    }, [range, scale, px])

    /** 今日位置 */
    const todayLeft = useMemo(() => {
        if (!range || today < range.start || today > range.end) return null
        return differenceInCalendarDays(today, range.start) * px + px / 2
    }, [range, today, px])

    /** 統計數值 */
    const stats = useMemo(() => {
        const s = { not_started: 0, in_progress: 0, completed: 0, overdue: 0 }
        tasks.forEach((t) => {
            s[t.progress]++
            if (t.overdue) s.overdue++
        })
        const rate = tasks.length > 0 ? Math.round((s.completed / tasks.length) * 100) : 0
        return { ...s, rate }
    }, [tasks])

    /** 捲動至今日 */
    const scrollToToday = useCallback(() => {
        const el = scrollRef.current
        if (!el || todayLeft === null) return
        el.scrollTo({ left: Math.max(todayLeft - (el.clientWidth - LEFT_W) / 2, 0), behavior: 'smooth' })
    }, [todayLeft])

    useEffect(() => {
        scrollToToday()
    }, [scrollToToday])

    /** 判斷單一維修單的尚未開始進度條與進行中進度條在時間軸上是否交疊 */
    const isTaskOverlap = (t: GanttTask): boolean => {
        if (!t.notStartedPhase || !t.inProgressPhase || !range) return false
        const nsLeft = differenceInCalendarDays(t.notStartedPhase.startDate, range.start) * px
        const nsWidth = t.notStartedPhase.hasRange && t.notStartedPhase.endDate
            ? Math.max((differenceInCalendarDays(t.notStartedPhase.endDate, t.notStartedPhase.startDate) + 1) * px, 150)
            : 110
        const ipLeft = differenceInCalendarDays(t.inProgressPhase.startDate, range.start) * px
        const ipWidth = Math.max((differenceInCalendarDays(t.inProgressPhase.endDate, t.inProgressPhase.startDate) + 1) * px, 150)
        return (nsLeft < (ipLeft + ipWidth) && (nsLeft + nsWidth) > ipLeft)
    }

    // 計算內容區總高度 (主項目 + 次項目列 + 各任務列，自適應重疊高度)
    const bodyH = groups.reduce((sum, g) => {
        let h = GROUP_H
        g.subGroups.forEach((sub) => {
            h += SUB_GROUP_H
            sub.tasks.forEach((t) => {
                h += isTaskOverlap(t) ? 52 : ROW_H
            })
        })
        if (g.subGroups.length === 0) {
            g.directTasks.forEach((t) => {
                h += isTaskOverlap(t) ? 52 : ROW_H
            })
        } else if (g.directTasks.length > 0) {
            h += SUB_GROUP_H
            g.directTasks.forEach((t) => {
                h += isTaskOverlap(t) ? 52 : ROW_H
            })
        }
        return sum + h
    }, 0)

    if (tasks.length === 0) {
        return (
            <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-[16px] bg-slate-50/50 dark:bg-slate-900/20">
                <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-60" />
                目前沒有可顯示的維修單
            </div>
        )
    }

    /** 渲染單個工單橫列的輔助函式：完整呈現尚未開始與進行中兩階段進度條 */
    const renderTaskRow = (t: GanttTask, indentLevel: 'sub' | 'direct') => {
        const plClass = indentLevel === 'sub' ? 'pl-12' : 'pl-7'
        const hasOverlap = isTaskOverlap(t)
        const rowH = hasOverlap ? 52 : ROW_H
        const currentStyle = GANTT_PROGRESS_STYLE[t.progress]

        // 1. 尚未開始階段進度條（開單日 ~ 審查日期）
        const nsPhase = t.notStartedPhase
        const nsStyle = GANTT_PROGRESS_STYLE['not_started']
        let nsBarElement: React.ReactNode = null

        if (nsPhase && range) {
            const nsLeft = differenceInCalendarDays(nsPhase.startDate, range.start) * px
            const nsPosClass = hasOverlap ? 'top-1.5' : 'top-1/2 -translate-y-1/2'
            const nsHeightClass = hasOverlap ? 'h-5' : 'h-6'

            if (nsPhase.hasRange && nsPhase.endDate) {
                const dayDiff = differenceInCalendarDays(nsPhase.endDate, nsPhase.startDate) + 1
                const actualWidth = dayDiff * px
                const isSameDay = nsPhase.startDate.getTime() === nsPhase.endDate.getTime()
                const startText = format(nsPhase.startDate, 'yyyy/MM/dd')
                const endText = format(nsPhase.endDate, 'yyyy/MM/dd')
                const minWidth = isSameDay ? 150 : 160
                const width = Math.max(actualWidth, minWidth)

                nsBarElement = (
                    <div
                        className={`absolute ${nsPosClass} flex items-center z-10`}
                        style={{ left: nsLeft }}
                    >
                        <button
                            type="button"
                            onClick={() => onOrderClick?.(t.order.id)}
                            onMouseEnter={(e) => setHover({ type: 'task_not_started', task: t, x: e.clientX, y: e.clientY })}
                            onMouseMove={(e) => setHover(prev => prev && prev.type === 'task_not_started' ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                            onMouseLeave={() => setHover(null)}
                            className={`${nsHeightClass} rounded-md shadow-md ring-1 ${nsStyle.bar} hover:brightness-110 hover:scale-y-105 transition-all duration-200 flex items-center justify-between px-2 overflow-hidden select-none cursor-pointer`}
                            style={{ width }}
                            title={`${t.order.work_order_id} 尚未開始 (${startText} ~ ${endText})`}
                        >
                            {/* 最左邊內側開單日 */}
                            <span className="text-[10px] font-mono font-bold text-white shrink-0 drop-shadow-sm select-none">
                                {startText}
                            </span>

                            {/* 中間輔助文字 */}
                            {width >= 240 && (
                                <span className="text-[11px] font-bold text-white truncate px-1.5 drop-shadow-sm">
                                    尚未開始
                                </span>
                            )}

                            {/* 最右邊內側審查日 */}
                            <span className="text-[10px] font-mono font-bold text-white shrink-0 drop-shadow-sm select-none ml-auto">
                                {endText}
                            </span>
                        </button>
                    </div>
                )
            } else {
                // 無審查日期：顯示開單日 + 狀態膠囊
                const startText = format(nsPhase.startDate, 'yyyy/MM/dd')
                nsBarElement = (
                    <button
                        type="button"
                        onClick={() => onOrderClick?.(t.order.id)}
                        onMouseEnter={(e) => setHover({ type: 'task_not_started', task: t, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setHover(prev => prev && prev.type === 'task_not_started' ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                        onMouseLeave={() => setHover(null)}
                        className={`absolute z-10 ${nsPosClass} ${nsHeightClass} px-2.5 rounded-md shadow-md ring-1 ${nsStyle.bar} hover:brightness-110 hover:scale-105 transition-all duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer`}
                        style={{ left: nsLeft }}
                        title={`${t.order.work_order_id} (${startText}) - 尚未開始`}
                    >
                        <span className="text-[10px] font-mono font-bold text-white/95 drop-shadow-sm select-none">
                            {startText}
                        </span>
                        <span className="text-[11px] font-bold text-white tracking-wide drop-shadow-sm">
                            尚未開始
                        </span>
                    </button>
                )
            }
        }

        // 2. 進行中 / 施工階段進度條（施工預計開始日 ~ 施工預計結束日）
        const ipPhase = t.inProgressPhase
        let ipBarElement: React.ReactNode = null

        if (ipPhase && range) {
            const ipLeft = differenceInCalendarDays(ipPhase.startDate, range.start) * px
            const ipPosClass = hasOverlap ? 'bottom-1.5' : 'top-1/2 -translate-y-1/2'
            const ipHeightClass = hasOverlap ? 'h-5' : 'h-6'
            const dayDiff = differenceInCalendarDays(ipPhase.endDate, ipPhase.startDate) + 1
            const actualWidth = dayDiff * px
            const isSameDay = ipPhase.startDate.getTime() === ipPhase.endDate.getTime()
            const startText = format(ipPhase.startDate, 'yyyy/MM/dd')
            const endText = format(ipPhase.endDate, 'yyyy/MM/dd')
            const minWidth = isSameDay ? 150 : 160
            const width = Math.max(actualWidth, minWidth)
            const middleText = t.order.vendor_name || t.order.status
            const progressStyle = GANTT_PROGRESS_STYLE[t.progress]

            ipBarElement = (
                <div
                    className={`absolute ${ipPosClass} flex items-center z-10`}
                    style={{ left: ipLeft }}
                >
                    <button
                        type="button"
                        onClick={() => onOrderClick?.(t.order.id)}
                        onMouseEnter={(e) => setHover({ type: 'task_in_progress', task: t, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setHover(prev => prev && prev.type === 'task_in_progress' ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                        onMouseLeave={() => setHover(null)}
                        className={`${ipHeightClass} rounded-md shadow-md ring-1 ${progressStyle.bar} hover:brightness-110 hover:scale-y-105 transition-all duration-200 flex items-center justify-between px-2 overflow-hidden select-none cursor-pointer
                            ${t.overdue ? 'outline outline-2 outline-offset-1 outline-amber-400' : ''}`}
                        style={{ width }}
                        title={`${t.order.work_order_id} 施工時程 (${startText} ~ ${endText})`}
                    >
                        {/* 最左邊內側施工預計開始日 */}
                        <span className="text-[10px] font-mono font-bold text-white shrink-0 drop-shadow-sm select-none">
                            {startText}
                        </span>

                        {/* 中間輔助文字 */}
                        {width >= 240 && (
                            <span className="text-[11px] font-bold text-white truncate px-1.5 drop-shadow-sm">
                                {middleText}
                            </span>
                        )}

                        {/* 最右邊內側施工預計結束日 */}
                        <span className="text-[10px] font-mono font-bold text-white shrink-0 drop-shadow-sm select-none ml-auto">
                            {endText}
                        </span>
                    </button>
                </div>
            )
        }

        return (
            <div
                key={t.order.id}
                className="relative flex border-b border-slate-100 dark:border-slate-800/60 hover:bg-blue-50/40 dark:hover:bg-slate-800/30 transition-colors group/row"
                style={{ height: rowH }}
            >
                {/* 左欄：工單資訊 */}
                <div
                    className={`sticky left-0 z-20 shrink-0 flex items-center gap-2 ${plClass} pr-3 bg-white dark:bg-slate-950 group-hover/row:bg-blue-50 dark:group-hover/row:bg-slate-900 border-r border-slate-200 dark:border-slate-800 cursor-pointer`}
                    style={{ width: LEFT_W }}
                    onClick={() => onOrderClick?.(t.order.id)}
                    title={t.order.maintain_content ?? ''}
                >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${currentStyle.dot}`} />
                    <span className="text-[13px] font-bold font-mono text-blue-600 dark:text-blue-400 shrink-0">{t.order.work_order_id}</span>
                    <span className="text-[13px] text-slate-600 dark:text-slate-300 truncate">{t.order.maintain_content || '-'}</span>
                    {t.overdue && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                </div>

                {/* 右側：進度條 (同時呈現尚未開始與進行中) */}
                <div className="relative shrink-0" style={{ width: timelineW }}>
                    {nsBarElement}
                    {ipBarElement}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3 w-0 min-w-full">
            {/* ===== 工具列 ===== */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {(Object.keys(GANTT_PROGRESS_STYLE) as GanttProgress[]).map((k) => (
                        <span
                            key={k}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[13px] font-semibold ${GANTT_PROGRESS_STYLE[k].chip}`}
                        >
                            <span className={`w-2.5 h-2.5 rounded-full ${GANTT_PROGRESS_STYLE[k].dot}`} />
                            {GANTT_PROGRESS_STYLE[k].label} {stats[k]}
                        </span>
                    ))}
                    {stats.overdue > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[13px] font-semibold bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            逾期 {stats.overdue}
                        </span>
                    )}
                    <div className="flex items-center gap-2 ml-1">
                        <div className="w-28 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                                style={{ width: `${stats.rate}%` }}
                            />
                        </div>
                        <span className="text-[13px] font-bold text-slate-600 dark:text-slate-300">完成率 {stats.rate}%</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {extraActions}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={scrollToToday}
                        disabled={todayLeft === null}
                        className="h-8 px-3 gap-1.5 rounded-lg text-[13px] font-semibold"
                    >
                        <Crosshair className="w-3.5 h-3.5" />
                        今天
                    </Button>
                    <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-lg border border-slate-200/40 dark:border-slate-700/40">
                        {(['day', 'week', 'month'] as GanttScale[]).map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setScale(s)}
                                className={`px-3 h-6 rounded-md text-[13px] font-bold transition-all duration-200 ${scale === s
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                                {s === 'day' ? '日' : s === 'week' ? '週' : '月'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== 甘特圖主體 ===== */}
            <div
                ref={scrollRef}
                className={`relative overflow-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm ${
                    fillHeight ? 'flex-1 min-h-[480px] max-h-[calc(92vh-160px)]' : 'max-h-[560px]'
                }`}
            >
                <div id="gantt-chart-full-inner" className="relative bg-white dark:bg-slate-950" style={{ width: LEFT_W + timelineW }}>


                    {/* 表頭 */}
                    <div className="sticky top-0 z-30 flex bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                        <div
                            className="sticky left-0 z-40 shrink-0 flex items-end px-4 pb-1.5 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-[13px] font-bold text-slate-500 dark:text-slate-400"
                            style={{ width: LEFT_W, height: HEADER_TOP_H + HEADER_BOTTOM_H }}
                        >
                            主項目 / 次項目 / 工單
                        </div>
                        <div className="relative shrink-0" style={{ width: timelineW, height: HEADER_TOP_H + HEADER_BOTTOM_H }}>
                            {topSegments.map((seg) => (
                                <div
                                    key={`t-${seg.key}`}
                                    className="absolute top-0 flex items-center px-2 border-l border-slate-200 dark:border-slate-800 text-[12px] font-bold text-slate-600 dark:text-slate-300 overflow-hidden whitespace-nowrap"
                                    style={{ left: seg.left, width: seg.width, height: HEADER_TOP_H }}
                                >
                                    {seg.label}
                                </div>
                            ))}
                            {bottomSegments.map((seg) => (
                                <div
                                    key={`b-${seg.key}`}
                                    className={`absolute flex items-center justify-center border-l border-t border-slate-200 dark:border-slate-800 text-[11px] font-medium overflow-hidden whitespace-nowrap ${seg.weekend ? 'text-rose-400 bg-slate-100/80 dark:bg-slate-800/40' : 'text-slate-500 dark:text-slate-400'}`}
                                    style={{ left: seg.left, width: seg.width, top: HEADER_TOP_H, height: HEADER_BOTTOM_H }}
                                >
                                    {seg.label}
                                </div>
                            ))}
                            {todayLeft !== null && (
                                <div
                                    className="absolute bottom-0 -translate-x-1/2 px-1.5 py-0.5 rounded-t-md bg-amber-500 text-white text-[10px] font-bold whitespace-nowrap"
                                    style={{ left: todayLeft }}
                                >
                                    今天
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 內容區 */}
                    <div className="relative" style={{ height: bodyH }}>
                        {/* 週末背景格線 */}
                        <div className="absolute top-0 bottom-0 z-0 pointer-events-none" style={{ left: LEFT_W, width: timelineW }}>
                            {bottomSegments.map((seg) => (
                                <div
                                    key={`g-${seg.key}`}
                                    className={`absolute top-0 bottom-0 border-l border-slate-100 dark:border-slate-800/60 ${seg.weekend ? 'bg-slate-50 dark:bg-slate-900/40' : ''}`}
                                    style={{ left: seg.left, width: seg.width }}
                                />
                            ))}
                        </div>

                        {/* 今日垂直線 */}
                        {todayLeft !== null && (
                            <div
                                className="absolute top-0 bottom-0 z-[15] w-0.5 bg-amber-500/80 pointer-events-none shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                                style={{ left: LEFT_W + todayLeft - 1 }}
                            />
                        )}

                        {/* 分組與任務列 */}
                        {groups.map((g) => {
                            return (
                                <div key={g.id}>
                                    {/* 1. 主項目分組列：含標題與灰色時程跨度條 */}
                                    <div className="relative flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50" style={{ height: GROUP_H }}>
                                        <div
                                            className="sticky left-0 z-20 shrink-0 flex items-center gap-2 px-4 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"
                                            style={{ width: LEFT_W }}
                                        >
                                            <div className={`w-1.5 h-4 rounded-full ${g.id === '__uncategorized__' ? 'bg-amber-500' : 'bg-gradient-to-b from-blue-500 to-indigo-500'}`} />
                                            <span className="text-[14px] font-bold text-slate-800 dark:text-slate-200 truncate">{g.name}</span>
                                            <span className="ml-auto text-[12px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">{g.doneCount}/{g.totalCount}</span>
                                        </div>
                                        {/* 右側時間軸：主項目灰色時程跨度條，週與月尺度兩側標註日期 */}
                                        <div className="relative shrink-0" style={{ width: timelineW }}>
                                            {range && g.startDate && g.endDate && (
                                                (() => {
                                                    const gLeft = differenceInCalendarDays(g.startDate, range.start) * px
                                                    const gWidth = Math.max((differenceInCalendarDays(g.endDate, g.startDate) + 1) * px, 12)
                                                    const showEdgeDates = (scale === 'week' || scale === 'month')
                                                    return (
                                                        <div
                                                            className="absolute top-1/2 -translate-y-1/2 flex items-center"
                                                            style={{ left: gLeft }}
                                                        >
                                                            {showEdgeDates && (
                                                                <span className="absolute right-full mr-2 text-[9.5px] font-mono font-semibold text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/90 px-1 py-0.5 rounded shadow-2xs whitespace-nowrap select-none pointer-events-none">
                                                                    {format(g.startDate, 'yyyy/MM/dd')}
                                                                </span>
                                                            )}
                                                            <div
                                                                className="h-2 rounded-full bg-slate-300/80 dark:bg-slate-700/80 shadow-sm"
                                                                style={{ width: gWidth }}
                                                                title={`${g.name} 整體時程跨度`}
                                                            />
                                                            {showEdgeDates && (
                                                                <span className="absolute left-full ml-2 text-[9.5px] font-mono font-semibold text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/90 px-1 py-0.5 rounded shadow-2xs whitespace-nowrap select-none pointer-events-none">
                                                                    {format(g.endDate, 'yyyy/MM/dd')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                })()
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. 主項目直屬工單（若有）：顯示在主項目正下方 */}
                                    {g.directTasks.length > 0 && (
                                        <>
                                            {g.subGroups.length > 0 && (
                                                <div
                                                    className="relative flex border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/20"
                                                    style={{ height: SUB_GROUP_H }}
                                                >
                                                    <div
                                                        className="sticky left-0 z-20 shrink-0 flex items-center gap-1.5 pl-7 pr-3 bg-slate-50/80 dark:bg-slate-900/80 border-r border-slate-200 dark:border-slate-800"
                                                        style={{ width: LEFT_W }}
                                                    >
                                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-900/40 px-1.5 py-0.5 rounded shrink-0">
                                                            主項目直屬工單
                                                        </span>
                                                        <span className="ml-auto text-[11px] font-mono font-semibold text-slate-500 shrink-0">
                                                            {g.directTasks.filter(t => t.progress === 'completed').length}/{g.directTasks.length}
                                                        </span>
                                                    </div>
                                                    <div className="relative shrink-0" style={{ width: timelineW }} />
                                                </div>
                                            )}
                                            {g.directTasks.map((t) => renderTaskRow(t, g.subGroups.length > 0 ? 'sub' : 'direct'))}
                                        </>
                                    )}
                                    
                                    {/* 3. 專案次項目（再次發包工程）：顯示在主項目直屬工單下方 */}
                                    {g.subGroups.length > 0 && (
                                        <>
                                            {g.subGroups.map((sub) => {
                                                const subStyle = GANTT_PROGRESS_STYLE[sub.progress]
                                                return (
                                                    <div key={sub.id}>
                                                        {/* 次項目進度列 */}
                                                        <div
                                                            className="relative flex border-b border-slate-100 dark:border-slate-800/80 bg-purple-50/20 dark:bg-purple-950/10"
                                                            style={{ height: SUB_GROUP_H }}
                                                        >
                                                            {/* 左側：次項目標籤與名稱 */}
                                                            <div
                                                                className="sticky left-0 z-20 shrink-0 flex items-center gap-1.5 pl-7 pr-3 bg-slate-50/90 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800"
                                                                style={{ width: LEFT_W }}
                                                            >
                                                                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded shrink-0">
                                                                    次項目
                                                                </span>
                                                                <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">
                                                                    {sub.name}
                                                                </span>
                                                                <span className="ml-auto text-[11px] font-mono font-semibold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-200/60 dark:border-purple-800/40 shrink-0">
                                                                    {sub.doneCount}/{sub.totalCount}
                                                                </span>
                                                            </div>
                                    
                                                            {/* 右側時間軸：專案次項目進度條，週與月尺度兩側標註日期 */}
                                                            <div className="relative shrink-0" style={{ width: timelineW }}>
                                                                {range && sub.startDate && sub.endDate && (
                                                                    (() => {
                                                                        const subLeft = differenceInCalendarDays(sub.startDate, range.start) * px
                                                                        const subWidth = Math.max((differenceInCalendarDays(sub.endDate, sub.startDate) + 1) * px, 18)
                                                                        const showEdgeDates = (scale === 'week' || scale === 'month')
                                                                        return (
                                                                            <div
                                                                                className="absolute top-1/2 -translate-y-1/2 flex items-center z-10"
                                                                                style={{ left: subLeft }}
                                                                            >
                                                                                {/* 次項目預計開始日期 (左側) */}
                                                                                {showEdgeDates && (
                                                                                    <span className="absolute right-full mr-2 text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50/95 dark:bg-purple-950/95 px-1 py-0.5 rounded border border-purple-200 dark:border-purple-800 shadow-2xs whitespace-nowrap select-none pointer-events-none">
                                                                                        {format(sub.startDate, 'yyyy/MM/dd')}
                                                                                    </span>
                                                                                )}
                                    
                                                                                <div
                                                                                    onMouseEnter={(e) => setHover({
                                                                                        type: 'subGroup',
                                                                                        name: sub.name,
                                                                                        startDate: sub.startDate,
                                                                                        endDate: sub.endDate,
                                                                                        durationDays: sub.durationDays,
                                                                                        progress: sub.progress,
                                                                                        doneCount: sub.doneCount,
                                                                                        totalCount: sub.totalCount,
                                                                                        x: e.clientX,
                                                                                        y: e.clientY
                                                                                    })}
                                                                                    onMouseMove={(e) => setHover(prev => prev && prev.type === 'subGroup' ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                                                                                    onMouseLeave={() => setHover(null)}
                                                                                    className={`h-4 rounded-md shadow-sm ring-1 ring-black/10 transition-all duration-200 flex items-center px-1.5 overflow-hidden cursor-help ${subStyle.bar}`}
                                                                                    style={{ width: subWidth }}
                                                                                    title={`專案次項目：${sub.name} (進度: ${subStyle.label})`}
                                                                                >
                                                                                    {subWidth > 70 && (
                                                                                        <span className="text-[10px] font-bold text-white truncate drop-shadow-sm">
                                                                                            {sub.name} ({sub.doneCount}/{sub.totalCount})
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                    
                                                                                {/* 次項目預計結束日期 (右側) */}
                                                                                {showEdgeDates && (
                                                                                    <span className="absolute left-full ml-2 text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50/95 dark:bg-purple-950/95 px-1 py-0.5 rounded border border-purple-200 dark:border-purple-800 shadow-2xs whitespace-nowrap select-none pointer-events-none">
                                                                                        {format(sub.endDate, 'yyyy/MM/dd')}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    })()
                                                                )}
                                                            </div>
                                                        </div>
                                    
                                                        {/* 該次項目所屬之工單列表 */}
                                                        {sub.tasks.map((t) => renderTaskRow(t, 'sub'))}
                                                    </div>
                                                )
                                            })}
                                        </>
                                    )}                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* 附註說明 */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-400">
                <span>※ 維修單同時呈現尚未開始（開單至審查發包）與進行中（廠商施工）之完整進度條。</span>
                <span>※ 專案次項目進度條依其下所有維修單之狀態與時程彙整計算。</span>
                {skipped > 0 && <span className="text-amber-500">※ {skipped} 筆工單因無任何接單或開單日期未顯示</span>}
            </div>

            {/* ===== 懸停 Tooltip ===== */}
            {hover && hover.type === 'task_not_started' && (
                <div
                    className="fixed z-[100] pointer-events-none w-72 p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl text-[13px] space-y-1.5 animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 300),
                        top: hover.y + 16
                    }}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/60 pb-1.5">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{hover.task.order.work_order_id}</span>
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${GANTT_PROGRESS_STYLE['not_started'].chip}`}>
                            尚未開始
                        </span>
                    </div>
                    <div className="text-slate-800 dark:text-slate-100 font-medium line-clamp-2">{hover.task.order.maintain_content || '-'}</div>
                    <div className="grid grid-cols-[85px_1fr] gap-y-0.5 text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">維修單狀態</span>
                        <span>{hover.task.order.status}</span>
                        <span className="text-slate-400">開單日</span>
                        <span className="font-mono">{hover.task.notStartedPhase?.orderDate ? format(hover.task.notStartedPhase.orderDate, 'yyyy/MM/dd') : '無'}</span>
                        <span className="text-slate-400">{hover.task.notStartedPhase?.reviewLabel || '審查日期'}</span>
                        <span className="font-mono">{hover.task.notStartedPhase?.reviewDate ? format(hover.task.notStartedPhase.reviewDate, 'yyyy/MM/dd') : '無'}</span>
                        <span className="text-slate-400">天數</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {hover.task.notStartedPhase?.days !== null && hover.task.notStartedPhase?.days !== undefined ? `${hover.task.notStartedPhase.days} 天` : '尚未審查'}
                        </span>
                    </div>
                </div>
            )}

            {hover && hover.type === 'task_in_progress' && (
                <div
                    className="fixed z-[100] pointer-events-none w-72 p-3 rounded-xl border border-red-200 dark:border-red-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl text-[13px] space-y-1.5 animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 300),
                        top: hover.y + 16
                    }}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-red-100 dark:border-red-900/60 pb-1.5">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{hover.task.order.work_order_id}</span>
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${GANTT_PROGRESS_STYLE[hover.task.progress].chip}`}>
                            {GANTT_PROGRESS_STYLE[hover.task.progress].label}
                        </span>
                    </div>
                    <div className="text-slate-800 dark:text-slate-100 font-medium line-clamp-2">{hover.task.order.maintain_content || '-'}</div>
                    <div className="grid grid-cols-[85px_1fr] gap-y-0.5 text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">狀態</span><span>{hover.task.order.status}</span>
                        <span className="text-slate-400">廠商</span><span>{hover.task.order.vendor_name || '-'}</span>
                        <span className="text-slate-400">承辦人</span><span>{hover.task.order.handler_name || '-'}</span>
                        <span className="text-slate-400">施工開始日</span>
                        <span className="font-mono">{hover.task.inProgressPhase?.startDate ? format(hover.task.inProgressPhase.startDate, 'yyyy/MM/dd') : '無'}</span>
                        <span className="text-slate-400">施工結束日</span>
                        <span className="font-mono">{hover.task.inProgressPhase?.endDate ? format(hover.task.inProgressPhase.endDate, 'yyyy/MM/dd') : '無'}</span>
                        <span className="text-slate-400">工期</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                            {hover.task.inProgressPhase?.durationDays !== undefined ? `${hover.task.inProgressPhase.durationDays} 天` : '無'}
                        </span>
                    </div>
                    {hover.task.overdue && (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" /> 已逾預計結束日
                        </div>
                    )}
                </div>
            )}

            {hover && hover.type === 'subGroup' && (
                <div
                    className="fixed z-[100] pointer-events-none w-72 p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl text-[13px] space-y-1.5 animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 300),
                        top: hover.y + 16
                    }}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-purple-100 dark:border-purple-900/60 pb-1.5">
                        <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            專案次項目進度
                        </span>
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${GANTT_PROGRESS_STYLE[hover.progress].chip}`}>
                            {GANTT_PROGRESS_STYLE[hover.progress].label}
                        </span>
                    </div>
                    <div className="text-slate-800 dark:text-slate-100 font-bold text-[14px]">{hover.name}</div>
                    <div className="grid grid-cols-[64px_1fr] gap-y-0.5 text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">完成進度</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{hover.doneCount} / {hover.totalCount} 筆工單完成</span>
                        <span className="text-slate-400">時程起</span>
                        <span className="font-mono">{hover.startDate ? format(hover.startDate, 'yyyy/MM/dd') : '無'}</span>
                        <span className="text-slate-400">時程迄</span>
                        <span className="font-mono">{hover.endDate ? format(hover.endDate, 'yyyy/MM/dd') : '無'}</span>
                        <span className="text-slate-400">總工期</span>
                        <span>{hover.durationDays !== null ? `${hover.durationDays} 天` : '無'}</span>
                    </div>
                </div>
            )}
        </div>
    )
}

