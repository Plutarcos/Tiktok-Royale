
import { GoogleGenAI } from "@google/genai";

/**
 * Obtém a chave de API de forma segura tanto em dev quanto em produção.
 */
const getSafeApiKey = () => {
  try {
    // Tenta obter do window (shimmed em index.html) ou do process.env direto
    return (window as any).process?.env?.API_KEY || process.env.API_KEY || "";
  } catch (e) {
    return "";
  }
};

export const getCommentary = async (event: string, players: string[]): Promise<string> => {
  const apiKey = getSafeApiKey();
  
  // Se não houver chave, retorna comentário padrão sem quebrar o app
  if (!apiKey) {
    return "A ação está frenética!";
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é um narrador engraçado e carismático de um Battle Royale do TikTok. 
      O evento atual é: ${event}. 
      Alguns jogadores envolvidos: ${players.join(', ')}.
      Crie uma frase curta de narração épica ou engraçada (máximo 15 palavras).`,
    });
    
    return response.text || "A batalha está insana!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "A ação não para!";
  }
};
