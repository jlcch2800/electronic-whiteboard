import { useState, useMemo, useEffect } from 'react'

type ExtractStringKey<T> = Extract<keyof T, string>
type SortConfig<T> = { key: ExtractStringKey<T>; direction: 'asc' | 'desc' } | null

export function useTableData<T>(data: T[], initialSortKey?: ExtractStringKey<T>) {
    const [page, setPage] = useState(1)
    const [perPage, setPerPage] = useState(10)
    const [sort, setSort] = useState<SortConfig<T>>(initialSortKey ? { key: initialSortKey, direction: 'desc' } : null)

    const handleSort = (key: ExtractStringKey<T>) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sort && sort.key === key && sort.direction === 'asc') direction = 'desc'
        setSort({ key, direction })
        setPage(1) // 排序時重設為第一頁
    }

    const sortedData = useMemo(() => {
        if (!sort) return data
        return [...data].sort((a, b) => {
            const valA = a[sort.key] === null || a[sort.key] === undefined ? '' : a[sort.key]
            const valB = b[sort.key] === null || b[sort.key] === undefined ? '' : b[sort.key]
            if (valA < valB) return sort.direction === 'asc' ? -1 : 1
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [data, sort])

    const totalPages = Math.ceil(sortedData.length / perPage)
    const paginatedData = useMemo(() => {
        const start = (page - 1) * perPage
        return sortedData.slice(start, start + perPage)
    }, [sortedData, page, perPage])

    // 確保頁籤不會超出範圍
    useEffect(() => {
        if (page > 1 && totalPages > 0 && page > totalPages) {
            setPage(totalPages)
        }
    }, [page, totalPages])

    return {
        page,
        setPage,
        perPage,
        setPerPage,
        sort,
        handleSort,
        sortedData,
        paginatedData,
        totalPages,
        totalItems: data.length
    }
}
