
import { GoogleGenAI, Type } from "@google/genai";
import { SalesItem } from "../types";

// Always use process.env.API_KEY directly for initialization.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
You are an advanced AI assistant for a mobile sales app, specialized in OCR and data extraction.
Extract sales items from inputs (images, text, or audio).
Target fields: productName, sku, quantity (number), unitPrice (number), currency, notes.
Apply corrections if mentioned. Handle diverse formats like "2x iPhone @ 1000".
Set lowConfidence: true if extraction is uncertain.
`;

// Complex reasoning tasks like structured data extraction use gemini-3-pro-preview.
export const parseFromText = async (text: string): Promise<SalesItem[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [{ text: `Extract sales items from: ${text}` }]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    // Access .text property directly, do not call as a function.
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Text Parse Error:", error);
    throw error;
  }
};

// Vision-based data extraction is complex; upgrading to gemini-3-pro-preview for better accuracy.
export const parseFromFile = async (base64Data: string, mimeType: string): Promise<SalesItem[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Extract all items, quantities, and prices from this image." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini File Parse Error:", error);
    throw error;
  }
};

// Audio transcription and structured extraction are complex tasks, using gemini-3-pro-preview.
export const parseFromAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<SalesItem[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Audio } },
          { text: "Listen and extract the list of sold items." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ITEM_SCHEMA,
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Audio Parse Error:", error);
    throw error;
  }
};
