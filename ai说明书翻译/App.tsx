import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultDisplay } from './components/ResultDisplay';
import {
  reconstructManualPages, parsePageRange, chunkPages,
  saveApiConfig, loadApiConfig, clearApiConfig,
  MODEL_PRESETS, ModelPreset, UsageStats, ApiConfig,
} from './services/geminiService';
import { AppStatus, FileData } from './types';
import { Cpu, ChevronRight, Loader2, AlertCircle, Settings, X, ChevronDown } from 'lucide-react';

const CHUNK_SIZE = 2;

const App: React.FC = () => {
  const [status, setStatus]         = useState<AppStatus>(AppStatus.IDLE);
  const [fileData, setFileData]     = useState<FileData | null>(null);
  const [pageInput, setPageInput]   = useState<string>('1');
  const [resultHtml, setResultHtml] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [progress, setProgress]     = useState<{ current: number; total: number } | null>(null);
  const [usage, setUsage]           = useState<UsageStats | null>(null);
  const [usedModel, setUsedModel]   = useState<string>('');

  // API 设置
  const [showApiSettings, setShowApiSettings]   = useState(false);
  const [apiKey, setApiKey]                     = useState('');
  const [baseUrl, setBaseUrl]                   = useState('');
  const [selectedPreset, setSelectedPreset]     = useState<ModelPreset>(MODEL_PRESETS[0]);
  const [customModelName, setCustomModelName]   = useState('');
  const [savedToast, setSavedToast]             = useState(false);

  const isCustom = selectedPreset.value === 'custom';

  // 挂载时恢复配置
  useEffect(() => {
    const config = loadApiConfig();
    if (!config) return;
    setApiKey(config.apiKey || '');
    setBaseUrl(config.baseUrl || '');
    const preset = MODEL_PRESETS.find(p => p.value === config.modelName)
                ?? MODEL_PRESETS.find(p => p.value === 'custom')!;
    setSelectedPreset(preset as ModelPreset);
    if (preset.value === 'custom') {
      setCustomModelName(config.modelName || '');
    }
  }, []);

  // 选择预设时自动填充 BaseURL
  const handlePresetChange = (value: string) => {
    const preset = MODEL_PRESETS.find(p => p.value === value) ?? MODEL_PRESETS[0];
    setSelectedPreset(preset as ModelPreset);
    if (preset.value !== 'custom' && preset.baseUrl) setBaseUrl(preset.baseUrl);
    else if (preset.value === 'custom') setBaseUrl('');
  };

  const handleSaveConfig = () => {
    const finalModelName = isCustom ? customModelName : selectedPreset.value;
    saveApiConfig({
      apiKey, baseUrl,
      modelName:         finalModelName,
      apiProtocol:       selectedPreset.protocol,
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleClearConfig = () => {
    setApiKey(''); setBaseUrl('');
    setSelectedPreset(MODEL_PRESETS[0] as ModelPreset);
    setCustomModelName(''); setCustomInputPrice('0'); setCustomOutputPrice('0');
    clearApiConfig();
  };

  const handleReconstruct = async () => {
    if (!fileData || !pageInput) return;

    setErrorMsg(null); setProgress(null); setUsage(null);
    setStatus(AppStatus.LOCATING_PAGE);

    const finalModelName = isCustom ? customModelName : selectedPreset.value;
    setUsedModel(finalModelName || selectedPreset.label);

    setTimeout(async () => {
      setStatus(AppStatus.GENERATING);

      // 预算批数，立即初始化进度条
      let initialTotal = 1;
      try {
        initialTotal = chunkPages(parsePageRange(pageInput), CHUNK_SIZE).length;
      } catch (_) {}
      setProgress({ current: 0, total: initialTotal });

      // 构建 ApiConfig
      const apiConfig: ApiConfig | undefined = apiKey ? {
        apiKey,
        baseUrl: baseUrl || selectedPreset.baseUrl,
        modelName:         finalModelName,
        apiProtocol:       selectedPreset.protocol,
      } : undefined;

      try {
        const { html, usage: finalUsage } = await reconstructManualPages(
          fileData.base64, fileData.mimeType, pageInput,
          CHUNK_SIZE,
          (cur, tot) => setProgress({ current: cur, total: tot }),
          (cum)      => setUsage(cum),
          apiConfig,
        );
        setResultHtml(html);
        setUsage(finalUsage);
        setStatus(AppStatus.COMPLETE);
      } catch (e: any) {
        setErrorMsg(e.message || '重构过程中发生错误。');
        setStatus(AppStatus.ERROR);
      }
    }, 1500);
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE); setResultHtml(null);
    setErrorMsg(null); setProgress(null); setUsage(null);
  };

  const progressPercent = progress
    ? progress.current === 0 ? 5 : Math.round((progress.current / progress.total) * 100)
    : 0;

  const progressLabel = progress
    ? progress.current === 0
      ? `正在提交第 1 / ${progress.total} 批，请稍候...`
      : `正在处理第 ${progress.current} / ${progress.total} 批，翻译内容并映射工程图表...`
    : '正在生成 HTML 结构，翻译内容并映射工程图表...';

  const displayModelName = isCustom ? (customModelName || '自定义') : selectedPreset.label;

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm"><Cpu size={24} /></div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 leading-tight">唐阳的AI说明书翻译</h1>
              <p className="text-xs text-slate-500">AI驱动的高保真翻译工具</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* API 设置按钮 */}
            <button
              onClick={() => setShowApiSettings(v => !v)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-all
                ${showApiSettings ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <Settings size={14} />
              {apiKey ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="hidden sm:inline max-w-[100px] truncate text-xs">{displayModelName}</span>
                </span>
              ) : 'API 设置'}
              <ChevronDown size={12} className={`transition-transform ${showApiSettings ? 'rotate-180' : ''}`} />
            </button>
            {/* 系统状态 */}
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
              <span className={`w-2 h-2 rounded-full ${status === AppStatus.GENERATING ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
              系统就绪
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* ── API 设置面板 ── */}
          {showApiSettings && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-amber-800">⚙️ API 配置</p>
                  <p className="text-xs text-amber-600 mt-0.5">留空 Key 则使用服务器默认配置</p>
                </div>
                <button onClick={() => setShowApiSettings(false)} className="text-amber-400 hover:text-amber-700"><X size={16} /></button>
              </div>

              {/* 模型选择 */}
              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1">模型选择</label>
                <div className="relative">
                  <select
                    value={selectedPreset.value}
                    onChange={e => handlePresetChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg appearance-none focus:ring-2 focus:ring-amber-400 outline-none"
                  >
                    {MODEL_PRESETS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-2.5 text-amber-400 pointer-events-none" />
                </div>
                
              </div>

              {/* 自定义模型名称 */}
              {isCustom && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-amber-800 mb-1">自定义模型名称</label>
                    <input
                      type="text" value={customModelName}
                      onChange={e => setCustomModelName(e.target.value)}
                      placeholder="例如: claude-3-5-sonnet-20241022"
                      className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  </div>
                </>
              )}

              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1">API Key</label>
                <input
                  type="password" value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="AIza... 或 sk-..."
                  className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  API Base URL
                  <span className="ml-1 font-normal text-amber-500">（兼容 OpenAI 格式的代理也可用）</span>
                </label>
                <input
                  type="text" value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  placeholder={selectedPreset.baseUrl || 'https://your-proxy.com'}
                  className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveConfig}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm py-1.5 rounded-lg font-medium transition-all">
                  {savedToast ? '已保存 ✓' : '保存配置'}
                </button>
                <button onClick={handleClearConfig}
                  className="px-3 py-1.5 text-sm text-amber-700 bg-white border border-amber-200 rounded-lg hover:bg-amber-100 transition-all">
                  清除
                </button>
              </div>
            </div>
          )}

          {/* ── 主控制卡片 ── */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded flex items-center justify-center text-xs">1</span>
              源文件
            </h2>
            <FileUpload fileData={fileData} onFileSelect={setFileData} />

            <div className="mt-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded flex items-center justify-center text-xs">2</span>
                页面配置
              </h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">物理页码</label>
                <div className="relative">
                  <input
                    type="text" value={pageInput}
                    onChange={e => setPageInput(e.target.value)}
                    placeholder="例如：5 或 5-6"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                  <div className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium bg-white px-1">索引</div>
                </div>
                <p className="text-xs text-slate-400 mt-2">*使用PDF文件的物理顺序页码，忽略页面底部印刷的页码。</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={handleReconstruct}
                disabled={!fileData || !pageInput || status === AppStatus.GENERATING || status === AppStatus.LOCATING_PAGE}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-medium shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {(status === AppStatus.GENERATING || status === AppStatus.LOCATING_PAGE) ? (
                  <><Loader2 size={20} className="animate-spin" />处理中...</>
                ) : (
                  <><span>开始重构</span><ChevronRight size={18} /></>
                )}
              </button>
              {/* 当前模型提示 */}
              <p className="text-center text-xs text-slate-400 mt-2">
                当前模型：<span className="font-medium text-slate-500">{displayModelName}</span>
              </p>
            </div>
          </div>

          {/* ── 状态消息 ── */}
          {status !== AppStatus.IDLE && status !== AppStatus.COMPLETE && status !== AppStatus.ERROR && (
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
              <Loader2 className="animate-spin shrink-0 mt-0.5" size={18} />
              <div className="w-full">
                <p className="font-semibold text-sm">
                  {status === AppStatus.LOCATING_PAGE ? '系统激活' : '分析结构'}
                </p>
                <p className="text-xs mt-1 opacity-80">
                  {status === AppStatus.LOCATING_PAGE
                    ? `正在定位物理 PDF 页码 [${pageInput}]。（忽略印刷页码）`
                    : progressLabel}
                </p>
                {status === AppStatus.GENERATING && progress && progress.total > 1 && (
                  <div className="mt-3">
                    <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${progressPercent}%` }} />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-blue-500 opacity-70">每批 {CHUNK_SIZE} 页</p>
                      <p className="text-xs text-blue-600 font-medium">{progress.current} / {progress.total} 批完成</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 错误消息 ── */}
          {status === AppStatus.ERROR && (
            <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-100 flex items-start gap-3">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-semibold text-sm">重构失败</p>
                <p className="text-xs mt-1 opacity-80">{errorMsg}</p>
                <button onClick={handleReset} className="text-xs font-bold underline mt-2 hover:text-red-900">重试</button>
              </div>
            </div>
          )}

          {/* ── Token 用量面板 ── */}
          {usage !== null && (
            <div className={`rounded-xl border p-4 text-sm animate-in fade-in duration-300
              ${status === AppStatus.COMPLETE ? 'bg-green-50 border-green-200 text-green-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <p className="font-bold mb-2 flex items-center gap-1.5">
                📊 Token 用量
                {status === AppStatus.COMPLETE && (
                  <span className="text-xs font-normal text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">翻译完成</span>
                )}
              </p>
              {usedModel && (
                <p className="text-xs opacity-60 mb-2 truncate">模型：{usedModel}</p>
              )}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="opacity-70">输入 Tokens</span>
                  <span className="font-mono font-medium">{usage.inputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">输出 Tokens</span>
                  <span className="font-mono font-medium">{usage.outputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-current border-opacity-10 pt-1 mt-1">
                  <span className="opacity-70">总计 Tokens</span>
                  <span className="font-mono font-medium">{usage.totalTokens.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Right Preview Panel ── */}
        <div className="lg:col-span-8 h-[600px] lg:h-auto min-h-[500px]">
          {resultHtml ? (
            <ResultDisplay htmlContent={resultHtml} sourceImageBase64={fileData?.base64} sourceMimeType={fileData?.mimeType} />
          ) : (
            <div className="w-full h-full border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-20 h-20 bg-white rounded-full shadow-sm mb-4 flex items-center justify-center">
                <Cpu size={32} className="text-slate-300" />
              </div>
              <p className="text-lg font-medium text-slate-500">准备就绪</p>
              <p className="text-sm mt-2 max-w-sm">上传说明书页面图片并指定页码，即可生成高保真 HTML 重构页面。</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default App;
