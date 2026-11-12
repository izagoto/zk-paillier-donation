import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";
import { generateDonationKeys } from "../../apps/backend/src/paillier.js";
import { encryptZero, limbsFromBigint, montgomeryParams } from "../../apps/backend/src/limbs.js";

const MANAGER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function artifact(name) {
  return JSON.parse(
    fs.readFileSync(path.join(root, "contracts/artifacts/contracts", name), "utf8"),
  );
}

const provider = new JsonRpcProvider("http://127.0.0.1:8545");
const manager = new Wallet(MANAGER_KEY, provider);
const keys = await generateDonationKeys();
const params = montgomeryParams(keys.publicKey.n ** 2n);

let nonce = await provider.getTransactionCount(manager.address);
const verifierArtifact = artifact("IdentityVerifier.sol/Groth16Verifier.json");
const verifier = await new ContractFactory(verifierArtifact.abi, verifierArtifact.bytecode, manager).deploy({
  nonce: nonce++,
});
await verifier.waitForDeployment();

const ledgerArtifact = artifact("DonationLedger.sol/DonationLedger.json");
const ledger = await new ContractFactory(ledgerArtifact.abi, ledgerArtifact.bytecode, manager).deploy(
  await verifier.getAddress(),
  manager.address,
  params.m0inv,
  params.modulusLimbs,
  params.r2,
  limbsFromBigint(encryptZero(keys.publicKey)),
  { nonce: nonce++ },
);
await ledger.waitForDeployment();
await (await ledger.createCampaign("Bantu Raka kembali bersekolah", 2_000_000, { nonce: nonce++ })).wait();
await (await ledger.createCampaign("Bantu Sari pulih setelah operasi", 5_000_000, { nonce: nonce++ })).wait();

const publicDir = path.join(root, "apps/web/public");
fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(path.join(root, "circuits/build/identity_js/identity.wasm"), path.join(publicDir, "identity.wasm"));
fs.copyFileSync(path.join(root, "circuits/build/identity_final.zkey"), path.join(publicDir, "identity_final.zkey"));

const deployment = {
  rpcUrl: "http://127.0.0.1:8545",
  ledger: await ledger.getAddress(),
  n: keys.publicKey.n.toString(),
  g: keys.publicKey.g.toString(),
};
fs.writeFileSync(path.join(publicDir, "deployment.json"), `${JSON.stringify(deployment, null, 2)}\n`);
fs.writeFileSync(
  path.join(root, "apps/backend/.env"),
  [
    `PAILLIER_N=${keys.publicKey.n}`,
    `PAILLIER_G=${keys.publicKey.g}`,
    `PAILLIER_LAMBDA=${keys.privateKey.lambda}`,
    `PAILLIER_MU=${keys.privateKey.mu}`,
    `LEDGER_ADDRESS=${deployment.ledger}`,
    `RPC_URL=${deployment.rpcUrl}`,
    "",
  ].join("\n"),
);
console.log(`ledger ${deployment.ledger}`);
