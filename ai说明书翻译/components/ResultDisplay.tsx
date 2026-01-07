import React, { useState, useEffect, useRef } from 'react';
import { Code, Eye, Download, ImagePlus } from 'lucide-react';

interface ResultDisplayProps {
  htmlContent: string;
  sourceImageBase64?: string;
  sourceMimeType?: string;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ htmlContent, sourceImageBase64, sourceMimeType }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [processedHtml, setProcessedHtml] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);

  // Initialize processed HTML
  useEffect(() => {
    if (htmlContent) {
      setProcessedHtml(htmlContent);
    }
  }, [htmlContent]);

  // Handle Container Click (Event Delegation)
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('.figure-box');
    
    if (target && activeTab === 'preview') {
      // Find which box index this is
      const allBoxes = document.querySelectorAll('.figure-box');
      // Convert NodeList to array to find index
      const index = Array.from(allBoxes).indexOf(target);
      
      if (index !== -1) {
        setSelectedBoxIndex(index);
        fileInputRef.current?.click();
      }
    }
  };

  // Handle File Selection
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedBoxIndex !== null) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        
        // Parse current HTML string into a DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(processedHtml, 'text/html');
        
        // Find the specific box
        const boxes = doc.querySelectorAll('.figure-box');
        const targetBox = boxes[selectedBoxIndex] as HTMLElement;
        
        if (targetBox) {
          // Replace content with Image
          targetBox.innerHTML = `<img src="${base64Data}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px;" />`;
          
          // Remove dashed border style for cleaner look
          targetBox.style.border = 'none';
          targetBox.style.background = 'transparent';
          
          // Update the state with new HTML
          // documentElement.outerHTML gets the full <html>...</html> string
          setProcessedHtml(doc.documentElement.outerHTML);
        }
        
        // Reset
        setSelectedBoxIndex(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([processedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manual_page.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex bg-slate-200/60 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === 'preview' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye size={16} />
            预览 & 编辑
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === 'code' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code size={16} />
            源码
          </button>
        </div>
        
        <div className="flex items-center gap-2">
           {activeTab === 'preview' && (
             <span className="text-xs text-slate-400 hidden sm:flex items-center gap-1 mr-2">
               <ImagePlus size={12} />
               点击图框上传图片
             </span>
           )}
          <button
            onClick={handleDownload}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="下载 HTML 源码"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-slate-100">
        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleImageUpload}
        />

        {activeTab === 'preview' ? (
          <div className="w-full h-full overflow-auto flex justify-center p-8">
             {/* 
                We use a ref-less approach for the click listener via bubbling 
                to avoid complex ref merging with the dangerous HTML div.
             */}
             <div 
               className="shadow-xl bg-white min-h-[297mm] min-w-[210mm] origin-top scale-75 md:scale-100 transition-transform"
               onClick={handlePreviewClick}
               dangerouslySetInnerHTML={{ __html: processedHtml }} 
             />
          </div>
        ) : (
          <div className="w-full h-full overflow-auto bg-slate-900 p-4">
            <pre className="font-mono text-sm text-slate-300 whitespace-pre-wrap break-all">
              {processedHtml}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};