# Teknologi, metode, dan setup

Purwarupa berjalan di mesin lokal. Tidak ada server publik dan tidak ada mainnet.

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Antarmuka | Vite, TypeScript, snarkjs, `paillier-bigint` |
| Backend | Node.js, TypeScript |
| Kontrak | Solidity 0.8, Hardhat, verifier Groth16 hasil snarkjs |
| Rantai uji | Hardhat Network |
| Sirkuit | Circom 2, circomlib (Poseidon), snarkjs |
| Bukti | Groth16 pada kurva bn128 |
| Enkripsi nominal | Paillier, modulus 2048 bit |
| Penyimpanan | Tidak ada basis data. Lihat bagian di bawah |
| Pembanding uji | AES, hanya untuk jalur T5. Pada jalur ini nominal disimpan di basis data |

## Basis data

Purwarupa Paillier tidak memakai basis data.

Tidak ada PostgreSQL, MySQL, MongoDB, SQLite, atau layanan basis data lain. Jangan menambahkan basis data untuk menyimpan donasi, nominal, atau total.

| Data | Tempat penyimpanan |
|---|---|
| Kampanye, commitment, ciphertext, proof, jumlah donasi, status tersalurkan | Smart contract di Hardhat Network |
| Kunci privat Paillier | `apps/backend/.env`, tidak masuk git |
| Kunci publik Paillier, proving key, verification key | Berkas setup yang dibaca browser dan kontrak |
| Secret donatur | Memori sesi browser, tidak dikirim ke server dan tidak ditulis ke rantai |
| Total yang sudah didekripsi | Dihitung ulang dari `aggregateCiphertext` di kontrak. Boleh di-cache di memori backend, bukan di basis data |

Backend yang kehilangan cache tetap bisa menampilkan total yang sama dengan membaca kontrak. Itu tolok ukur T4.

Basis data hanya ada pada jalur pembanding AES (tolok ukur T5), yaitu model sistem yang berjalan sekarang. Di jalur itu nominal dienkripsi lalu disimpan di basis data, dan harus didekripsi satu per satu sebelum dijumlahkan. Basis data itu bukan bagian dari sistem yang dibangun.

## Bahasa

| Bahasa | Dipakai untuk |
|---|---|
| TypeScript | Antarmuka browser dan backend |
| Solidity | Smart contract dan verifier |
| Circom | Sirkuit zk-SNARK |
| Bash | `circuits/setup.sh` untuk trusted setup |

JavaScript yang dieksekusi adalah hasil kompilasi TypeScript. Pustaka `snarkjs` dan `paillier-bigint` dipanggil dari TypeScript.

## Server

Tiga proses lokal. Tidak ada server di luar laptop pengembang.

| Proses | Peran | Alamat |
|---|---|---|
| Hardhat Network | Rantai uji. Menyimpan kontrak, ciphertext, proof, dan total terenkripsi | `127.0.0.1:8545` |
| Backend Node.js | Membaca ciphertext total dari rantai, mendekripsi total, menyajikan total ke antarmuka. Tidak menyajikan nominal per donasi | `127.0.0.1:3001` |
| Vite | Antarmuka donatur dan publik. Enkripsi dan pembuatan proof terjadi di browser, bukan di backend | `127.0.0.1:5173` |

Kunci privat Paillier hanya dibaca backend dari berkas lingkungan yang tidak masuk git. Browser hanya menerima kunci publik `(n, g)`.

## Model

Dua model dipakai. Model pertama adalah sistem yang berjalan sekarang, dan hanya menjadi pembanding. Model kedua adalah sistem yang dibangun.

### Model sistem yang berjalan

Nominal dikirim sebagai plaintext ke backend, dienkripsi dengan AES, lalu disimpan di basis data. Total hanya bisa dihitung setelah tiap nominal didekripsi. Jika basis data atau kunci bocor, nominal tiap donasi ikut terbuka.

| Langkah | Yang terjadi |
|---|---|
| Donatur | Mengirim nominal mentah |
| Backend | Mengenkripsi dengan AES dan menyimpan ciphertext di basis data |
| Penghitungan total | Mendekripsi nominal satu per satu, lalu menjumlahkan |
| Publik | Melihat total, tanpa bukti di rantai bahwa donasi masuk |

Model ini adalah jalur tolok ukur T5. Basis datanya bukan penyimpanan sistem Paillier.

### Model sistem yang dibangun

Nominal dienkripsi di browser dengan Paillier. Browser juga membuat proof Groth16. Smart contract memeriksa proof, menyimpan ciphertext, dan mengalikan ciphertext ke total terenkripsi. Backend hanya mendekripsi ciphertext total.

| Peran | Model kerja |
|---|---|
| Browser | Poseidon untuk commitment, enkripsi Paillier, proof Groth16 |
| Smart contract | Verifikasi Groth16, penyimpanan donasi, agregasi homomorfik |
| Backend | Dekripsi satu ciphertext total per kampanye |
| Publik | Melihat total rupiah, riwayat `ENC`, dan pengenal transaksi |

Alamat pengirim, indeks kampanye, dan total yang dipublikasikan tetap terlihat. Secret, nominal tiap donasi, dan randomness enkripsi tidak ditulis ke rantai.

## Algoritma

| Algoritma | Peran pada purwarupa |
|---|---|
| Paillier | Enkripsi nominal, penjumlahan ciphertext, dekripsi total |
| Poseidon | `commitment = Poseidon(secret)` |
| Groth16 | Bukti bahwa donatur tahu secret dan nominal berada pada rentang yang sah |
| Powers of Tau `pot12` | Trusted setup Groth16 untuk sirkuit `Identity` |
| Montgomery CIOS, 4096 bit | Perkalian ciphertext modulo `n^2` di dalam kontrak |
| AES | Pembanding pada model sistem yang berjalan, jalur T5 |

### Paillier

Modulus 2048 bit. Pembangkitan kunci memakai `g = n + 1`.

- Enkripsi, di browser: `c = g^m * r^n mod n^2`. `m` adalah nominal rupiah bulat. `r` acak, koprima terhadap `n`.
- Penjumlahan homomorfik: `c_total = c1 * c2 mod n^2`, yaitu enkripsi dari `m1 + m2`.
- Awal agregat kampanye adalah `Enc(0)`.
- Dekripsi, di backend: `m = L(c^λ mod n^2) * μ mod n`, dengan `L(u) = (u - 1) / n`.

Nominal yang diterima adalah 1 sampai 1.000.000.000. Perkalian skalar tidak dipakai.

### Poseidon

Hash di dalam sirkuit dan di browser memakai Poseidon satu masukan dari circomlib. Masukannya `secret`. Keluarannya commitment yang didaftarkan ke kontrak. Secret tidak meninggalkan browser.

### Groth16

Sistem bukti Groth16 pada kurva bn128. Verifier Solidity memakai precompile Ethereum. Sinyal publik sirkuit tahap A hanya `commitment`. Sinyal privat adalah `secret` dan `amount`.

Batasan yang sedang berjalan:

1. `Poseidon(secret) = commitment`
2. `1 <= amount <= 1000000000`, diperiksa dengan pembanding 40 bit

Proof tahap A belum mengikat ciphertext Paillier ke `amount`. Ikatan itu adalah tahap B pada rencana pengerjaan. Selama tahap B belum ada, proof yang sama masih bisa menyertai dua ciphertext yang berbeda.

### Montgomery CIOS

`n^2` untuk modulus 2048 bit berukuran 4096 bit, yaitu 16 limb `uint256`. Solidity tidak mengalikan bilangan sebesar itu secara langsung. Kontrak memakai perkalian Montgomery CIOS: `montMul(montMul(a, R^2), b) mod n^2`, dengan `R = 2^4096`. Hasilnya disimpan sebagai 512 byte big-endian.

### AES

AES hanya meniru model sistem yang berjalan pada skenario uji yang sama. Tiap nominal harus dibuka sebelum dijumlahkan. AES tidak mengenkripsi donasi pada jalur Paillier.

## Metode

### Metode penelitian

Pengembangan purwarupa, lalu eksperimen pada skenario yang sama untuk dua model di atas. Yang dibandingkan adalah data yang tersimpan dan data yang harus dibuka, sesuai tolok ukur T5. Bukan survei pengguna.

### Metode kriptografi

Enkripsi dan proof dibuat di browser. Verifikasi proof dan agregasi ciphertext dilakukan di smart contract. Dekripsi total dilakukan di backend. Kunci privat Paillier tidak masuk browser dan tidak masuk repositori.

### Metode pengujian

Uji skenario U1 sampai U10 pada Hardhat Network. T1 sampai T4 wajib lulus. Waktu enkripsi, waktu proof, dan gas dicatat tanpa ambang lulus.

## Setup

Alat yang dipasang sekali:

1. Node.js 20 atau lebih baru. Circom 2 harus tersedia sebagai perintah `circom`.
2. Circom 2, tersedia sebagai perintah `circom`.
3. Dependensi npm di `contracts/`, `apps/web/`, dan `apps/backend/`, termasuk Hardhat, snarkjs, circomlib, dan `paillier-bigint`.

Urutan menyalakan purwarupa:

1. Bangkitkan kunci Paillier 2048 bit. Simpan kunci privat di `apps/backend/.env`. Simpan kunci publik untuk browser dan untuk konstanta sirkuit.
2. Jalankan `circuits/setup.sh`. Keluaran yang dipakai: `identity.r1cs`, proving key, `verification_key.json`, dan kontrak verifier.
3. Jalankan Hardhat Network di `127.0.0.1:8545`.
4. Deploy kontrak dengan kunci publik Paillier dan verification key.
5. Jalankan backend di `127.0.0.1:3001` dengan kunci privat.
6. Jalankan antarmuka Vite di `127.0.0.1:5173`. Browser memakai proving key statis dan alamat kontrak hasil deploy.

Donasi uji tidak membutuhkan akun di server. Donatur membuat secret di browser, mendaftarkan commitment ke kontrak, lalu mengirim ciphertext dan proof ke Hardhat Network.
