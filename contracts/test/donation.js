const { expect } = require("chai");
const { commitmentOf, prove, solidityProof } = require("../../circuits/lib/witness");

function storedCiphertext(limbs) {
  let hex = "";
  for (let i = limbs.length - 1; i >= 0; i--) {
    hex += BigInt(limbs[i]).toString(16).padStart(64, "0");
  }
  return `0x${hex}`;
}

const ANTO = "Bantu Raka kembali bersekolah";
const DINA = "Bantu Sari pulih setelah operasi";
const SECRET = "12345";
const AMOUNT = "50000";

async function loadCrypto() {
  const paillier = await import("../../apps/backend/src/paillier.js");
  const limbs = await import("../../apps/backend/src/limbs.js");
  const totals = await import("../../apps/backend/src/totals.js");
  const keys = await paillier.generateDonationKeys();
  const params = limbs.montgomeryParams(keys.publicKey.n ** 2n);
  return {
    paillier,
    limbs,
    totals,
    keys,
    params,
    encZero: limbs.limbsFromBigint(limbs.encryptZero(keys.publicKey)),
  };
}

async function deploy(crypto) {
  const [manager, donor] = await ethers.getSigners();
  const Verifier = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const Ledger = await ethers.getContractFactory("DonationLedger");
  const ledger = await Ledger.deploy(
    await verifier.getAddress(),
    manager.address,
    crypto.params.m0inv,
    crypto.params.modulusLimbs,
    crypto.params.r2,
    crypto.encZero,
  );
  await ledger.waitForDeployment();
  return { manager, donor, ledger };
}

describe("donation ledger", function () {
  let crypto;

  before(async function () {
    crypto = await loadCrypto();
  });

  it("menolak commitment kosong dan pendaftaran ganda", async function () {
    const { ledger } = await deploy(crypto);
    await expect(ledger.register(0)).to.be.revertedWithCustomError(ledger, "EmptyCommitment");
    const commitment = await commitmentOf(SECRET);
    await ledger.register(commitment);
    await expect(ledger.register(commitment)).to.be.revertedWithCustomError(ledger, "AlreadyRegistered");
  });

  it("pengelola membuat dua kampanye aktif", async function () {
    const { ledger, donor } = await deploy(crypto);
    await expect(ledger.connect(donor).createCampaign(ANTO, 2_000_000)).to.be.revertedWithCustomError(
      ledger,
      "NotManager",
    );

    await ledger.createCampaign(ANTO, 2_000_000);
    await ledger.createCampaign(DINA, 5_000_000);

    const anto = await ledger.campaigns(1);
    const dina = await ledger.campaigns(2);
    expect(anto.title).to.equal(ANTO);
    expect(anto.targetAmount).to.equal(2_000_000);
    expect(anto.active).to.equal(true);
    expect(anto.donationCount).to.equal(0);
    expect(dina.title).to.equal(DINA);
    expect(dina.targetAmount).to.equal(5_000_000);
    expect(dina.active).to.equal(true);
  });

  it("menyimpan donasi tanpa nominal dan menolak identitas yang belum terdaftar", async function () {
    const { ledger, donor } = await deploy(crypto);
    await ledger.createCampaign(ANTO, 2_000_000);
    const commitment = await commitmentOf(SECRET);
    const { proof, publicSignals } = await prove({
      secret: SECRET,
      amount: AMOUNT,
      commitment,
    });
    const call = solidityProof(proof, publicSignals);
    const ciphertext = crypto.limbs.limbsFromBigint(
      crypto.paillier.encryptAmount(crypto.keys.publicKey, 1n),
    );

    await expect(
      ledger.connect(donor).donate(1, commitment, ciphertext, call.a, call.b, call.c),
    ).to.be.revertedWithCustomError(ledger, "NotRegistered");

    await ledger.register(commitment);
    const tx = await ledger.connect(donor).donate(1, commitment, ciphertext, call.a, call.b, call.c);
    const receipt = await tx.wait();
    const recorded = receipt.logs
      .map((log) => {
        try {
          return ledger.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log && log.name === "DonationRecorded");

    expect(recorded.args.commitment).to.equal(BigInt(commitment));
    expect(recorded.args.sender).to.equal(donor.address);
    expect(recorded.args.ciphertext).to.equal(storedCiphertext(ciphertext));
    expect(recorded.fragment.inputs.map((input) => input.name)).to.not.include("amount");
    for (const value of recorded.args) {
      if (typeof value === "bigint") {
        expect(value).to.not.equal(50_000n);
      }
    }

    const stored = await ledger.donations(1);
    expect(stored.campaignId).to.equal(1);
    expect(stored.commitment).to.equal(BigInt(commitment));
    expect(stored.ciphertext).to.equal(storedCiphertext(ciphertext));
    expect(stored.sender).to.equal(donor.address);
    expect(stored.blockTime).to.be.gt(0);
    expect(Object.keys(stored)).to.not.include("amount");
    expect((await ledger.campaigns(1)).donationCount).to.equal(1);

    const tamperedA = [(BigInt(call.a[0]) + 1n).toString(), call.a[1]];
    await expect(
      ledger.connect(donor).donate(1, commitment, ciphertext, tamperedA, call.b, call.c),
    ).to.be.revertedWithCustomError(ledger, "InvalidProof");
  });

  it("menjumlahkan dua ciphertext dan tetap bisa didekripsi dari kontrak", async function () {
    const { ledger, donor } = await deploy(crypto);
    await ledger.createCampaign(ANTO, 2_000_000);
    const commitment = await commitmentOf(SECRET);
    await ledger.register(commitment);
    const { proof, publicSignals } = await prove({
      secret: SECRET,
      amount: AMOUNT,
      commitment,
    });
    const call = solidityProof(proof, publicSignals);
    const first = crypto.limbs.limbsFromBigint(
      crypto.paillier.encryptAmount(crypto.keys.publicKey, 50_000n),
    );
    const second = crypto.limbs.limbsFromBigint(
      crypto.paillier.encryptAmount(crypto.keys.publicKey, 20_000n),
    );

    await ledger.connect(donor).donate(1, commitment, first, call.a, call.b, call.c);
    await ledger.connect(donor).donate(1, commitment, second, call.a, call.b, call.c);

    const total = await crypto.totals.campaignTotal(ledger, 1, crypto.keys.privateKey);
    expect(total).to.equal(70_000n);
    expect(crypto.totals.cachedTotal(1)).to.equal(70_000n);

    crypto.totals.clearCache();
    expect(crypto.totals.cachedTotal(1)).to.equal(undefined);
    expect(await crypto.totals.campaignTotal(ledger, 1, crypto.keys.privateKey)).to.equal(70_000n);
    expect(Object.keys(crypto.totals)).to.not.include("donationAmount");
  });
});
