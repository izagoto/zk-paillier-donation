import { decryptAmount } from "./paillier.js";
import { bigintFromLimbs } from "./limbs.js";

const cache = new Map();

export async function campaignTotal(ledger, campaignId, privateKey) {
  const limbs = await ledger.aggregateOf(campaignId);
  const total = decryptAmount(privateKey, bigintFromLimbs(limbs));
  cache.set(String(campaignId), total);
  return total;
}

export function cachedTotal(campaignId) {
  return cache.get(String(campaignId));
}

export function clearCache() {
  cache.clear();
}
