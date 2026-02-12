---
description: 將完成報告複製到專案參考文件資料夾
---

# 儲存 Walkthrough 到專案

當任務完成並產生相關文件時，執行以下步驟：

1. 確認 artifact 目錄中有相關文件（walkthrough.md、implementation_plan.md、task.md）

2. 在專案根目錄建立「參考文件」資料夾（如不存在）：
   ```bash
   mkdir -p "./參考文件"
   ```

3. 將 walkthrough 複製到專案參考文件資料夾（以任務名稱命名）：
   ```bash
   cp "$ARTIFACT_DIR/walkthrough.md" "./參考文件/{任務名稱}.md"
   ```

4. 將 implementation_plan.md 複製到專案參考文件資料夾：
   ```bash
   cp "$ARTIFACT_DIR/implementation_plan.md" "./參考文件/{任務名稱}_實作計畫.md" 2>/dev/null || true
   ```

5. 將 task.md 複製到專案參考文件資料夾：
   ```bash
   cp "$ARTIFACT_DIR/task.md" "./參考文件/{任務名稱}_任務清單.md" 2>/dev/null || true
   ```

6. 如果有相關截圖，也一併複製：
   ```bash
   cp "$ARTIFACT_DIR"/*.png "./參考文件/" 2>/dev/null || true
   ```

7. 更新 walkthrough 中的圖片路徑為相對路徑（同目錄）

## 注意事項
- 任務名稱使用繁體中文，空格用底線替代
- 若檔案已存在會覆蓋
- `./` 代表當前專案根目錄（workflow 所在專案）
- 此 workflow 可複製到任何專案的 `.agent/workflows/` 直接使用
