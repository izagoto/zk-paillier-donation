const path = require("path");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");

const wasm = path.join(__dirname, "../build/identity_js/identity.wasm");
const zkey = path.join(__dirname, "../build/identity_final.zkey");
const vkeyPath = path.join(__dirname, "../build/verification_key.json");

async function commitmentOf(secret) {
  const poseidon = await buildPoseidon();
  return poseidon.F.toObject(poseidon([BigInt(secret)])).toString();
}

function prove(input) {
  return snarkjs.groth16.fullProve(input, wasm, zkey);
}

function solidityProof(proof, publicSignals) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
    input: publicSignals,
  };
}

module.exports = { commitmentOf, prove, solidityProof, vkeyPath, snarkjs };
