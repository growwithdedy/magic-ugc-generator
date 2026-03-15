import { GoogleGenAI } from "@google/genai";

let currentApiKey = process.env.GEMINI_API_KEY || "";

export let ai = new GoogleGenAI({ apiKey: currentApiKey });

export const updateApiKey = (newKey: string) => {
  const trimmedKey = newKey.trim();
  currentApiKey = trimmedKey;
  ai = new GoogleGenAI({ apiKey: trimmedKey });
};

export const getApiKey = () => currentApiKey;

export const validateApiKey = async (key: string): Promise<boolean> => {
  try {
    const tempAi = new GoogleGenAI({ apiKey: key });
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
