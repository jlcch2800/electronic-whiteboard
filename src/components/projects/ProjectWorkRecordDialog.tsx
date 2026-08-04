'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import {
    X,
    FileText,
    Image as ImageIcon,
    Video as VideoIcon,
    UploadCloud,
    Download,
    Trash2,
    Loader2,
    Calendar,
    User,
    MapPin,
    Clock,
    Paperclip,
    Search,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    Grid,
    List,
    RefreshCw,
    FolderArchive
} from 'lucide-react'
import * as XLSX from 'xlsx'
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

import { createClient } from '@/lib/supabase/client'
import { logChangeRecord } from '@/lib/change-log'
import { useToast } from '@/hooks/use-toast'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { exportToPdfFile } from '@/lib/export-utils'
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// 圖片壓縮輔助函數：大於 1MB 的照片壓縮至約 1MB
const compressImage = (file: File): Promise<Blob | File> => {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/') || file.size <= 1024 * 1024) {
            resolve(file)
            return
        }
        
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target?.result as string
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height
                
                // 限制最大寬高以避免處理超大圖導致效能受影響
                const MAX_WIDTH = 1920
                const MAX_HEIGHT = 1080
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width
                        width = MAX_WIDTH
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height
                        height = MAX_HEIGHT
                    }
                }
                
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(img, 0, 0, width, height)
                
                let quality = 0.8
                const getBlob = (q: number): Promise<Blob> => {
                    return new Promise((res) => {
                        canvas.toBlob((blob) => {
                            if (blob) res(blob)
                        }, 'image/jpeg', q)
                    })
                }
                
                const tryCompress = async () => {
                    let blob = await getBlob(quality)
                    while (blob.size > 1024 * 1024 && quality > 0.3) {
                        quality -= 0.1
                        blob = await getBlob(quality)
                    }
                    resolve(blob)
                }
                tryCompress()
            }
        }
    })
}

interface ProjectWorkRecordDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId?: string
    projectCategoryId?: string
    workOrderId?: string
    projectOrderId?: string
    maintainContent?: string
    projectName?: string
    categoryName?: string
}

export default function ProjectWorkRecordDialog({
    open,
    onOpenChange,
    projectId,
    projectCategoryId,
    workOrderId,
    projectOrderId,
    maintainContent,
    projectName,
    categoryName
}: ProjectWorkRecordDialogProps) {
    const supabase = createClient()
    const { toast } = useToast()

    const [loading, setLoading] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)

    // 專案與主項目中文顯示名稱
    const [displayProjectName, setDisplayProjectName] = useState(projectName || '')
    const [displayCategoryName, setDisplayCategoryName] = useState(categoryName || '')

    useEffect(() => {
        if (projectName) setDisplayProjectName(projectName)
        if (categoryName) setDisplayCategoryName(categoryName)
    }, [projectName, categoryName])

    // 資料列表
    const [workOrders, setWorkOrders] = useState<any[]>([])
    const [vendorWorks, setVendorWorks] = useState<any[]>([])
    const [attachments, setAttachments] = useState<any[]>([])

    // 選取的施工日誌、照片與施工文件 (篩選下載或匯出)
    const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
    const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
    const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())

    // 上傳與壓縮檔案狀態
    const [uploadingId, setUploadingId] = useState<string | null>(null) // 指向正上傳附件的 vendor_work_id
    const [isZipping, setIsZipping] = useState(false)

    // 三大頁籤：timeline (日誌時間軸), gallery (照片牆), files (文件庫)
    const [activeTab, setActiveTab] = useState<'timeline' | 'gallery' | 'files'>('timeline')

    // 搜尋與篩選狀態
    const [searchKeyword, setSearchKeyword] = useState('')
    const [selectedVendorFilter, setSelectedVendorFilter] = useState('all')
    const [startDateFilter, setStartDateFilter] = useState('')
    const [endDateFilter, setEndDateFilter] = useState('')

    // 折疊月份狀態 (預設展開最新月份)
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

    // Lightbox 大圖檢視狀態
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)

    // 獲取當前登入者
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setCurrentUser(user)
        }
        getUser()
    }, [supabase])

    // 載入所有關聯資料
    const loadRecords = useCallback(async () => {
        if (!projectId && !projectCategoryId && !workOrderId && !projectOrderId) return
        setLoading(true)
        try {
            let targetProjectId = projectId || ''
            let targetCategoryId = projectCategoryId || ''

            // 若缺專案 ID，嘗試由工單號或工程單號查找
            if (!targetProjectId && (workOrderId || projectOrderId)) {
                let matchQuery = supabase
                    .from('maintenance_work_orders')
                    .select('maintenance_project_id, maintenance_project_category_id')
                if (workOrderId) matchQuery = matchQuery.eq('work_order_id', workOrderId)
                else if (projectOrderId) matchQuery = matchQuery.eq('project_order_id', projectOrderId)

                const { data: matchedOrder } = await matchQuery.maybeSingle()
                if (matchedOrder?.maintenance_project_id) {
                    targetProjectId = matchedOrder.maintenance_project_id
                    targetCategoryId = matchedOrder.maintenance_project_category_id || ''
                } else {
                    let matchHistQuery = supabase
                        .from('maintenance_work_orders_history')
                        .select('maintenance_project_id, maintenance_project_category_id')
                    if (workOrderId) matchHistQuery = matchHistQuery.eq('work_order_id', workOrderId)
                    else if (projectOrderId) matchHistQuery = matchHistQuery.eq('project_order_id', projectOrderId)

                    const { data: matchedHistOrder } = await matchHistQuery.maybeSingle()
                    if (matchedHistOrder?.maintenance_project_id) {
                        targetProjectId = matchedHistOrder.maintenance_project_id
                        targetCategoryId = matchedHistOrder.maintenance_project_category_id || ''
                    }
                }
            }

            // 設定名稱
            if (targetProjectId) {
                if (!projectName || !categoryName) {
                    const { data: proj } = await supabase
                        .from('maintenance_project')
                        .select('maintenance_project_name')
                        .eq('id', targetProjectId)
                        .maybeSingle()

                    if (targetCategoryId) {
                        const { data: cat } = await supabase
                            .from('maintenance_project_category')
                            .select('maintenance_category_name')
                            .eq('id', targetCategoryId)
                            .maybeSingle()
                        if (cat) setDisplayCategoryName(cat.maintenance_category_name)
                    }

                    if (proj) setDisplayProjectName(proj.maintenance_project_name)
                }
            } else {
                setDisplayProjectName(projectName || maintainContent || projectOrderId || workOrderId || '專案維修單')
                setDisplayCategoryName(categoryName || '工程施工紀錄')
            }

            // 1. 讀取維修單 (進行中與歷史)
            let ordersQuery = supabase.from('maintenance_work_orders').select('*')
            let histOrdersQuery = supabase.from('maintenance_work_orders_history').select('*')

            if (targetProjectId && targetCategoryId) {
                ordersQuery = ordersQuery.eq('maintenance_project_id', targetProjectId).eq('maintenance_project_category_id', targetCategoryId)
                histOrdersQuery = histOrdersQuery.eq('maintenance_project_id', targetProjectId).eq('maintenance_project_category_id', targetCategoryId)
            } else if (targetProjectId) {
                ordersQuery = ordersQuery.eq('maintenance_project_id', targetProjectId)
                histOrdersQuery = histOrdersQuery.eq('maintenance_project_id', targetProjectId)
            } else if (workOrderId || projectOrderId) {
                const conds: string[] = []
                if (workOrderId) conds.push(`work_order_id.eq.${workOrderId}`)
                if (projectOrderId) conds.push(`project_order_id.eq.${projectOrderId}`)
                ordersQuery = ordersQuery.or(conds.join(','))
                histOrdersQuery = histOrdersQuery.or(conds.join(','))
            }

            const [ordersRes, historyOrdersRes] = await Promise.all([ordersQuery, histOrdersQuery])
            const activeOrders = ordersRes.data || []
            const historyOrders = historyOrdersRes.data || []
            const allOrders = [...activeOrders, ...historyOrders].sort(
                (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            )

            // 2. 讀取廠商工作紀錄 (今日與歷史歸檔)
            let vendorsQuery = supabase.from('vendor_today_work').select('*')
            let historyVendorsQuery = supabase.from('vendor_today_work_history').select('*')

            if (targetProjectId && targetCategoryId) {
                vendorsQuery = vendorsQuery.eq('maintenance_project_id', targetProjectId).eq('maintenance_project_category_id', targetCategoryId)
                historyVendorsQuery = historyVendorsQuery.eq('maintenance_project_id', targetProjectId).eq('maintenance_project_category_id', targetCategoryId)
            } else if (targetProjectId) {
                vendorsQuery = vendorsQuery.eq('maintenance_project_id', targetProjectId)
                historyVendorsQuery = historyVendorsQuery.eq('maintenance_project_id', targetProjectId)
            } else if (workOrderId || projectOrderId) {
                const conds: string[] = []
                if (workOrderId) conds.push(`work_order_id.eq.${workOrderId}`)
                if (projectOrderId) conds.push(`project_order_id.eq.${projectOrderId}`)
                vendorsQuery = vendorsQuery.or(conds.join(','))
                historyVendorsQuery = historyVendorsQuery.or(conds.join(','))
            }

            const [vendorsRes, historyRes] = await Promise.all([vendorsQuery, historyVendorsQuery])
            const activeVendors = vendorsRes.data || []
            const historyVendors = historyRes.data || []
            const allVendors = [...activeVendors, ...historyVendors].sort((a, b) => (b.work_date || '').localeCompare(a.work_date || ''))

            // 3. 讀取所有附件
            let filesQuery = supabase.from('maintenance_project_work_file').select('*')
            if (targetProjectId) {
                filesQuery = filesQuery.eq('maintenance_project_id', targetProjectId)
            } else if (workOrderId || projectOrderId) {
                const conds: string[] = []
                if (workOrderId) conds.push(`work_order_id.eq.${workOrderId}`)
                if (projectOrderId) conds.push(`project_order_id.eq.${projectOrderId}`)
                filesQuery = filesQuery.or(conds.join(','))
            }
            const { data: files } = await filesQuery.order('created_at', { ascending: false })

            setWorkOrders(allOrders)
            setVendorWorks(allVendors)
            setAttachments(files || [])
        } catch (error: any) {
            toast({ title: '載入失敗', description: error.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [projectId, projectCategoryId, workOrderId, projectOrderId, maintainContent, supabase, toast, projectName, categoryName])

    useEffect(() => {
        if (open) {
            loadRecords()
        }
    }, [open, loadRecords])

    // Cloudinary 上傳
    const uploadToCloudinary = async (file: File, resourceType: 'image' | 'video' | 'raw' = 'raw', folderPath: string) => {
        const formData = new FormData()
        formData.append('folder', folderPath)
        formData.append('file', file)
        formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
        formData.append('cloud_name', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!)

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
            { method: 'POST', body: formData }
        )

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Upload failed')
        }

        const data = await response.json()
        return data.secure_url
    }

    // 處理檔案選擇與批次上傳
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, vendorWorkId: string) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        if (files.length > 5) {
            toast({ title: '超過數量限制', description: '一次最多只能選擇 5 個檔案上傳', variant: 'warning' })
            files.splice(5)
        }

        setUploadingId(vendorWorkId)
        try {
            for (const originalFile of files) {
                // 如果是大於 1MB 的圖片，則在瀏覽器端先進行壓縮
                let fileToUpload: Blob | File = originalFile
                if (originalFile.type.startsWith('image/') && originalFile.size > 1024 * 1024) {
                    fileToUpload = await compressImage(originalFile)
                }

                // 將 Blob 包裝成 File 以維持原本的檔名
                const finalFile = fileToUpload instanceof File 
                    ? fileToUpload 
                    : new File([fileToUpload], originalFile.name, { type: originalFile.type })

                let resourceType: 'image' | 'video' | 'raw' = 'raw'
                const fileType = finalFile.type
                if (fileType.startsWith('image/')) {
                    resourceType = 'image'
                } else if (fileType.startsWith('video/')) {
                    resourceType = 'video'
                }

                const vendorWork = vendorWorks.find(v => v.id === vendorWorkId)
                let folderPath = `project-work/${displayProjectName}/${displayCategoryName}`
                if (vendorWork) {
                    const subFolderName = `${vendorWork.work_date || ''}_${vendorWork.vendor_name || ''}_${vendorWork.location || ''}_${vendorWork.work_content || ''}`
                    const cleanSubFolder = subFolderName
                        .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_+|_+$/g, '')
                        .substring(0, 100)

                    if (cleanSubFolder) {
                        folderPath = `${folderPath}/${cleanSubFolder}`
                    }
                }

                const url = await uploadToCloudinary(finalFile, resourceType, folderPath)
                const uploaderName = currentUser?.user_metadata?.name || currentUser?.email || '訪客'

                const payload = {
                    vendor_work_id: vendorWorkId,
                    maintenance_project_id: projectId,
                    maintenance_project_name: displayProjectName,
                    maintenance_category_name: displayCategoryName,
                    folder_name: originalFile.name,
                    uploader_name: uploaderName,
                    file_url: resourceType === 'raw' ? url : '',
                    image_url: resourceType === 'image' ? url : '',
                    video_url: resourceType === 'video' ? url : ''
                }

                const { data, error } = await supabase
                    .from('maintenance_project_work_file')
                    .insert(payload)
                    .select('id')
                    .single()

                if (error) throw error

                logChangeRecord({
                    actionType: 'Insert',
                    modifyTable: 'maintenance_project_work_file',
                    modifyRecordId: data.id,
                    newData: payload
                })
            }

            toast({ title: '上傳成功', description: `已成功上傳 ${files.length} 個附件檔案` })
            loadRecords()
        } catch (error: any) {
            toast({ title: '上傳失敗', description: error.message, variant: 'destructive' })
        } finally {
            setUploadingId(null)
            e.target.value = ''
        }
    }

    // 刪除附件
    const handleDeleteFile = async (fileId: string, fileUrl: string) => {
        if (!window.confirm('確定要刪除此附件檔案嗎？')) return
        try {
            const { error: dbError } = await supabase
                .from('maintenance_project_work_file')
                .delete()
                .eq('id', fileId)

            if (dbError) throw dbError

            if (fileUrl) {
                const urlParts = fileUrl.split('/')
                const uploadIndex = urlParts.indexOf('upload')
                if (uploadIndex !== -1) {
                    const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/')
                    const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'))

                    let resType = 'raw'
                    if (fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
                        resType = 'image'
                    } else if (fileUrl.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
                        resType = 'video'
                    }

                    await fetch('/api/cloudinary/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ publicId, resourceType: resType })
                    })
                }
            }

            logChangeRecord({
                actionType: 'Delete',
                modifyTable: 'maintenance_project_work_file',
                modifyRecordId: fileId,
                oldData: { id: fileId, file_url: fileUrl }
            })

            toast({ title: '刪除成功', description: '附件檔案已刪除' })
            loadRecords()
        } catch (error: any) {
            toast({ title: '刪除失敗', description: error.message, variant: 'destructive' })
        }
    }

    // 匯出 Excel
    const handleExportExcel = () => {
        try {
            const wb = XLSX.utils.book_new()

            // 根據選取的日誌進行過濾，若無選取則預設匯出全部
            const filteredWorkOrders = selectedEvents.size > 0 
                ? workOrders.filter(o => selectedEvents.has(o.id))
                : workOrders;
            const filteredVendorWorks = selectedEvents.size > 0
                ? vendorWorks.filter(v => selectedEvents.has(v.id))
                : vendorWorks;

            const orderData = filteredWorkOrders.map(o => ({
                '工單編號': o.work_order_id || o.order_id || '',
                '日期': o.work_order_date || o.sent_date || '',
                '主項目': displayCategoryName,
                '故障內容/維修原因': o.maintain_content || o.cause || '',
                '處理狀態': o.status || '',
                '維修金額': o.price || 0,
                '備註': o.note || ''
            }))
            const wsOrders = XLSX.utils.json_to_sheet(orderData)
            XLSX.utils.book_append_sheet(wb, wsOrders, '工務維修單')

            const vendorData = filteredVendorWorks.map(v => {
                const rowFiles = attachments.filter(a => a.vendor_work_id === v.id)
                const urls = rowFiles.map(a => a.image_url || a.video_url || a.file_url).join(' \n')
                return {
                    '施工日期': v.work_date || '',
                    '廠商名稱': v.vendor_name || '',
                    '負責人員': v.vendor_contact || '',
                    '到院時間': v.arrival_time || '',
                    '離院時間': v.departure_time || '',
                    '施工地點': v.location || '',
                    '工作證號': v.vendor_badge_id || '',
                    '施工人數': v.head_count || 1,
                    '工作/施工內容': v.work_content || '',
                    '備註': v.note || '',
                    '附件連結': urls
                }
            })
            const wsVendors = XLSX.utils.json_to_sheet(vendorData)
            XLSX.utils.book_append_sheet(wb, wsVendors, '廠商施工日誌')

            XLSX.writeFile(wb, `專案工作紀錄_${displayProjectName}_${displayCategoryName}.xlsx`)
            toast({ title: '匯出成功', description: 'Excel 檔案已下載' })
        } catch (error: any) {
            toast({ title: '匯出失敗', description: error.message, variant: 'destructive' })
        }
    }

    // 列印/匯出 PDF
    const handlePrint = async () => {
        try {
            toast({ title: '正在準備匯出 PDF...', description: '正在載入中文字型，請稍候...' })

            // 根據選取的日誌進行過濾，若無選取則預設匯出全部
            const filteredWorkOrders = selectedEvents.size > 0 
                ? workOrders.filter(o => selectedEvents.has(o.id))
                : workOrders;
            const filteredVendorWorks = selectedEvents.size > 0
                ? vendorWorks.filter(v => selectedEvents.has(v.id))
                : vendorWorks;

            const orderHead = [['工單編號', '日期', '主項目', '故障內容/維修原因', '處理狀態', '維修金額', '備註']]
            const orderBody = filteredWorkOrders.map(o => [
                o.work_order_id || o.order_id || '',
                o.work_order_date || o.sent_date || '',
                displayCategoryName,
                o.maintain_content || o.cause || '',
                o.status || '',
                `NT$ ${(o.price || 0).toLocaleString()}`,
                o.note || ''
            ])

            const vendorHead = [['施工日期', '廠商名稱', '負責人員', '到離院時間', '人數', '施工地點', '施工內容', '備註']]
            const vendorBody = filteredVendorWorks.map(v => [
                v.work_date || '',
                v.vendor_name || '',
                v.vendor_contact || '',
                `${v.arrival_time || '--:--'} ~ ${v.departure_time || '--:--'}`,
                `${v.head_count || 1} 人`,
                v.location || '',
                v.work_content || '',
                v.note || ''
            ])

            await exportToPdfFile({
                title: `專案工作紀錄報告 — ${displayProjectName} (${displayCategoryName})`,
                filenamePrefix: `專案工作紀錄_${displayProjectName}_${displayCategoryName}`,
                orientation: 'landscape',
                themeColor: [2, 132, 199],
                head: orderHead,
                body: orderBody,
                secondTable: {
                    title: '廠商施工日誌',
                    head: vendorHead,
                    body: vendorBody
                }
            })

            toast({ title: 'PDF 匯出成功', description: 'PDF 檔案已下載' })
        } catch (error: any) {
            toast({ title: 'PDF 匯出失敗', description: error.message, variant: 'destructive' })
        }
    }

    // 批次下載選取照片 (打包為 ZIP 壓縮檔)
    const handleDownloadSelectedPhotos = async () => {
        if (selectedPhotos.size === 0 || isZipping) return

        setIsZipping(true)
        toast({ title: '正在打包照片...', description: `準備將 ${selectedPhotos.size} 張照片打包為 ZIP 壓縮檔，請稍候...` })

        try {
            const zip = new JSZip()
            const photosToDownload = photoAttachments.filter(p => selectedPhotos.has(p.id))
            const usedNames = new Set<string>()

            for (let i = 0; i < photosToDownload.length; i++) {
                const photo = photosToDownload[i]
                const url = photo.image_url

                // 取得原始檔名或自動命名
                let originalName = photo.folder_name || `photo_${photo.id}.jpg`
                // 確保副檔名存在
                if (!/\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(originalName)) {
                    originalName += '.jpg'
                }

                // 防止 ZIP 內部檔名重複
                let fileName = originalName
                let counter = 1
                const extIndex = originalName.lastIndexOf('.')
                const nameWithoutExt = extIndex !== -1 ? originalName.substring(0, extIndex) : originalName
                const ext = extIndex !== -1 ? originalName.substring(extIndex) : '.jpg'

                while (usedNames.has(fileName)) {
                    fileName = `${nameWithoutExt}_${counter}${ext}`
                    counter++
                }
                usedNames.add(fileName)

                try {
                    const response = await fetch(url)
                    if (!response.ok) throw new Error(`HTTP error ${response.status}`)
                    const blob = await response.blob()
                    zip.file(fileName, blob)
                } catch (e) {
                    console.error(`下載圖片失敗: ${url}`, e)
                }
            }

            // 產生 ZIP Blob 檔案
            const zipBlob = await zip.generateAsync({ type: 'blob' })

            // 格式化 ZIP 檔名
            const cleanProjectName = (displayProjectName || '專案').replace(/[/\\?%*:|"<>]/g, '_')
            const cleanCategoryName = (displayCategoryName || '').replace(/[/\\?%*:|"<>]/g, '_')
            const dateStr = format(new Date(), 'yyyyMMdd_HHmm')
            const zipFileName = `${cleanProjectName}${cleanCategoryName ? '_' + cleanCategoryName : ''}_施工照片_${dateStr}.zip`

            saveAs(zipBlob, zipFileName)

            toast({ title: '下載成功', description: `已成功下載照片壓縮檔 (${zipFileName})` })
        } catch (error: any) {
            console.error('打包照片失敗:', error)
            toast({ title: '打包失敗', description: error?.message || '產生壓縮檔時發生錯誤', variant: 'destructive' })
        } finally {
            setIsZipping(false)
        }
    }

    // 批次下載選取施工文件 (打包為 ZIP 壓縮檔)
    const handleDownloadSelectedDocs = async () => {
        if (selectedDocs.size === 0 || isZipping) return

        setIsZipping(true)
        toast({ title: '正在打包施工文件...', description: `準備將 ${selectedDocs.size} 個文件打包為 ZIP 壓縮檔，請稍候...` })

        try {
            const zip = new JSZip()
            const docsToDownload = documentAttachments.filter(d => selectedDocs.has(d.id))
            const usedNames = new Set<string>()

            for (let i = 0; i < docsToDownload.length; i++) {
                const doc = docsToDownload[i]
                const url = doc.file_url || doc.video_url || doc.image_url
                if (!url) continue

                let originalName = doc.folder_name || `file_${doc.id}`
                // 如果檔名無副檔名，試著從 URL 提取
                if (!/\.[a-zA-Z0-9]+$/i.test(originalName)) {
                    const urlPath = url.split('?')[0]
                    const lastDot = urlPath.lastIndexOf('.')
                    if (lastDot !== -1) {
                        const urlExt = urlPath.substring(lastDot)
                        if (urlExt.length <= 5) {
                            originalName += urlExt
                        }
                    }
                }

                // 防止 ZIP 內部檔名重複
                let fileName = originalName
                let counter = 1
                const extIndex = originalName.lastIndexOf('.')
                const nameWithoutExt = extIndex !== -1 ? originalName.substring(0, extIndex) : originalName
                const ext = extIndex !== -1 ? originalName.substring(extIndex) : ''

                while (usedNames.has(fileName)) {
                    fileName = `${nameWithoutExt}_${counter}${ext}`
                    counter++
                }
                usedNames.add(fileName)

                try {
                    const response = await fetch(url)
                    if (!response.ok) throw new Error(`HTTP error ${response.status}`)
                    const blob = await response.blob()
                    zip.file(fileName, blob)
                } catch (e) {
                    console.error(`下載文件失敗: ${url}`, e)
                }
            }

            // 產生 ZIP Blob 檔案
            const zipBlob = await zip.generateAsync({ type: 'blob' })

            // 格式化 ZIP 檔名
            const cleanProjectName = (displayProjectName || '專案').replace(/[/\\?%*:|"<>]/g, '_')
            const cleanCategoryName = (displayCategoryName || '').replace(/[/\\?%*:|"<>]/g, '_')
            const dateStr = format(new Date(), 'yyyyMMdd_HHmm')
            const zipFileName = `${cleanProjectName}${cleanCategoryName ? '_' + cleanCategoryName : ''}_施工文件_${dateStr}.zip`

            saveAs(zipBlob, zipFileName)

            toast({ title: '下載成功', description: `已成功下載施工文件壓縮檔 (${zipFileName})` })
        } catch (error: any) {
            console.error('打包施工文件失敗:', error)
            toast({ title: '打包失敗', description: error?.message || '產生壓縮檔時發生錯誤', variant: 'destructive' })
        } finally {
            setIsZipping(false)
        }
    }

    // 提取所有唯一廠商列表（過濾用）
    const vendorOptions = useMemo(() => {
        const set = new Set<string>()
        vendorWorks.forEach(v => { if (v.vendor_name) set.add(v.vendor_name) })
        workOrders.forEach(o => { if (o.vendor_name) set.add(o.vendor_name) })
        return Array.from(set)
    }, [vendorWorks, workOrders])

    // 整合兩邊紀錄並依日期降序排序
    const allTimelineEvents = useMemo(() => {
        return [
            ...workOrders.map(o => ({
                id: o.id,
                date: o.work_order_date || o.sent_date || (o.created_at ? format(new Date(o.created_at), 'yyyy-MM-dd') : ''),
                time: o.created_at ? format(new Date(o.created_at), 'HH:mm') : '',
                type: 'work_order',
                title: `【工務單】編號：${o.work_order_id || o.order_id || '未填'}`,
                vendorName: o.vendor_name || '',
                status: o.status,
                content: o.maintain_content || o.cause || '',
                meta: {
                    price: o.price,
                    note: o.note
                }
            })),
            ...vendorWorks.map(v => ({
                id: v.id,
                date: v.work_date || (v.created_at ? format(new Date(v.created_at), 'yyyy-MM-dd') : ''),
                time: v.arrival_time || '',
                type: 'vendor_work',
                title: `【廠商施工】${v.vendor_name || ''}`,
                vendorName: v.vendor_name || '',
                status: v.entry_status === 'arrival' ? '已到院' : '已離院',
                content: v.work_content || '',
                meta: {
                    contact: v.vendor_contact,
                    timeRange: `${v.arrival_time || '--:--'} ~ ${v.departure_time || '--:--'}`,
                    location: v.location,
                    headCount: v.head_count,
                    badgeId: v.vendor_badge_id,
                    note: v.note
                }
            }))
        ].sort((a, b) => b.date.localeCompare(a.date))
    }, [workOrders, vendorWorks])

    // 根據搜尋條件過濾事件
    const filteredEvents = useMemo(() => {
        return allTimelineEvents.filter(ev => {
            // 1. 廠商過濾
            if (selectedVendorFilter !== 'all' && ev.vendorName !== selectedVendorFilter) {
                return false
            }

            // 2. 日期範圍過濾
            if (startDateFilter && ev.date < startDateFilter) return false
            if (endDateFilter && ev.date > endDateFilter) return false

            // 3. 關鍵字搜尋
            if (searchKeyword.trim()) {
                const kw = searchKeyword.trim().toLowerCase()
                const matchTitle = (ev.title || '').toLowerCase().includes(kw)
                const matchContent = (ev.content || '').toLowerCase().includes(kw)
                const matchVendor = (ev.vendorName || '').toLowerCase().includes(kw)
                const matchLocation = (ev.meta.location || '').toLowerCase().includes(kw)
                const matchContact = (ev.meta.contact || '').toLowerCase().includes(kw)
                const matchNote = (ev.meta.note || '').toLowerCase().includes(kw)
                if (!matchTitle && !matchContent && !matchVendor && !matchLocation && !matchContact && !matchNote) {
                    return false
                }
            }

            return true
        })
    }, [allTimelineEvents, selectedVendorFilter, startDateFilter, endDateFilter, searchKeyword])

    // 提取目前篩選日誌所屬的所有年份 (例如 2026, 2025)
    const uniqueYears = useMemo(() => {
        const years = new Set<string>()
        filteredEvents.forEach(ev => {
            if (ev.date) {
                const yr = ev.date.substring(0, 4)
                years.add(yr)
            }
        })
        return Array.from(years).sort().reverse()
    }, [filteredEvents])

    // 按 年-月 分組 (如 "2026年07月")
    const groupedEventsByMonth = useMemo(() => {
        const map = new Map<string, typeof filteredEvents>()
        filteredEvents.forEach(ev => {
            const monthKey = ev.date ? ev.date.substring(0, 7) : '未指定日期'
            if (!map.has(monthKey)) {
                map.set(monthKey, [])
            }
            map.get(monthKey)!.push(ev)
        })
        return Array.from(map.entries())
    }, [filteredEvents])

    // 當 groupedEventsByMonth 改變時，預設展開最新的月份
    useEffect(() => {
        if (groupedEventsByMonth.length > 0) {
            const latestMonth = groupedEventsByMonth[0][0]
            setExpandedMonths(new Set([latestMonth]))
        }
    }, [groupedEventsByMonth])

    const toggleMonthExpand = (monthKey: string) => {
        setExpandedMonths(prev => {
            const next = new Set(prev)
            if (next.has(monthKey)) {
                next.delete(monthKey)
            } else {
                next.add(monthKey)
            }
            return next
        })
    }

    // 提取所有相片附件 (相片牆專用)
    const photoAttachments = useMemo(() => {
        return attachments.filter(a => {
            if (!a.image_url) return false

            const parentVendorWork = vendorWorks.find(v => v.id === a.vendor_work_id)
            if (selectedVendorFilter !== 'all') {
                if (!parentVendorWork || parentVendorWork.vendor_name !== selectedVendorFilter) {
                    return false
                }
            }

            if (startDateFilter && parentVendorWork && parentVendorWork.work_date < startDateFilter) return false
            if (endDateFilter && parentVendorWork && parentVendorWork.work_date > endDateFilter) return false

            if (searchKeyword.trim()) {
                const kw = searchKeyword.trim().toLowerCase()
                const matchName = (a.folder_name || '').toLowerCase().includes(kw)
                const matchUploader = (a.uploader_name || '').toLowerCase().includes(kw)
                const matchVendor = (parentVendorWork?.vendor_name || '').toLowerCase().includes(kw)
                if (!matchName && !matchUploader && !matchVendor) return false
            }

            return true
        })
    }, [attachments, vendorWorks, selectedVendorFilter, startDateFilter, endDateFilter, searchKeyword])

    // Lightbox 相片清單
    const lightboxSlides = useMemo(() => {
        return photoAttachments.map(p => {
            const parentVendorWork = vendorWorks.find(v => v.id === p.vendor_work_id)
            return {
                src: p.image_url,
                title: p.folder_name,
                description: `施工日期: ${parentVendorWork?.work_date || '未標示'} | 上傳者: ${p.uploader_name || '訪客'} | 施工廠商: ${parentVendorWork?.vendor_name || '無'}`
            }
        })
    }, [photoAttachments, vendorWorks])

    // 提取所有文件檔案 (非相片)
    const documentAttachments = useMemo(() => {
        return attachments.filter(a => {
            if (a.image_url) return false

            const parentVendorWork = vendorWorks.find(v => v.id === a.vendor_work_id)
            if (selectedVendorFilter !== 'all') {
                if (!parentVendorWork || parentVendorWork.vendor_name !== selectedVendorFilter) {
                    return false
                }
            }

            if (startDateFilter && parentVendorWork && parentVendorWork.work_date < startDateFilter) return false
            if (endDateFilter && parentVendorWork && parentVendorWork.work_date > endDateFilter) return false

            if (searchKeyword.trim()) {
                const kw = searchKeyword.trim().toLowerCase()
                const matchName = (a.folder_name || '').toLowerCase().includes(kw)
                const matchUploader = (a.uploader_name || '').toLowerCase().includes(kw)
                const matchVendor = (parentVendorWork?.vendor_name || '').toLowerCase().includes(kw)
                if (!matchName && !matchUploader && !matchVendor) return false
            }

            return true
        })
    }, [attachments, vendorWorks, selectedVendorFilter, startDateFilter, endDateFilter, searchKeyword])

    // 重設篩選器
    const handleResetFilters = () => {
        setSearchKeyword('')
        setSelectedVendorFilter('all')
        setStartDateFilter('')
        setEndDateFilter('')
        setSelectedEvents(new Set())
        setSelectedPhotos(new Set())
        setSelectedDocs(new Set())
    }

    const hasActiveFilters = searchKeyword || selectedVendorFilter !== 'all' || startDateFilter || endDateFilter

    return (
        <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden print:max-w-full print:max-h-full print:overflow-visible print:border-none print:shadow-none p-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                {/* 1. 頂部控制欄 - 列印時隱藏 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0 gap-3 print:hidden">
                    <div>
                        <span className="text-[13px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">專案維修單管理</span>
                        <DialogTitle className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 mt-0.5">
                            {displayProjectName} — <span className="text-slate-500 dark:text-slate-400 font-semibold">{displayCategoryName}</span>
                        </DialogTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="px-3 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 h-9 gap-1.5 font-bold"
                                >
                                    <Download className="w-4 h-4 shrink-0" />
                                    <span>匯出</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleExportExcel}>
                                    匯出 Excel {selectedEvents.size > 0 && `(已選 ${selectedEvents.size} 筆)`}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handlePrint}>
                                    匯出 PDF {selectedEvents.size > 0 && `(已選 ${selectedEvents.size} 筆)`}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            onClick={() => onOpenChange(false)}
                            variant="outline"
                            size="sm"
                            className="text-slate-600 hover:text-slate-700 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/30 h-9 gap-1.5 font-bold"
                        >
                            <X className="w-4 h-4" />
                            關閉
                        </Button>
                    </div>
                </div>

                {/* 2. 篩選與搜尋工具列 */}
                <div className="p-4 bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 shrink-0 print:hidden space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* 搜尋框 */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="搜尋關鍵字 (廠商/內容/地點/負責人)..."
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            />
                        </div>

                        {/* 廠商篩選 */}
                        <div className="w-44">
                            <Select value={selectedVendorFilter} onValueChange={setSelectedVendorFilter}>
                                <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                    <SelectValue placeholder="選擇廠商" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部廠商 ({vendorOptions.length})</SelectItem>
                                    {vendorOptions.map(v => (
                                        <SelectItem key={v} value={v}>{v}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 日期起 */}
                        <Input
                            type="date"
                            value={startDateFilter}
                            onChange={(e) => setStartDateFilter(e.target.value)}
                            className="w-36 h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        />
                        <span className="text-slate-400 text-xs">至</span>
                        {/* 日期迄 */}
                        <Input
                            type="date"
                            value={endDateFilter}
                            onChange={(e) => setEndDateFilter(e.target.value)}
                            className="w-36 h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        />

                        {/* 重設條件 */}
                        {(hasActiveFilters || selectedEvents.size > 0 || selectedPhotos.size > 0) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleResetFilters}
                                className="h-9 px-2 text-xs text-slate-500 hover:text-slate-700 gap-1"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                清除條件
                            </Button>
                        )}
                    </div>

                    {/* 三大檢視頁籤選單 */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-900">
                        <Button
                            variant={activeTab === 'timeline' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('timeline')}
                            className={`h-8 px-4 text-xs font-bold gap-1.5 rounded-lg transition-colors ${activeTab === 'timeline' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                            <List className="w-4 h-4" />
                            <span>施工日誌 ({filteredEvents.length})</span>
                        </Button>
                        <Button
                            variant={activeTab === 'gallery' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('gallery')}
                            className={`h-8 px-4 text-xs font-bold gap-1.5 rounded-lg transition-colors ${activeTab === 'gallery' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                            <Grid className="w-4 h-4" />
                            <span>施工照片牆 ({photoAttachments.length})</span>
                        </Button>
                        <Button
                            variant={activeTab === 'files' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('files')}
                            className={`h-8 px-4 text-xs font-bold gap-1.5 rounded-lg transition-colors ${activeTab === 'files' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                            <FolderArchive className="w-4 h-4" />
                            <span>施工文件庫 ({documentAttachments.length})</span>
                        </Button>
                    </div>
                </div>

                {/* Print Banner - 僅在列印時顯示 */}
                <div className="hidden print:block p-8 border-b border-slate-300">
                    <h1 className="text-2xl font-black text-center mb-2">專案工作施工紀錄報告</h1>
                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                        <div><strong>專案名稱：</strong>{displayProjectName}</div>
                        <div><strong>工程主項目：</strong>{displayCategoryName}</div>
                        <div><strong>列印日期：</strong>{format(new Date(), 'yyyy-MM-dd HH:mm')}</div>
                    </div>
                </div>

                {/* 主要內容滾動區 */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <span className="text-sm text-slate-500">正在載入專案工作紀錄...</span>
                        </div>
                    ) : (
                        <>
                            {/* TAB 1: 施工日誌時間軸 (按月 Accordion 摺疊) */}
                            {activeTab === 'timeline' && (
                                filteredEvents.length === 0 ? (
                                    <div className="text-center py-20 bg-white dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                        <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">尚無符合條件的工作紀錄</h3>
                                        <p className="text-xs text-slate-500 mt-1">請嘗試調整上方搜尋關鍵字、日期區間或廠商篩選。</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* 批次選取控制列 (全選主項目、年分全選) */}
                                        <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                                            <div className="flex flex-wrap items-center gap-4 text-xs">
                                                {/* 全選主項目全部符合 */}
                                                <label className="flex items-center gap-2 cursor-pointer font-bold select-none text-slate-800 dark:text-slate-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={filteredEvents.length > 0 && filteredEvents.every(e => selectedEvents.has(e.id))}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedEvents(new Set(filteredEvents.map(ev => ev.id)))
                                                            } else {
                                                                setSelectedEvents(new Set())
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 bg-white"
                                                    />
                                                    <span className="text-[13px]">全選全部符合的日誌 ({filteredEvents.length} 筆)</span>
                                                </label>

                                                {/* 年份全選 */}
                                                {uniqueYears.length > 0 && (
                                                    <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-4">
                                                        <span className="text-slate-400">快速年份選取：</span>
                                                        {uniqueYears.map(yr => {
                                                            const yearEvents = filteredEvents.filter(e => e.date && e.date.startsWith(yr))
                                                            const isYearAllChecked = yearEvents.length > 0 && yearEvents.every(e => selectedEvents.has(e.id))
                                                            return (
                                                                <label key={yr} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-md text-[11px] text-slate-600 dark:text-slate-300 font-semibold cursor-pointer select-none">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isYearAllChecked}
                                                                        onChange={(e) => {
                                                                            setSelectedEvents(prev => {
                                                                                const next = new Set(prev)
                                                                                yearEvents.forEach(ev => {
                                                                                    if (e.target.checked) {
                                                                                        next.add(ev.id)
                                                                                    } else {
                                                                                        next.delete(ev.id)
                                                                                    }
                                                                                })
                                                                                return next
                                                                            })
                                                                        }}
                                                                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 bg-white"
                                                                    />
                                                                    <span>{yr} 年</span>
                                                                </label>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 shrink-0 self-end md:self-center font-bold">
                                                <span>已選擇 <strong className="text-blue-600 dark:text-blue-400 text-sm font-black">{selectedEvents.size}</strong> 筆日誌</span>
                                                {selectedEvents.size > 0 && (
                                                    <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">※ 匯出功能此時只會包含選取的日誌</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {groupedEventsByMonth.map(([monthKey, events]) => {
                                                const isExpanded = expandedMonths.has(monthKey)

                                                return (
                                                    <div key={monthKey} className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                                        {/* 月份 Header (可按壓展開/收合) */}
                                                        <div
                                                            onClick={() => toggleMonthExpand(monthKey)}
                                                            className="px-5 py-3.5 bg-slate-100/80 dark:bg-slate-900/80 hover:bg-slate-200/60 dark:hover:bg-slate-900 border-b border-slate-200 dark:border-slate-800 cursor-pointer flex items-center justify-between transition-colors select-none"
                                                        >
                                                            <div className="flex items-center gap-2.5">
                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                                                )}
                                                                
                                                                {/* 單一月份全選核取框 */}
                                                                <input
                                                                    type="checkbox"
                                                                    checked={events.length > 0 && events.every(e => selectedEvents.has(e.id))}
                                                                    onClick={(e) => e.stopPropagation()} // 避免展開收合
                                                                    onChange={(e) => {
                                                                        setSelectedEvents(prev => {
                                                                            const next = new Set(prev)
                                                                            events.forEach(ev => {
                                                                                if (e.target.checked) {
                                                                                    next.add(ev.id)
                                                                                } else {
                                                                                    next.delete(ev.id)
                                                                                }
                                                                            })
                                                                            return next
                                                                        })
                                                                    }}
                                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 bg-white cursor-pointer shrink-0"
                                                                />

                                                                <span className="text-base font-black text-slate-800 dark:text-slate-100">
                                                                    {monthKey}
                                                                </span>
                                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                                                                    {events.length} 筆紀錄
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-slate-400 font-medium">
                                                                {isExpanded ? '點擊收合' : '點擊展開查閱'}
                                                            </span>
                                                        </div>

                                                        {/* 月份內部日誌卡片 */}
                                                        {isExpanded && (
                                                            <div className="p-5 space-y-6">
                                                                <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 md:ml-4 space-y-6">
                                                                    {events.map((event) => {
                                                                        const isWorkOrder = event.type === 'work_order'
                                                                        const eventAttachments = attachments.filter(a => a.vendor_work_id === event.id)

                                                                        return (
                                                                            <div key={event.id} className="relative pl-6 md:pl-8 group print:break-inside-avoid">
                                                                                {/* 時間軸點 */}
                                                                                <span className={`absolute left-[-9px] top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-950 ${isWorkOrder
                                                                                    ? 'bg-blue-500 text-white'
                                                                                    : 'bg-emerald-500 text-white'
                                                                                    }`}>
                                                                                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                                                                </span>

                                                                                {/* 日誌卡片 */}
                                                                                <div className="bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-sm group-hover:border-blue-300 dark:group-hover:border-slate-700 transition-all">
                                                                                    <div className="flex items-start md:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-3 mb-3">
                                                                                        <div className="flex items-center gap-2.5">
                                                                                            {/* 選取日誌 Checkbox */}
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={selectedEvents.has(event.id)}
                                                                                                onChange={(e) => {
                                                                                                    setSelectedEvents(prev => {
                                                                                                        const next = new Set(prev)
                                                                                                        if (e.target.checked) {
                                                                                                            next.add(event.id)
                                                                                                        } else {
                                                                                                            next.delete(event.id)
                                                                                                        }
                                                                                                        return next
                                                                                                    })
                                                                                                }}
                                                                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 bg-white cursor-pointer shrink-0"
                                                                                            />
                                                                                            <div>
                                                                                                <span className="text-xs font-semibold text-slate-400 block">{event.date} {event.time}</span>
                                                                                                <h4 className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">{event.title}</h4>
                                                                                            </div>
                                                                                        </div>
                                                                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full w-fit shrink-0 ${isWorkOrder
                                                                                            ? event.status === '已驗收'
                                                                                                ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                                                                                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                                                                                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                                                            }`}>
                                                                                            {event.status}
                                                                                        </span>
                                                                                    </div>

                                                                                    <div className="space-y-3">
                                                                                        <div>
                                                                                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">工作/施工內容：</span>
                                                                                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{event.content}</p>
                                                                                        </div>

                                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800">
                                                                                            {isWorkOrder ? (
                                                                                                <>
                                                                                                    <div><strong className="text-slate-400">維修金額：</strong>NT$ {(event.meta.price || 0).toLocaleString()} 元</div>
                                                                                                    <div><strong className="text-slate-400">工單備註：</strong>{event.meta.note || '無'}</div>
                                                                                                </>
                                                                                            ) : (
                                                                                                <>
                                                                                                    <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> <strong className="text-slate-400">負責人：</strong>{event.meta.contact} ({event.meta.headCount} 人)</div>
                                                                                                    <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> <strong className="text-slate-400">在院時間：</strong>{event.meta.timeRange}</div>
                                                                                                    <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> <strong className="text-slate-400">施工地點：</strong>{event.meta.location}</div>
                                                                                                    <div><strong className="text-slate-400">工作證號：</strong>{event.meta.badgeId || '無'}</div>
                                                                                                    {event.meta.note && <div className="col-span-2"><strong className="text-slate-400">廠商備註：</strong>{event.meta.note}</div>}
                                                                                                </>
                                                                                            )}
                                                                                        </div>

                                                                                        {!isWorkOrder && (
                                                                                            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                                                                                                <div className="flex items-center justify-between mb-2">
                                                                                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                                                                        <Paperclip className="w-3.5 h-3.5" /> 上傳施工附件 (可複選，單次建議最多5張檔案/照片)
                                                                                                    </span>

                                                                                                    <div className="relative print:hidden">
                                                                                                        <input
                                                                                                            type="file"
                                                                                                            id={`upload-${event.id}`}
                                                                                                            className="sr-only"
                                                                                                            multiple
                                                                                                            disabled={uploadingId !== null}
                                                                                                            onChange={(e) => handleFileUpload(e, event.id)}
                                                                                                        />
                                                                                                        <Button
                                                                                                            variant="ghost"
                                                                                                            size="sm"
                                                                                                            disabled={uploadingId !== null}
                                                                                                            className="text-blue-600 hover:text-blue-700 h-7 text-xs font-bold p-0 flex items-center gap-1"
                                                                                                            asChild
                                                                                                        >
                                                                                                            <label htmlFor={`upload-${event.id}`} className="cursor-pointer">
                                                                                                                {uploadingId === event.id ? (
                                                                                                                    <>
                                                                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                                                                        上傳中...
                                                                                                                    </>
                                                                                                                ) : (
                                                                                                                    <>
                                                                                                                        <UploadCloud className="w-3.5 h-3.5" />
                                                                                                                        新增附件
                                                                                                                    </>
                                                                                                                )}
                                                                                                            </label>
                                                                                                        </Button>
                                                                                                    </div>
                                                                                                </div>

                                                                                                {eventAttachments.length === 0 ? (
                                                                                                    <p className="text-xs text-slate-400 italic">尚無施工圖檔或文件。</p>
                                                                                                ) : (
                                                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2">
                                                                                                        {eventAttachments.map((file) => {
                                                                                                            const isImage = !!file.image_url
                                                                                                            const isVideo = !!file.video_url
                                                                                                            const fileUrl = file.image_url || file.video_url || file.file_url

                                                                                                            return (
                                                                                                                <div key={file.id} className="relative group/file bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden h-24 flex flex-col justify-between p-2 shadow-xs">
                                                                                                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                                                                                                                        {isImage ? (
                                                                                                                            <img src={file.image_url} alt={file.folder_name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover/file:opacity-100 transition-opacity" />
                                                                                                                        ) : isVideo ? (
                                                                                                                            <VideoIcon className="w-6 h-6 text-slate-500" />
                                                                                                                        ) : (
                                                                                                                            <FileText className="w-6 h-6 text-slate-500" />
                                                                                                                        )}
                                                                                                                        {!isImage && (
                                                                                                                            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold truncate max-w-full text-center px-1">
                                                                                                                                {file.folder_name}
                                                                                                                            </span>
                                                                                                                        )}
                                                                                                                    </a>

                                                                                                                    <div className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover/file:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                                                                                                        <div className="text-[10px] text-white font-medium truncate">
                                                                                                                            {file.uploader_name}
                                                                                                                        </div>
                                                                                                                        <div className="flex items-center justify-between">
                                                                                                                            <span className="text-[10px] text-slate-300">
                                                                                                                                {format(new Date(file.created_at), 'MM/dd')}
                                                                                                                            </span>
                                                                                                                            <button
                                                                                                                                onClick={() => handleDeleteFile(file.id, fileUrl)}
                                                                                                                                className="text-red-400 hover:text-red-500 transition-colors p-0.5 rounded hover:bg-white/10 print:hidden"
                                                                                                                            >
                                                                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                                                                            </button>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            )
                                                                                                        })}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            )}

                            {/* TAB 2: 施工照片牆 (Photo Gallery View) */}
                            {activeTab === 'gallery' && (
                                photoAttachments.length === 0 ? (
                                    <div className="text-center py-20 bg-white dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                        <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">尚無符合條件的施工照片</h3>
                                        <p className="text-xs text-slate-500 mt-1">此類別下尚未上傳相片，或已被當前篩選條件過濾。</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* 照片牆工具欄 */}
                                        <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => {
                                                        if (selectedPhotos.size === photoAttachments.length) {
                                                            setSelectedPhotos(new Set())
                                                        } else {
                                                            setSelectedPhotos(new Set(photoAttachments.map(p => p.id)))
                                                        }
                                                    }}
                                                    className="font-bold text-blue-600 hover:text-blue-700"
                                                >
                                                    {selectedPhotos.size === photoAttachments.length ? '取消全選' : '全選照片'}
                                                </button>
                                                <span>已選擇 {selectedPhotos.size} / {photoAttachments.length} 張照片</span>
                                            </div>
                                            {selectedPhotos.size > 0 && (
                                                <Button
                                                    onClick={handleDownloadSelectedPhotos}
                                                    disabled={isZipping}
                                                    size="sm"
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-7 py-0 px-3 text-xs gap-1"
                                                >
                                                    {isZipping ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            正在壓縮照片...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download className="w-3.5 h-3.5" />
                                                            下載選取照片 ({selectedPhotos.size})
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {photoAttachments.map((photo, index) => {
                                                const parentVendorWork = vendorWorks.find(v => v.id === photo.vendor_work_id)

                                                return (
                                                    <div
                                                        key={photo.id}
                                                        onClick={() => {
                                                            setLightboxIndex(index)
                                                            setLightboxOpen(true)
                                                        }}
                                                        className="group relative aspect-square bg-slate-900 rounded-xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all"
                                                    >
                                                        <img
                                                            src={photo.image_url}
                                                            alt={photo.folder_name}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                        
                                                        {/* 施工日期與選取核取方塊 */}
                                                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedPhotos.has(photo.id)}
                                                                onClick={(e) => e.stopPropagation()} // 防止觸發大圖檢視
                                                                onChange={(e) => {
                                                                    setSelectedPhotos(prev => {
                                                                        const next = new Set(prev)
                                                                        if (e.target.checked) {
                                                                            next.add(photo.id)
                                                                        } else {
                                                                            next.delete(photo.id)
                                                                        }
                                                                        return next
                                                                    })
                                                                }}
                                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 bg-white/95 cursor-pointer shadow-sm shrink-0"
                                                            />
                                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-950/70 text-white backdrop-blur-[2px]">
                                                                施工日: {parentVendorWork?.work_date || '未標示'}
                                                            </span>
                                                        </div>

                                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-95 transition-opacity p-3 flex flex-col justify-end">
                                                            <div>
                                                                <p className="text-xs font-bold text-white truncate">{photo.folder_name}</p>
                                                                <div className="flex items-center justify-between text-[10px] text-slate-300 mt-1">
                                                                    <span className="truncate max-w-[60px]">{photo.uploader_name}</span>
                                                                    <span>{format(new Date(photo.created_at), 'MM/dd HH:mm')}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            )}

                            {/* TAB 3: 施工文件庫 (Document Vault View) */}
                            {activeTab === 'files' && (
                                documentAttachments.length === 0 ? (
                                    <div className="text-center py-20 bg-white dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                        <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">尚無施工文件</h3>
                                        <p className="text-xs text-slate-500 mt-1">目前無 PDF、DOCX 或 Excel 等相關施工文件上傳。</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {/* 上方批次選擇與下載操作列 */}
                                        <div className="flex items-center justify-between bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => {
                                                        if (selectedDocs.size === documentAttachments.length) {
                                                            setSelectedDocs(new Set())
                                                        } else {
                                                            setSelectedDocs(new Set(documentAttachments.map(d => d.id)))
                                                        }
                                                    }}
                                                    className="font-bold text-blue-600 hover:text-blue-700"
                                                >
                                                    {selectedDocs.size === documentAttachments.length ? '取消全選' : '全選文件'}
                                                </button>
                                                <span>已選擇 {selectedDocs.size} / {documentAttachments.length} 個文件</span>
                                            </div>
                                            {selectedDocs.size > 0 && (
                                                <Button
                                                    onClick={handleDownloadSelectedDocs}
                                                    disabled={isZipping}
                                                    size="sm"
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-7 py-0 px-3 text-xs gap-1"
                                                >
                                                    {isZipping ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            正在壓縮文件...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download className="w-3.5 h-3.5" />
                                                            下載選取文件 ({selectedDocs.size})
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>

                                        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-100/80 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                                                        <tr>
                                                            <th className="p-3.5 w-10 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={documentAttachments.length > 0 && selectedDocs.size === documentAttachments.length}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setSelectedDocs(new Set(documentAttachments.map(d => d.id)))
                                                                        } else {
                                                                            setSelectedDocs(new Set())
                                                                        }
                                                                    }}
                                                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                                />
                                                            </th>
                                                            <th className="p-3.5">檔案名稱</th>
                                                            <th className="p-3.5">施工單位 / 廠商</th>
                                                            <th className="p-3.5">上傳者</th>
                                                            <th className="p-3.5">上傳時間</th>
                                                            <th className="p-3.5 text-right">操作</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                                                        {documentAttachments.map(doc => {
                                                            const fileUrl = doc.file_url || doc.video_url || ''
                                                            const parentVendorWork = vendorWorks.find(v => v.id === doc.vendor_work_id)
                                                            const isSelected = selectedDocs.has(doc.id)

                                                            return (
                                                                <tr key={doc.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors ${isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}>
                                                                    <td className="p-3.5 text-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSelected}
                                                                            onChange={() => {
                                                                                const newSet = new Set(selectedDocs)
                                                                                if (newSet.has(doc.id)) newSet.delete(doc.id)
                                                                                else newSet.add(doc.id)
                                                                                setSelectedDocs(newSet)
                                                                            }}
                                                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                                        />
                                                                    </td>
                                                                    <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                                                        <span className="truncate max-w-[250px]">{doc.folder_name}</span>
                                                                    </td>
                                                                    <td className="p-3.5 text-slate-600 dark:text-slate-400">
                                                                        {parentVendorWork?.vendor_name || '無標示'}
                                                                    </td>
                                                                    <td className="p-3.5 text-slate-600 dark:text-slate-400">
                                                                        {doc.uploader_name || '訪客'}
                                                                    </td>
                                                                    <td className="p-3.5 text-slate-500 dark:text-slate-500 font-mono">
                                                                        {format(new Date(doc.created_at), 'yyyy-MM-dd HH:mm')}
                                                                    </td>
                                                                    <td className="p-3.5 text-right space-x-2">
                                                                        <a
                                                                            href={fileUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold px-2 py-1 bg-blue-50 dark:bg-blue-950/40 rounded transition-colors"
                                                                        >
                                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                                            開啟
                                                                        </a>
                                                                        <button
                                                                            onClick={() => handleDeleteFile(doc.id, fileUrl)}
                                                                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-bold px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                            刪除
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>

                {/* Lightbox 大圖檢視器 */}
                <Lightbox
                    open={lightboxOpen}
                    close={() => setLightboxOpen(false)}
                    index={lightboxIndex}
                    slides={lightboxSlides}
                    on={{ view: ({ index }) => setLightboxIndex(index) }}
                />
            </DialogContent>
        </Dialog>
    )
}
