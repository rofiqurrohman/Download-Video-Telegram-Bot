import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads.js';
import { Api } from 'telegram';
import * as input from 'input';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let client: TelegramClient | null = null;

/**
 * Inisialisasi GramJS client dengan StringSession.
 * Jika TELEGRAM_SESSION kosong, akan melakukan login interaktif (hanya sekali).
 */
export async function initGramJs(): Promise<void> {
  const apiId = parseInt(process.env.TELEGRAM_API_ID!, 10);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const sessionString = process.env.TELEGRAM_SESSION ?? '';

  const session = new StringSession(sessionString);

  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => {
      const phone = await input.text('Masukkan nomor telepon (+62xxx): ');
      return phone;
    },
    password: async () => {
      const pwd = await input.text('Masukkan password 2FA (kosongkan jika tidak ada): ');
      return pwd;
    },
    phoneCode: async () => {
      const code = await input.text('Masukkan kode OTP dari Telegram: ');
      return code;
    },
    onError: (err) => {
      console.error('[GramJS] Login error:', err);
    },
  });

  // Simpan session string ke console setelah login pertama kali
  const savedSession = client.session.save() as unknown as string;
  if (!sessionString) {
    console.log('\n========================================');
    console.log('✅ Login berhasil! Salin session string berikut ke .env:');
    console.log(`TELEGRAM_SESSION=${savedSession}`);
    console.log('========================================\n');
  }

  console.log('[GramJS] Client siap.');
}

/**
 * Ambil GramJS client yang sudah diinisialisasi.
 */
export function getClient(): TelegramClient {
  if (!client) {
    throw new Error('GramJS client belum diinisialisasi. Panggil initGramJs() terlebih dahulu.');
  }
  return client;
}

export interface StorageUploadResult {
  /** message_id dari pesan di storage channel (untuk forward via Bot API) */
  messageId: number;
  /** Channel ID string asli dari env (misal: "-100xxxxxxxxxx") */
  channelId: string;
}

/**
 * Upload file ke storage channel via GramJS.
 *
 * Menggunakan file sementara di tmpDir agar kompatibel dengan file > 20MB.
 * Mengembalikan `messageId` dan `channelId` agar pesan bisa di-forward via Bot API.
 */
export async function uploadToStorageChannel(
  buffer: Buffer,
  fileName: string,
  caption?: string,
  thumbnailBuffer?: Buffer | null,
): Promise<StorageUploadResult> {
  const gramClient = getClient();
  const channelId = process.env.STORAGE_CHANNEL_ID!;

  const entity = await gramClient.getEntity(channelId);

  // Tulis buffer ke file sementara agar GramJS bisa stream file besar
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `gramjs_upload_${Date.now()}_${fileName}`);
  const tmpThumbPath = thumbnailBuffer
    ? path.join(tmpDir, `gramjs_thumb_${Date.now()}.jpg`)
    : null;

  try {
    fs.writeFileSync(tmpPath, buffer);
    if (tmpThumbPath && thumbnailBuffer) {
      fs.writeFileSync(tmpThumbPath, thumbnailBuffer);
    }

    const customFile = new CustomFile(fileName, buffer.length, tmpPath);

    const result = await gramClient.sendFile(entity, {
      file: customFile,
      caption: caption ?? fileName,
      // GramJS menerima path string langsung untuk thumb (bukan CustomFile)
      thumb: tmpThumbPath ?? undefined,
      attributes: [new Api.DocumentAttributeFilename({ fileName })],
      forceDocument: false, // biarkan Telegram deteksi sebagai video jika bisa
    });

    const message = result as Api.Message;

    if (!message || !message.id) {
      throw new Error('Gagal mendapatkan message dari storage channel setelah upload.');
    }

    console.log(`[GramJS] Upload selesai. messageId=${message.id}, channelId=${channelId}`);

    return {
      messageId: message.id,
      channelId,
    };
  } finally {
    // Hapus file sementara
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignore error saat hapus tmp
    }
    try {
      if (tmpThumbPath && fs.existsSync(tmpThumbPath)) fs.unlinkSync(tmpThumbPath);
    } catch {
      // ignore error saat hapus tmp thumbnail
    }
  }
}
