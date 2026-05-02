import "dotenv/config";
import mongoose from "mongoose";
import { Bot } from "grammy";
import { initGramJs } from "./services/gramjs";
import { startHandler } from "./bot/handlers/start";
import { urlHandler } from "./bot/handlers/url";
import { adminOnly, getAdminIds } from "./bot/middleware/admin";
import {
  adminMenuHandler,
  blockUserHandler,
  unblockUserHandler,
  userInfoHandler,
  listUsersHandler,
  blockListHandler,
  statsHandler,
} from "./bot/handlers/admin";

async function main() {
  // ── Validasi environment variables ──────────────────────────────────────
  const requiredEnvVars = [
    "BOT_TOKEN",
    "TELEGRAM_API_ID",
    "TELEGRAM_API_HASH",
    "STORAGE_CHANNEL_ID",
    "YTDLP_API_BASE_URL",
    "YTDLP_API_KEY",
    "MONGODB_URI",
  ];

  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      console.error(`❌ Environment variable "${key}" belum diset.`);
      process.exit(1);
    }
  }

  // Cek ADMIN_IDS (opsional, tapi penting)
  const adminIds = getAdminIds();
  if (adminIds.length === 0) {
    console.warn("[startup] ⚠️  ADMIN_IDS tidak diset! Perintah admin tidak akan bisa diakses.");
  } else {
    console.log(`[startup] 🛡️  Admin terdaftar: ${adminIds.join(", ")}`);
  }

  // ── 1. Koneksi ke MongoDB ─────────────────────────────────────────────
  console.log("[startup] Menghubungkan ke MongoDB...");
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("[startup] ✅ MongoDB terhubung.");
  } catch (err) {
    console.error("[startup] ❌ Gagal koneksi MongoDB:", err);
    process.exit(1);
  }

  // ── 2. Inisialisasi GramJS Client ─────────────────────────────────────
  console.log("[startup] Menginisialisasi GramJS...");
  try {
    await initGramJs();
    console.log("[startup] ✅ GramJS siap.");
  } catch (err) {
    console.error("[startup] ❌ Gagal inisialisasi GramJS:", err);
    process.exit(1);
  }

  // ── 3. Setup GrammyJS Bot ─────────────────────────────────────────────
  const bot = new Bot(process.env.BOT_TOKEN!);

  // ── User commands ──────────────────────────────────────────────────────
  bot.command("start", startHandler);

  // ── Admin commands (dilindungi adminOnly middleware) ───────────────────
  bot.command("admin", adminOnly, adminMenuHandler);
  bot.command("block", adminOnly, blockUserHandler);
  bot.command("unblock", adminOnly, unblockUserHandler);
  bot.command("userinfo", adminOnly, userInfoHandler);
  bot.command("users", adminOnly, listUsersHandler);
  bot.command("blocklist", adminOnly, blockListHandler);
  bot.command("stats", adminOnly, statsHandler);

  // ── Handler pesan teks URL ─────────────────────────────────────────────
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text?.trim() ?? "";
    // Skip jika pesan adalah command (dimulai dengan /)
    if (text.startsWith("/")) return;
    await urlHandler(ctx);
  });

  // Global error handler — mencegah bot crash
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[bot] Error saat menangani update ${ctx.update.update_id}:`, err.error);
  });

  // ── 4. Jalankan Bot (Long Polling) ────────────────────────────────────
  console.log("[startup] 🤖 Bot berjalan dengan long polling...");
  await bot.start({
    onStart: (botInfo) => {
      console.log(`[startup] ✅ Bot aktif sebagai @${botInfo.username}`);
    },
  });
}

main().catch((err) => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});

