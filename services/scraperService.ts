
/**
 * Serviço para interagir com o Apify TikTok Scraper
 * Nota: O usuário precisará de um Token do Apify (apify.com)
 * Usando 'clockworks~tiktok-scraper' por ser altamente especializado em seguidores.
 */

export interface ScrapeProgress {
  status: string;
  percentage: number;
}

export const scrapeTikTokFollowers = async (
  username: string, 
  apiToken: string, 
  maxResults: number = 50,
  onProgress: (p: ScrapeProgress) => void
): Promise<string[]> => {
  try {
    onProgress({ status: "Iniciando Actor no Apify (Clockworks Scraper)...", percentage: 10 });
    
    // Garantir que o nome de usuário não tenha @
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    // Alguns atores preferem a URL completa do perfil
    const profileUrl = `https://www.tiktok.com/@${cleanUsername}`;

    // 1. Iniciar o Actor do Apify
    // O erro anterior indicava que o ator espera 'profiles', 'postURLs', 'hashtags', 'searchQueries' ou 'music'
    const runResponse = await fetch(`https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "profiles": [profileUrl],
        "type": "followers",
        "maxResults": maxResults,
        "proxyConfiguration": { "useApifyProxy": true }
      })
    });

    if (!runResponse.ok) {
      const errorBody = await runResponse.text();
      let errorMessage = `Erro HTTP ${runResponse.status}`;
      try {
        const jsonError = JSON.parse(errorBody);
        errorMessage = jsonError.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorBody || errorMessage;
      }
      
      // Se o ator clockworks não for encontrado, tentamos o apify/tiktok-scraper como fallback
      if (runResponse.status === 404) {
         return await fallbackScrape(cleanUsername, apiToken, maxResults, onProgress);
      }

      throw new Error(`Falha ao iniciar scraper: ${errorMessage}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;

    return await pollAndFetchResults(runId, apiToken, onProgress);

  } catch (error: any) {
    console.error("Scraper Error:", error);
    throw error;
  }
};

const pollAndFetchResults = async (runId: string, apiToken: string, onProgress: (p: ScrapeProgress) => void): Promise<string[]> => {
  onProgress({ status: "Scraping em progresso (aguardando servidor)...", percentage: 30 });

  let isFinished = false;
  let attempts = 0;
  let lastStatus = "RUNNING";

  while (!isFinished && attempts < 60) {
    await new Promise(r => setTimeout(r, 10000));
    const statusRes = await fetch(`https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs/${runId}?token=${apiToken}`);
    
    if (!statusRes.ok) throw new Error("Erro ao consultar status da execução no Apify.");

    const statusData = await statusRes.json();
    const currentStatus = statusData.data.status;
    lastStatus = currentStatus;
    
    if (currentStatus === 'SUCCEEDED') {
      isFinished = true;
    } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(currentStatus)) {
      throw new Error(`O scraper parou com status: ${currentStatus}. Verifique os logs no console do Apify.`);
    }
    
    attempts++;
    onProgress({ 
      status: `Extraindo seguidores... (${attempts * 10}s - Status: ${currentStatus})`, 
      percentage: Math.min(85, 30 + (attempts * 2)) 
    });
  }

  if (!isFinished) throw new Error(`O scraper demorou demais. Status final: ${lastStatus}`);

  onProgress({ status: "Processando resultados...", percentage: 90 });

  const runInfoRes = await fetch(`https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs/${runId}?token=${apiToken}`);
  const runInfo = await runInfoRes.json();
  const datasetId = runInfo.data.defaultDatasetId;
  
  const resultsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`);
  if (!resultsRes.ok) throw new Error("Falha ao baixar os resultados do dataset.");

  const items = await resultsRes.json();
  
  // Mapeamento flexível de nomes dependendo da estrutura de saída do ator
  const names = items.map((item: any) => 
    item.nickname || 
    item.uniqueId || 
    item.username ||
    item.user?.nickname ||
    item.user?.uniqueId
  ).filter(Boolean);
  
  if (names.length === 0) throw new Error("Nenhum seguidor encontrado. Certifique-se de que o perfil é público e tem seguidores.");

  onProgress({ status: "Finalizado!", percentage: 100 });
  return names;
};

// Fallback caso o primeiro ator falhe ou não seja encontrado
const fallbackScrape = async (username: string, apiToken: string, maxResults: number, onProgress: (p: ScrapeProgress) => void): Promise<string[]> => {
    onProgress({ status: "Tentando Actor Alternativo (Apify Scraper)...", percentage: 15 });
    
    const runResponse = await fetch(`https://api.apify.com/v2/acts/apify~tiktok-scraper/runs?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "type": "user",
        "searchQueries": [username],
        "resultsPerPage": 20,
        "maxResults": maxResults,
        "proxyConfiguration": { "useApifyProxy": true }
      })
    });

    if (!runResponse.ok) {
        throw new Error("Ambos os scrapers falharam. Verifique seu token e permissões.");
    }

    const runData = await runResponse.json();
    return await pollAndFetchResultsGeneric(runData.data.id, apiToken, onProgress, "apify~tiktok-scraper");
};

const pollAndFetchResultsGeneric = async (runId: string, apiToken: string, onProgress: (p: ScrapeProgress) => void, actorName: string): Promise<string[]> => {
  let isFinished = false;
  let attempts = 0;
  const cleanActorName = actorName.replace('~', '/');

  while (!isFinished && attempts < 60) {
    await new Promise(r => setTimeout(r, 10000));
    const statusRes = await fetch(`https://api.apify.com/v2/acts/${cleanActorName}/runs/${runId}?token=${apiToken}`);
    if (!statusRes.ok) break;
    const statusData = await statusRes.json();
    if (statusData.data.status === 'SUCCEEDED') isFinished = true;
    else if (['FAILED', 'ABORTED'].includes(statusData.data.status)) throw new Error("Scraper fallback falhou.");
    attempts++;
  }
  
  const statusRes = await fetch(`https://api.apify.com/v2/acts/${cleanActorName}/runs/${runId}?token=${apiToken}`);
  const statusData = await statusRes.json();
  const datasetId = statusData.data.defaultDatasetId;
  const resultsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`);
  const items = await resultsRes.json();
  
  return items.map((item: any) => 
    item.nickname || 
    item.uniqueId || 
    item.username ||
    item.authorMeta?.nickname
  ).filter(Boolean);
};
