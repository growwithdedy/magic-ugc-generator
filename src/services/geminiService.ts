import { GoogleGenAI } from "@google/genai";

let currentApiKeys: string[] = (process.env.GEMINI_API_KEY || "").split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

export let ai = new GoogleGenAI({ apiKey: currentApiKeys[0] || "" });

export const updateApiKey = (newKeysString: string) => {
  const keys = newKeysString.split(',').map(k => k.trim()).filter(Boolean);
  currentApiKeys = keys;
  currentKeyIndex = 0;
  if (keys.length > 0) {
    ai = new GoogleGenAI({ apiKey: keys[0] });
  }
};

export const getApiKey = () => currentApiKeys[currentKeyIndex] || "";

export const rotateApiKey = () => {
  if (currentApiKeys.length <= 1) return false;
  currentKeyIndex = (currentKeyIndex + 1) % currentApiKeys.length;
  ai = new GoogleGenAI({ apiKey: currentApiKeys[currentKeyIndex] });
  console.log(`Switched to API Key #${currentKeyIndex + 1}`);
  return true;
};

export const validateApiKey = async (key: string): Promise<{ valid: boolean; error?: string }> => {
  const keys = key.split(',').map(k => k.trim()).filter(Boolean);
  if (keys.length === 0) return { valid: false, error: "Key tidak boleh kosong" };
  
  // Just check if it looks like a Google API Key (usually starts with AIza)
  const isValidFormat = keys.every(k => k.startsWith("AIza") && k.length > 20);
  
  if (!isValidFormat) {
    return { 
      valid: false, 
      error: "Format API Key tidak valid. Pastikan diawali dengan 'AIza'." 
    };
  }

  return { valid: true };
};

export const getGeminiModel = (modelName: string = "gemini-3-flash-preview") => {
  return modelName;
};

export const getImageModel = () => "gemini-3.1-flash-image-preview";
