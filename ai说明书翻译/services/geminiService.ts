// ai说明书翻译/services/geminiService.ts

const CLIENT_SCRIPT = `
<script>
/**
 * Interactive Image Upload Script for Standalone HTML
 * Allows users to click on dashed boxes to upload and insert images.
 */
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    let currentBox = null;

    document.body.addEventListener('click', (e) => {
      const box = e.target.closest('.figure-box');
      if (box) {
        currentBox = box;
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && currentBox) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Data = event.target.result;
          currentBox.innerHTML = '<img src="' + base64Data + '" style="width:100%; height:100%; object-fit:contain; border-radius:4px;" />';
          currentBox.style.border = 'none';
          currentBox.style.background = 'transparent';
          currentBox.style.padding = '0';
        };
        reader.readAsDataURL(file);
      }
      fileInput.value = '';
    });
  });
})();
</script>
`;

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/**
 * 将页码字符串解析为页码数组
 * 例如: "5"   → [5]
 *       "3-7" → [3, 4, 5, 6, 7]
 */
export function parsePageRange(pageRange: string): number[] {
  const trimmed = pageRange.trim();
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    const start = parseInt(parts[0].trim(), 10);
    const end   = parseInt(parts[1].trim(), 10);
    if (isNaN(start) || isNaN(end) || start > end) {
      throw new Error(`无效的页码范围: "${pageRange}"`);
    }
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }
  const single = parseInt(trimmed, 10);
  if (isNaN(single)) throw new Error(`无效的页码: "${pageRange}"`);
  return [single];
}

/**
 * 将页码数组按 chunkSize 拆分为多个批次
 * 例如: ([1,2,3,4,5], 2) → [[1,2],[3,4],[5]]
 */
export function chunkPages(pages: number[], chunkSize: number = 2): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < pages.length; i += chunkSize) {
    chunks.push(pages.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * 将一个页码批次 [3, 4] 转换为 API 可读的字符串 "3-4"；单页返回 "3"
 */
function chunkToRangeString(chunk: number[]): string {
  if (chunk.length === 1) return String(chunk[0]);
  return `${chunk[0]}-${chunk[chunk.length - 1]}`;
}

// ─── 提取 page-container 块 ───────────────────────────────────────────────────

/**
 * 从完整 HTML 字符串中提取所有 <div class="page-container"...>...</div> 块
 * 支持嵌套标签，使用手动计数匹配括号的方式
 */
function extractPageContainers(html: string): string[] {
  const results: string[] = [];
  const searchTag = '<div';
  let searchFrom = 0;

  while (true) {
    // 找到下一个含 page-container 的 div 开始位置
    const startIdx = html.indexOf('<div', searchFrom);
    if (startIdx === -1) break;

    // 检查此 div 是否含 class="page-container" 或 class='page-container'
    const tagEnd = html.indexOf('>', startIdx);
    if (tagEnd === -1) break;
    const openingTag = html.slice(startIdx, tagEnd + 1);

    if (!openingTag.includes('page-container')) {
      searchFrom = startIdx + 1;
      continue;
    }

    // 找到匹配的关闭 </div>，处理嵌套
    let depth = 1;
    let pos = tagEnd + 1;
    while (depth > 0 && pos < html.length) {
      const nextOpen  = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          results.push(html.slice(startIdx, nextClose + 6));
          searchFrom = nextClose + 6;
          break;
        }
        pos = nextClose + 6;
      }
    }
    if (depth !== 0) break; // 防止无限循环
  }
  return results;
}

/**
 * 从 HTML 字符串中提取 <head>...</head> 部分（含标签本身）
 */
function extractHead(html: string): string {
  const start = html.indexOf('<head');
  const end   = html.indexOf('</head>');
  if (start === -1 || end === -1) return '';
  return html.slice(start, end + 7);
}

// ─── 单批次调用（保持原有逻辑，供内部复用）────────────────────────────────────

async function callReconstructAPI(
  imageBase64: string,
  mimeType: string,
  pageRange: string,
): Promise<string> {
  const response = await fetch('/api/reconstruct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, pageRange }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as any).error || `请求失败: ${response.status}`);
  }

  const data = await response.json();
  const text = (data as any).text || '';

  // 清理 Markdown 标记
  return text.replace(/```html/g, '').replace(/```/g, '').trim();
}

// ─── 原单页函数（向下兼容保留）──────────────────────────────────────────────

export const reconstructManualPage = async (
  imageBase64: string,
  mimeType: string,
  pageRange: string,
): Promise<string> => {
  try {
    let cleanHtml = await callReconstructAPI(imageBase64, mimeType, pageRange);

    // 注入前端交互脚本
    if (cleanHtml.includes('</body>')) {
      cleanHtml = cleanHtml.replace('</body>', `${CLIENT_SCRIPT}</body>`);
    } else {
      cleanHtml += CLIENT_SCRIPT;
    }

    return cleanHtml;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// ─── 多页拆批翻译（新增核心函数）────────────────────────────────────────────

/**
 * 将 pageRange 拆分为每批 chunkSize 页，逐批提交给后端翻译，
 * 完成后将所有批次的 .page-container 合并为一个完整 HTML 文档返回。
 *
 * @param imageBase64   上传图片的 base64 字符串
 * @param mimeType      图片 MIME 类型
 * @param pageRange     页码范围，如 "1"、"3-10"
 * @param chunkSize     每批提交的页数，默认 2
 * @param onProgress    进度回调 (current: number, total: number) => void
 */
export const reconstructManualPages = async (
  imageBase64: string,
  mimeType: string,
  pageRange: string,
  chunkSize: number = 2,
  onProgress?: (current: number, total: number) => void,
): Promise<string> => {
  // 1. 解析 & 分批
  const pages  = parsePageRange(pageRange);
  const chunks = chunkPages(pages, chunkSize);
  const total  = chunks.length;

  let firstBatchHtml = '';
  const allContainers: string[] = [];

  // 2. 逐批翻译
  for (let i = 0; i < chunks.length; i++) {
    const rangeStr = chunkToRangeString(chunks[i]);
    const batchHtml = await callReconstructAPI(imageBase64, mimeType, rangeStr);

    // 保留第一批的完整 HTML 以提取 <head>
    if (i === 0) firstBatchHtml = batchHtml;

    // 提取本批的所有 page-container
    const containers = extractPageContainers(batchHtml);
    allContainers.push(...containers);

    // 3. 上报进度
    if (onProgress) onProgress(i + 1, total);
  }

  // 4. 组装最终 HTML
  const headHtml = extractHead(firstBatchHtml);
  const bodyContent = allContainers.join('\n\n');

  let finalHtml = `<!DOCTYPE html>
<html lang="en">
${headHtml}
<body>
${bodyContent}
${CLIENT_SCRIPT}
</body>
</html>`;

  return finalHtml;
};
