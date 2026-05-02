import { Context } from "grammy";
import { User } from "../../models/User";

/**
 * Handler untuk command /start
 * - Upsert user ke MongoDB
 * - Kirim pesan sambutan
 */
export async function startHandler(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  try {
    // Upsert user ke database
    await User.findOneAndUpdate(
      { telegramId: user.id },
      {
        telegramId: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        lastActiveAt: new Date(),
      },
      { upsert: true, new: true },
    );
  } catch (err) {
    console.error("[start] Error upsert user:", err);
  }

  const firstName = user.first_name;
  await ctx.reply(
    `👋 Halo <b>${firstName}</b>!\n\n` +
      `Kirimkan URL video yang ingin kamu download, dan saya akan memprosesnya untuk kamu.\n\n` +
      `✅ Mendukung: YouTube, Twitter, Instagram, TikTok, dan masih banyak lagi.\n`,
    // `📦 File besar (>50 MB) tetap bisa dikirim melalui relay channel.`,
    { parse_mode: "HTML" },
  );
}
