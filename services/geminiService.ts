
import { GoogleGenAI } from "@google/genai";

// Fixed: Initializing GoogleGenAI directly with process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getCommentary = async (event: string, players: string[]): Promise<string> => {
  try {
    // Fixed: Always use ai.models.generateContent to query GenAI with both the model name and prompt.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é um narrador engraçado e carismático de um Battle Royale do TikTok. 
      O evento atual é: ${event}. 
      Alguns jogadores envolvidos: ${players.join(', ')}.
      Crie uma frase curta de narração épica ou engraçada (máximo 15 palavras).`,
    });
    // response.text directly returns the extracted string output.
    return response.text || "A batalha está insana!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "A ação não para!";
  }
};