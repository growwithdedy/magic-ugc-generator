import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in the environment variables.");
}

export const ai = new GoogleGenAI({ apiKey });

export const getGeminiModel = (modelName: string = "gemini-3-flash-preview") => {
  return modelName;
};
