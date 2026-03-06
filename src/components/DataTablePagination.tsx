import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface DataTablePaginationProps {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    onPageChange: (page: number) => void
    onItemsPerPageChange: (value: number) => void
    selectedCount?: number
}

export function DataTablePagination({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    selectedCount = 0,
}: DataTablePaginationProps) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4">
            <div className="flex-1 text-sm text-muted-foreground whitespace-nowrap">
                {selectedCount > 0 ? (
                    <>已選取 {selectedCount} / {totalItems} 筆</>
                ) : (
                    <>共 {totalItems} 筆資料</>
                )}
            </div>
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 lg:space-x-8">
                <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-foreground/70">每頁筆數</p>
                    <Select
                        value={`${itemsPerPage}`}
                        onValueChange={(value) => onItemsPerPageChange(Number(value))}
                    >
                        <SelectTrigger className="h-8 w-[70px] bg-background">
                            <SelectValue placeholder={itemsPerPage} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 20, 50, 100].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex w-auto items-center justify-center text-sm font-medium text-foreground/70 space-x-2">
                    <span>第</span>
                    <Select
                        value={`${currentPage}`}
                        onValueChange={(value) => onPageChange(Number(value))}
                        disabled={totalPages <= 1}
                    >
                        <SelectTrigger className="h-8 w-[60px] bg-background">
                            <SelectValue placeholder={currentPage} />
                        </SelectTrigger>
                        <SelectContent side="top" className="max-h-[200px]">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <SelectItem key={page} value={`${page}`}>
                                    {page}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span>頁，共 {totalPages} 頁</span>
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0 bg-background active:scale-95 transition-transform"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1 || totalPages === 0}
                    >
                        <span className="sr-only">Go to first page</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0 bg-background active:scale-95 transition-transform"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1 || totalPages === 0}
                    >
                        <span className="sr-only">Go to previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0 bg-background active:scale-95 transition-transform"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || totalPages === 0}
                    >
                        <span className="sr-only">Go to next page</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0 bg-background active:scale-95 transition-transform"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage >= totalPages || totalPages === 0}
                    >
                        <span className="sr-only">Go to last page</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
