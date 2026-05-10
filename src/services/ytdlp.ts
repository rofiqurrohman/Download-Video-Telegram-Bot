import axios from "axios";
import https from "https";
import http from "http";

const BASE_URL = process.env.YTDLP_API_BASE_URL!;
const API_KEY = process.env.YTDLP_API_KEY!;

const headers = () => ({
  "X-API-Key": API_KEY,
  "Content-Type": "application/json",
});

export interface JobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  logs?: string[];
  error?: string;
}

export interface FileRecord {
  id: string;
  filename: string;
  size_bytes: number;
  job_id: string;
  virtual_path?: string;
  original_name?: string;
}

export interface ThumbnailEntry {
  url: string;
  width?: number;
  height?: number;
  id?: string;
  preference?: number;
  resolution?: string;
}

export interface VideoInfo {
  title?: string;
  thumbnail?: string;
  thumbnails?: ThumbnailEntry[];
  duration?: number;
  uploader?: string;
  webpage_url?: string;
  ext?: string;
  filesize?: number;
  filesize_approx?: number;
  [key: string]: any;
}

/**
 * Get info metadata video
 */
export async function getDataInfo(url: string): Promise<VideoInfo> {
  const res = await axios.post(
    `${BASE_URL}/api/info`,
    {
      url,
    },
    {
      headers: headers(),
    },
  );
  return res.data?.data ?? res.data;
}

/**
 * Download thumbnail dari URL ke Buffer
 */
export async function downloadThumbnailBuffer(thumbnailUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = thumbnailUrl.startsWith('https') ? https : http;
    protocol.get(thumbnailUrl, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Kirim request download ke yt-dlp API Service
 */
export async function requestDownload(
  url: string,
  config?: {
    format?: string;
    output_template?: string;
    embed_metadata?: boolean;
    embed_thumbnail?: boolean;
  },
): Promise<{ id: string }> {
  const payload = {
    url,
    custom_config: {
      format:
        config?.format ??
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      output_template: config?.output_template ?? "%(title)s.%(ext)s",
      embed_metadata: config?.embed_metadata ?? true,
      embed_thumbnail: config?.embed_thumbnail ?? true,
    },
  };

  const res = await axios.post(`${BASE_URL}/api/downloads`, payload, {
    headers: headers(),
  });

  return res.data?.data;
}

/**
 * Ambil status job download
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await axios.get(`${BASE_URL}/api/downloads/${jobId}`, {
    headers: headers(),
  });
  return res.data?.data;
}

/**
 * Ambil daftar file hasil download dari jobId
 */
export async function getJobFiles(jobId: string): Promise<FileRecord[]> {
  const res = await axios.get(`${BASE_URL}/api/files/job/${jobId}`, {
    headers: headers(),
  });
  return res.data?.data;
}

/**
 * Download file ke Buffer berdasarkan fileId
 */
export async function downloadFileBuffer(fileId: string): Promise<Buffer> {
  const res = await axios.get(`${BASE_URL}/api/files/${fileId}/download`, {
    headers: { "X-API-Key": API_KEY },
    responseType: "arraybuffer",
  });
  return Buffer.from(res.data);
}
