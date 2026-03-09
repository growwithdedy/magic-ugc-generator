import React, { useState, useRef } from 'react';
import { playClickSound } from '../utils/helpers';

export const CustomButton = ({ onClick, children, className = '', disabled = false, title = '' }: {
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
}) => (
  <button
    onClick={(e) => {
      if (!disabled) playClickSound();
      if (onClick) onClick(e);
    }}
    disabled={disabled}
    title={title}
    className={`neo-btn bg-[#FFDE59] text-black font-black uppercase py-4 px-8 border-[3px] border-black rounded-sm transition-all disabled:opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

export const FilePreview = ({ file, onRemove }: { file: File; onRemove: (e: React.MouseEvent) => void; key?: React.Key }) => (
  <div className="relative group neo-card p-1 bg-white inline-block">
    <img src={URL.createObjectURL(file)} alt={file.name} className="w-24 h-24 object-cover border-2 border-black" />
    <button 
      onClick={(e) => {
        e.stopPropagation();
        playClickSound();
        onRemove(e);
      }} 
      className="absolute -top-3 -right-3 bg-[#FF5252] text-black border-2 border-black font-black rounded-full w-8 h-8 flex items-center justify-center neo-shadow-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all z-10"
    >
      X
    </button>
  </div>
);

export const UploadArea = ({ onDrop, files, title, description, maxFiles = 1, onRemoveImage }: {
  onDrop: (files: File[]) => void;
  files: { file: File; name: string }[];
  title: string;
  description: string;
  maxFiles?: number;
  accept?: Record<string, string[]>;
  onRemoveImage: (index: number) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (files.length >= maxFiles) return;
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file: any) => file.type.startsWith('image/')) as File[];
    if (droppedFiles.length > 0) {
      onDrop(droppedFiles);
    }
  };

  const handleClick = () => {
    if (files.length < maxFiles && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onDrop(Array.from(e.target.files));
    }
  };

  return (
    <div 
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`p-8 border-[4px] border-dashed border-black bg-white rounded-md text-center transition-all neo-shadow
      ${isDragActive ? 'bg-[#FFE600] scale-[1.02]' : ''} 
      ${files.length >= maxFiles ? 'cursor-not-allowed bg-gray-200' : 'cursor-pointer hover:bg-[#FDF8E1]'}`}
    >
      <input 
        type="file" 
        ref={inputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        multiple={maxFiles > 1}
        disabled={files.length >= maxFiles}
      />
      {!files.length ? (
         <>
            <div className="w-16 h-16 mx-auto bg-black text-[#FFDE59] flex items-center justify-center rounded-sm neo-shadow-sm mb-4 transform -rotate-3">
                <svg className="w-8 h-8" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                   <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
               </svg>
            </div>
           <p className="font-black text-black text-xl uppercase tracking-tight">{title}</p>
           <p className="mt-2 text-sm text-gray-700 font-bold border-t-2 border-black inline-block pt-1">{description}</p>
        </>
      ) : (
         <div className="flex flex-wrap justify-center gap-6">
             {files.map((file, index) => <FilePreview key={index} file={file.file} onRemove={(e) => { e.stopPropagation(); onRemoveImage(index); }} />)}
         </div>
      )}
    </div>
  );
};

export const AssetThumbnail = ({ file, onRemove, onReplace, isModel = false }: {
  file: File;
  onRemove: () => void;
  onReplace: (file: File) => void;
  isModel?: boolean;
  key?: React.Key;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReplaceClick = () => {
    playClickSound();
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onReplace(e.target.files[0]);
    }
  };

  return (
    <div className="relative group w-24 h-24 shrink-0 neo-card bg-white p-1">
      <img 
        src={URL.createObjectURL(file)} 
        alt={file.name} 
        className={`w-full h-full object-cover border-2 border-black ${isModel ? 'grayscale-0' : ''}`} 
      />
      <div className="absolute inset-0 bg-[#FFDE59]/90 border-[3px] border-black flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-none m-1">
        <button onClick={handleReplaceClick} className="w-8 h-8 bg-black text-white rounded-sm flex items-center justify-center neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5" title="Ganti Gambar">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        </button>
        <button 
          onClick={() => {
            playClickSound();
            onRemove();
          }}
          className="w-8 h-8 bg-[#FF5252] text-black border-2 border-black font-black flex items-center justify-center neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5" 
          title="Hapus Gambar"
        >
          X
        </button>
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden"
        accept="image/*"
      />
    </div>
  );
};

export const AddMoreProducts = ({ onDrop, disabled }: { onDrop: (files: File[]) => void; disabled: boolean }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragActive(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragActive(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragActive(true); };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (disabled) return;
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file: any) => file.type.startsWith('image/')) as File[];
    if (droppedFiles.length > 0) {
      onDrop(droppedFiles);
    }
  };

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onDrop(Array.from(e.target.files));
    }
  };

  return (
    <div 
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`w-24 h-24 border-[3px] border-dashed border-black bg-white flex items-center justify-center text-center transition-all
      ${disabled ? 'cursor-not-allowed bg-gray-200 opacity-50' : 'cursor-pointer hover:bg-[#00E5FF] neo-shadow hover:-translate-y-1'}
      ${isDragActive ? 'bg-[#00E5FF] scale-105' : ''}`}
    >
      <input 
        type="file" 
        ref={inputRef}
        className="hidden"
        onChange={handleFileChange}
        accept="image/*"
        multiple
        disabled={disabled}
      />
      <div className="text-4xl font-black text-black">+</div>
    </div>
  );
};
