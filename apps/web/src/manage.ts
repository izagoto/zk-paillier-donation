import { Contract, JsonRpcProvider, Wallet } from "ethers";
import artifact from "../../../contracts/artifacts/contracts/DonationLedger.sol/DonationLedger.json";
import { createCampaign, type CampaignView } from "./chain.js";

const LOCAL_MANAGER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const campaignsEl = document.querySelector<HTMLElement>("#campaigns")!;
const titleInput = document.querySelector<HTMLInputElement>("#campaign-title")!;
const targetInput = document.querySelector<HTMLInputElement>("#campaign-target")!;
const photoInput = document.querySelector<HTMLInputElement>("#campaign-photo")!;
const photoPreview = document.querySelector<HTMLImageElement>("#photo-preview")!;
const photoLabel = document.querySelector<HTMLElement>("#photo-label")!;
const note = document.querySelector<HTMLElement>("#manage-note")!;
const errorEl = document.querySelector<HTMLElement>("#manage-error")!;
const okEl = document.querySelector<HTMLElement>("#manage-ok")!;
const button = document.querySelector<HTMLButtonElement>("#create-button")!;
const form = document.querySelector<HTMLFormElement>("#manage-form")!;

function rupiah(value: string) {
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function photoFile() {
  return photoInput.files?.[0] ?? null;
}

function ready() {
  const file = photoFile();
  return titleInput.value.trim() !== "" && /^[1-9]\d*$/.test(targetInput.value.trim()) && file !== null && file.size > 0 && file.size <= 2_000_000;
}

function chainError(cause: unknown) {
  const data = typeof cause === "object" && cause && "data" in cause ? String((cause as { data?: unknown }).data) : "";
  const message = cause instanceof Error ? cause.message : "";
  if (`${data} ${message}`.includes("0xc0fc8a8a")) return "Hanya pengelola yang dapat membuat campaign.";
  return "Campaign gagal dibuat. Periksa judul dan target.";
}

async function managerLedger() {
  const deployment = (await fetch("/deployment.json").then((response) => response.json())) as { rpcUrl: string; ledger: string };
  const provider = new JsonRpcProvider(deployment.rpcUrl);
  return new Contract(deployment.ledger, artifact.abi, new Wallet(LOCAL_MANAGER_KEY, provider));
}

async function refresh() {
  const [response, coverResponse] = await Promise.all([
    fetch("/api/campaigns"),
    fetch("/covers/index.json", { cache: "no-store" }),
  ]);
  const body = (await response.json()) as { campaigns: CampaignView[] };
  const covers = coverResponse.ok ? ((await coverResponse.json()) as Record<string, string>) : {};
  campaignsEl.replaceChildren(
    ...body.campaigns.map((campaign) => {
      const row = document.createElement("div");
      row.className = "campaign-row";
      const src = covers[campaign.id] ?? "";
      row.innerHTML = `<span class="identity"><span class="thumb">${src ? `<img alt="" src="${src}" />` : ""}</span><span><h3></h3><p class="muted"></p></span></span><span class="side"></span>`;
      row.querySelector("h3")!.textContent = campaign.title;
      const waiting = campaign.active && campaign.total === null;
      row.querySelector("p")!.textContent = waiting ? "belum dihitung" : rupiah(campaign.total ?? campaign.target);
      row.querySelector(".side")!.textContent = campaign.active ? rupiah(campaign.target) : "Tersalurkan";
      return row;
    }),
  );
}

async function uploadCover(id: string, file: File) {
  const response = await fetch("/api/covers", {
    method: "POST",
    headers: { "content-type": file.type, "x-campaign-id": id },
    body: file,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Foto gagal diunggah.");
  }
}

function sync() {
  const digits = targetInput.value.trim();
  note.textContent = /^[1-9]\d*$/.test(digits) ? `Target ${Number(digits).toLocaleString("id-ID")}` : "";
  button.disabled = !ready();
}

titleInput.addEventListener("input", sync);
targetInput.addEventListener("input", sync);
photoInput.addEventListener("change", () => {
  const file = photoFile();
  if (photoPreview.src.startsWith("blob:")) URL.revokeObjectURL(photoPreview.src);
  if (!file) {
    photoPreview.hidden = true;
    photoLabel.textContent = "Pilih foto JPEG, PNG, atau WebP";
  } else {
    photoPreview.src = URL.createObjectURL(file);
    photoPreview.hidden = false;
    photoLabel.textContent = file.name;
  }
  sync();
});

const ledger = await managerLedger();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = photoFile();
  if (!ready() || !file) return;
  errorEl.hidden = true;
  okEl.hidden = true;
  button.disabled = true;
  button.textContent = "Membuat...";
  try {
    const id = await createCampaign(ledger, titleInput.value.trim(), BigInt(targetInput.value.trim()));
    await uploadCover(id, file);
    titleInput.value = "";
    targetInput.value = "";
    photoInput.value = "";
    photoPreview.hidden = true;
    photoLabel.textContent = "Pilih foto JPEG, PNG, atau WebP";
    note.textContent = "";
    okEl.hidden = false;
    okEl.textContent = "Campaign dibuat. Donasi yang sudah ada tetap tersimpan.";
    await refresh();
  } catch (cause) {
    errorEl.hidden = false;
    errorEl.textContent = cause instanceof Error && cause.message && !cause.message.includes("0x") ? cause.message : chainError(cause);
  } finally {
    button.textContent = "Buat campaign";
    sync();
  }
});

sync();
await refresh();
