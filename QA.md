# Laporan QA RuangUang

Tanggal: 15 Oktober 2026. Pengujian source di folder github/ruang-uang-gpt.

## Otomatis

40 test: 16 perhitungan/validasi dan 24 integrasi UI jsdom. Perintah: `npm test` dan `npm run check`.

| Fitur | Cakupan |
| --- | --- |
| Navigasi | Delapan halaman, fallback URL, menu ponsel dan aria-expanded |
| Transaksi | Tambah/edit/hapus, income/expense/transfer, tanggal, batal, nominal invalid |
| Transfer | Saldo sumber/tujuan, konservasi saldo, tidak menambah arus kas, satu rekening |
| Filter | Pencarian, bulan, jenis, rekening sumber/tujuan transfer |
| Rekening | CRUD, saldo awal, lindungi rekening terakhir dan yang terpakai |
| Anggaran | CRUD, cegah kategori/bulan duplikat, terlampaui, isolasi bulan |
| Target | CRUD, alokasi, cegah melebihi target, tidak mengubah saldo |
| Tagihan | CRUD, pembayaran sekali per bulan, akhir Februari, batal, edit pembayaran, hapus pembayaran membuka kembali status, hapus tagihan mempertahankan ledger |
| Laporan | Rekonsiliasi, bulan kosong, kategori, sembunyikan nominal/tooltip |
| Pengaturan | Nama, escape markup, kategori kustom dan duplikat |
| Backup/CSV | JSON lengkap, CSV terfilter/escaping/formula, impor valid/rusak/terlalu besar, batal |
| Penyimpanan | Demo/pribadi terpisah, persistensi, reset demo, mode invalid, data korup tidak ditimpa, gagal kuota |

Bug yang ditemukan dan diperbaiki: pesan sukses profil, penghapusan, dan pembayaran kini hanya muncul setelah penyimpanan benar-benar berhasil. Mode tersimpan yang tidak dikenal kembali ke demo.

## Browser nyata

Browser Chromium bawaan, memakai data contoh lokal:

- Buat rekening, anggaran yang terlampaui, kategori, target dan alokasi.
- Target Rp500.000 menjadi Rp750.000 (15% dari Rp5.000.000).
- Buat tagihan, catat pembayaran; status lunas dan pengeluaran terkait tampil.
- Unduh JSON dan CSV: isi kedua file diverifikasi, masing-masing 15 transaksi pada waktu unduhan.
- Impor kembali backup yang sama; pemulihan berhasil.
- Transfer Rp25.000 tidak mengubah saldo total Rp23.536.000, pemasukan Rp10.500.000 atau pengeluaran Rp4.064.000.
- Pencarian transfer dan persistensi setelah reload berhasil.
- Delapan halaman pada 390 px tidak membuat halaman melebar; tabel tetap dapat digulir di panel.
- Dashboard juga diperiksa pada 320, 768, 1024 px dan viewport desktop default.
- Tidak ada error JavaScript pada log browser selama pemeriksaan.

## Batas verifikasi

Semua fitur tersedia tercakup test otomatis. Browser smoke test mencakup alur utama, bukan semua kombinasi input. Belum diuji Safari/Firefox, perangkat fisik, atau Vercel produksi. Pengujian tidak menjamin bebas bug di setiap kondisi. Data contoh tambahan QA hanya berada di browser lokal, tidak masuk repository.
