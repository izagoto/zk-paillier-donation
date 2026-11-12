import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { PrivateKey, PublicKey } from "paillier-bigint";
import { decryptAmount } from "./paillier.js";
import { bigintFromLimbs } from "./limbs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const port = 3001;

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const split = trimmed.indexOf("=");
    env[trimmed.slice(0, split)] = trimmed.slice(split + 1);
  }
  return env;
}

const env = loadEnv(path.join(root, "apps/backend/.env"));
const deployment = JSON.parse(fs.readFileSync(path.join(root, "apps/web/public/deployment.json"), "utf8"));
const artifact = JSON.parse(
  fs.readFileSync(
    path.join(root, "contracts/artifacts/contracts/DonationLedger.sol/DonationLedger.json"),
    "utf8",
  ),
);
const provider = new ethers.JsonRpcProvider(env.RPC_URL);
const ledger = new ethers.Contract(deployment.ledger, artifact.abi, provider);
const publicKey = new PublicKey(BigInt(env.PAILLIER_N), BigInt(env.PAILLIER_G));
const privateKey = new PrivateKey(BigInt(env.PAILLIER_LAMBDA), BigInt(env.PAILLIER_MU), publicKey);

async function campaigns() {
  const next = await ledger.nextCampaignId();
  const list = [];
  let donations = 0n;
  for (let id = 1n; id < next; id++) {
    const campaign = await ledger.campaigns(id);
    const donationCount = campaign.donationCount;
    donations += donationCount;
    let total = null;
    if (donationCount > 0n) {
      total = decryptAmount(privateKey, bigintFromLimbs(await ledger.aggregateOf(id))).toString();
    }
    list.push({
      id: id.toString(),
      title: campaign.title,
      target: campaign.targetAmount.toString(),
      donationCount: donationCount.toString(),
      active: campaign.active,
      total,
    });
  }
  return { campaigns: list, donationCount: donations.toString() };
}

const coversDir = path.join(root, "apps/web/public/covers");
const coverIndexPath = path.join(coversDir, "index.json");
const coverTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function readCoverIndex() {
  if (!fs.existsSync(coverIndexPath)) return {};
  return JSON.parse(fs.readFileSync(coverIndexPath, "utf8"));
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("besar"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function saveCover(request, response) {
  const id = String(request.headers["x-campaign-id"] ?? "");
  const ext = coverTypes[String(request.headers["content-type"] ?? "")];
  if (!/^[1-9]\d*$/.test(id) || !ext) {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Foto harus JPEG, PNG, atau WebP." }));
    return;
  }
  let bytes;
  try {
    bytes = await readBody(request, 2_000_000);
  } catch {
    response.writeHead(413, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Foto terlalu besar. Maksimum 2 MB." }));
    return;
  }
  if (!bytes.length) {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Foto kosong." }));
    return;
  }
  fs.mkdirSync(coversDir, { recursive: true });
  for (const old of Object.values(coverTypes)) {
    if (old === ext) continue;
    const oldPath = path.join(coversDir, `${id}.${old}`);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  fs.writeFileSync(path.join(coversDir, `${id}.${ext}`), bytes);
  const index = readCoverIndex();
  index[id] = `/covers/${id}.${ext}?v=${Date.now()}`;
  fs.writeFileSync(coverIndexPath, `${JSON.stringify(index, null, 2)}\n`);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ cover: index[id] }));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/covers") {
    await saveCover(request, response);
    return;
  }
  if (request.method !== "GET") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "tidak ada" }));
    return;
  }
  if (request.url === "/api/campaigns") {
    const body = await campaigns();
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "tidak ada" }));
});

server.listen(port, "127.0.0.1");
