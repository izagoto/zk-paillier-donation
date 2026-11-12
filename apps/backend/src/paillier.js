import { generateRandomKeys } from "paillier-bigint";

export const MODULUS_BITS = 2048;
export const MIN_AMOUNT = 1n;
export const MAX_AMOUNT = 1_000_000_000n;

export function assertAmount(amount) {
  if (typeof amount !== "bigint") {
    throw new TypeError("nominal harus bigint");
  }
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    throw new RangeError("nominal harus dari 1 sampai 1000000000");
  }
}

export function generateDonationKeys() {
  return generateRandomKeys(MODULUS_BITS, true);
}

export function encryptAmount(publicKey, amount) {
  assertAmount(amount);
  return publicKey.encrypt(amount);
}

export function addCiphertexts(publicKey, left, right) {
  return publicKey.addition(left, right);
}

export function decryptAmount(privateKey, ciphertext) {
  return privateKey.decrypt(ciphertext);
}
