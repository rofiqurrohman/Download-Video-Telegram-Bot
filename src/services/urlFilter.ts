import axios from 'axios';

export interface TransformResult {
  downloadUrl: string;
  title?: string;
  outputTemplate?: string;
}

/**
 * Transformasi URL sebelum dikirim ke yt-dlp service.
 * - Case 1: vidtronx.com / vide.la → embed URL
 * - Case 2: vidara.to → fetch streaming_url dari vidara.so API
 * - Case 3: URL lainnya → pass-through
 */
export async function transformUrl(rawUrl: string): Promise<TransformResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('URL tidak valid');
  }

  const hostname = url.hostname.replace(/^www\./, '');

  // const urlFilterVidoy = ['vidtronx.com', 'vide.la', 'vidoy.com', 'vidzp.com'];
  // const urlFilterVidara = ['vidara.to'];
  const urlFilterVidoy = process.env.VIDOY_URLS?.split(',') || [];
  const urlFilterVidara = process.env.VIDARA_URLS?.split(',') || [];

  // --- Case 1: vidtronx.com atau vide.la ---
  if (urlFilterVidoy.includes(hostname)) {
    // Pattern: /(e|f|v)/{id}
    const match = url.pathname.match(/^\/(e|f|v)\/([^/]+)/);
    if (match) {
      const id = match[2];
      const downloadUrl = `https://vidzp.com/embed.php?bucket=vidoycdn&id=${id}`;
      return { downloadUrl };
    }
    // Jika pattern tidak cocok, fallthrough ke Case 3
    return { downloadUrl: rawUrl };
  }

  // --- Case 2: vidara.to ---
  if (urlFilterVidara.includes(hostname)) {
    // Pattern: /(e|v)/{id}
    const match = url.pathname.match(/^\/(e|v)\/([^/]+)/);
    if (!match) {
      return { downloadUrl: rawUrl };
    }

    const id = match[2];
    const apiUrl = `https://vidara.so/api/stream?filecode=${id}`;

    let streamData: { streaming_url: string; title?: string };
    try {
      // const res = await axios.get(apiUrl, { timeout: 10000 });
      const bodyRaw = JSON.stringify({ filecode: id, device: 'web' });
      const res = await axios.post(apiUrl, bodyRaw, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });
      streamData = res.data;
    } catch (err) {
      throw new Error('Gagal mengambil info stream dari vidara. Coba lagi.');
    }

    if (!streamData?.streaming_url) {
      throw new Error('Gagal mengambil info stream dari vidara. Coba lagi.');
    }

    const result: TransformResult = {
      downloadUrl: streamData.streaming_url,
    };

    if (streamData.title) {
      result.title = streamData.title;
      result.outputTemplate = `${streamData.title}.%(ext)s`;
    }

    return result;
  }

  // --- Case 3: URL lainnya (pass-through) ---
  return { downloadUrl: rawUrl };
}

/**
 * Validasi apakah string merupakan URL yang valid
 */
export function isValidUrl(text: string): boolean {
  try {
    const u = new URL(text);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
