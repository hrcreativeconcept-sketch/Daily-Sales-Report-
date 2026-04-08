
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SalesItem } from "../types";

const ITEM_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      productName: { type: Type.STRING, description: "Full descriptive name of the product. Correct typos and expand abbreviations." },
      sku: { type: Type.STRING, description: "Unique identifier, model number, or barcode if visible." },
      quantity: { type: Type.NUMBER, description: "Number of units. Default to 1 if not explicitly stated." },
      unitPrice: { type: Type.NUMBER, description: "Price per single unit. If only total is given, divide by quantity." },
      currency: { type: Type.STRING, description: "3-letter ISO code (e.g., AED, USD, SAR). Use context to infer if missing." },
      notes: { type: Type.STRING, description: "Additional details like color, size, or specific customer requests." },
      lowConfidence: { type: Type.BOOLEAN, description: "Set to true if text is blurry, handwriting is messy, or data is missing." },
    },
    required: ["productName", "quantity", "unitPrice"],
  },
};

const SYSTEM_INSTRUCTION = `
You are a high-performance sales data extraction engine. Your goal is to convert unstructured input (text, images, audio) into clean, structured JSON sales records with 100% accuracy.

Rules:
1. PRODUCT IDENTIFICATION: Extract the full product name. Clean up common OCR/Voice errors (e.g., "iPhon" -> "iPhone").
2. QUANTITY: Always identify the quantity. Default to 1 if not specified.
3. PRICING: Extract unit prices. If a total is given for multiple units, calculate the unit price (Total / Quantity).
4. CURRENCY: Detect currency symbols or codes ($, AED, SAR, etc.). Default to the most common one in the context if missing.
5. CONFIDENCE: Set lowConfidence to true ONLY if the data is genuinely illegible or highly ambiguous.
6. NO HALLUCINATIONS: Do not invent items. Only extract what is present.
7. MULTI-ITEM: If multiple items are listed, return an array containing all of them.
`;

/**
 * Checks if a valid API key is available in the environment.
 */
export const hasValidKey = (): boolean => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return false;
  const invalidStrings = ["undefined", "null", "", "false", "0"];
  return key.length > 10 && !invalidStrings.includes(key.toLowerCase());
};

/**
 * Triggers the native API key selection dialog in AI Studio.
 */
export const requestKeySelection = async (): Promise<boolean> => {
  if (typeof window !== 'undefined' && window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
    try {
      await window.aistudio.openSelectKey();
      // Per guidelines: proceed immediately as if successful to mitigate race conditions
      return true;
    } catch (e) {
      console.error("Failed to open key selector:", e);
      return false;
    }
  }
  return false;
};

/**
 * Ensures an API key is selected.
 */
export const ensureApiKey = async (): Promise<boolean> => {
  if (hasValidKey()) return true;
  try {
    if (typeof window !== 'undefined' && window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      return await window.aistudio.hasSelectedApiKey();
    }
  } catch (e) {}
  return false;
};

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

/**
 * Creates or retrieves a cached instance of the Gemini AI client.
 */
const getClient = async () => {
  const currentKey = process.env.GEMINI_API_KEY || '';
  
  if (cachedClient && cachedKey === currentKey) {
    return cachedClient;
  }

  cachedKey = currentKey;
  cachedClient = new GoogleGenAI({ 
    apiKey: currentKey,
    // @ts-ignore
    fetch: (url, options) => fetch(url, options)
  });
  
  return cachedClient;
};

// Use gemini-3-flash-preview for high speed and excellent extraction accuracy
const DEFAULT_MODEL = "gemini-3-flash-preview";

export const parseFromText = async (text: string): Promise<SalesItem[]> => {
  const ai = await getClient();
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Extract all sales items from this text. If it's a list, extract every row: "${text}"`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    
    const rawText = response.text;
    if (!rawText) return [];
    
    try {
      return JSON.parse(rawText);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw response:", rawText);
      // Fallback: try to find JSON block if it's wrapped in markdown
      const jsonMatch = rawText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("Invalid response format from AI engine.");
    }
  } catch (error: any) {
    console.error("Gemini parseFromText error:", error);
    if (error.message?.includes("entity was not found") && window.aistudio) {
      window.aistudio.openSelectKey();
    }
    throw error;
  }
};

export const parseFromFile = async (base64Data: string, mimeType: string): Promise<SalesItem[]> => {
  const ai = await getClient();
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Analyze this image/document and extract every sales item, quantity, and price. Look for tables or lists." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    
    const rawText = response.text;
    if (!rawText) return [];
    
    try {
      return JSON.parse(rawText);
    } catch (parseError) {
      console.error("JSON Parse Error (File). Raw response:", rawText);
      const jsonMatch = rawText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error("Invalid response format from AI engine.");
    }
  } catch (error: any) {
    console.error("Gemini parseFromFile error:", error);
    throw error;
  }
};

export const parseFromAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<SalesItem[]> => {
  const ai = await getClient();
  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Audio } },
          { text: "Transcribe this sales dictation and extract all items mentioned with their quantities and prices." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    
    const rawText = response.text;
    if (!rawText) return [];
    
    try {
      return JSON.parse(rawText);
    } catch (parseError) {
      console.error("JSON Parse Error (Audio). Raw response:", rawText);
      const jsonMatch = rawText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error("Invalid response format from AI engine.");
    }
  } catch (error: any) {
    console.error("Gemini parseFromAudio error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  const ai = await getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error: any) {
    console.error("Speech Gen Error:", error);
    return undefined;
  }
};
