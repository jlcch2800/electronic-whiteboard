'use client'

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { format } from 'date-fns'

// 字型二進位快取，避免重複 Fetch 下載 9.4MB 的字型檔
let cachedFontBase64: string | null = null;
let fontLoadingPromise: Promise<string> | null = null;

/**
 * 將 ArrayBuffer 安全且無 stack overflow 風險地轉換為 base64 字串
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    // 採用分段處理或簡單迴圈，避免 String.fromCharCode.apply 因參數限制發生錯誤
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * 載入中文字型檔並快取於記憶體中
 */
export async function loadChineseFont(): Promise<string> {
    if (cachedFontBase64) return cachedFontBase64;
    if (fontLoadingPromise) return fontLoadingPromise;

    fontLoadingPromise = (async () => {
        const response = await fetch('/fonts/NotoSansTC-Regular.ttf');
        if (!response.ok) {
            throw new Error('無法載入中文字型檔，請確保 /fonts/NotoSansTC-Regular.ttf 存在');
        }
        const buffer = await response.arrayBuffer();
        cachedFontBase64 = arrayBufferToBase64(buffer);
        return cachedFontBase64;
    })();

    return fontLoadingPromise;
}

/**
 * 匯出 Excel 活頁簿
 * @param sheetData 格式化後的物件陣列
 * @param filenamePrefix 檔案名稱前綴
 * @param sheetName 工作表名稱
 */
export function exportToExcelFile(sheetData: any[], filenamePrefix: string, sheetName: string = 'Sheet1') {
    if (!sheetData || sheetData.length === 0) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);

    // 設定寬度 (預設 15 寬)
    const wscols = Object.keys(sheetData[0] || {}).map(() => ({ wch: 15 }));
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${filenamePrefix}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
}

/**
 * 匯出單筆二維陣列 (AOA) 至 Excel 活頁簿 (通常適用於明細頁)
 */
export function exportAoaToExcelFile(aoa: any[][], filenamePrefix: string, sheetName: string = 'Sheet1', colWidths?: number[]) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    if (colWidths) {
        ws['!cols'] = colWidths.map(w => ({ wch: w }));
    } else {
        const maxCols = aoa.reduce((max, row) => Math.max(max, row.length), 0);
        ws['!cols'] = Array(maxCols).fill({ wch: 20 });
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${filenamePrefix}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
}

export interface ExportPdfOptions {
    title: string;
    filenamePrefix: string;
    orientation?: 'portrait' | 'landscape';
    themeColor?: [number, number, number]; // RGB 顏色，例如 [124, 58, 237]
    
    // 選項 1: 傳入物件陣列 (適用於清單表格匯出)
    sheetData?: any[]; 
    excludeColumns?: string[]; // 匯出時要過濾掉的欄位 (例如 ID、建立時間 等冗長欄位)
    
    // 選項 2: 傳入自訂表格資料 (適用於特殊明細頁)
    head?: string[][];
    body?: string[][];
    
    // 是否要啟用多表格 (當明細包含基本資訊與異動對比時)
    secondTable?: {
        title: string;
        head: string[][];
        body: string[][];
    };
}

/**
 * 匯出 PDF 檔案，支援自訂中文 NotoSans 註冊與品牌代表色
 */
export async function exportToPdfFile({
    title,
    filenamePrefix,
    orientation = 'landscape',
    themeColor = [124, 58, 237], // 預設紫色
    sheetData,
    excludeColumns = ['ID', '建立時間'], // 預設排除冗長欄位
    head,
    body,
    secondTable
}: ExportPdfOptions) {
    // 1. 取得中文字型 base64 碼
    const fontBase64 = await loadChineseFont();

    // 2. 建立 jsPDF 實例
    const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
    });

    // 3. 註冊 NotoSansTC 字型並設為預設
    const fontFileName = 'NotoSansTC-Regular.ttf';
    const fontName = 'NotoSansTC';
    doc.addFileToVFS(fontFileName, fontBase64);
    doc.addFont(fontFileName, fontName, 'normal');
    doc.setFont(fontName);

    // 4. 繪製標題與時間戳記
    doc.setFontSize(16);
    doc.setTextColor(50);
    doc.text(title, 14, 15);

    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`匯出時間: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 14, 21);
    doc.setTextColor(0); // 重設顏色

    // 5. 決定主要表格資料
    let tableHead: string[][] = [];
    let tableBody: string[][] = [];

    if (sheetData && sheetData.length > 0) {
        const originalHeaders = Object.keys(sheetData[0]);
        const filteredHeaders = originalHeaders.filter(h => !excludeColumns.includes(h));
        tableHead = [filteredHeaders];
        tableBody = sheetData.map(item => filteredHeaders.map(h => {
            const val = item[h];
            return val !== undefined && val !== null ? String(val) : '';
        }));
    } else if (head && body) {
        tableHead = head;
        tableBody = body;
    }

    if (tableHead.length === 0) return;

    // 6. 根據欄位數量動態調整字型大小與內距，確保寬度極大時依然精美對齊、不溢出
    const colCount = tableHead[0]?.length || 1;
    let dynamicFontSize = orientation === 'landscape' ? 8 : 9;
    let dynamicCellPadding = 2;

    if (colCount > 30) {
        dynamicFontSize = 3.6;
        dynamicCellPadding = 0.4;
    } else if (colCount > 20) {
        dynamicFontSize = 4.8;
        dynamicCellPadding = 0.8;
    } else if (colCount > 13) {
        dynamicFontSize = 6.0;
        dynamicCellPadding = 1.0;
    } else if (colCount > 9) {
        dynamicFontSize = 7.2;
        dynamicCellPadding = 1.5;
    }

    autoTable(doc, {
        startY: 25,
        styles: {
            font: 'NotoSansTC',
            fontStyle: 'normal',
            fontSize: dynamicFontSize,
            cellPadding: dynamicCellPadding,
        },
        headStyles: {
            fillColor: themeColor,
            textColor: 255,
            fontStyle: 'normal'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252] // 微帶灰藍色的交替背景色，非常高雅
        },
        head: tableHead,
        body: tableBody,
        margin: { top: 25, bottom: 15 },
        didDrawPage: (data: any) => {
            // 頁碼頁尾
            const str = `頁碼 ${data.pageNumber} / ${data.pageCount || ''}`;
            doc.setFontSize(8);
            doc.setTextColor(150);

            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
            const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();

            doc.text(str, pageWidth - 30, pageHeight - 10);
        }
    });

    // 7. 若有第二個表格 (適用於詳細記錄對比頁)
    if (secondTable) {
        const firstTableFinalY = (doc as any).lastAutoTable.finalY || 40;
        
        doc.setFontSize(12);
        doc.setTextColor(50);
        doc.text(secondTable.title, 14, firstTableFinalY + 12);
        
        autoTable(doc, {
            startY: firstTableFinalY + 16,
            styles: {
                font: 'NotoSansTC',
                fontStyle: 'normal',
                fontSize: 8,
                cellPadding: 2,
            },
            headStyles: {
                fillColor: themeColor,
                textColor: 255,
                fontStyle: 'normal'
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            head: secondTable.head,
            body: secondTable.body,
            margin: { bottom: 15 },
            // 對於明細的變更對比表，如果「是否異動」是「是」，可以把該列上色，這是頂級美學設計！
            didParseCell: (data: any) => {
                // 如果是資料列，且第四欄的值為 '是' (代表有異動)，我們將該儲存格或整列塗上亮眼但淡雅的琥珀底色
                if (data.row.section === 'body') {
                    // 檢查第四欄 (index 3) 是否為 '是'
                    const changeCol = data.row.cells[3];
                    if (changeCol && changeCol.text && changeCol.text[0] === '是') {
                        // 為該行儲存格背景上淡黃色
                        data.cell.styles.fillColor = [254, 243, 199]; // Tailwind amber-100
                    }
                }
            }
        });
    }

    // 8. 儲存 PDF 檔案
    doc.save(`${filenamePrefix}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
}
