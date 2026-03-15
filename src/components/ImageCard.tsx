import React, { useState } from 'react';
import { GeneratedImage } from '../types';
import { playClickSound, copyTextToClipboard, callGenerativeApiWithRetry } from '../utils/helpers';
import { getApiKey, getGeminiModel } from '../services/geminiService';

interface ImageCardProps {
  image: GeneratedImage;
  index: number;
  onRegenerate: (imageId: number, revisionText: string) => void;
  currentRatio: string;
  isRegenerating: boolean;
  initialStyle: string;
  generationMode: string | null;
  key?: React.Key;
}

export const ImageCard = ({ image, index, onRegenerate, currentRatio, isRegenerating, initialStyle, generationMode }: ImageCardProps) => {
  const [revision, setRevision] = useState('');
  const [videoPrompt, setVideoPrompt] = useState(image.videoPrompt || '');
  const [copyStatus, setCopyStatus] = useState('COPY PROMPT');
  const [isPromptUpdated, setIsPromptUpdated] = useState(false); 
  
  const [videoStyle, setVideoStyle] = useState(initialStyle || 'COMMERCIAL'); 
  const [ugcSubStyle, setUgcSubStyle] = useState('SOFT'); 
  
  const [scriptLanguage, setScriptLanguage] = useState('id-ID');
  const [generatedScript, setGeneratedScript] = useState(image.script || '');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false); 

  const handleRegenerateClick = () => {
    playClickSound();
    onRegenerate(image.id, revision);
    setRevision('');
  };

  const handleCopyVideoPrompt = () => {
    playClickSound();
    copyTextToClipboard(videoPrompt);
    setCopyStatus('COPIED!');
    setIsPromptUpdated(false); 
    setTimeout(() => setCopyStatus('COPY PROMPT'), 2000);
  };

  const handleAutoGenerateScript = async () => {
    playClickSound();
    setIsGeneratingScript(true);
    
    try {
      const apiKey = getApiKey(); 
      if (!apiKey) throw new Error("API Key tidak ditemukan.");

      const model = getGeminiModel();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const languageName = scriptLanguage === 'id-ID' ? 'Bahasa Indonesia' : (scriptLanguage === 'ja-JP' ? 'Japanese' : 'English');
      
      let stylePromptContext = "";
      if (videoStyle === 'COMMERCIAL') {
        stylePromptContext = "Gaya: Iklan Profesional (TVC). Nada: Meyakinkan, Elegan, Singkat, Punchy. Tujuannya branding dan sales.";
      } else if (videoStyle === 'CINEMATIC') {
        stylePromptContext = "Gaya: Film Layar Lebar. Nada: Dramatis, Puitis, Mendalam, Emosional. Seperti monolog film.";
      } else {
        stylePromptContext = `Gaya: Konten Kreator (TikTok/Reels). Nada: ${ugcSubStyle === 'HARD' ? 'Bersemangat, Promo Langsung (Hard Selling)' : 'Santai, Jujur, Teman Curhat (Soft Selling)'}. Gunakan bahasa gaul yang sopan/natural.`;
      }

      const prompt = `
      Bertindaklah sebagai Scriptwriter Video Pendek Profesional.
      Tugas: Buatkan 1 kalimat naskah pendek (maksimal 15 kata) yang SANGAT SESUAI dengan visual ini untuk diucapkan (voiceover/talking head).
      
      Konteks Visual: ${image.angle}
      ${stylePromptContext}
      Bahasa: ${languageName}.

      Output HANYA teks scriptnya saja. Jangan pakai tanda petik, label, atau instruksi scene.
      `;

      const payload = { contents: [{ parts: [{ text: prompt }] }] };
      const result = await callGenerativeApiWithRetry(apiUrl, payload);
      const script = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (script) setGeneratedScript(script);

    } catch (error) {
      console.error("Failed to generate script", error);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleGenerateVideoPrompt = (includeVoiceOver = true) => {
    playClickSound();
    
    let styleKeywords = "";
    let cameraKeywords = "";
    let lightingKeywords = "";

    if (videoStyle === 'COMMERCIAL') {
      styleKeywords = "High-End TV Commercial, luxury advertising style, product showcase, slow motion elegance, sharp focus on details, pristine look";
      cameraKeywords = "Shot on RED V-Raptor, Macro lens for details, smooth camera movement (dolly in)";
      lightingKeywords = "Professional studio lighting, softbox, rim light, glossy reflections, clean background";
    } else if (videoStyle === 'CINEMATIC') {
      styleKeywords = "Cinematic Movie Scene, dramatic atmosphere, emotional depth, blockbuster film look, color graded (teal and orange)";
      cameraKeywords = "Shot on Arri Alexa Mini, Anamorphic lens, shallow depth of field, cinematic aspect ratio";
      lightingKeywords = "Volumetric lighting, chiaroscuro (contrast light/shadow), moody atmosphere, cinematic haze";
    } else {
      const vibe = ugcSubStyle === 'HARD' ? "High energy, enthusiastic, viral content style" : "Authentic, cozy, relatable, day-in-the-life style";
      styleKeywords = `User Generated Content (UGC), TikTok/Reels aesthetic, ${vibe}, influencer style`;
      cameraKeywords = "Shot on iPhone 15 Pro, vertical video, handheld camera shake, selfie angle or POV";
      lightingKeywords = "Natural window light, ring light, bright and airy, real-life environment";
    }

    const langContext = scriptLanguage === 'id-ID' ? "Bahasa Indonesia" : (scriptLanguage === 'ja-JP' ? "Japanese" : "English");

    let speakingInstruction = "";
    
    if (includeVoiceOver) {
      speakingInstruction = generatedScript.trim() 
        ? `, talking head shot (if model present), mouth moving naturally to pronounce "${generatedScript}", lip-sync compatible` 
        : ", expressive movement, engaging visual flow";
    } else {
      speakingInstruction = ", no talking, no lip-sync, atmospheric sound only, cinematic b-roll style";
    }

    const ratioText = currentRatio === '9:16' ? '--ar 9:16' : (currentRatio === '16:9' ? '--ar 16:9' : '--ar 1:1');

    let baseVisual = image.videoPrompt ? image.videoPrompt.replace(/^create video\s+/i, '').split(',')[0] : `Shot of ${image.angle}`;
    if (image.customDetail) {
       baseVisual = `${baseVisual}, featuring ${image.customDetail}`;
    }
    
    let productConstraint = "";
    if (generationMode === 'product') {
      productConstraint = ", STRICTLY product focus, NO human faces, NO talent bodies, only hands or feet interaction allowed";
    }

    const newPrompt = `create video ${baseVisual}${productConstraint}, ${styleKeywords}, ${cameraKeywords}, ${lightingKeywords}${speakingInstruction}, ${langContext} accent hints, high fidelity, 4k, ${ratioText}`;
    
    setVideoPrompt(newPrompt);
    setIsPromptUpdated(true);
  };
  
  const handleDownloadImage = (e: React.MouseEvent) => {
    if (e) e.preventDefault();
    playClickSound();
    
    const filename = `foto-magic-affiliate-${image.id}.png`;

    fetch(image.url)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
      })
      .catch(err => {
        console.error("Download fallback error:", err);
        const link = document.createElement('a');
        link.href = image.url;
        link.download = filename;
        link.click();
      });
  };

  const getPreviewAspectClass = (ratio: string) => {
    if (ratio === '1:1') return 'aspect-[1/1]';
    if (ratio === '16:9') return 'aspect-[16/9]';
    return 'aspect-[9/16]'; 
  };

  return (
    <div className="neo-card bg-white p-4 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 bg-[#FF90E8] border-r-4 border-b-4 border-black text-black text-sm font-black px-3 py-1 z-10 uppercase tracking-wider">
        SCENE {String(index + 1).padStart(2, '0')}
      </div>

      {isRegenerating && (
        <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center border-4 border-black m-2">
          <div className="w-12 h-12 border-4 border-black border-t-[#00E5FF] rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-black text-black uppercase bg-[#FFDE59] px-2 py-1 border-2 border-black neo-shadow-sm">Memperbaiki...</p>
        </div>
      )}

      <div className="border-[3px] border-black p-1 bg-gray-100 mt-8 mb-4">
        <img 
          src={image.url} 
          alt={`Generated result: ${image.angle}`} 
          className={`w-full h-auto object-cover border-2 border-black ${getPreviewAspectClass(currentRatio)}`}
        />
      </div>
      
      <h4 className="font-black text-lg text-black uppercase tracking-tight mb-2 leading-tight">{image.angle}</h4>
      
      <div className="text-left mb-4 flex-grow">
        <textarea
          rows={2}
          className="w-full p-3 bg-[#F4F4F0] text-black border-[3px] border-black rounded-none focus:bg-[#FFE066] focus:outline-none transition-colors text-sm font-bold placeholder-gray-500 neo-shadow-sm mb-2"
          placeholder="Kosongkan untuk VARIASI BARU..."
          value={revision}
          onChange={(e) => setRevision(e.target.value)}
        ></textarea>
        <button 
          onClick={handleRegenerateClick} 
          className="w-full neo-btn bg-[#00E5FF] text-black font-black uppercase py-2 border-[3px] border-black rounded-none"
        >
          {revision.trim() ? "TERAPKAN REVISI" : "VARIASI BARU"}
        </button>
      </div>
      
      <button 
        onClick={handleDownloadImage}
        className="w-full neo-btn bg-black text-white font-black uppercase py-3 border-[3px] border-black rounded-none mb-4 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="square"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
        DOWNLOAD FOTO
      </button>

      <div className="mt-2 pt-4 border-t-4 border-black bg-[#FDFBF7] p-4 border-[3px] neo-shadow-sm text-left relative">
        <div className="absolute -top-3 right-4 bg-[#A3E635] border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase transform rotate-2">
          VIDEO AI
        </div>
        
        <div className="flex gap-1 mb-3">
          {['COMMERCIAL', 'UGC', 'CINEMATIC'].map(mode => (
            <button 
              key={mode}
              onClick={() => { playClickSound(); setVideoStyle(mode); }}
              className={`flex-1 text-[10px] font-black uppercase py-2 px-1 border-2 border-black transition-all ${videoStyle === mode ? 'bg-[#FFDE59] neo-shadow-sm translate-y-[-2px]' : 'bg-white hover:bg-gray-100'}`}
            >
              {mode.slice(0,4)}
            </button>
          ))}
        </div>

        {videoStyle === 'UGC' && (
          <div className="flex gap-2 mb-3">
             <button 
                onClick={() => { playClickSound(); setUgcSubStyle('SOFT'); }}
                className={`flex-1 text-[10px] font-black uppercase py-1 px-2 border-2 border-black transition-all ${ugcSubStyle === 'SOFT' ? 'bg-[#FF90E8]' : 'bg-white'}`}
            >
                ☁️ SOFT
            </button>
            <button 
                onClick={() => { playClickSound(); setUgcSubStyle('HARD'); }}
                className={`flex-1 text-[10px] font-black uppercase py-1 px-2 border-2 border-black transition-all ${ugcSubStyle === 'HARD' ? 'bg-[#FF5252]' : 'bg-white'}`}
            >
                🔥 HARD
            </button>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <select 
            value={scriptLanguage}
            onChange={(e) => setScriptLanguage(e.target.value)}
            className="w-full text-[10px] p-2 border-[3px] border-black bg-white text-black font-bold focus:outline-none focus:bg-[#FFE066] rounded-none neo-shadow-sm"
          >
            <option value="id-ID">INDONESIA (LIP-SYNC)</option>
            <option value="en-US">ENGLISH (UNIVERSAL)</option>
            <option value="ja-JP">JAPANESE</option>
          </select>

          <div className="relative">
            <input
              type="text"
              placeholder={videoStyle === 'CINEMATIC' ? "DIALOG DRAMATIS..." : (videoStyle === 'COMMERCIAL' ? "SLOGAN IKLAN..." : "SCRIPT SANTAI...")}
              value={generatedScript}
              onChange={(e) => setGeneratedScript(e.target.value)}
              className="w-full text-xs p-3 pr-10 border-[3px] border-black bg-white text-black font-bold focus:outline-none focus:bg-[#FFE066] rounded-none neo-shadow-sm placeholder-gray-400"
            />
            <button 
              onClick={handleAutoGenerateScript}
              disabled={isGeneratingScript}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black text-white p-1.5 border-2 border-black hover:bg-[#FFDE59] hover:text-black transition-colors"
              title="Auto Generate Script"
            >
              {isGeneratingScript ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button 
            onClick={() => handleGenerateVideoPrompt(true)}
            className="neo-btn w-full bg-[#A3E635] text-black border-[3px] border-black text-[10px] font-black uppercase py-2 rounded-none flex items-center justify-center gap-1"
          >
            <span>🎙️ DENGAN VOICEOVER</span>
          </button>
          <button 
            onClick={() => handleGenerateVideoPrompt(false)}
            className="neo-btn w-full bg-white text-black border-[3px] border-black text-[10px] font-black uppercase py-2 rounded-none flex items-center justify-center gap-1"
          >
            <span>🔇 TANPA VOICEOVER</span>
          </button>
        </div>
      </div>

      <div className="mt-4">
         <textarea
            rows={3}
            className="w-full p-3 text-[10px] border-[3px] border-black bg-gray-100 rounded-none focus:outline-none focus:bg-[#FFE066] transition-colors text-black font-mono font-bold mb-2 neo-shadow-sm"
            value={videoPrompt}
            onChange={(e) => setVideoPrompt(e.target.value)}
        ></textarea>
        <button 
            onClick={handleCopyVideoPrompt}
            className={`neo-btn w-full py-3 rounded-none text-xs font-black uppercase border-[3px] border-black transition-all
                ${copyStatus === 'COPIED!' 
                    ? 'bg-[#A3E635] text-black' 
                    : isPromptUpdated 
                        ? 'bg-[#FFDE59] text-black animate-pulse' 
                        : 'bg-black text-white hover:bg-gray-800'
                }`}
        >
            {isPromptUpdated && copyStatus !== 'COPIED!' ? '✨ COPY UPDATED PROMPT' : copyStatus}
        </button>
      </div>
    </div>
  );
};
