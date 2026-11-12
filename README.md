# Sistem Donasi Transparan dengan Paillier dan zk-SNARK

Purwarupa lokal untuk donasi yang tercatat di blockchain. Nominal tiap donasi tetap terenkripsi. Total campaign tetap bisa ditampilkan.

Sistem ini tidak memakai basis data. Donasi, commitment, ciphertext, dan total terenkripsi disimpan di smart contract. Basis data hanya ada pada jalur pembanding AES, dan jalur itu belum menjadi penyimpanan sistem ini.

Dokumen acuan:

- [docs/perancangan-sistem.md](docs/perancangan-sistem.md) untuk perilaku sistem.
- [docs/rencana-pengerjaan.md](docs/rencana-pengerjaan.md) untuk urutan kerja.
- [docs/teknologi-dan-setup.md](docs/teknologi-dan-setup.md) untuk model, algoritma, dan metode.

## Peran

| Peran | Halaman | Yang bisa dilakukan |
|---|---|---|
| Publik dan donatur | http://127.0.0.1:5173/ | Melihat campaign, mendaftar secret, mengirim donasi |
| Pengelola | http://127.0.0.1:5173/pengelola.html | Membuat campaign dan mengunggah foto sampul |

Halaman pengelola tidak ditautkan dari halaman publik. Secret donatur hanya tinggal di browser. Kunci privat Paillier hanya tinggal di `apps/backend/.env`.

## Setup

Alat yang dibutuhkan: Node.js 20 atau lebih baru, dan Circom 2 yang bisa dipanggil sebagai `circom`.

Dari folder proyek, pasang dependensi:

```bash
npm install --prefix circuits
npm install --prefix contracts
npm install --prefix apps/backend
npm install --prefix apps/web
```

Trusted setup Groth16 dijalankan sekali. Perintah ini menghasilkan proving key, verification key, dan verifier Solidity.

```bash
cd circuits
./setup.sh
```

## Menyalakan purwarupa

Tiga proses lokal dijalankan di terminal terpisah. Hardhat Network harus hidup lebih dulu.

```bash
cd contracts
npx hardhat node
```

Deploy membuat kunci Paillier 2048 bit, memasang kontrak, dan membuat dua campaign awal. Skrip menulis `apps/backend/.env` dan `apps/web/public/deployment.json`. Kedua berkas itu tidak masuk git.

```bash
node contracts/scripts/deploy-local.mjs
```

Backend membaca kunci privat dan menyajikan total campaign:

```bash
cd apps/backend
npm start
```

Antarmuka:

```bash
cd apps/web
npm run dev
```

Backend menjawab di `127.0.0.1:3001`. Antarmuka menjawab di `127.0.0.1:5173`.

Campaign berikutnya dibuat dari halaman pengelola, pada kontrak yang sedang berjalan. Deploy ulang hanya dipakai untuk pemasangan pertama, karena skrip itu memasang kontrak baru.

## Uji

```bash
npm test --prefix circuits
npm test --prefix contracts
npm test --prefix apps/backend
npm test --prefix apps/web
```

Uji kontrak memakai `npx hardhat test` lewat skrip `contracts`.
