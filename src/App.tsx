import React, { useState, useCallback, useEffect } from 'react';
import { Instagram, ExternalLink } from 'lucide-react';
import {
  VOICE_OPTIONS,
  LANGUAGE_OPTIONS,
  TONE_OPTIONS,
  SCENE_COUNT_OPTIONS,
  MODEL_FOCUS_MODES,
  PRODUCT_FOCUS_MODES,
  STORYBOARD_TYPES,
  FALLBACK_MODEL_SHOTS
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
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  const { user, accessStatus, role, isLoading: authLoading, logout } = useAuth();

  // API Key Management
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem('gemini_api_key') || '');

  const handleSaveApiKey = () => {
    const key = apiKeyInput.trim();
    if (key) {
      localStorage.setItem('gemini_api_key', key);
      setGeminiApiKey(key);
    }
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setGeminiApiKey('');
    setApiKeyInput('');
  };

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

  const ASPECT_RATIOS = ['9:16', '1:1', '16:9'];

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
        const apiKey = geminiApiKey;
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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
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

  const detectProductName = async (file: File) => {
    try {
      const imagePart = await fileToGenerativePart(file);
      const apiKey = geminiApiKey;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      const prompt = "Identifikasi produk dalam gambar ini. Berikan nama yang singkat, detail, dan deskriptif dalam Bahasa Indonesia (maksimal 4 kata, contoh: 'Kemeja Flanel Coklat', 'Botol Serum Vitamin C'). Jawab HANYA dengan nama produk.";
      const payload = { contents: [{ parts: [{ text: prompt }, imagePart] }] };
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) return file.name;
      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text.trim() || file.name;
    } catch (error) {
      console.error("Product detection failed for one image:", error);
      return file.name;
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
      const detectedName = await detectProductName(product.file);
      setProductImages(prev => prev.map(p =>
        p.id === product.id ? { ...p, name: detectedName } : p
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
    setIsDetailsConfirmed(false);

    setProductImages(prev => {
      const newImages = [...prev];
      newImages[index] = { ...newImages[index], file, name: 'Mendeteksi...' };
      return newImages;
    });

    const detectedName = await detectProductName(file);

    setProductImages(prev => {
      const newImages = [...prev];
      if (newImages[index]) {
        newImages[index] = { ...newImages[index], name: detectedName };
      }
      return newImages;
    });

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

      const apiKey = geminiApiKey;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

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

      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

      const result = await response.json();
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

      const apiKey = geminiApiKey;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

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
      const apiKey = geminiApiKey;
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
      const apiKey = geminiApiKey;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

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

      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("Gagal membuat storyboard dinamis.");

      const result = await response.json();
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
      const apiKey = geminiApiKey;
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

      const generatedResults: GeneratedImage[] = [];
      const shotsToGenerate = currentShotTypes.slice(0, sceneCount);

      for (let i = 0; i < shotsToGenerate.length; i++) {
        const shot = shotsToGenerate[i];
        const shotName = shot.name;
        setLoadingMessage(`Menciptakan Scene... (${i + 1}/${shotsToGenerate.length}: ${shotName})`);

        const prompt = `
          OBJECTIVE: INSERT THE EXACT PRODUCT FROM THE INPUT IMAGE INTO THE NEW SCENE.
          SCENE CONTEXT: ${shot.prompt}
          BACKGROUND: ${background}
        `;

        const payload = {
          contents: [{ parts: [{ text: prompt }, ...allImageParts] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        };

        const result = await callGenerativeApiWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
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
      const apiKey = geminiApiKey;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

      let payload;
      const background = selectedBackground === 'custom_bg' ? manualBackground.trim() : selectedBackground;

      if (!revisionText || revisionText.trim() === '') {
        const productImageParts = await Promise.all(productImages.map(p => fileToGenerativePart(p.file)));
        let allImageParts = [...productImageParts];
        if (generationMode === 'model' && modelImage) {
          allImageParts.unshift(await fileToGenerativePart(modelImage));
        }

        const prompt = `RE-SHOOT MODE. BACKGROUND: ${background}. Angle: ${originalImage.originalPrompt || originalImage.angle}.`;
        payload = {
          contents: [{ parts: [{ text: prompt }, ...allImageParts] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        };
      } else {
        const imageToRevisePart = await dataUrlToGenerativePart(originalImage.url);
        const prompt = `PHOTO RETOUCHING. INSTRUKSI: "${revisionText}".`;
        payload = {
          contents: [{ parts: [{ text: prompt }, imageToRevisePart] }],
          generationConfig: { responseModalities: ['IMAGE'] },
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

  const isReadyForSelection = () => {
    if (!isDetailsConfirmed) return false;
    if (generationMode === 'model') return modelImage !== null && productImages.length > 0 && !isLoading;
    if (generationMode === 'product') return productImages.length > 0 && !isLoading;
    return false;
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#FFE600] text-black border-[12px] border-black box-border">
        <div className="animate-pulse text-center">
          <div className="bg-white border-4 border-black px-8 py-4 neo-shadow inline-block">
            <h2 className="text-2xl font-black uppercase tracking-tight">Memuat...</h2>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in or not approved — show login/pending page
  if (!user || accessStatus !== 'approved') {
    return <LoginPage />;
  }

  // API Key not set — show setup screen
  if (!geminiApiKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#FFE600] text-black border-[12px] border-black box-border">
        <div className="text-center max-w-lg mx-auto p-8 animate-scale-in">
          <div className="inline-block bg-white border-4 border-black px-6 py-2 transform rotate-2 neo-shadow mb-6">
            <h2 className="text-lg font-black uppercase tracking-widest">Setup API Key</h2>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-8" style={{ textShadow: '4px 4px 0px #fff, 6px 6px 0px #000' }}>
            MAGIC<br />UGC
          </h1>

          <div className="neo-card bg-white p-8">
            <h3 className="text-lg font-black uppercase mb-4 border-b-4 border-black pb-3">
              🔑 MASUKKAN API KEY
            </h3>

            <p className="text-sm font-bold text-gray-700 mb-4 text-left">
              Masukkan API Key Google Gemini Anda.
            </p>

            <a
              href="https://s.id/caradapatapikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-[#00E5FF] text-black font-black uppercase text-xs px-4 py-2 border-2 border-black neo-shadow-sm mb-6 no-underline hover:bg-[#67e8f9] transition-colors"
            >
              📖 BACA CARA MENDAPATKAN API KEY GOOGLE DISINI
            </a>

            <input
              type="password"
              placeholder="Paste API Key di sini..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full p-4 border-4 border-black bg-white text-black font-bold focus:bg-[#FFE066] focus:outline-none neo-shadow-sm mb-4 text-sm"
            />

            <button
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput.trim()}
              className="neo-btn w-full bg-[#A3E635] text-black font-black uppercase px-6 py-4 border-4 border-black neo-shadow text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✅ SIMPAN & MULAI
            </button>

            <button
              onClick={logout}
              className="neo-btn mt-4 bg-[#FF5252] text-white font-black uppercase px-6 py-2 border-2 border-black text-sm"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-black antialiased flex flex-col selection:bg-[#00E5FF] selection:text-black">
      {/* Admin Panel (floating button, only for admins) */}
      <AdminPanel />
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
            {appState === 'result' && <button onClick={handleBackToSelection} className="neo-btn bg-white text-black font-black uppercase px-4 py-2 border-2 border-black text-sm">KEMBALI</button>}
            {appState === 'selecting' && generatedImages.length > 0 && <button onClick={handleViewResults} className="neo-btn bg-[#FF90E8] text-black font-black uppercase px-4 py-2 border-2 border-black text-sm">RIWAYAT HASIL</button>}
            <button onClick={handleReset} className={`neo-btn font-black uppercase px-4 py-2 text-sm border-2 border-black ${appState === 'welcome' ? "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none hover:transform-none" : "bg-[#FF5252] text-white"}`} disabled={appState === 'welcome'}>RESET</button>
            <button onClick={handleClearApiKey} className="neo-btn font-black uppercase px-3 py-2 text-sm border-2 border-black bg-[#FFDE59] text-black" title="Ganti API Key">🔑</button>
            <button onClick={logout} className="neo-btn font-black uppercase px-3 py-2 text-sm border-2 border-black bg-black text-white" title="Logout">🚪</button>
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
                <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-2 uppercase" style={{ textShadow: '6px 6px 0px #fff, 8px 8px 0px #000' }}>MAGIC<br />UGC</h1>
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
                      <UploadArea onDrop={onModelDrop} files={modelImage ? [{ file: modelImage, name: modelImage.name }] : []} title="1. UPLOAD MODEL" description="Maks. 1 Foto" onRemoveImage={removeModelImage} />
                      <UploadArea onDrop={onProductDrop} files={productImages} title="2. UPLOAD PRODUK" description="Maks. 2 Foto" maxFiles={2} onRemoveImage={removeProductImage} />
                    </div>
                  ) : (
                    <div className="max-w-3xl mx-auto">
                      <UploadArea onDrop={onProductDrop} files={productImages} title="UPLOAD PRODUK" description="Maks. 2 Foto" maxFiles={2} onRemoveImage={removeProductImage} />
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
                  {generatedImages.map((image, index) => <ImageCard key={image.id} image={image} index={index} onRegenerate={handleRegenerate} currentRatio={aspectRatio} isRegenerating={regeneratingId === image.id} initialStyle={storyboardType} generationMode={generationMode} apiKey={geminiApiKey} />)}
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
                            <div className="w-16 h-16 bg-[#A3E635] border-4 border-black rounded-full flex items-center justify-center mx-auto mb-4 neo-shadow-sm"><svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
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
                    <div className="inline-block bg-[#00E5FF] border-4 border-black px-6 py-2 mb-8 transform rotate-1 neo-shadow-sm"><h3 className="text-2xl font-black text-black uppercase">LANJUT KE VIDEO AI</h3></div><br />
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
