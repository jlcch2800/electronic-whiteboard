import StatusDetailPageClient from './StatusDetailPageClient'

export const dynamic = 'force-dynamic'

export default async function StatusDetailPage({ params }: { params: { status: string } }) {
    // 解碼 URL 中的狀態字串
    const decodedStatus = decodeURIComponent(params.status)
    return <StatusDetailPageClient status={decodedStatus} />
}
