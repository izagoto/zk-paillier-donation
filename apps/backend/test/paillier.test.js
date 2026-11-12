import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_AMOUNT,
  MIN_AMOUNT,
  MODULUS_BITS,
  addCiphertexts,
  assertAmount,
  decryptAmount,
  encryptAmount,
  generateDonationKeys,
} from "../src/paillier.js";

const keys = generateDonationKeys();

test("kunci publik berukuran 2048 bit", async () => {
  const { publicKey } = await keys;
  assert.equal(publicKey.bitLength, MODULUS_BITS);
});

test("Enc(50000) terdekripsi menjadi 50000", async () => {
  const { publicKey, privateKey } = await keys;
  const ciphertext = encryptAmount(publicKey, 50_000n);
  assert.equal(decryptAmount(privateKey, ciphertext), 50_000n);
});

test("Enc(50000) ditambah Enc(20000) terdekripsi menjadi 70000", async () => {
  const { publicKey, privateKey } = await keys;
  const total = addCiphertexts(
    publicKey,
    encryptAmount(publicKey, 50_000n),
    encryptAmount(publicKey, 20_000n),
  );
  assert.equal(decryptAmount(privateKey, total), 70_000n);
});

test("batas nominal", () => {
  assert.doesNotThrow(() => assertAmount(MIN_AMOUNT));
  assert.doesNotThrow(() => assertAmount(MAX_AMOUNT));
  assert.throws(() => assertAmount(0n), RangeError);
  assert.throws(() => assertAmount(MAX_AMOUNT + 1n), RangeError);
});

test("enkripsi menolak nominal di luar batas", async () => {
  const { publicKey } = await keys;
  assert.throws(() => encryptAmount(publicKey, 0n), RangeError);
  assert.throws(() => encryptAmount(publicKey, MAX_AMOUNT + 1n), RangeError);
  assert.equal(decryptAmount((await keys).privateKey, encryptAmount(publicKey, MIN_AMOUNT)), MIN_AMOUNT);
  assert.equal(
    decryptAmount((await keys).privateKey, encryptAmount(publicKey, MAX_AMOUNT)),
    MAX_AMOUNT,
  );
});
