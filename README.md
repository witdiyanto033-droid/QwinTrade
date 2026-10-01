# QwinAi Trade v5

Paket lengkap Node.js untuk dashboard trading:
- Twelve Data OHLC
- refresh 20 detik
- candlestick
- SNR/SND/SMC, BOS/CHOCH proxy, liquidity sweep, price action
- threshold sinyal 50%
- Gemini AI
- browser notification
- Web Push/VAPID infrastructure
- kalkulator IDR/USD/USC
- tema bisa diganti
- responsif untuk HP

## Jalankan
Node.js 18+ diperlukan.
```bash
npm install
```
Isi `.env`:
```env
TWELVE_DATA_API_KEY=...
GEMINI_API_KEY=...
```
Gemini API sebaiknya disimpan sebagai environment variable dan tidak dimasukkan ke frontend.

### VAPID
```bash
npx web-push generate-vapid-keys
```
Salin public/private key ke `.env`:
```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:email-kamu@example.com
```

Kemudian:
```bash
npm start
```

## Catatan notifikasi
Browser notification lokal berjalan saat halaman aktif. Infrastruktur Web Push/VAPID juga disediakan, tetapi untuk push otomatis yang benar-benar berjalan saat browser tertutup, backend harus mengirim `web-push` ke subscription yang didaftarkan. Versi ini sudah menyediakan endpoint subscribe dan push-test; frontend dapat dikembangkan untuk menyimpan subscription persisten (database).

## Data & delay
Twelve Data REST candles dapat mengalami delay pemrosesan setelah candle tutup. Untuk kebutuhan latency sangat rendah, Twelve Data menyediakan WebSocket; akses/kuota bergantung paket. Jangan menganggap refresh 20 detik berarti harga tick real-time.

## Keamanan
Jangan upload `.env` ke repository publik. Jangan menaruh API key Twelve Data/Gemini di browser.
