
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SalesItem } from "../types";

const ITEM_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      productName: { type: Type.STRING, description: "Name of the product sold" },
      sku: { type: Type.STRING, description: "Stock keeping unit or model number" },
      quantity: { type: Type.NUMBER, description: "Number of units sold" },
      unitPrice: { type: Type.NUMBER, description: "Price per single unit" },
      currency: { type: Type.STRING, description: "ISO Currency code" },
      notes: { type: Type.STRING, description: "Any additional details or corrections" },
      lowConfidence: { type: Type.BOOLEAN, description: "True if the data was blurry or unclear" },
    },
    required: ["productName", "quantity", "unitPrice"],
  },
};

const SYSTEM_INSTRUCTION = `
You are an expert sales data analyst. Extract structured sales records from unstructured input.
Rules:
1. Identify product names, quantities, and prices accurately.
2. If the user mentions multiple items, extract all of them.
3. If specific currencies are mentioned (AED, USD, SAR), preserve them.
4. If an input is ambiguous, set lowConfidence to true for that item.
5. For voice transcripts, ignore filler words and focus on the data.
`;

/**
 * Checks if a valid API key is available in the environment.
 */
export const hasValidKey = (): boolean => {
  const key = process.env.API_KEY;
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

/**
 * Creates a fresh instance of the Gemini AI client.
 */
const getClient = async () => {
  // Always use a new instance to ensure we pick up the latest injected API_KEY
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Use gemini-3-pro-preview for complex text task (sales data extraction)
export const parseFromText = async (text: string): Promise<SalesItem[]> => {
  const ai = await getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Extract sales data from this text: "${text}"`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    if (error.message?.includes("entity was not found") && window.aistudio) {
      window.aistudio.openSelectKey();
    }
    throw error;
  }
};

// Use gemini-3-pro-preview for complex multimodal task (extracting items from images)
export const parseFromFile = async (base64Data: string, mimeType: string): Promise<SalesItem[]> => {
  const ai = await getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "List all sales items and their prices found in this image." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error: any) {
    throw error;
  }
};

// Use gemini-3-pro-preview for complex task (extracting items from audio dictation)
export const parseFromAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<SalesItem[]> => {
  const ai = await getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Audio } },
          { text: "Listen to this sales dictation and extract the items sold." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error: any) {
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
