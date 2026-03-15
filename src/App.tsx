import React, { useState, useCallback, useEffect } from 'react';
import { Instagram, ExternalLink, Key, Eye, EyeOff, HelpCircle, Lock, X } from 'lucide-react';
import { 
  VOICE_OPTIONS, 
  LANGUAGE_OPTIONS, 
  TONE_OPTIONS, 
  SCENE_COUNT_OPTIONS, 
  MODEL_FOCUS_MODES, 
  PRODUCT_FOCUS_MODES, 
  STORYBOARD_TYPES,
  FALLBACK_MODEL_SHOTS,
  PRODUCT_CONSISTENCY
} from './constants';
import { 
  ProductImage, 
  GeneratedImage, 
  ShotType 
} from './types';
import { 
  fileToGenerativePart, 
  dataUrlToGenerativePart, 
  adjustImageAspectRatio, 
  playClickSound, 
  pcmToWav, 
  callGenerativeApiWithRetry 
} from './utils/helpers';
import { 
  CustomButton, 
  UploadArea, 
  AssetThumbnail, 
  AddMoreProducts 
} from './components/UI';
import { ImageCard } from './components/ImageCard';
import { updateApiKey, getApiKey, getGeminiModel, getImageModel, validateApiKey } from './services/geminiService';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  // State Management
  const [appState, setAppState] = useState('intro'); 
  const [generationMode, setGenerationMode] = useState<string | null>(null); 
  const [modelImage, setModelImage] = useState<File | null>(null);
  const [productImages, setProductImages] = useState<ProductImage[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null); 
  const [apiError, setApiError] = useState('');
  const [isDetailsConfirmed, setIsDetailsConfirmed] = useState(false); 
  
  // Recommendations and selections
  const [backgroundRecommendations, setBackgroundRecommendations] = useState<string[]>([]);
  const [selectedBackground, setSelectedBackground] = useState('');
  const [focusMode, setFocusMode] = useState(MODEL_FOCUS_MODES[0].value); 
  const [storyboardType, setStoryboardType] = useState('COMMERCIAL'); 
  const [aspectRatio, setAspectRatio] = useState('9:16'); 
  const [sceneCount, setSceneCount] = useState(8); 
  const [manualBackground, setManualBackground] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false); 
  
  // Results
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  // --- AUDIO GENERATOR STATE ---
  const [commercialScript, setCommercialScript] = useState('');
  const [selectedVoiceName, setSelectedVoiceName] = useState(VOICE_OPTIONS[0].name); 
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGE_OPTIONS[0].code); 
  const [selectedTone, setSelectedTone] = useState(TONE_OPTIONS[0].value); 
  const [selectedDuration, setSelectedDuration] = useState('30'); 
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState('');
  
  // Jingle Audio State
  const [introAudioUrl, setIntroAudioUrl] = useState<string | null>(null);
  const [showVideoOptions, setShowVideoOptions] = useState(false);

  const [userApiKey, setUserApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyValidationStatus, setKeyValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const ASPECT_RATIOS = ['9:16', '1:1', '16:9'];
  
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setUserApiKey(savedKey);
      setTempKey(savedKey);
      updateApiKey(savedKey);
      
      // Silently validate on load
      validateApiKey(savedKey).then(isValid => {
        if (!isValid) {
          // If saved key is invalid, maybe it expired or was wrong
          // We don't clear it automatically to avoid annoying the user, 
          // but we could show a warning.
          console.warn("Saved API Key is invalid.");
        }
      });
    }
  }, []);

  useEffect(() => {
    document.title = "Magic UGC Generator | by growwithdedy";
  }, []);

  useEffect(() => {
    if (generationMode === 'model') {
      setFocusMode(MODEL_FOCUS_MODES[0].value);
    } else if (generationMode === 'product') {
      setFocusMode(PRODUCT_FOCUS_MODES[0].value);
    }
  }, [generationMode]);
  
  useEffect(() => {
    const preFetchIntroAudio = async () => {
      try {
        const apiKey = getApiKey();
        if (!apiKey) return;

        const text = "Welcome to Magic UGC Generator! Let's create magic.";
        const voiceName = "Puck"; 
        
        const payload = {
          contents: [{ parts: [{ text: text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName,
                  languageCode: 'id-ID'
                }
              }
            }
          },
          model: "gemini-2.5-flash-preview-tts"
        };
    
        const result = await callGenerativeApiWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
          payload
        );
    
        const pcmData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        
        if (pcmData) {
          const wavUrl = pcmToWav(pcmData);
          setIntroAudioUrl(wavUrl);
        }
      } catch (error) {
        console.warn("Failed to pre-fetch intro audio:", error);
      }
    };

    if (appState === 'intro') {
      preFetchIntroAudio();
    }
  }, [appState]);
  
  const handleStartApp = () => {
    playClickSound();
    if (introAudioUrl) {
      const audio = new Audio(introAudioUrl);
      audio.play().catch(e => console.log("Audio play failed (interaction policy):", e));
    }
    setAppState('welcome');
  };

  const analyzeProductImage = async (file: File) => {
    try {
      const imagePart = await fileToGenerativePart(file);
      const apiKey = getApiKey(); 
      if (!apiKey) return { name: file.name, description: '' };

      const model = getGeminiModel();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const prompt = "Identify this product. Provide a concise name (max 3 words) and a brief but detailed description focusing on its physical appearance, color, and key features. Output format: Name | Description";
      const payload = { contents: [{ parts: [{ text: prompt }, imagePart] }] };
      
      const result = await callGenerativeApiWithRetry(apiUrl, payload, 2, 15000); // 2 retries, 15s timeout
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      
      if (text.includes('|')) {
        const parts = text.split('|');
        const name = parts[0]?.trim();
        const description = parts.slice(1).join('|').trim();
        return { name: name || file.name, description: description || '' };
      }
      
      return { name: text || file.name, description: '' };
    } catch (error) {
      console.error("Product analysis failed:", error);
      // Fallback to file name to prevent getting stuck in "Mendeteksi..."
      return { name: file.name, description: '' };
    }
  };

  const onModelDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setModelImage(acceptedFiles[0]);
      if (appState === 'selecting') {
        handleGetRecommendations(true);
      }
    }
  }, [appState]);

  const onProductDrop = useCallback((acceptedFiles: File[]) => {
    const newProducts = acceptedFiles.map(file => ({ 
      id: Math.random().toString(36).substr(2, 9),
      file, 
      name: 'Mendeteksi...' 
    }));

    setProductImages(prev => {
      const updatedProducts = [...prev, ...newProducts].slice(0, 2);
      setIsDetailsConfirmed(false); 
      return updatedProducts;
    });

    newProducts.forEach(async (product) => {
      // Safety timeout: if detection takes more than 20s, fallback to file name
      const safetyTimeout = setTimeout(() => {
        setProductImages(prev => prev.map(p => 
          (p.id === product.id && p.name === 'Mendeteksi...') ? { ...p, name: product.file.name, description: '' } : p
        ));
      }, 20000);

      const { name, description } = await analyzeProductImage(product.file);
      clearTimeout(safetyTimeout);
      
      setProductImages(prev => prev.map(p => 
        p.id === product.id ? { ...p, name, description } : p
      ));
    });

  }, [appState]);
  
  const removeProductImage = (indexToRemove: number) => {
    setProductImages(prev => {
      const newImages = prev.filter((_, index) => index !== indexToRemove);
      setIsDetailsConfirmed(false); 
      if (appState === 'selecting') {
        if (newImages.length === 0 || (generationMode === 'model' && !modelImage)) {
          handleReset();
        } else {
          setTimeout(() => handleGetRecommendations(true), 0);
        }
      }
      return newImages;
    });
  };
  
  const removeModelImage = () => {
    setModelImage(null);
    handleReset(); 
  }

  const handleReplaceModel = (file: File) => {
    setModelImage(file);
    if (appState === 'selecting') {
      handleGetRecommendations(true);
    }
  };

  const handleReplaceProduct = async (index: number, file: File) => {
    const newId = Math.random().toString(36).substr(2, 9);
    setIsDetailsConfirmed(false); 
    
    setProductImages(prev => {
      const newImages = [...prev];
      if (newImages[index]) {
        newImages[index] = { ...newImages[index], id: newId, file, name: 'Mendeteksi...', description: '' };
      }
      return newImages;
    });

    // Safety timeout for replacement
    const safetyTimeout = setTimeout(() => {
      setProductImages(prev => prev.map(p => 
        (p.id === newId && p.name === 'Mendeteksi...') ? { ...p, name: file.name, description: '' } : p
      ));
    }, 20000);

    const { name, description } = await analyzeProductImage(file);
    clearTimeout(safetyTimeout);
    
    setProductImages(prev => prev.map(p => 
      p.id === newId ? { ...p, name, description } : p
    ));

    if (appState === 'selecting') {
      setTimeout(() => handleGetRecommendations(true), 0);
    }
  };

  const handleDetailChange = (index: number, newName: string) => {
    setProductImages(prev => {
      const newImages = [...prev];
      newImages[index] = { ...newImages[index], name: newName };
      return newImages;
    });
    setIsDetailsConfirmed(false); 
  };

  const handleConfirmDetails = () => {
    playClickSound();
    if (productImages.some(p => p.name === 'Mendeteksi...')) return;
    setIsDetailsConfirmed(true);
  };

  const handleGetRecommendations = async (isReload = false) => {
    if (productImages.length === 0) {
      setApiError("Harap unggah minimal 1 foto produk.");
      return;
    }
    if (generationMode === 'model' && !modelImage) {
      setApiError("Mode Model membutuhkan foto model.");
      return;
    }
    
    setIsLoading(true);
    setLoadingMessage(isReload ? 'Memuat ulang rekomendasi...' : 'Mendeteksi produk...');
    setApiError('');

    try {
      const productNames = productImages.map(p => p.name);
      setLoadingMessage('Membuat rekomendasi latar...');

      let imageParts = await Promise.all(productImages.map(p => fileToGenerativePart(p.file)));
      let prompt = `Analisis produk berikut: ${productNames.join(', ')}. Berikan rekomendasi latar.`;

      if (generationMode === 'model' && modelImage) {
        const modelImagePart = await fileToGenerativePart(modelImage);
        imageParts.unshift(modelImagePart); 
        prompt = `Analisis model dan produk (${productNames.join(', ')}) ini, lalu berikan rekomendasi latar.`;
      } else if (generationMode === 'product') {
        prompt = `Analisis produk-produk ini (${productNames.join(', ')}), dan berikan rekomendasi 7 latar belakang E-commerce yang paling cocok untuk menampilkan produk secara visual yang bersih and menarik, tanpa melibatkan model manusia.`;
      }
      
      const apiKey = getApiKey(); 
      if (!apiKey) {
        setApiError("Harap atur API Key terlebih dahulu di menu pengaturan (icon kunci).");
        setIsLoading(false);
        return;
      }

      const model = getGeminiModel();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const systemPrompt = `Anda adalah seorang art director yang SANGAT PAHAM ESTETIKA LOKAL INDONESIA. 
      Tugas Anda adalah menganalisis foto model/produk, lalu memberikan 7 rekomendasi latar (background) yang bernuansa INDONESIA (lokal) dan kekinian.
      
      PENTING: Pastikan rekomendasi latar mencakup variasi gaya "POV" (Mirror Selfie, Dalam Mobil) dan lokasi "Ambient" (Kafe, Jalanan).
      
      Kembalikan HANYA dalam format JSON yang valid dengan kunci "backgrounds" (array of strings).`;

      const payload = {
        contents: [{ parts: [{ text: prompt }, ...imageParts] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { backgrounds: { type: "ARRAY", items: { type: "STRING" } } },
            required: ["backgrounds"]
          }
        }
      };

      const result = await callGenerativeApiWithRetry(apiUrl, payload);
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error("API response is empty.");

      const parsedJson = JSON.parse(responseText);
      const finalBackgrounds = ["Backdrop Putih Polos", ...(parsedJson.backgrounds || [])];

      setBackgroundRecommendations(finalBackgrounds);
      setSelectedBackground(finalBackgrounds[0]);
      if (!isReload) {
        setAppState('selecting');
      }
    } catch (error) {
      console.error("Recommendation failed:", error);
      setApiError('Gagal mendapatkan rekomendasi. Coba lagi dengan gambar lain.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenerateCommercialScript = async () => {
    playClickSound();
    setIsGeneratingScript(true);
    setAudioError('');
    
    try {
      const productNames = productImages.map(p => p.name).join(' dan ');
      const namesToUse = productNames || "Produk Fashion Premium";

      const apiKey = getApiKey(); 
      if (!apiKey) throw new Error("API Key tidak ditemukan.");

      const model = getGeminiModel();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const languageName = LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name || 'Bahasa Indonesia';
      
      let prompt = `
      Bertindaklah sebagai copywriter video pendek (TikTok/Reels). Buatkan naskah voiceover yang SANGAT NATURAL, LUWES, dan SEPERTI ORANG NGOBROL untuk produk: "${namesToUse}".
      
      Target Durasi: Kurang lebih ${selectedDuration} detik saat dibacakan dengan kecepatan normal.
      
      Bahasa: ${languageName}.
      `;

      const payload = { contents: [{ parts: [{ text: prompt }] }] };
      const result = await callGenerativeApiWithRetry(apiUrl, payload);
      
      const script = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (script) {
        setCommercialScript(script);
      } else {
        setCommercialScript(`Tampil memukau dengan gaya yang sempurna. Dapatkan koleksi ${namesToUse} eksklusif ini sekarang juga.`);
      }

    } catch (error) {
      console.error("Script generation failed:", error);
      setCommercialScript("Temukan gaya terbaikmu hari ini dengan koleksi terbaru kami. Kualitas premium untuk penampilan yang tak terlupakan.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleGlobalGenerateAudio = async () => {
    playClickSound();
    if (!commercialScript.trim()) return;
    setIsGeneratingAudio(true);
    setAudioError('');
    setAudioUrl(null);
    
    const tonePrefix = TONE_OPTIONS.find(t => t.value === selectedTone)?.prompt || '';
    const finalScript = tonePrefix + commercialScript;

    try {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error("API Key tidak ditemukan.");

      const payload = {
        contents: [{ parts: [{ text: finalScript }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoiceName, 
                languageCode: selectedLanguage 
              }
            }
          }
        },
        model: "gemini-2.5-flash-preview-tts"
      };

      const result = await callGenerativeApiWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
        payload
      );

      const pcmData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (pcmData) {
        const wavUrl = pcmToWav(pcmData); 
        setAudioUrl(wavUrl);
      } else {
        throw new Error("Gagal menghasilkan audio.");
      }

    } catch (error: any) {
      console.error("Audio generation error:", error);
      setAudioError("Gagal: " + error.message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const generateDynamicShots = async (imageParts: any[], mode = 'model', style = 'COMMERCIAL', count = 10): Promise<ShotType[]> => {
    setLoadingMessage(`Merancang Storyboard (${count} Scenes)...`);
    try {
      const apiKey = getApiKey(); 
      if (!apiKey) throw new Error("API Key tidak ditemukan.");

      const model = getGeminiModel();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      let contextPrompt = "";
      let stylePrompt = "";

      if (style === 'UGC') {
        stylePrompt = "STYLE: User Generated Content (UGC) / Creator Style.";
      } else if (style === 'CINEMATIC') {
        stylePrompt = "STYLE: CINEMATIC FILM STILL.";
      } else {
        stylePrompt = "STYLE: HIGH-END EDITORIAL PHOTOGRAPHY.";
      }

      if (mode === 'model') {
        contextPrompt = `Generate ${count} SEQUENTIAL storyboard shots for a MODEL promoting this product. ${stylePrompt}`;
      } else {
        contextPrompt = `Generate ${count} SEQUENTIAL Still Life storyboard shots. STRICTLY NO HUMAN MODELS. ${stylePrompt}`;
      }

      const systemPrompt = `You are an expert Creative Director. Your task: ${contextPrompt}. Return JSON with "shots" array of ${count} objects: {name, prompt, videoPrompt, script}.`;

      const payload = {
        contents: [{ parts: [{ text: `Generate ${count} sequential storyboard shots.` }, ...imageParts] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              shots: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    prompt: { type: "STRING" },
                    videoPrompt: { type: "STRING" },
                    script: { type: "STRING" }
                  },
                  required: ["name", "prompt", "videoPrompt", "script"]
                }
              }
            },
            required: ["shots"]
          }
        }
      };

      const result = await callGenerativeApiWithRetry(apiUrl, payload);
      const parsed = JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text);
      return parsed.shots || FALLBACK_MODEL_SHOTS;

    } catch (error) {
      console.error("Dynamic shot generation failed, using fallback:", error);
      return FALLBACK_MODEL_SHOTS;
    }
  };

  const handleGenerate = async () => {
    playClickSound();
    setShowGenerateModal(false); 

    const background = selectedBackground === 'custom_bg' ? manualBackground.trim() : selectedBackground;
    
    if (productImages.length === 0 || !background) {
      setApiError("Harap unggah minimal 1 produk dan pilih latar.");
      return;
    }
    
    if (generationMode === 'model' && !modelImage) {
      setApiError("Mode Model membutuhkan foto model.");
      return;
    }

    setIsLoading(true);
    setApiError('');
    setAppState('generating');
    setGeneratedImages([]);

    setCommercialScript('');
    setAudioUrl(null);

    try {
      // Mandatory API Key Selection for Gemini 3.1 Flash Image
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
      }

      const apiKey = getApiKey();
      if (!apiKey) throw new Error("API Key tidak ditemukan.");

      const productImageParts = await Promise.all(productImages.map(p => fileToGenerativePart(p.file)));
      let allImageParts = [...productImageParts];
      
      let currentShotTypes: ShotType[] = [];
      
      if (generationMode === 'model' && modelImage) {
        const modelImagePart = await fileToGenerativePart(modelImage);
        allImageParts.unshift(modelImagePart); 
        currentShotTypes = await generateDynamicShots(productImageParts, 'model', storyboardType, sceneCount);
      } else {
        currentShotTypes = await generateDynamicShots(productImageParts, 'product', storyboardType, sceneCount);
      }
      
      const productDescriptions = productImages.map(p => p.description).filter(Boolean).join('. ');
      
      const generatedResults: GeneratedImage[] = [];
      const shotsToGenerate = currentShotTypes.slice(0, sceneCount);

      for (let i = 0; i < shotsToGenerate.length; i++) {
        const shot = shotsToGenerate[i];
        const shotName = shot.name;
        setLoadingMessage(`Menciptakan Scene... (${i + 1}/${shotsToGenerate.length}: ${shotName})`);

        const prompt = `
          ${PRODUCT_CONSISTENCY}
          OBJECTIVE: INSERT THE EXACT PRODUCT FROM THE INPUT IMAGE INTO THE NEW SCENE.
          PRODUCT DESCRIPTION: ${productDescriptions}
          SCENE CONTEXT: ${shot.prompt}
          BACKGROUND: ${background}
        `;
        
        const imageModel = getImageModel();
        const payload = {
          contents: [{ parts: [{ text: prompt }, ...allImageParts] }],
          generationConfig: { 
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: "1K"
            }
          },
        };
 
        const result = await callGenerativeApiWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`, 
          payload
        );
        
        const base64Data = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (base64Data) {
          const processedUrl = await adjustImageAspectRatio(base64Data, aspectRatio);
          const videoRatioText = aspectRatio === '9:16' ? '--ar 9:16' : (aspectRatio === '16:9' ? '--ar 16:9' : '--ar 1:1');
          
          let videoPromptText = shot.videoPrompt;
          if (generationMode === 'product') videoPromptText += ", NO human faces";

          generatedResults.push({ 
            id: Date.now() + i, 
            url: processedUrl, 
            angle: shotName,
            videoPrompt: `create video ${videoPromptText}, ${videoRatioText}`,
            script: shot.script,
            originalPrompt: shot.prompt 
          });
        }
      }

      setGeneratedImages(generatedResults);
      setAppState('result');
      setTimeout(handleGenerateCommercialScript, 500);

    } catch (error: any) {
      console.error("Image generation failed:", error);
      setApiError(error.message || 'Gagal menghasilkan gambar. Silakan coba lagi.');
      setAppState('result');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleRegenerate = async (imageId: number, revisionText: string) => {
    const originalImage = generatedImages.find(img => img.id === imageId);
    if (!originalImage) return; 
  
    setRegeneratingId(imageId); 
    setApiError('');
    
    try {
      // Mandatory API Key Selection for Gemini 3.1 Flash Image
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
      }

      const apiKey = getApiKey();
      if (!apiKey) throw new Error("API Key tidak ditemukan.");

      const imageModel = getImageModel();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`;
      
      let payload;
      const background = selectedBackground === 'custom_bg' ? manualBackground.trim() : selectedBackground;
      const productDescriptions = productImages.map(p => p.description).filter(Boolean).join('. ');

      if (!revisionText || revisionText.trim() === '') {
        const productImageParts = await Promise.all(productImages.map(p => fileToGenerativePart(p.file)));
        let allImageParts = [...productImageParts];
        if (generationMode === 'model' && modelImage) {
          allImageParts.unshift(await fileToGenerativePart(modelImage));
        }

        const prompt = `
          ${PRODUCT_CONSISTENCY}
          RE-SHOOT MODE. 
          PRODUCT DESCRIPTION: ${productDescriptions}
          BACKGROUND: ${background}. 
          Angle: ${originalImage.originalPrompt || originalImage.angle}.
        `;
        payload = {
          contents: [{ parts: [{ text: prompt }, ...allImageParts] }],
          generationConfig: { 
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: "1K"
            }
          },
        };
      } else {
        const imageToRevisePart = await dataUrlToGenerativePart(originalImage.url);
        const prompt = `
          ${PRODUCT_CONSISTENCY}
          PHOTO RETOUCHING. 
          PRODUCT DESCRIPTION: ${productDescriptions}
          INSTRUKSI: "${revisionText}".
        `;
        payload = {
          contents: [{ parts: [{ text: prompt }, imageToRevisePart] }],
          generationConfig: { 
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: "1K"
            }
          },
        };
      }
  
      const result = await callGenerativeApiWithRetry(apiUrl, payload);
      const base64Data = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
      if (base64Data) {
        const processedUrl = await adjustImageAspectRatio(base64Data, aspectRatio);
        const newImage: GeneratedImage = { 
          id: Date.now(), 
          url: processedUrl, 
          angle: originalImage.angle,
          videoPrompt: originalImage.videoPrompt,
          customDetail: revisionText ? revisionText.trim() : undefined,
          script: originalImage.script,
          originalPrompt: originalImage.originalPrompt 
        };
        setGeneratedImages(prev => prev.map(img => img.id === imageId ? newImage : img));
      }
  
    } catch (error: any) {
      console.error("Image revision failed:", error);
      alert(error.message || 'Gagal menerapkan revisi.');
    } finally {
      setRegeneratingId(null); 
    }
  };

  const handleReset = () => {
    playClickSound();
    setAppState('welcome');
    setGenerationMode(null);
    setModelImage(null);
    setProductImages([]);
    setIsLoading(false);
    setApiError('');
    setBackgroundRecommendations([]);
    setSelectedBackground('');
    setManualBackground('');
    setGeneratedImages([]);
    setFocusMode(MODEL_FOCUS_MODES[0].value); 
    setCommercialScript('');
    setAudioUrl(null);
    setSelectedLanguage(LANGUAGE_OPTIONS[0].code);
    setSelectedVoiceName(VOICE_OPTIONS[0].name);
    setSelectedTone(TONE_OPTIONS[0].value);
    setShowVideoOptions(false); 
    setShowGenerateModal(false);
    setStoryboardType('COMMERCIAL');
    setIsDetailsConfirmed(false);
    setSelectedDuration('30');
    setSceneCount(8);
  };
  
  const handleBackToSelection = () => {
    playClickSound();
    setAppState('selecting');
    setApiError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewResults = () => {
    playClickSound();
    setAppState('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveKey = async () => {
    playClickSound();
    if (!tempKey.trim()) {
      setKeyValidationStatus('invalid');
      return;
    }

    setIsValidatingKey(true);
    setKeyValidationStatus('idle');
    
    const isValid = await validateApiKey(tempKey);
    
    setIsValidatingKey(false);
    if (isValid) {
      localStorage.setItem('gemini_api_key', tempKey);
      setUserApiKey(tempKey);
      updateApiKey(tempKey);
      setKeyValidationStatus('valid');
      setTimeout(() => {
        setShowKeyModal(false);
        setKeyValidationStatus('idle');
      }, 1500);
    } else {
      setKeyValidationStatus('invalid');
    }
  };

  const handleResetKey = () => {
    playClickSound();
    if (window.confirm('Apakah Anda yakin ingin menghapus API Key?')) {
      localStorage.removeItem('gemini_api_key');
      setUserApiKey('');
      setTempKey('');
      updateApiKey('');
      setKeyValidationStatus('idle');
      setShowKeyModal(false);
    }
  };

  const isReadyForSelection = () => {
    if (!isDetailsConfirmed) return false;
    if (generationMode === 'model') return modelImage !== null && productImages.length > 0 && !isLoading;
    if (generationMode === 'product') return productImages.length > 0 && !isLoading;
    return false;
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-black antialiased flex flex-col selection:bg-[#00E5FF] selection:text-black">
      {appState !== 'intro' && (
        <header className="px-6 py-4 border-b-[4px] border-black bg-white flex justify-between items-center top-0 z-20 sticky neo-shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-[#FFDE59] border-2 border-black w-10 h-10 flex items-center justify-center font-black text-xl neo-shadow-sm transform -rotate-6">M</div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tighter text-black uppercase leading-none">Magic UGC Generator</h1>
              <p className="text-[10px] font-bold text-black border-t-2 border-black mt-1 pt-0.5 uppercase tracking-widest inline-block bg-[#00E5FF] px-1">by growwithdedy</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-2">
              <span className="text-[8px] font-black uppercase tracking-tighter text-gray-500">Status API</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full border border-black/20 ${userApiKey ? 'bg-[#A3E635] shadow-[0_0_8px_#A3E635]' : 'bg-[#FF5252] animate-pulse'}`}></div>
                <span className={`text-[10px] font-black uppercase ${userApiKey ? 'text-[#00C853]' : 'text-[#FF5252]'}`}>
                  {userApiKey ? `${userApiKey.split(',').filter(Boolean).length} API AKTIF` : 'Nonaktif'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => { playClickSound(); setShowKeyModal(true); }} 
              className={`w-10 h-10 flex items-center justify-center border-2 border-black neo-shadow-sm transition-all ${userApiKey ? 'bg-[#A3E635]' : 'bg-[#FFDE59] animate-pulse'}`}
              title="Set API Key"
            >
              <Key size={20} />
            </button>
            {appState === 'result' && <button onClick={handleBackToSelection} className="neo-btn bg-white text-black font-black uppercase px-4 py-2 border-2 border-black text-sm">KEMBALI</button>}
            {appState === 'selecting' && generatedImages.length > 0 && <button onClick={handleViewResults} className="neo-btn bg-[#FF90E8] text-black font-black uppercase px-4 py-2 border-2 border-black text-sm">RIWAYAT HASIL</button>}
            <button onClick={handleReset} className={`neo-btn font-black uppercase px-4 py-2 text-sm border-2 border-black ${appState === 'welcome' ? "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none hover:transform-none" : "bg-[#FF5252] text-white"}`} disabled={appState === 'welcome'}>RESET</button>
          </div>
        </header>
      )}

      <main className={`${appState !== 'intro' ? 'px-4 py-6 md:px-8 md:py-8' : 'p-0'} flex-grow`}>
        <div className={appState !== 'intro' ? "max-w-6xl mx-auto" : "w-full"}>
          {appState === 'intro' && (
            <div className="flex flex-col items-center justify-center h-screen w-full bg-[#FFE600] text-black animate-scale-in border-[12px] border-black m-0 p-0 box-border">
              <div className="text-center space-y-8 p-10 max-w-4xl">
                <div className="inline-block bg-white border-4 border-black px-6 py-2 transform rotate-2 neo-shadow mb-6">
                  <h2 className="text-xl font-black uppercase tracking-widest">growwithdedy presents</h2>
                </div>
                <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-2 uppercase" style={{ textShadow: '6px 6px 0px #fff, 8px 8px 0px #000' }}>MAGIC<br/>UGC</h1>
                <div className="mt-16">
                  <button onClick={handleStartApp} className="neo-btn bg-[#00E5FF] text-black text-2xl font-black uppercase px-16 py-6 border-4 border-black neo-shadow">Mulai Sekarang!</button>
                </div>
              </div>
            </div>
          )}

          {appState === 'welcome' && (
            <div className="animate-fade-in-up text-center mt-4">
              <div className="inline-block bg-[#FF90E8] border-4 border-black px-8 py-3 transform -rotate-2 neo-shadow mb-12">
                <h2 className="text-3xl md:text-5xl font-black text-black uppercase tracking-tight">PILIH MODE GENERATOR</h2>
              </div>
              {generationMode === null ? (
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                  <div onClick={() => { playClickSound(); setGenerationMode('model'); }} className="neo-card bg-[#A3E635] p-10 cursor-pointer hover:bg-[#86efac] transition-colors flex flex-col items-center text-center group">
                    <div className="w-24 h-24 mb-6 bg-white border-4 border-black text-black flex items-center justify-center neo-shadow-sm group-hover:-translate-y-2 transition-transform">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="square" strokeLinejoin="miter" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                    </div>
                    <h3 className="text-2xl font-black text-black mb-3 uppercase border-b-4 border-black pb-2">Model Generator</h3>
                  </div>
                  <div onClick={() => { playClickSound(); setGenerationMode('product'); }} className="neo-card bg-[#00E5FF] p-10 cursor-pointer hover:bg-[#67e8f9] transition-colors flex flex-col items-center text-center group">
                    <div className="w-24 h-24 mb-6 bg-white border-4 border-black text-black flex items-center justify-center neo-shadow-sm group-hover:-translate-y-2 transition-transform">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="square" strokeLinejoin="miter" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                    </div>
                    <h3 className="text-2xl font-black text-black mb-3 uppercase border-b-4 border-black pb-2">Product Generator</h3>
                  </div>
                </div>
              ) : (
                <div className="mt-8">
                  {generationMode === 'model' ? (
                    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                      <UploadArea onDrop={onModelDrop} files={modelImage ? [{file: modelImage, name: modelImage.name}] : []} title="1. UPLOAD MODEL" description="Maks. 1 Foto" onRemoveImage={removeModelImage} />
                      <UploadArea onDrop={onProductDrop} files={productImages} title="2. UPLOAD PRODUK" description="Maks. 2 Foto" maxFiles={2} onRemoveImage={removeProductImage}/>
                    </div>
                  ) : (
                    <div className="max-w-3xl mx-auto">
                      <UploadArea onDrop={onProductDrop} files={productImages} title="UPLOAD PRODUK" description="Maks. 2 Foto" maxFiles={2} onRemoveImage={removeProductImage}/>
                    </div>
                  )}
                  {productImages.length > 0 && (
                    <div className="max-w-4xl mx-auto mt-10 neo-card bg-white p-8 text-left relative">
                      <div className="absolute -top-4 -left-4 bg-[#FF90E8] border-4 border-black px-4 py-1 font-black uppercase text-xl neo-shadow-sm transform -rotate-3">DETAIL PRODUK</div>
                      <div className="space-y-6 mt-4">
                        {productImages.map((product, index) => (
                          <div key={product.id} className="flex flex-col md:flex-row gap-4 items-center md:items-start p-4 bg-gray-100 border-4 border-black neo-shadow-sm">
                            <div className="w-20 h-20 shrink-0 bg-white border-2 border-black p-1"><img src={URL.createObjectURL(product.file)} className="w-full h-full object-cover" alt="preview" /></div>
                            <div className="flex-grow w-full">
                              <label className="text-xs font-black text-black uppercase tracking-widest block mb-2 bg-[#A3E635] inline-block px-2 py-1 border-2 border-black">ITEM {index + 1}</label>
                              <input type="text" value={product.name} onChange={(e) => handleDetailChange(index, e.target.value)} className="w-full p-3 border-4 border-black bg-white text-black font-bold focus:bg-[#FFE066] neo-shadow-sm" disabled={product.name === 'Mendeteksi...'} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-8 flex justify-end border-t-4 border-black pt-6">
                        {!isDetailsConfirmed ? <button onClick={handleConfirmDetails} disabled={productImages.some(p => p.name === 'Mendeteksi...')} className="neo-btn bg-[#00E676] text-black font-black uppercase py-3 px-8 border-[4px] border-black">KONFIRMASI DETAIL</button> : <div className="flex items-center gap-4"><div className="bg-[#A3E635] px-4 py-2 border-4 border-black neo-shadow-sm font-black uppercase">✅ DATA TERKUNCI</div><button onClick={() => setIsDetailsConfirmed(false)} className="text-sm font-black border-b-2 border-black uppercase">EDIT ULANG</button></div>}
                      </div>
                    </div>
                  )}
                  {apiError && <p className="text-white bg-[#FF5252] border-4 border-black font-black text-lg mt-6 p-4 neo-shadow inline-block uppercase">{apiError}</p>}
                  <div className="mt-12 flex flex-col items-center justify-center gap-4">
                    <CustomButton onClick={() => handleGetRecommendations(false)} disabled={!isReadyForSelection()} className="text-xl px-12 py-5">{isLoading ? loadingMessage.toUpperCase() : 'LANJUT KE STEP 2 ->'}</CustomButton>
                    <button onClick={handleReset} className="text-sm text-black font-black uppercase border-b-2 border-black hover:bg-[#FF5252] hover:text-white px-2 mt-4">X BATAL & GANTI MODE</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {appState === 'selecting' && (
            <div className="animate-fade-in-up mt-6">
              <div className="flex flex-col md:flex-row items-center justify-between mb-10 bg-white border-4 border-black p-6 neo-shadow">
                <div>
                  <h2 className="text-3xl font-black text-black uppercase tracking-tight">STUDIO SETUP</h2>
                  <p className="text-black font-bold text-sm bg-[#FFDE59] inline-block px-2 border-2 border-black mt-2 uppercase">ATUR KOMPOSISI VISUAL ANDA</p>
                </div>
                <div className="text-lg font-black text-white bg-black border-4 border-black px-4 py-2 mt-4 md:mt-0 neo-shadow-sm uppercase transform rotate-2">STEP 2 / 3</div>
              </div>
              <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
                <div className="lg:col-span-4 lg:sticky lg:top-28 z-10 self-start">
                  <div className="neo-card bg-[#FF90E8] p-6 relative mt-4">
                    <div className="absolute -top-5 left-4 bg-white border-4 border-black px-3 py-1 font-black uppercase neo-shadow-sm">ASET AKTIF</div>
                    <div className="flex flex-wrap gap-4 mt-4">
                      {generationMode === 'model' && modelImage && <AssetThumbnail file={modelImage} onRemove={removeModelImage} onReplace={handleReplaceModel} isModel={true} />}
                      {productImages.map((p, i) => <AssetThumbnail key={p.id} file={p.file} onRemove={() => removeProductImage(i)} onReplace={(file) => handleReplaceProduct(i, file)} />)}
                      {productImages.length < 2 && <AddMoreProducts onDrop={onProductDrop} disabled={productImages.length >= 2} />}
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-8 space-y-12">
                  <section className="neo-card bg-white p-6">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-6 bg-[#A3E635] inline-block px-3 border-2 border-black">1. STYLE DIRECTION</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {STORYBOARD_TYPES.map(type => (
                        <div key={type.value} onClick={() => { playClickSound(); setStoryboardType(type.value); }} className={`cursor-pointer p-4 border-[4px] border-black transition-all flex flex-col items-start gap-4 neo-shadow-sm ${storyboardType === type.value ? 'bg-[#FFDE59] transform -translate-y-1' : 'bg-gray-50 hover:bg-[#FDF8E1]'}`}>
                          <div className="text-black bg-white border-2 border-black p-2 neo-shadow-sm">{type.icon}</div>
                          <div><div className="font-black text-sm uppercase mb-1">{type.label}</div><div className="text-xs font-bold text-gray-700">{type.description}</div></div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="neo-card bg-white p-6">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-6 bg-[#00E5FF] inline-block px-3 border-2 border-black">2. FOKUS KOMPOSISI</h3>
                    <div className="flex flex-wrap gap-4">
                      {(generationMode === 'model' ? MODEL_FOCUS_MODES : PRODUCT_FOCUS_MODES).map(mode => (
                        <button key={mode.value} onClick={() => { playClickSound(); setFocusMode(mode.value); }} className={`flex-1 min-w-[140px] py-4 px-4 font-black text-sm uppercase transition-all border-4 border-black ${focusMode === mode.value ? 'bg-black text-white neo-shadow' : 'bg-white text-black hover:bg-gray-200 neo-shadow-sm hover:-translate-y-1'}`}>{mode.label}</button>
                      ))}
                    </div>
                  </section>
                  <section className="grid md:grid-cols-2 gap-8">
                    <div className="neo-card bg-[#F4F4F0] p-6">
                      <label className="text-lg font-black uppercase mb-4 block">JUMLAH SCENE</label>
                      <div className="flex flex-col gap-3">
                        {SCENE_COUNT_OPTIONS.map(opt => <button key={opt.value} onClick={() => { playClickSound(); setSceneCount(opt.value); }} className={`w-full py-3 px-4 text-sm font-black uppercase transition-all border-[3px] border-black text-left ${sceneCount === opt.value ? 'bg-[#FF5252] text-white neo-shadow-sm transform translate-x-1' : 'bg-white text-black hover:bg-gray-100'}`}>{opt.label}</button>)}
                      </div>
                    </div>
                    <div className="neo-card bg-[#F4F4F0] p-6">
                      <label className="text-lg font-black uppercase mb-4 block">ENVIRONMENT LATAR</label>
                      <select value={selectedBackground} onChange={e => { playClickSound(); setSelectedBackground(e.target.value); }} className="w-full bg-white border-[4px] border-black text-black text-sm font-black py-4 px-4 focus:outline-none focus:bg-[#FFE066] neo-shadow-sm cursor-pointer mb-4">
                        {backgroundRecommendations.map((bg, i) => <option key={i} value={bg}>{bg}</option>)}
                        <option value="custom_bg">✨ CUSTOM PROMPT...</option>
                      </select>
                      {selectedBackground === 'custom_bg' && <input type="text" placeholder="KETIK DESKRIPSI LATAR..." value={manualBackground} onChange={e => setManualBackground(e.target.value)} className="w-full bg-white border-[4px] border-black text-black placeholder-gray-400 py-4 px-4 text-sm font-black focus:outline-none focus:bg-[#FFE066] neo-shadow-sm animate-fade-in-up" />}
                    </div>
                  </section>
                  <div className="pt-8 pb-12 flex flex-col items-center">
                    <button onClick={() => { playClickSound(); setShowGenerateModal(true); }} disabled={isLoading} className="neo-btn bg-black text-[#FFDE59] text-2xl font-black py-5 px-16 border-4 border-black hover:bg-gray-900 transition-all uppercase inline-block">GENERATE SEKARANG!</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(appState === 'generating' || appState === 'result') && (
            <div className="mt-8">
              <div className="inline-block bg-[#00E5FF] border-4 border-black px-8 py-3 transform -rotate-1 neo-shadow mb-12 mx-auto flex items-center justify-center max-w-2xl">
                <h2 className="text-2xl md:text-4xl font-black text-black uppercase tracking-tight text-center">{isLoading ? "MERANCANG STORYBOARD..." : `HASIL: ${generatedImages.length} SCENES`}</h2>
              </div>
              {isLoading && (
                <div className="text-center p-12 neo-card bg-white max-w-md mx-auto">
                  <div className="w-20 h-20 border-8 border-black border-t-[#FF5252] rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-xl font-black text-black uppercase bg-[#FFDE59] inline-block px-4 py-2 border-4 border-black neo-shadow-sm">{loadingMessage}</p>
                </div>
              )}
              {apiError && !isLoading && <p className="text-black bg-[#FF5252] border-4 border-black font-black text-xl p-6 text-center neo-shadow mx-auto max-w-2xl uppercase">{apiError}</p>}
              {generatedImages.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-20">
                  {generatedImages.map((image, index) => <ImageCard key={image.id} image={image} index={index} onRegenerate={handleRegenerate} currentRatio={aspectRatio} isRegenerating={regeneratingId === image.id} initialStyle={storyboardType} generationMode={generationMode} />)}
                </div>
              )}
              {appState === 'result' && (
                <div className="mt-24 max-w-6xl mx-auto">
                  <div className="mb-12 border-b-8 border-black pb-6 flex items-end justify-between">
                    <div>
                      <h2 className="text-5xl font-black text-black uppercase tracking-tight">AUDIO STUDIO</h2>
                      <p className="text-xl text-black font-bold bg-[#A3E635] inline-block px-3 mt-2 border-2 border-black uppercase">BUAT VOICEOVER PROFESIONAL</p>
                    </div>
                  </div>
                  <div className="neo-card bg-white overflow-hidden text-black flex flex-col xl:flex-row">
                    <div className="xl:w-1/3 p-8 border-b-4 xl:border-b-0 xl:border-r-4 border-black bg-[#FDF8E1]">
                      <div className="flex items-center gap-3 mb-8 bg-black text-white p-3 neo-shadow-sm inline-flex"><h3 className="font-black text-xl uppercase">VOICE SETUP</h3></div>
                      <div className="space-y-6">
                        <div><label className="block text-sm font-black uppercase mb-2">BAHASA</label><select value={selectedLanguage} onChange={(e) => { playClickSound(); setSelectedLanguage(e.target.value); setCommercialScript(''); setAudioUrl(null); }} className="w-full bg-white border-4 border-black p-4 text-black font-bold focus:outline-none focus:bg-[#FFE066] neo-shadow-sm">{LANGUAGE_OPTIONS.map(lang => <option key={lang.code} value={lang.code}>{lang.name.toUpperCase()}</option>)}</select></div>
                        <div><label className="block text-sm font-black uppercase mb-2">KARAKTER AI</label><select value={selectedVoiceName} onChange={(e) => { playClickSound(); setSelectedVoiceName(e.target.value); }} className="w-full bg-white border-4 border-black p-4 text-black font-bold focus:outline-none focus:bg-[#FFE066] neo-shadow-sm">{VOICE_OPTIONS.map(v => <option key={v.name} value={v.name}>{v.label.toUpperCase()}</option>)}</select></div>
                        <div><label className="block text-sm font-black uppercase mb-2">NADA BICARA</label><select value={selectedTone} onChange={(e) => { playClickSound(); setSelectedTone(e.target.value); }} className="w-full bg-white border-4 border-black p-4 text-black font-bold focus:outline-none focus:bg-[#FFE066] neo-shadow-sm">{TONE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label.toUpperCase()}</option>)}</select></div>
                        <button onClick={handleGenerateCommercialScript} disabled={isGeneratingScript} className="neo-btn w-full py-4 mt-4 font-black bg-[#FF90E8] text-black border-4 border-black uppercase">{isGeneratingScript ? 'MENULIS...' : 'AUTO-WRITE SCRIPT'}</button>
                      </div>
                    </div>
                    <div className="xl:w-1/3 p-8 border-b-4 xl:border-b-0 xl:border-r-4 border-black bg-white">
                      <div className="flex items-center gap-3 mb-8 bg-black text-white p-3 neo-shadow-sm inline-flex"><h3 className="font-black text-xl uppercase">TEXT EDITOR</h3></div>
                      <textarea className="w-full h-80 p-6 border-[4px] border-black bg-[#F4F4F0] text-black font-bold text-lg resize-none focus:outline-none focus:bg-[#FFE066] neo-shadow-sm" placeholder="KETIK NASKAH DI SINI..." value={commercialScript} onChange={(e) => setCommercialScript(e.target.value)}></textarea>
                    </div>
                    <div className="xl:w-1/3 p-8 bg-[#E2F0CB] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-8 bg-black text-[#A3E635] p-3 neo-shadow-sm inline-flex"><h3 className="font-black text-xl uppercase">AUDIO PREVIEW</h3></div>
                        {audioUrl ? (
                          <div className="bg-white border-4 border-black p-6 text-center neo-shadow-sm animate-fade-in-up">
                            <div className="w-16 h-16 bg-[#A3E635] border-4 border-black rounded-full flex items-center justify-center mx-auto mb-4 neo-shadow-sm"><svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                            <audio controls src={audioUrl} className="w-full h-12 mb-6 border-2 border-black bg-gray-100" />
                            <a href={audioUrl} download="magic-affiliate-gen.wav" className="neo-btn block w-full bg-black text-[#FFDE59] text-sm font-black uppercase py-4 border-4 border-black text-center">DOWNLOAD WAV</a>
                          </div>
                        ) : <div className="bg-white border-4 border-dashed border-black p-10 text-center"><p className="text-xl font-black text-gray-400 uppercase">BELUM ADA AUDIO</p></div>}
                        {audioError && <p className="text-white bg-[#FF5252] font-black mt-6 p-4 border-4 border-black neo-shadow-sm uppercase">{audioError}</p>}
                      </div>
                      <button onClick={handleGlobalGenerateAudio} disabled={isGeneratingAudio || !commercialScript.trim()} className={`neo-btn w-full mt-8 py-5 text-xl font-black uppercase border-4 border-black ${isGeneratingAudio ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#FFDE59] text-black'}`}>{isGeneratingAudio ? 'MEMPROSES...' : 'GENERATE AUDIO'}</button>
                    </div>
                  </div>
                  <div className="mt-24 mb-24 text-center">
                    <div className="inline-block bg-[#00E5FF] border-4 border-black px-6 py-2 mb-8 transform rotate-1 neo-shadow-sm"><h3 className="text-2xl font-black text-black uppercase">LANJUT KE VIDEO AI</h3></div><br/>
                    {!showVideoOptions ? <button onClick={() => setShowVideoOptions(true)} className="neo-btn bg-black text-white px-12 py-5 font-black uppercase border-4 border-black text-xl inline-flex items-center gap-4">BUKA GENERATOR VIDEO <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg></button> : (
                      <div className="flex flex-col md:flex-row justify-center gap-6 animate-fade-in-up">
                        <button onClick={() => window.open('https://www.meta.ai', '_blank')} className="neo-btn bg-[#FF90E8] text-black px-8 py-5 font-black uppercase border-4 border-black inline-flex items-center justify-center gap-3 w-full md:w-auto text-lg">META AI</button>
                        <button onClick={() => window.open('https://grok.com', '_blank')} className="neo-btn bg-white text-black px-8 py-5 font-black uppercase border-4 border-black inline-flex items-center justify-center gap-3 w-full md:w-auto text-lg">GROK AI</button>
                        <button onClick={() => window.open('https://labs.google/flow/about', '_blank')} className="neo-btn bg-[#A3E635] text-black px-8 py-5 font-black uppercase border-4 border-black inline-flex items-center justify-center gap-3 w-full md:w-auto text-lg">GOOGLE FLOW</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {showGenerateModal && (
            <div className="fixed inset-0 bg-[#FDFBF7]/90 z-50 flex items-center justify-center animate-fade-in-up p-4">
              <div className="bg-white border-[6px] border-black p-8 max-w-md w-full neo-shadow relative">
                <button onClick={() => setShowGenerateModal(false)} className="absolute -top-6 -right-6 w-12 h-12 bg-[#FF5252] border-4 border-black text-black font-black text-2xl neo-shadow-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">X</button>
                <div className="text-center">
                  <h3 className="text-3xl font-black uppercase mb-2 bg-[#FFDE59] inline-block px-4 py-1 border-2 border-black transform -rotate-2">FORMAT OUTPUT</h3>
                  <p className="text-black font-bold mb-8 mt-4">Pilih rasio untuk {sceneCount} variasi otomatis Anda.</p>
                  <div className="mb-10">
                    <div className="grid grid-cols-3 gap-4">
                      {ASPECT_RATIOS.map(ratio => <button key={ratio} onClick={() => { playClickSound(); setAspectRatio(ratio); }} className={`py-6 px-2 text-xl font-black uppercase transition-all border-[4px] border-black ${aspectRatio === ratio ? 'bg-[#00E5FF] text-black neo-shadow transform -translate-y-1' : 'bg-white text-black hover:bg-gray-100'}`}>{ratio}</button>)}
                    </div>
                  </div>
                  <CustomButton onClick={handleGenerate} disabled={isLoading} className="w-full py-5 text-2xl bg-[#A3E635]">🚀 GENERATE!</CustomButton>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showKeyModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white border-[4px] border-black max-w-md w-full rounded-[40px] overflow-hidden neo-shadow-lg animate-fade-in-up">
            {/* Header */}
            <div className="bg-[#FFDE59] p-8 border-b-[4px] border-black relative flex flex-col items-center">
              <button 
                onClick={() => setShowKeyModal(false)} 
                className="absolute top-6 right-6 text-black/60 hover:text-black transition-colors"
              >
                <X size={28} strokeWidth={3} />
              </button>
              
              <div className="w-20 h-16 bg-white border-[4px] border-black rounded-2xl flex items-center justify-center mb-4 neo-shadow-sm transform -rotate-2">
                <Key size={36} strokeWidth={2.5} />
              </div>
              
              <h3 className="text-3xl font-black uppercase tracking-tight">API KEY SETTING</h3>
            </div>

            {/* Body */}
            <div className="p-8 space-y-8">
              {/* Step 1 */}
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Langkah 1: Dapatkan API Key Anda</p>
                <a 
                  href="https://s.id/caradapatapikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="neo-btn bg-[#FFDE59] w-full py-4 border-[4px] border-black flex items-center justify-center gap-3 font-black text-sm uppercase group"
                >
                  <div className="bg-white border-2 border-black rounded-full p-0.5 group-hover:bg-black group-hover:text-white transition-colors">
                    <HelpCircle size={18} strokeWidth={3} />
                  </div>
                  BACA CARA DAPATKAN API KEY DISINI
                </a>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Langkah 2: Masukkan API Key Dibawah Ini</p>
                <div className="text-[9px] text-gray-400 font-bold mb-2 uppercase">* Pisahkan dengan koma (,) untuk menggunakan lebih dari 1 key</div>
                <div className="relative group">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={tempKey}
                    onChange={(e) => {
                      setTempKey(e.target.value);
                      setKeyValidationStatus('idle');
                    }}
                    placeholder="........................................"
                    className={`w-full p-5 pr-14 border-[4px] rounded-[20px] bg-white text-black font-bold text-lg neo-shadow-sm focus:outline-none transition-all ${
                      keyValidationStatus === 'valid' ? 'border-[#00E676]' : 
                      keyValidationStatus === 'invalid' ? 'border-[#FF5252]' : 'border-black'
                    }`}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                  >
                    {showPassword ? <EyeOff size={24} strokeWidth={2.5} /> : <Eye size={24} strokeWidth={2.5} />}
                  </button>
                </div>
                {keyValidationStatus === 'valid' && (
                  <p className="text-[#00E676] text-xs font-black mt-2 uppercase tracking-wider">✅ {tempKey.split(',').length} API Key Valid & Aktif!</p>
                )}
                {keyValidationStatus === 'invalid' && (
                  <p className="text-[#FF5252] text-xs font-black mt-2 uppercase tracking-wider">❌ API Key Tidak Valid / Salah!</p>
                )}
              </div>

              {/* Action Button */}
              <button 
                onClick={handleSaveKey}
                disabled={isValidatingKey}
                className={`w-full py-6 border-[4px] border-black rounded-[25px] font-black text-xl uppercase neo-shadow-lg transition-all active:scale-95 ${
                  isValidatingKey ? 'bg-gray-200 cursor-wait' : 
                  keyValidationStatus === 'valid' ? 'bg-[#00E676]' : 'bg-[#00E5FF] hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
                }`}
              >
                {isValidatingKey ? 'MEMVERIFIKASI...' : 
                 keyValidationStatus === 'valid' ? 'BERHASIL DIAKTIFKAN' : 'SIMPAN & AKTIFKAN AKUN'}
              </button>

              {/* Reset Link */}
              <div className="text-center">
                <button 
                  onClick={handleResetKey}
                  className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:text-[#FF5252] transition-colors border-b-2 border-transparent hover:border-[#FF5252]"
                >
                  HAPUS / RESET API KEY
                </button>
              </div>

              {/* Footer Note */}
              <div className="flex items-start gap-2 text-gray-400">
                <Lock size={12} className="mt-0.5 shrink-0" />
                <p className="text-[8px] font-bold leading-tight uppercase text-center w-full">
                  API KEY DISIMPAN HANYA DI BROWSER LOKAL ANDA (LOCALSTORAGE) DAN TIDAK DIKIRIM KE SERVER MANAPUN.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <footer className="p-8 border-t-[4px] border-black text-center bg-[#FFDE59] mt-auto flex flex-col items-center justify-center gap-6">
        <div className="flex flex-col md:flex-row items-center justify-center gap-2">
          <p className="text-sm text-black font-black uppercase tracking-widest">2026 Magic UGC Generator</p>
          <p className="text-sm text-black font-bold border-l-0 md:border-l-4 border-black pl-0 md:pl-2">Licensed by <span className="font-black bg-white px-2 border-2 border-black inline-block transform -rotate-2">growwithdedy</span></p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a 
            href="https://instagram.com/growwithdedy" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-black text-xs uppercase neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            <Instagram size={16} /> Instagram
          </a>
          <a 
            href="https://threads.net/@growwithdedy" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-black text-xs uppercase neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            <span className="text-lg leading-none">@</span> Threads
          </a>
          <a 
            href="https://lynk.id/growwithdedy" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 bg-[#00E5FF] border-2 border-black px-4 py-2 font-black text-xs uppercase neo-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            <ExternalLink size={16} /> Tools Lainnya
          </a>
        </div>
      </footer>
    </div>
  );
}
