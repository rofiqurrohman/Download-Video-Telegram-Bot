import { Context } from "grammy";
import { User } from "../../models/User";

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Format bytes menjadi string yang mudah dibaca (KB/MB/GB) */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/** Format tanggal ke string lokal */
function formatDate(date?: Date): string {
  if (!date) return "—";
  return date.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

/** Parse argumen perintah — /block <userId> [reason...] */
function parseArgs(ctx: Context): string[] {
  const text = ctx.message?.text ?? "";
  const parts = text.trim().split(/\s+/);
  return parts.slice(1); // hilangkan command-nya
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * /admin — Tampilkan menu bantuan admin
 */
export async function adminMenuHandler(ctx: Context): Promise<void> {
  const menu = `
🛡️ <b>Admin Panel</b>

<b>Manajemen User:</b>
• <code>/block &lt;userId&gt; [alasan]</code> — Blokir user
• <code>/unblock &lt;userId&gt;</code> — Buka blokir user
• <code>/userinfo &lt;userId&gt;</code> — Detail info satu user
• <code>/users [page]</code> — Daftar user terbaru (10 per halaman)
• <code>/blocklist</code> — Daftar semua user yang diblokir

<b>Statistik:</b>
• <code>/stats</code> — Statistik global bot

<i>userId adalah Telegram User ID (angka).</i>
`.trim();

  await ctx.reply(menu, { parse_mode: "HTML" });
}

/**
 * /block <userId> [alasan] — Blokir user
 */
export async function blockUserHandler(ctx: Context): Promise<void> {
  const args = parseArgs(ctx);
  const targetId = parseInt(args[0], 10);

  if (!targetId || isNaN(targetId)) {
    await ctx.reply("⚠️ Format: <code>/block &lt;userId&gt; [alasan]</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  const reason = args.slice(1).join(" ") || "Tidak ada alasan";

  try {
    const user = await User.findOneAndUpdate(
      { telegramId: targetId },
      {
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: reason,
      },
      { new: true }
    );

    if (!user) {
      await ctx.reply(`❓ User dengan ID <code>${targetId}</code> tidak ditemukan di database.`, {
        parse_mode: "HTML",
      });
      return;
    }

    const displayName = user.username
      ? `@${user.username}`
      : `${user.firstName}${user.lastName ? " " + user.lastName : ""}`;

    await ctx.reply(
      `🚫 <b>User diblokir</b>\n\n` +
        `👤 <b>Nama:</b> ${displayName}\n` +
        `🆔 <b>ID:</b> <code>${targetId}</code>\n` +
        `📝 <b>Alasan:</b> ${reason}`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    console.error("[admin/block] Error:", err);
    await ctx.reply("❌ Gagal memblokir user. Coba lagi.");
  }
}

/**
 * /unblock <userId> — Buka blokir user
 */
export async function unblockUserHandler(ctx: Context): Promise<void> {
  const args = parseArgs(ctx);
  const targetId = parseInt(args[0], 10);

  if (!targetId || isNaN(targetId)) {
    await ctx.reply("⚠️ Format: <code>/unblock &lt;userId&gt;</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  try {
    const user = await User.findOneAndUpdate(
      { telegramId: targetId },
      {
        isBlocked: false,
        $unset: { blockedAt: "", blockedReason: "" },
      },
      { new: true }
    );

    if (!user) {
      await ctx.reply(`❓ User dengan ID <code>${targetId}</code> tidak ditemukan.`, {
        parse_mode: "HTML",
      });
      return;
    }

    const displayName = user.username
      ? `@${user.username}`
      : `${user.firstName}${user.lastName ? " " + user.lastName : ""}`;

    await ctx.reply(
      `✅ <b>User dibuka blokirnya</b>\n\n` +
        `👤 <b>Nama:</b> ${displayName}\n` +
        `🆔 <b>ID:</b> <code>${targetId}</code>`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    console.error("[admin/unblock] Error:", err);
    await ctx.reply("❌ Gagal membuka blokir user. Coba lagi.");
  }
}

/**
 * /userinfo <userId> — Detail info satu user
 */
export async function userInfoHandler(ctx: Context): Promise<void> {
  const args = parseArgs(ctx);
  const targetId = parseInt(args[0], 10);

  if (!targetId || isNaN(targetId)) {
    await ctx.reply("⚠️ Format: <code>/userinfo &lt;userId&gt;</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  try {
    const user = await User.findOne({ telegramId: targetId });

    if (!user) {
      await ctx.reply(`❓ User dengan ID <code>${targetId}</code> tidak ditemukan.`, {
        parse_mode: "HTML",
      });
      return;
    }

    const displayName = user.username
      ? `@${user.username}`
      : `${user.firstName}${user.lastName ? " " + user.lastName : ""}`;

    const statusEmoji = user.isBlocked ? "🚫 Diblokir" : "✅ Aktif";

    let msg =
      `👤 <b>Info User</b>\n\n` +
      `🆔 <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
      `📛 <b>Nama:</b> ${displayName}\n` +
      `📊 <b>Status:</b> ${statusEmoji}\n` +
      `📥 <b>Total Download:</b> ${user.downloadCount} video\n` +
      `💾 <b>Total Data:</b> ${formatBytes(user.totalBytesDownloaded)}\n` +
      `🕐 <b>Bergabung:</b> ${formatDate(user.createdAt)}\n` +
      `🕐 <b>Aktif Terakhir:</b> ${formatDate(user.lastActiveAt)}`;

    if (user.isBlocked) {
      msg +=
        `\n\n🚫 <b>Diblokir pada:</b> ${formatDate(user.blockedAt)}\n` +
        `📝 <b>Alasan:</b> ${user.blockedReason ?? "—"}`;
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (err) {
    console.error("[admin/userinfo] Error:", err);
    await ctx.reply("❌ Gagal mengambil info user. Coba lagi.");
  }
}

/**
 * /users [page] — Daftar user terbaru (10 per halaman)
 */
export async function listUsersHandler(ctx: Context): Promise<void> {
  const args = parseArgs(ctx);
  const page = Math.max(1, parseInt(args[0], 10) || 1);
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    const [users, total] = await Promise.all([
      User.find().sort({ lastActiveAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(),
    ]);

    if (users.length === 0) {
      await ctx.reply("📭 Belum ada user terdaftar.");
      return;
    }

    const totalPages = Math.ceil(total / limit);
    let msg = `👥 <b>Daftar User</b> (hal. ${page}/${totalPages}, total: ${total})\n\n`;

    for (const u of users) {
      const name = u.username ? `@${u.username}` : u.firstName;
      const status = u.isBlocked ? "🚫" : "✅";
      msg +=
        `${status} <code>${u.telegramId}</code> — <b>${name}</b>\n` +
        `   📥 ${u.downloadCount}x · 💾 ${formatBytes(u.totalBytesDownloaded)} · ⏱️ ${formatDate(u.lastActiveAt)}\n\n`;
    }

    if (page < totalPages) {
      msg += `\n➡️ Halaman berikut: <code>/users ${page + 1}</code>`;
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (err) {
    console.error("[admin/users] Error:", err);
    await ctx.reply("❌ Gagal mengambil daftar user. Coba lagi.");
  }
}

/**
 * /blocklist — Daftar semua user yang diblokir
 */
export async function blockListHandler(ctx: Context): Promise<void> {
  try {
    const blocked = await User.find({ isBlocked: true }).sort({ blockedAt: -1 });

    if (blocked.length === 0) {
      await ctx.reply("✅ Tidak ada user yang diblokir saat ini.");
      return;
    }

    let msg = `🚫 <b>Daftar User Diblokir</b> (${blocked.length})\n\n`;

    for (const u of blocked) {
      const name = u.username ? `@${u.username}` : u.firstName;
      msg +=
        `• <code>${u.telegramId}</code> — <b>${name}</b>\n` +
        `  📝 ${u.blockedReason ?? "—"}\n` +
        `  🕐 ${formatDate(u.blockedAt)}\n\n`;
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (err) {
    console.error("[admin/blocklist] Error:", err);
    await ctx.reply("❌ Gagal mengambil daftar blokir. Coba lagi.");
  }
}

/**
 * /stats — Statistik global bot
 */
export async function statsHandler(ctx: Context): Promise<void> {
  try {
    const [
      totalUsers,
      totalBlocked,
      activeToday,
      activeThisWeek,
      aggregateResult,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isBlocked: true }),
      User.countDocuments({
        lastActiveAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      User.countDocuments({
        lastActiveAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      User.aggregate([
        {
          $group: {
            _id: null,
            totalDownloads: { $sum: "$downloadCount" },
            totalBytes: { $sum: "$totalBytesDownloaded" },
          },
        },
      ]),
    ]);

    const agg = aggregateResult[0] ?? { totalDownloads: 0, totalBytes: 0 };

    // Top 5 user paling aktif
    const topUsers = await User.find({ isBlocked: false })
      .sort({ downloadCount: -1 })
      .limit(5)
      .select("telegramId username firstName downloadCount totalBytesDownloaded");

    let msg =
      `📊 <b>Statistik Bot</b>\n\n` +
      `👥 <b>Total User:</b> ${totalUsers}\n` +
      `🚫 <b>Diblokir:</b> ${totalBlocked}\n` +
      `🟢 <b>Aktif Hari Ini:</b> ${activeToday}\n` +
      `📅 <b>Aktif Minggu Ini:</b> ${activeThisWeek}\n\n` +
      `📥 <b>Total Download:</b> ${agg.totalDownloads} video\n` +
      `💾 <b>Total Data:</b> ${formatBytes(agg.totalBytes)}\n`;

    if (topUsers.length > 0) {
      msg += `\n🏆 <b>Top 5 User Aktif:</b>\n`;
      topUsers.forEach((u, i) => {
        const name = u.username ? `@${u.username}` : u.firstName;
        msg += `${i + 1}. <code>${u.telegramId}</code> ${name} — ${u.downloadCount}x · ${formatBytes(u.totalBytesDownloaded)}\n`;
      });
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (err) {
    console.error("[admin/stats] Error:", err);
    await ctx.reply("❌ Gagal mengambil statistik. Coba lagi.");
  }
}
