// ai说明书翻译/services/geminiService.ts

const CLIENT_SCRIPT = `
<script>
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    let currentBox: HTMLElement | null = null;
    document.body.addEventListener('click', (e: MouseEvent) => {
      const box = (e.target as HTMLElement).closest('.figure-box') as HTMLElement | null;
      if (box) { currentBox = box; fileInput.click(); }
    });
    fileInput.addEventListener('change', (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && currentBox) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const src = (evt.target as FileReader).result as string;
          currentBox!.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:contain;border-radius:4px;" />';
          currentBox!.style.border = 'none';
          currentBox!.style.background = 'transparent';
          currentBox!.style.padding = '0';
        };
        reader.readAsDataURL(file);
      }
      fileInput.value = '';
    });
  });
})();
</script>
`;

// ─── 模型预设 ─────────────────────────────────────────────────────────────────

export const MODEL_PRESETS = [
  {
    label: 'Gemini 2.5 Flash (默认)', value: 'gemini-2.5-flash-preview-04-17',
    protocol: 'gemini' as const,
    baseUrl: 'https://generativelanguage.googleapis.com'
  },
  {
    label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash',
    protocol: 'gemini' as const,
    baseUrl: 'https://generativelanguage.googleapis.com'
  },
  {
    label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro',
    protocol: 'gemini' as const,
    baseUrl: 'https://generativelanguage.googleapis.com'
  },
  {
    label: 'GPT-4o', value: 'gpt-4o',
    protocol: 'openai' as const,
    baseUrl: 'https://api.openai.com'
  },
  {
    label: 'GPT-4o mini', value: 'gpt-4o-mini',
    protocol: 'openai' as const,
    baseUrl: 'https://api.openai.com'
  },
  {
    label: '自定义模型', value: 'custom',
    protocol: 'openai' as const,
    baseUrl: ''
  },
] as const;

export type ModelPreset = typeof MODEL_PRESETS[number];

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface ApiConfig {
  apiKey:            string;
  baseUrl:           string;
  modelName:         string;
  apiProtocol:       'gemini' | 'openai';
}

export interface UsageStats {
  inputTokens:      number;
  outputTokens:     number;
  totalTokens:      number;
}



// ─── localStorage 持久化 ──────────────────────────────────────────────────────

const STORAGE_KEY = 'hvac_api_config';

export function saveApiConfig(config: ApiConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function loadApiConfig(): ApiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ApiConfig) : null;
  } catch { return null; }
}

export function clearApiConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

export function parsePageRange(pageRange: string): number[] {
  const trimmed = pageRange.trim();
  if (trimmed.includes('-')) {
    const [a, b] = trimmed.split('-').map(s => parseInt(s.trim(), 10));
    if (isNaN(a) || isNaN(b) || a > b) throw new Error(`无效的页码范围: "${pageRange}"`);
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  const single = parseInt(trimmed, 10);
  if (isNaN(single)) throw new Error(`无效的页码: "${pageRange}"`);
  return [single];
}

export function chunkPages(pages: number[], chunkSize: number = 2): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < pages.length; i += chunkSize) chunks.push(pages.slice(i, i + chunkSize));
  return chunks;
}

function chunkToRangeString(chunk: number[]): string {
  return chunk.length === 1 ? String(chunk[0]) : `${chunk[0]}-${chunk[chunk.length - 1]}`;
}

function extractPageContainers(html: string): string[] {
  const results: string[] = [];
  let searchFrom = 0;
  while (true) {
    const startIdx = html.indexOf('<div', searchFrom);
    if (startIdx === -1) break;
    const tagEnd = html.indexOf('>', startIdx);
    if (tagEnd === -1) break;
    if (!html.slice(startIdx, tagEnd + 1).includes('page-container')) {
      searchFrom = startIdx + 1; continue;
    }
    let depth = 1, pos = tagEnd + 1;
    while (depth > 0 && pos < html.length) {
      const nextOpen  = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 4; }
      else {
        depth--;
        if (depth === 0) { results.push(html.slice(startIdx, nextClose + 6)); searchFrom = nextClose + 6; break; }
        pos = nextClose + 6;
      }
    }
    if (depth !== 0) break;
  }
  return results;
}

function extractHead(html: string): string {
  const s = html.indexOf('<head'), e = html.indexOf('</head>');
  return (s !== -1 && e !== -1) ? html.slice(s, e + 7) : '';
}

// ─── 单批次 API 调用 ──────────────────────────────────────────────────────────

async function callReconstructAPI(
  imageBase64: string,
  mimeType: string,
  pageRange: string,
  apiConfig?: ApiConfig,
): Promise<{ html: string; usage: UsageStats }> {

  const body: Record<string, unknown> = { imageBase64, mimeType, pageRange };
  if (apiConfig?.apiKey) {
    body.userApiKey   = apiConfig.apiKey;
    body.userBaseUrl  = apiConfig.baseUrl;
    body.modelName    = apiConfig.modelName;
    body.apiProtocol  = apiConfig.apiProtocol;
  }

  const response = await fetch('/api/reconstruct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as any).error || `请求失败: ${response.status}`);
  }

  const data      = await response.json() as any;
  const rawHtml   = (data.text || '').replace(/```html/g, '').replace(/```/g, '').trim();
  const rawUsage  = data.usage || {};
  const inputTokens  = rawUsage.inputTokens  || 0;
  const outputTokens = rawUsage.outputTokens || 0;

  const usage: UsageStats = {
    inputTokens,
    outputTokens,
    totalTokens:      rawUsage.totalTokens || inputTokens + outputTokens,
  };

  return { html: rawHtml, usage };
}

// ─── 原单页函数（向下兼容）──────────────────────────────────────────────────

export const reconstructManualPage = async (
  imageBase64: string, mimeType: string, pageRange: string, apiConfig?: ApiConfig,
): Promise<string> => {
  try {
    let { html } = await callReconstructAPI(imageBase64, mimeType, pageRange, apiConfig);
    html = html.includes('</body>') ? html.replace('</body>', `${CLIENT_SCRIPT}</body>`) : html + CLIENT_SCRIPT;
    return html;
  } catch (e) { console.error('API Error:', e); throw e; }
};

// ─── 多页拆批翻译 ─────────────────────────────────────────────────────────────

export const reconstructManualPages = async (
  imageBase64: string,
  mimeType: string,
  pageRange: string,
  chunkSize: number = 2,
  onProgress?:    (current: number, total: number) => void,
  onUsageUpdate?: (cumulative: UsageStats) => void,
  apiConfig?:     ApiConfig,
): Promise<{ html: string; usage: UsageStats }> => {

  const pages  = parsePageRange(pageRange);
  const chunks = chunkPages(pages, chunkSize);
  const total  = chunks.length;

  let firstBatchHtml = '';
  const allContainers: string[] = [];
  const cumUsage: UsageStats = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  for (let i = 0; i < chunks.length; i++) {
    const { html: batchHtml, usage: batchUsage } =
      await callReconstructAPI(imageBase64, mimeType, chunkToRangeString(chunks[i]), apiConfig);

    if (i === 0) firstBatchHtml = batchHtml;
    allContainers.push(...extractPageContainers(batchHtml));

    cumUsage.inputTokens      += batchUsage.inputTokens;
    cumUsage.outputTokens     += batchUsage.outputTokens;
    cumUsage.totalTokens      += batchUsage.totalTokens;

    if (onProgress)    onProgress(i + 1, total);
    if (onUsageUpdate) onUsageUpdate({ ...cumUsage });
  }

  const finalHtml = `<!DOCTYPE html>
<html lang="en">
${extractHead(firstBatchHtml)}
<body>
${allContainers.join('\n\n')}
${CLIENT_SCRIPT}
</body>
</html>`;

  return { html: finalHtml, usage: cumUsage };
};
