import { Context, NextFunction } from "grammy";

/**
 * Ambil daftar Telegram ID admin dari environment variable ADMIN_IDS.
 * Format .env: ADMIN_IDS=123456789,987654321
 */
export function getAdminIds(): number[] {
  const raw = process.env.ADMIN_IDS ?? "";
  return raw
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id) && id > 0);
}

/**
 * Cek apakah telegramId termasuk admin
 */
export function isAdmin(telegramId: number): boolean {
  return getAdminIds().includes(telegramId);
}

/**
 * Middleware GrammyJS: tolak akses jika bukan admin.
 * Gunakan sebagai: bot.command("block", adminOnly, handler)
 */
export async function adminOnly(ctx: Context, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply("⛔ Kamu tidak memiliki akses ke perintah ini.");
    return;
  }
  await next();
}
