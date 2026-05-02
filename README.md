# Telegram Video Downloader Bot

Bot Telegram yang menerima URL video, mendownload via yt-dlp API Service internal, lalu mengirimkan hasilnya ke user. Mendukung file besar (>50 MB) menggunakan GramJS sebagai relay.

---

## Tech Stack

| Paket | Kegunaan |
|---|---|
| `grammy` | Bot Telegram (long polling) |
| `telegram` (GramJS) | Upload file besar via Telegram Client API |
| `mongoose` | ODM untuk MongoDB |
| `axios` | HTTP request ke yt-dlp API |
| `dotenv` | Konfigurasi environment |

---

## Setup & Instalasi

### 1. Clone & Install

```bash
cd telegrambot
npm install
```

### 2. Konfigurasi Environment

Salin `.env.example` menjadi `.env` dan isi semua nilai:

```bash
cp .env.example .env
```

```env
# Telegram Bot
BOT_TOKEN=          # Token dari @BotFather

# Telegram Client (GramJS) — untuk file > 50MB
TELEGRAM_API_ID=    # dari https://my.telegram.org
TELEGRAM_API_HASH=  # dari https://my.telegram.org
TELEGRAM_SESSION=   # Diisi setelah menjalankan npm run login
STORAGE_CHANNEL_ID= # ID channel penyimpanan, contoh: -1001234567890

# yt-dlp API Service
YTDLP_API_BASE_URL= # contoh: http://localhost:3001
YTDLP_API_KEY=      # nilai header X-API-Key

# MongoDB
MONGODB_URI=        # contoh: mongodb://localhost:27017/vtdlbot
```

### 3. Login GramJS (Sekali Saja)

Jalankan skrip login untuk menghasilkan `TELEGRAM_SESSION`:

```bash
npm run login
```

Ikuti instruksi di terminal (masukkan nomor HP, kode OTP, dan password 2FA jika ada). Setelah selesai, salin nilai `TELEGRAM_SESSION` ke file `.env`.

> **Catatan:** Bot harus sudah menjadi **admin** di `STORAGE_CHANNEL_ID`.

---

## Menjalankan Bot

### Mode Development

```bash
npm run dev
```

### Mode Production

```bash
npm run build
npm start
```

---

## Struktur Direktori

```
src/
├── index.ts                  # Entry point
├── login.ts                  # Script login GramJS (satu kali)
├── bot/
│   └── handlers/
│       ├── start.ts          # Handler /start
│       └── url.ts            # Handler URL video
├── services/
│   ├── ytdlp.ts              # Wrapper HTTP ke yt-dlp API
│   ├── urlFilter.ts          # Transformasi URL (vidtronx, vidara, dll)
│   └── gramjs.ts             # Wrapper GramJS upload
├── models/
│   └── User.ts               # Mongoose schema User
├── types/
│   └── input.d.ts            # Type declaration untuk module 'input'
└── utils/
    └── poller.ts             # Polling status job download
```

---

## Flow Kerja

```
User kirim URL
  ↓
Validasi URL → filter & transform URL
  ↓
POST /api/downloads ke yt-dlp Service
  ↓
Poll GET /api/downloads/:id (setiap 3 detik, max 5 menit)
  ↓
GET /api/files/job/:jobId → ambil file info
  ↓
Download file ke buffer
  ↓
File ≤ 50 MB → kirim via GrammyJS + upload storage channel (background)
File > 50 MB → upload via GramJS → reply dengan file_id
```

---

## URL yang Didukung (Transformasi Khusus)

| Domain | Transformasi |
|---|---|
| `vidtronx.com` / `vide.la` | Path `/(e/f/v)/{id}` → embed URL |
| `vidara.to` | Fetch streaming URL dari `vidara.so API` |
| Lainnya | Pass-through langsung ke yt-dlp |

---

## Error Handling

| Kondisi | Response ke User |
|---|---|
| URL tidak valid | ❌ URL tidak dikenali |
| Fetch vidara.so gagal | ❌ Gagal mengambil info stream |
| Job download failed | ❌ Download gagal: {error} |
| Polling timeout >5 menit | ❌ Download terlalu lama |
| File tidak ditemukan | ❌ File tidak tersedia |
| Upload GramJS gagal | ❌ Gagal mengirim file besar |
