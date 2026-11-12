import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { PublicKey } from "paillier-bigint";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import artifact from "../../../contracts/artifacts/contracts/DonationLedger.sol/DonationLedger.json";

const LOCAL_DONOR_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

type Deployment = {
  rpcUrl: string;
  ledger: string;
  n: string;
  g: string;
};

type Poseidon = {
  F: { toObject: (value: unknown) => bigint };
  (input: bigint[]): unknown;
};

export type CampaignView = {
  id: string;
  title: string;
  target: string;
  donationCount: string;
  active: boolean;
  total: string | null;
};

let poseidonPromise: Promise<Poseidon> | undefined;

function poseidon() {
  poseidonPromise ??= buildPoseidon() as Promise<Poseidon>;
  return poseidonPromise;
}

function limbs(value: bigint) {
  const mask = (1n << 256n) - 1n;
  const out = [];
  let rest = value;
  for (let i = 0; i < 16; i += 1) {
    out.push(rest & mask);
    rest >>= 256n;
  }
  return out;
}

function proofArgs(proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] }, signals: string[]) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
    input: signals,
  };
}

export async function loadApp() {
  const deployment = (await fetch("/deployment.json").then((response) => response.json())) as Deployment;
  const provider = new JsonRpcProvider(deployment.rpcUrl);
  const donor = new Wallet(LOCAL_DONOR_KEY, provider);
  const ledger = new Contract(deployment.ledger, artifact.abi, donor);
  const publicKey = new PublicKey(BigInt(deployment.n), BigInt(deployment.g));
  return { ledger, publicKey };
}

export async function commitmentOf(secret: string) {
  const hash = await poseidon();
  return hash.F.toObject(hash([BigInt(secret)])).toString();
}

export async function createCampaign(ledger: Contract, title: string, target: bigint) {
  const tx = await ledger.createCampaign(title, target);
  const receipt = await tx.wait();
  const created = receipt.logs
    .map((log) => {
      try {
        return ledger.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((log) => log?.name === "CampaignCreated");
  return String(created?.args?.campaignId ?? "");
}

export async function registerIdentity(ledger: Contract, secret: string) {
  const commitment = await commitmentOf(secret);
  const tx = await ledger.register(commitment);
  await tx.wait();
  return commitment;
}

export async function donate(options: {
  ledger: Contract;
  publicKey: PublicKey;
  campaignId: string;
  secret: string;
  amount: bigint;
  onStep: (step: "encrypt" | "proof" | "send" | "wait") => void;
}) {
  options.onStep("encrypt");
  const ciphertext = limbs(options.publicKey.encrypt(options.amount));
  options.onStep("proof");
  const commitment = await commitmentOf(options.secret);
  const proof = await groth16.fullProve(
    { secret: options.secret, amount: options.amount.toString(), commitment },
    "/identity.wasm",
    "/identity_final.zkey",
  );
  const call = proofArgs(proof.proof, proof.publicSignals);
  options.onStep("send");
  const tx = await options.ledger.donate(
    options.campaignId,
    commitment,
    ciphertext,
    call.a,
    call.b,
    call.c,
  );
  options.onStep("wait");
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function donationHistory(ledger: Contract, titles: Map<string, string>) {
  const events = await ledger.queryFilter(ledger.filters.DonationRecorded());
  const blocks = new Map<number, number>();
  return Promise.all(
    events.map(async (event) => {
      const blockNumber = event.blockNumber;
      if (!blocks.has(blockNumber)) {
        const block = await event.getBlock();
        blocks.set(blockNumber, Number(block?.timestamp ?? 0));
      }
      const campaignId = String(event.args?.campaignId);
      return {
        campaignId,
        campaign: titles.get(campaignId) ?? "Campaign",
        tx: event.transactionHash,
        time: blocks.get(blockNumber) ?? 0,
      };
    }),
  );
}
