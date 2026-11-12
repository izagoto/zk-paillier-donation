const test = require("node:test");
const assert = require("node:assert/strict");
const { commitmentOf, prove, snarkjs, vkeyPath } = require("../lib/witness");

const secret = "12345";
const amount = "50000";

test("proof sah untuk secret yang cocok dan amount 50000", async () => {
  const commitment = await commitmentOf(secret);
  const { proof, publicSignals } = await prove({ secret, amount, commitment });
  const vkey = require(vkeyPath);

  assert.equal(publicSignals.length, 1);
  assert.equal(publicSignals[0], commitment);
  assert.equal(publicSignals.includes(amount), false);
  assert.equal(await snarkjs.groth16.verify(vkey, publicSignals, proof), true);
});

test("proof gagal untuk amount 0", async () => {
  const commitment = await commitmentOf(secret);
  await assert.rejects(() => prove({ secret, amount: "0", commitment }));
});

test("proof gagal jika secret tidak cocok dengan commitment", async () => {
  const commitment = await commitmentOf(secret);
  await assert.rejects(() => prove({ secret: "99999", amount, commitment }));
});
