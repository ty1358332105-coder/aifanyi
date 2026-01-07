import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultDisplay } from './components/ResultDisplay';
import { reconstructManualPage } from './services/geminiService';
import { AppStatus, FileData } from './types';
import { Cpu, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [pageInput, setPageInput] = useState<string>('1');
  const [resultHtml, setResultHtml] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleReconstruct = async () => {
    if (!fileData || !pageInput) return;

    setErrorMsg(null);
    setStatus(AppStatus.LOCATING_PAGE);

    // Simulate the "Locating Physical PDF Page(s)..." delay from the prompt role definition
    // This gives the user feedback matching the requested persona.
    setTimeout(async () => {
      setStatus(AppStatus.GENERATING);
      try {
        const html = await reconstructManualPage(fileData.base64, fileData.mimeType, pageInput);
        setResultHtml(html);
        setStatus(AppStatus.COMPLETE);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e.message || "重构过程中发生错误。");
        setStatus(AppStatus.ERROR);
      }
    }, 1500);
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setResultHtml(null);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
              <Cpu size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 leading-tight">AI说明书翻译</h1>
              <p className="text-xs text-slate-500">AI驱动的高保真翻译工具</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
            <span className={`w-2 h-2 rounded-full ${status === AppStatus.GENERATING ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></span>
            系统就绪
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid lg:grid-cols-12 gap-8">
        
        {/* Left Control Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6">
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
                    type="text" 
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    placeholder="例如：5 或 5-6"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                  <div className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium bg-white px-1">
                    索引
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  *使用PDF文件的物理顺序页码，忽略页面底部印刷的页码。
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={handleReconstruct}
                disabled={!fileData || !pageInput || status === AppStatus.GENERATING || status === AppStatus.LOCATING_PAGE}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-medium shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {(status === AppStatus.GENERATING || status === AppStatus.LOCATING_PAGE) ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    开始重构
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status Messages */}
          {status !== AppStatus.IDLE && status !== AppStatus.COMPLETE && status !== AppStatus.ERROR && (
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Loader2 className="animate-spin shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-semibold text-sm">
                  {status === AppStatus.LOCATING_PAGE ? "系统激活" : "分析结构"}
                </p>
                <p className="text-xs mt-1 opacity-80">
                  {status === AppStatus.LOCATING_PAGE 
                    ? `正在定位物理 PDF 页码 [${pageInput}]。（忽略印刷页码）`
                    : "正在生成 HTML 结构，翻译内容并映射工程图表..."}
                </p>
              </div>
            </div>
          )}

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
        </div>

        {/* Right Preview Panel */}
        <div className="lg:col-span-8 h-[600px] lg:h-auto min-h-[500px]">
          {resultHtml ? (
            <ResultDisplay 
              htmlContent={resultHtml} 
              sourceImageBase64={fileData?.base64} 
              sourceMimeType={fileData?.mimeType}
            />
          ) : (
            <div className="w-full h-full border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-20 h-20 bg-white rounded-full shadow-sm mb-4 flex items-center justify-center">
                <Cpu size={32} className="text-slate-300" />
              </div>
              <p className="text-lg font-medium text-slate-500">准备就绪</p>
              <p className="text-sm mt-2 max-w-sm">
                上传说明书页面图片并指定页码，即可生成高保真 HTML 重构页面。
              </p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default App;