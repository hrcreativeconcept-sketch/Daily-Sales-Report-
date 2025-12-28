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
 * Checks for API key availability and prompts user if necessary (in AI Studio context).
 */
export const ensureApiKey = async (): Promise<boolean> => {
  if (process.env.API_KEY) return true;
  
  // If in AI Studio / Managed environment
  if (window.aistudio) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
      // Assume success after opening dialog per instructions to avoid race conditions
      return true;
    }
    return true;
  }
  
  return false;
};

/**
 * Creates a new instance of the Gemini AI client using the current API key.
 */
const getClient = async () => {
  const hasKey = await ensureApiKey();
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || !hasKey) {
    throw new Error("Gemini API Key is missing. Please select a key or configure process.env.API_KEY.");
  }
  
  return new GoogleGenAI({ apiKey });
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
    console.error("Gemini Text Parse Error:", error);
    throw error;
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
    console.error("Gemini File Parse Error:", error);
    throw error;
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
    console.error("Gemini Audio Parse Error:", error);
    throw error;
  }
};