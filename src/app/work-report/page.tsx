// Work Report List Page - 施工回報列表
import { Suspense } from 'react'
import WorkReportClient from './WorkReportClient'
import { Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

function LoadingFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-muted-foreground">載入中...</p>
            </div>
        </div>
    )
}

export default function WorkReportPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <WorkReportClient />
        </Suspense>
    )
}
