/**
 * Script login GramJS satu kali untuk menghasilkan TELEGRAM_SESSION string.
 * Jalankan: npm run login
 * Setelah selesai, salin nilai TELEGRAM_SESSION ke file .env
 */
import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as input from "input";

async function login() {
  const apiId = parseInt(process.env.TELEGRAM_API_ID!, 10);
  const apiHash = process.env.TELEGRAM_API_HASH!;

  if (!apiId || !apiHash) {
    console.error("❌ Set TELEGRAM_API_ID dan TELEGRAM_API_HASH di .env terlebih dahulu.");
    process.exit(1);
  }

  const session = new StringSession("");
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => input.text("📱 Masukkan nomor telepon (+62xxx): "),
    password: async () => input.text("🔐 Password 2FA (kosongkan jika tidak ada): "),
    phoneCode: async () => input.text("📨 Kode OTP dari Telegram: "),
    onError: (err) => console.error("Error:", err),
  });

  const sessionString = client.session.save() as unknown as string;

  console.log("\n✅ Login berhasil!\n");
  console.log("Salin baris berikut ke file .env:\n");
  console.log(`TELEGRAM_SESSION=${sessionString}`);
  console.log("\nLalu jalankan bot dengan: npm run dev\n");

  await client.disconnect();
  process.exit(0);
}

login().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
