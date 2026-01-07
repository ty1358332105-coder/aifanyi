import React, { ChangeEvent } from 'react';
import { UploadCloud, File as FileIcon, X, FileText } from 'lucide-react';
import { FileData } from '../types';

interface FileUploadProps {
  fileData: FileData | null;
  onFileSelect: (data: FileData | null) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ fileData, onFileSelect }) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Extract base64 and mimetype
        // data:image/png;base64,.....
        const base64Data = result.split(',')[1];
        const mimeType = result.split(';')[0].split(':')[1];

        onFileSelect({
          file,
          previewUrl: URL.createObjectURL(file),
          base64: base64Data,
          mimeType,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFile = () => {
    onFileSelect(null);
  };

  if (fileData) {
    const isPdf = fileData.mimeType === 'application/pdf';

    return (
      <div className="relative group w-full border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex items-center gap-4 transition-all">
        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
          {isPdf ? (
            <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500">
               <FileText size={32} />
            </div>
          ) : (
            <img src={fileData.previewUrl} alt="Preview" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{fileData.file.name}</p>
          <p className="text-xs text-slate-500">{(fileData.file.size / 1024).toFixed(1)} KB</p>
        </div>
        <button 
          onClick={clearFile}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-blue-400 transition-all">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadCloud className="w-8 h-8 mb-3 text-slate-400" />
          <p className="text-sm text-slate-500 font-medium">点击上传页面图片或 PDF</p>
          <p className="text-xs text-slate-400 mt-1">支持 PNG, JPG, WEBP, PDF</p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept="image/*,application/pdf"
          onChange={handleFileChange} 
        />
      </label>
    </div>
  );
};