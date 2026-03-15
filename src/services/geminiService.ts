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

export const validateApiKey = async (key: string): Promise<boolean> => {
  try {
    const keys = key.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) return false;
    
    // Validate the first key as a representative
    const tempAi = new GoogleGenAI({ apiKey: keys[0] });
    // Try a very simple prompt to validate the key
    await tempAi.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "ping",
    });
    return true;
  } catch (error) {
    console.error("API Key validation failed:", error);
    return false;
  }
};

export const getGeminiModel = (modelName: string = "gemini-3-flash-preview") => {
  return modelName;
};

export const getImageModel = () => "gemini-3.1-flash-image-preview";
