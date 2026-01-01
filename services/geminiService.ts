import { GoogleGenAI, Type } from "@google/genai";
import { SalesItem } from "../types";

const ITEM_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      productName: { type: Type.STRING },
      sku: { type: Type.STRING },
      quantity: { type: Type.NUMBER },
      unitPrice: { type: Type.NUMBER },
      currency: { type: Type.STRING },
      notes: { type: Type.STRING },
      lowConfidence: { type: Type.BOOLEAN },
    },
    required: ["productName", "quantity", "unitPrice"],
  },
};

const SYSTEM_INSTRUCTION = `
You are an advanced AI assistant for a mobile sales app, specialized in OCR and data extraction for sales reports.
Extract sales items from inputs (images of receipts, spoken descriptions, or pasted text).

Extraction Rules:
1. Target fields: productName, sku, quantity (number), unitPrice (number), currency, notes.
2. Normalize Spoken Numerals: Always convert spoken number words into their numeric equivalents.
3. Normalize Units: Map unit markers like "pieces", "units", "qty" to the 'quantity' field.
4. Self-Correction: Use the final intended value if user corrects themselves.
5. Confidence: Set 'lowConfidence: true' if the input is ambiguous.
`;

/**
 * Checks if a valid API key is available in the environment.
 */
export const hasValidKey = (): boolean => {
  const key = process.env.API_KEY;
  return !!(key && key.length > 5 && key !== "undefined" && key !== "null");
};

/**
 * Ensures an API key is selected. In AI Studio, this opens the picker.
 */
export const ensureApiKey = async (): Promise<boolean> => {
  if (hasValidKey()) return true;

  if (window.aistudio) {
    const hasSelected = await window.aistudio.hasSelectedApiKey();
    if (hasSelected) return true;
    
    // If not selected, we return false so the UI can prompt
    return false;
  }
  
  return false;
};

/**
 * Triggers the native API key selection dialog.
 */
export const requestKeySelection = async () => {
  if (window.aistudio) {
    await window.aistudio.openSelectKey();
    // Per instructions: assume success after triggering to mitigate race conditions
    return true;
  }
  return false;
};

/**
 * Creates a fresh instance of the Gemini AI client using the latest environment key.
 */
const getClient = async () => {
  // Always create a new instance right before use to pick up the latest injected key
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.length < 5 || apiKey === "undefined" || apiKey === "null") {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Proceed immediately assuming selection worked (race condition mitigation)
      return new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    throw new Error("Gemini API Key is missing. Please ensure process.env.API_KEY is configured.");
  }
  
  return new GoogleGenAI({ apiKey });
};

/**
 * Handles common API errors, specifically re-triggering key selection on 404s.
 */
const handleApiError = async (error: any) => {
  console.error("Gemini API Error:", error);
  const message = error?.message || "";
  
  // If requested entity was not found, reset key selection state
  if (message.includes("Requested entity was not found") && window.aistudio) {
    await window.aistudio.openSelectKey();
  }
  
  throw error;
};

export const parseFromText = async (text: string): Promise<SalesItem[]> => {
  const ai = await getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract sales items from the following text: "${text}"`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    
    const content = response.text;
    if (!content) return [];
    return JSON.parse(content);
  } catch (error) {
    return handleApiError(error);
  }
};

export const parseFromFile = async (base64Data: string, mimeType: string): Promise<SalesItem[]> => {
  const ai = await getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Extract all sales items, their quantities, and their individual unit prices from this image. Output JSON." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    
    const content = response.text;
    if (!content) return [];
    return JSON.parse(content);
  } catch (error) {
    return handleApiError(error);
  }
};

export const parseFromAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<SalesItem[]> => {
  const ai = await getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Audio } },
          { text: "Listen to this audio and extract the list of sold items. Normalize numbers. Output JSON." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    
    const content = response.text;
    if (!content) return [];
    return JSON.parse(content);
  } catch (error) {
    return handleApiError(error);
  }
};