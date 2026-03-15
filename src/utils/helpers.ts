import { getApiKey, rotateApiKey } from '../services/geminiService';

export const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const dataUrlToGenerativePart = async (dataUrl: string) => {
  const mimeType = dataUrl.substring(dataUrl.indexOf(":") + 1, dataUrl.indexOf(";"));
  const base64Data = dataUrl.substring(dataUrl.indexOf(",") + 1);
  return {
    inlineData: { data: base64Data, mimeType: mimeType },
  };
};

export const copyTextToClipboard = (text: string) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Unable to copy', err);
  }
  document.body.removeChild(textArea);
};

export const adjustImageAspectRatio = async (base64Data: string, targetRatio: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let targetWidth, targetHeight;
      
      if (targetRatio === '9:16') {
        targetWidth = 1080;
        targetHeight = 1920; 
      } else if (targetRatio === '16:9') {
        targetWidth = 1920;
        targetHeight = 1080;
      } else { // 1:1
        targetWidth = 1080;
        targetHeight = 1080;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(`data:image/png;base64,${base64Data}`);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const x = (targetWidth - scaledWidth) / 2;
      const y = (targetHeight - scaledHeight) / 2;
      
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      
      resolve(canvas.toDataURL('image/png', 1.0)); 
    };
    img.src = `data:image/png;base64,${base64Data}`;
  });
};

export const playClickSound = () => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.error("Audio context error", e);
  }
};

export const pcmToWav = (pcmBase64: string, sampleRate = 24000) => {
  const binaryString = window.atob(pcmBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const pcmData = bytes.buffer;

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.byteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.byteLength, true);

  const wavBlob = new Blob([view, pcmData], { type: 'audio/wav' });
  return URL.createObjectURL(wavBlob);
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

export const callGenerativeApiWithRetry = async (apiUrl: string, payload: any, maxRetries = 3, timeoutMs = 30000) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          throw new Error(`API Error: ${response.statusText}`);
        }
        
        const errorMessage = errorData?.error?.message || response.statusText;

        // Handle Model Fallback (404 or 403 for preview models)
        if ((response.status === 404 || response.status === 403) && (apiUrl.includes('gemini-3') || apiUrl.includes('gemini-2.5'))) {
          let fallbackModel = 'gemini-1.5-flash';
          
          // If it's an image request, try gemini-2.5-flash-image first
          if (payload.generationConfig?.responseModalities?.includes('IMAGE')) {
            fallbackModel = 'gemini-2.5-flash-image';
          }

          console.warn(`Model not available or restricted. Falling back to ${fallbackModel}...`);
          const fallbackUrl = apiUrl.replace(/models\/[a-zA-Z0-9.-]+/, `models/${fallbackModel}`);
          
          return callGenerativeApiWithRetry(fallbackUrl, payload, maxRetries, timeoutMs);
        }

        // Handle Rate Limit (429) with Failover
        if (response.status === 429) {
          console.warn("Rate limit hit. Attempting to rotate API key...");
          const rotated = rotateApiKey();
          if (rotated) {
            const newKey = getApiKey();
            const urlObj = new URL(apiUrl);
            urlObj.searchParams.set('key', newKey);
            return callGenerativeApiWithRetry(urlObj.toString(), payload, maxRetries - 1, timeoutMs);
          }
        }

        if (errorMessage.includes('SAFETY')) {
           throw new Error('Konten diblokir oleh filter keamanan.');
        }
        throw new Error(`API Error: ${errorMessage}`);
      }

      const result = await response.json();
      return result; 

    } catch (error: any) {
      attempt++;
      if (error.name === 'AbortError') {
        console.warn(`API request timed out (attempt ${attempt})`);
      }
      
      // If it's a model error, we already handled it above with fallback
      // If it's a network error, we retry
      if (attempt >= maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Gagal menghubungi API setelah beberapa kali percobaan.');
};
