const { expect } = require("chai");

const MASK = (1n << 256n) - 1n;
const R = 1n << 4096n;

function limbsFromBigint(value) {
  const limbs = [];
  let rest = value;
  for (let i = 0; i < 16; i++) {
    limbs.push(rest & MASK);
    rest >>= 256n;
  }
  return limbs;
}

function bigintFromLimbs(limbs) {
  let value = 0n;
  for (let i = 15; i >= 0; i--) {
    value = (value << 256n) + BigInt(limbs[i]);
  }
  return value;
}

function inverseMod256(odd) {
  let inverse = 1n;
  for (let i = 0; i < 8; i++) {
    inverse = (inverse * (2n - ((odd * inverse) & MASK))) & MASK;
  }
  return inverse;
}

describe("montgomery 4096", function () {
  it("mengalikan dua angka modulo n kuadrat", async function () {
    const { generateDonationKeys } = await import("../../apps/backend/src/paillier.js");
    const { publicKey } = await generateDonationKeys();
    const modulus = publicKey.n ** 2n;
    const m0inv = (MASK + 1n - inverseMod256(modulus & MASK)) & MASK;
    const r2 = limbsFromBigint((R * R) % modulus);
    const harness = await (await ethers.getContractFactory("MontgomeryHarness")).deploy();

    const left = publicKey.encrypt(50_000n);
    const right = publicKey.encrypt(20_000n);
    const product = await harness.mulMod(
      limbsFromBigint(left),
      limbsFromBigint(right),
      limbsFromBigint(modulus),
      m0inv,
      r2,
    );
    expect(bigintFromLimbs(product)).to.equal(publicKey.addition(left, right));
  });
});
