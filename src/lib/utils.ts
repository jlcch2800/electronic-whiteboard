import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化項目列表（如借用/歸還項目）
 * 1. 將「其他」排在最後
 * 2. 如果有「其他」且有說明文字，格式化為「其他(說明)」
 */
export function formatItemsDisplay(items: string[] | undefined | null, otherText?: string | null): string {
  const itemList = items || []
  if (itemList.length === 0 && !otherText) return ''

  // 先顯示非「其他」的項目，最後顯示「其他」
  const sortedItems = [...itemList].sort((a, b) => {
    if (a === '其他') return 1
    if (b === '其他') return -1
    return 0
  })

  // 如果有說明文字
  if (otherText) {
    if (itemList.includes('其他')) {
      // 找到「其他」的索引並替換為說明文字，其餘項目保持原樣
      const displayItems = sortedItems.map(item => item === '其他' ? otherText : item)
      return displayItems.join('、')
    } else {
      // 如果沒有選「其他」但有說明文字，則附加在最後，並以頓號分隔
      return [...sortedItems, otherText].join('、')
    }
  }

  return sortedItems.join('、')
}

/**
 * 驗證其他物品說明是否使用正確的分隔符號（僅限頓號）
 * 如果偵測到多個項目，則原始字串不得包含頓號以外的分隔符號
 */
export function validateOtherItemsSeparator(text: string | undefined | null): { isValid: boolean; message: string } {
  if (!text) return { isValid: true, message: '' }

  // 使用所有可能的分隔符號進行切分（包括頓號、逗號、空格、句號），看是否有複數項目
  const parts = text.split(/[、,，\s\.]+/).map(s => s.trim()).filter(Boolean)
  
  // 如果只有一個項目或沒有項目，則不需要驗證分隔符號
  if (parts.length <= 1) return { isValid: true, message: '' }

  // 如果有兩個以上項目，檢查原始字串是否包含頓號以外的常見分隔符號（半形逗號、全形逗號、空格、半形句號）
  const invalidPattern = /[ ,，\s\.]/
  if (invalidPattern.test(text)) {
    return { 
      isValid: false, 
      message: '有兩個以上的其他物品，請以頓號「、」分隔' 
    }
  }

  return { isValid: true, message: '' }
}
