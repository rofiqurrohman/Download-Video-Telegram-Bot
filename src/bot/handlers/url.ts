import { Context, InputFile } from 'grammy';
import { User } from '../../models/User';
import { isValidUrl, transformUrl } from '../../services/urlFilter';
import { requestDownload, getJobFiles, downloadFileBuffer, getDataInfo } from '../../services/ytdlp';
import { pollJob } from '../../utils/poller';
import { uploadToStorageChannel } from '../../services/gramjs';

const MB_50 = 50 * 1024 * 1024; // 50 MB dalam bytes

/**
 * Handler utama untuk pesan teks yang berisi URL video.
 *
 * Flow:
 * - File ≤ 50 MB → kirim langsung via Bot API, lalu upload ke storage channel (background)
 * - File > 50 MB → upload ke storage channel via GramJS, lalu forward ke user via Bot API
 */
export async function urlHandler(ctx: Context): Promise<void> {
  const user = ctx.from;
  const text = ctx.message?.text?.trim();

  if (!user || !text) return;

  // --- Cek apakah user diblokir ---
  const dbUser = await User.findOne({ telegramId: user.id });
  if (dbUser?.isBlocked) {
    await ctx.reply('🚫 Akses kamu telah diblokir. Hubungi admin jika ada pertanyaan.', {
      reply_to_message_id: ctx.message?.message_id,
    });
    return;
  }

  // --- Validasi URL ---
  if (!isValidUrl(text)) {
    await ctx.reply('❌ URL tidak dikenali. Kirim URL video yang valid.', {
      reply_to_message_id: ctx.message?.message_id,
    });
    return;
  }

  // --- Update lastActiveAt user ---
  try {
    await User.findOneAndUpdate(
      { telegramId: user.id },
      {
        telegramId: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        lastActiveAt: new Date(),
      },
      { upsert: true },
    );
  } catch (err) {
    // console.error('[url] Error update user:', err);
  }

  // --- Kirim pesan status awal ---
  const statusMsg = await ctx.reply('⏳ Mengambil info video...', {
    reply_to_message_id: ctx.message?.message_id,
  });

  const editStatus = async (newText: string) => {
    try {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, newText);
    } catch {
      // Abaikan jika pesan sudah tidak bisa diedit
    }
  };

  const deleteStatus = async () => {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id);
    } catch {
      // Abaikan jika pesan sudah tidak bisa dihapus
    }
  };

  try {
    // ─── 1. Transform URL ──────────────────────────────────────────────────────
    let transformResult: Awaited<ReturnType<typeof transformUrl>>;
    try {
      transformResult = await transformUrl(text);
    } catch (err: any) {
      await editStatus(`❌ ${err.message ?? 'Gagal memproses URL.'}`);
      return;
    }

    const { downloadUrl, outputTemplate } = transformResult;

    // ─── 2. Ambil info video ────────────────────────────────────────────────────
    try {
      await getDataInfo(downloadUrl);
    } catch (err: any) {
      // console.error('[url] Error get data info:', err);
      await editStatus('❌ Gagal mendapatkan info video. Coba lagi.');
      return;
    }

    // ─── 3. Request download ke yt-dlp service ──────────────────────────────────
    let jobId: string;
    try {
      const downloadReq = await requestDownload(downloadUrl, {
        output_template: outputTemplate,
      });
      jobId = downloadReq.id;
    } catch (err: any) {
      await editStatus('❌ Gagal menghubungi layanan download. Coba lagi.');
      return;
    }

    await editStatus('📥 Mendownload video, mohon tunggu...');

    // ─── 4. Polling status job ──────────────────────────────────────────────────
    try {
      await pollJob(jobId);
    } catch (err: any) {
      await editStatus(`❌ ${err.message}`);
      return;
    }

    // ─── 5. Ambil daftar file hasil download ────────────────────────────────────
    let files: Awaited<ReturnType<typeof getJobFiles>>;
    try {
      files = await getJobFiles(jobId);
    } catch (err: any) {
      await editStatus('❌ File tidak tersedia setelah download.');
      return;
    }

    if (!files || files.length === 0) {
      await editStatus('❌ File tidak tersedia setelah download.');
      return;
    }

    const file = files[0];
    const fileSizeBytes = file.size_bytes;
    const fileName = file.filename || file.original_name || `video-${jobId}.mp4`;

    await editStatus('📦 Menyiapkan video untuk dikirim...');

    // ─── 6. Download file ke buffer ─────────────────────────────────────────────
    let fileBuffer: Buffer;
    try {
      fileBuffer = await downloadFileBuffer(file.id);
    } catch (err: any) {
      await editStatus('❌ Gagal mengunduh file dari server. Coba lagi.');
      return;
    }

    // ─── 7. Kirim ke user berdasarkan ukuran file ───────────────────────────────
    if (fileSizeBytes <= MB_50) {
      await sendSmallFile(ctx, user.id, fileSizeBytes, fileBuffer, fileName, editStatus);
      await deleteStatus();
    } else {
      await sendLargeFile(ctx, user.id, fileSizeBytes, fileBuffer, fileName, editStatus);
      await deleteStatus();
    }
  } catch (err: any) {
    // console.error('[url] Unexpected error:', err);
    try {
      await editStatus('❌ Server sedang sibuk, coba lagi beberapa saat lagi.');
    } catch {
      // ignore
    }
  }
}

// ─── Helper: kirim file kecil (≤ 50 MB) ──────────────────────────────────────

async function sendSmallFile(
  ctx: Context,
  telegramUserId: number,
  fileSizeBytes: number,
  fileBuffer: Buffer,
  fileName: string,
  editStatus: (text: string) => Promise<void>,
): Promise<void> {
  await editStatus('♻️ Mengirim video...');

  try {
    await ctx.replyWithVideo(new InputFile(fileBuffer, fileName), {
      caption: `🎬 <b>${fileName}</b>`,
      parse_mode: 'HTML',
      reply_to_message_id: ctx.message?.message_id,
    });

    // await editStatus('✅ Video berhasil dikirim!');

    // Update statistik user (non-blocking)
    User.findOneAndUpdate(
      { telegramId: telegramUserId },
      { $inc: { downloadCount: 1, totalBytesDownloaded: fileSizeBytes } },
    ).catch((e) => {
      // console.error('[url] Gagal update stats:', e);
    });
  } catch (err: any) {
    // console.error('[url] Error kirim video kecil:', err);
    await editStatus('❌ Terjadi kesalahan saat mengirim video');
    return;
  }

  // Upload ke storage channel di background (non-blocking)
  uploadToStorageChannel(fileBuffer, fileName, fileName)
    .then(({ messageId, channelId }) =>
      console.log(`[storage] Upload selesai. messageId=${messageId}, channelId=${channelId}`),
    )
    .catch((err) => {
      // console.error('[storage] Gagal upload ke storage channel:', err)
    });
}

// ─── Helper: kirim file besar (> 50 MB) ──────────────────────────────────────

async function sendLargeFile(
  ctx: Context,
  telegramUserId: number,
  fileSizeBytes: number,
  fileBuffer: Buffer,
  fileName: string,
  editStatus: (text: string) => Promise<void>,
): Promise<void> {
  // await editStatus('📤 File besar terdeteksi, mengupload ke relay channel...');
  await editStatus('♻️ Mengirim video...');

  let messageId: number;
  let channelId: string;

  // 1. Upload ke storage channel via GramJS
  try {
    const result = await uploadToStorageChannel(fileBuffer, fileName, fileName);
    messageId = result.messageId;
    channelId = result.channelId;
    console.log(`[url] Upload storage channel selesai. messageId=${messageId}`);
  } catch (err: any) {
    // console.error('[url] Error upload ke storage channel:', err);
    await editStatus('❌ Gagal mengupload file besar ke relay channel. Coba lagi.');
    return;
  }

  // await editStatus('📨 Meneruskan video ke kamu...');

  // 2. Forward pesan dari storage channel ke user via Bot API
  try {
    // channelId bisa berupa "-100xxxxxxxxxx" (string), parse ke number untuk fromChatId
    const fromChatId = parseInt(channelId, 10);

    await ctx.api.forwardMessage(
      ctx.chat!.id, // tujuan: chat user
      fromChatId, // sumber: storage channel
      messageId, // message_id di storage channel
    );

    // await editStatus('✅ Video berhasil dikirim!');

    // Update statistik user (non-blocking)
    User.findOneAndUpdate(
      { telegramId: telegramUserId },
      { $inc: { downloadCount: 1, totalBytesDownloaded: fileSizeBytes } },
    ).catch((e) => {
      // console.error('[url] Gagal update stats:', e);
    });
  } catch (err: any) {
    // console.error('[url] Error forward video dari storage channel:', err);
    await editStatus('❌ Terjadi kesalahan saat meneruskan video. Coba lagi.');
  }
}
