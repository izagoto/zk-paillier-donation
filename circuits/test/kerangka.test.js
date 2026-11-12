const test = require("node:test");
const assert = require("node:assert/strict");

test("snarkjs dapat dimuat", () => {
  const snarkjs = require("snarkjs");
  assert.equal(typeof snarkjs.groth16.fullProve, "function");
});
