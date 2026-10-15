# RuangUang

Website keuangan pribadi berbahasa Indonesia. HTML/CSS/JavaScript statis; tanpa backend atau build.

## Fitur

- CRUD pemasukan, pengeluaran, transfer, rekening, anggaran, target, dan tagihan rutin.
- Pencarian/filter bulan, kategori melalui pencarian, jenis, dan rekening.
- Saldo awal, saldo berjalan, laporan bulanan, grafik arus kas, indikator anggaran terlampaui.
- Alokasi target, pembayaran tagihan per bulan, kategori kustom, profil dan sembunyikan nominal.
- Ekspor CSV sesuai filter, backup/pemulihan JSON, mode demo/pribadi terpisah.
- Tampilan responsif, logo dan favicon SVG.

## Jalankan lokal

```sh
python3 -m http.server 4180 --directory dist
```

Buka http://localhost:4180. Gunakan server HTTP; ES modules tidak berjalan dengan membuka index.html melalui file://.

## Pengujian

Gunakan Node.js 22.22.2+, 24.15.0+, atau 26+ sesuai dukungan jsdom.

```sh
npm ci
npm run check
npm test
```

Dependensi npm hanya untuk test. Aplikasi di dist tidak memerlukan npm saat runtime. Lihat [QA.md](QA.md) untuk hasil dan batas pemeriksaan.

## Vercel

Import `ganoolmovie5th-cell/ruang-uang-gpt`, branch `main`:

- Framework Preset: **Other**
- Root Directory: default/root repository
- Build Command: kosong/nonaktif
- Output Directory: **dist**
- Install Command: kosong/nonaktif bila tidak ingin menginstal dependensi test

vercel.json sudah menetapkan konfigurasi statis. Tidak memerlukan environment variable. Navigasi hash tidak membutuhkan rewrite SPA.

## Mulai menggunakan

Klik **Mulai catatan pribadi**, atur rekening dan saldo awal, kemudian catat transaksi. Data demo tidak ikut dipindahkan. Unduh backup JSON berkala lewat Pengaturan.

## Penyimpanan dan batas fitur

Data disimpan di localStorage pada browser dan origin/domain yang sama, tanpa enkripsi atau sinkronisasi antarperangkat. Data localhost tidak otomatis muncul di Vercel: pindahkan memakai backup JSON pada mode yang sesuai. Menghapus data browser menghapus catatan.

Tidak ada koneksi bank, pengiriman uang, autodebit, atau notifikasi latar belakang. Pembayaran tagihan hanya mencatat pengeluaran. Alokasi target tidak mengubah saldo rekening. Saldo rekening mencakup seluruh tanggal transaksi; laporan/anggaran mengikuti bulan yang dipilih. Mata uang IDR dengan nominal bilangan bulat.
