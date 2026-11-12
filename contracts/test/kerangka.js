const { expect } = require("chai");

describe("kerangka", function () {
  it("jaringan lokal punya akun pengirim", async function () {
    const [signer] = await ethers.getSigners();
    expect(signer.address).to.be.a("string").and.to.have.lengthOf(42);
  });
});
