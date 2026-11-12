const { expect } = require("chai");
const { commitmentOf, prove, solidityProof } = require("../../circuits/lib/witness");

describe("verifier identitas", function () {
  it("menerima proof sah dan menolak proof yang diubah", async function () {
    const secret = "12345";
    const amount = "50000";
    const commitment = await commitmentOf(secret);
    const { proof, publicSignals } = await prove({ secret, amount, commitment });
    const call = solidityProof(proof, publicSignals);

    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    expect(await verifier.verifyProof(call.a, call.b, call.c, call.input)).to.equal(true);

    const tamperedA = [(BigInt(call.a[0]) + 1n).toString(), call.a[1]];
    expect(await verifier.verifyProof(tamperedA, call.b, call.c, call.input)).to.equal(false);
  });
});
