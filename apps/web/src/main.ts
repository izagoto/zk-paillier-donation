import { shortHash, whenLabel } from "./history.js";
import { donate, donationHistory, loadApp, registerIdentity, type CampaignView } from "./chain.js";

const banner = document.querySelector<HTMLElement>("#banner")!;
const campaignsEl = document.querySelector<HTMLElement>("#campaigns")!;
const historyEl = document.querySelector<HTMLElement>("#history")!;
const donationCount = document.querySelector<HTMLElement>("#donation-count")!;
const campaignCount = document.querySelector<HTMLElement>("#campaign-count")!;
const registerForm = document.querySelector<HTMLFormElement>("#register-form")!;
const picker = document.querySelector<HTMLElement>("#picker")!;
const pickerLive = document.querySelector<HTMLElement>("#picker-live")!;
const pickerClosed = document.querySelector<HTMLElement>("#picker-closed")!;
const closedLabel = document.querySelector<HTMLElement>("#closed-label")!;
const donateForm = document.querySelector<HTMLFormElement>("#donate-form")!;
const amountInput = document.querySelector<HTMLInputElement>("#amount")!;
const amountNote = document.querySelector<HTMLElement>("#amount-note")!;
const selected = document.querySelector<HTMLElement>("#selected-campaign")!;
const success = document.querySelector<HTMLElement>("#success")!;
const successCampaign = document.querySelector<HTMLElement>("#success-campaign")!;
const successHash = document.querySelector<HTMLElement>("#success-hash")!;
const errorEl = document.querySelector<HTMLElement>("#error")!;
const registerError = document.querySelector<HTMLElement>("#register-error")!;
const steps = document.querySelector<HTMLElement>("#steps")!;
const donateButton = document.querySelector<HTMLButtonElement>("#donate-button")!;
const registerButton = document.querySelector<HTMLButtonElement>("#register-button")!;

const stories: Record<string, { cover: string; disbursed?: boolean; date?: string; note?: string }> = {
  "Bantu Raka kembali bersekolah": { cover: "/covers/anto.jpg" },
  "Bantu Sari pulih setelah operasi": {
    cover: "/covers/dina.jpg",
    disbursed: true,
    date: "27 Juli 2026",
    note: "Semua sudah ditransfer",
  },
};

const stepLabel: Record<string, string> = {
  encrypt: "Mengenkripsi donasi (Paillier)...",
  proof: "Membuat ZK proof (snarkjs)...",
  send: "Mengirim ke blockchain...",
  wait: "Menunggu konfirmasi...",
};

let selectedId = "";
let busy = false;
const openHistory = new Set<string>();
const app = await loadApp();

function rupiah(value: string) {
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

let covers: Record<string, string> = {};

function storyOf(campaign: CampaignView) {
  return stories[campaign.title] ?? { cover: "/covers/anto.jpg" };
}

function isDisbursed(campaign: CampaignView) {
  return !campaign.active || storyOf(campaign).disbursed === true;
}

function cover(campaign: CampaignView) {
  const src = covers[campaign.id] ?? storyOf(campaign).cover;
  return `<img src="${src}" alt="" />`;
}

function settledAmount(campaign: CampaignView) {
  if (!isDisbursed(campaign)) return campaign.total;
  return campaign.total ?? campaign.target;
}

function isFull(campaign: CampaignView) {
  const amount = settledAmount(campaign);
  if (amount === null) return false;
  return BigInt(amount) >= BigInt(campaign.target);
}

function progressPercent(campaign: CampaignView) {
  const amount = settledAmount(campaign);
  const target = Number(campaign.target);
  if (amount === null || target <= 0) return 0;
  return Math.min(100, Math.round((Number(amount) / target) * 100));
}

function fullBar(campaign: CampaignView) {
  if (!isFull(campaign)) return "";
  const story = storyOf(campaign);
  const date = story.date ? `<span class="meter-date">${story.date.replace("Juli", "Jul")}</span>` : "";
  return `<span class="meter-wrap"><span class="meter filled"><span style="width:100%"></span></span>${date}</span>`;
}

function meter(campaign: CampaignView) {
  if (isDisbursed(campaign)) return isFull(campaign) ? `<span class="meter-wrap"><span class="meter filled"><span style="width:100%"></span></span></span>` : "";
  const empty = campaign.total === null;
  const label = empty ? "belum dihitung" : `${rupiah(campaign.total!)} masuk`;
  const count = `${campaign.donationCount} donasi`;
  return `<span class="meter-wrap"><span class="meter${empty ? "" : " filled"}"><span style="width:${progressPercent(campaign)}%"></span></span><span class="meter-label"><span class="${empty ? "muted italic" : ""}">${label}</span><span>${count}</span></span></span>`;
}

function show(panel: "register" | "pick" | "donate" | "success") {
  registerForm.hidden = panel !== "register";
  picker.hidden = panel !== "pick";
  donateForm.hidden = panel !== "donate";
  success.hidden = panel !== "success";
}

function chainError(cause: unknown) {
  const data = typeof cause === "object" && cause && "data" in cause ? String((cause as { data?: unknown }).data) : "";
  const message = cause instanceof Error ? cause.message : "";
  const blob = `${data} ${message}`;
  if (blob.includes("0x3a81d6fc")) return "already";
  if (blob.includes("0xaac1fcc6")) return "Secret tidak boleh kosong.";
  if (blob.includes("0xaba47339")) return "Secret ini belum terdaftar.";
  if (blob.includes("0x09bde339")) return "Bukti ditolak. Secret harus sama dengan yang didaftarkan.";
  if (blob.includes("0xb49a509a")) return "Campaign ini sudah ditutup.";
  if (blob.includes("0xdbe0cd78")) return "Ciphertext donasi kosong.";
  if (blob.includes("0xc0fc8a8a")) return "Hanya pengelola yang dapat membuat campaign.";
  return "Transaksi ditolak. Periksa secret dan jumlah donasi.";
}

function secretField() {
  return document.querySelector<HTMLInputElement>("#secret-donate")!;
}

function formReady() {
  return /^[1-9]\d*$/.test(amountInput.value.trim()) && secretField().value.trim() !== "";
}

function setBusy(on: boolean, label = "Kirim Donasi") {
  busy = on;
  donateButton.disabled = on || !formReady();
  donateButton.innerHTML = on ? `<span class="spin"></span>${label}` : "Kirim Donasi";
}

function markStep(name: string) {
  const order = ["encrypt", "proof", "send", "wait"];
  const index = order.indexOf(name);
  steps.hidden = false;
  for (const item of steps.querySelectorAll<HTMLElement>("li")) {
    const step = item.dataset.step ?? "";
    item.classList.toggle("done", order.indexOf(step) < index);
    item.classList.toggle("current", step === name);
  }
  setBusy(true, stepLabel[name]);
}

function openDonate() {
  amountInput.value = "";
  secretField().value = "";
  amountNote.textContent = "";
  errorEl.hidden = true;
  steps.hidden = true;
  show("donate");
  setBusy(false);
  document.querySelector("#panel")?.scrollIntoView({ block: "nearest" });
}

function choose(campaign: CampaignView) {
  if (isDisbursed(campaign) || busy) return;
  selectedId = campaign.id;
  selected.textContent = campaign.title;
  if (banner.hidden) {
    registerError.hidden = false;
    registerError.textContent = "Daftarkan secret terlebih dahulu.";
    show("register");
    document.querySelector("#panel")?.scrollIntoView({ block: "nearest" });
    return;
  }
  openDonate();
}

function renderCampaigns(list: CampaignView[]) {
  campaignsEl.replaceChildren(
    ...list.map((campaign) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "campaign-row";
      const disbursed = isDisbursed(campaign);
      const story = storyOf(campaign);
      const waiting = !disbursed && campaign.total === null;
      const full = disbursed && isFull(campaign);
      button.innerHTML = `<span class="identity"><span class="thumb">${cover(campaign)}</span><span><h3></h3><p class="muted"></p></span></span><span class="side"></span>${full ? fullBar(campaign) : meter(campaign)}`;
      button.querySelector("h3")!.textContent = campaign.title;
      const totalEl = button.querySelector("p")!;
      if (waiting) {
        totalEl.textContent = "belum dihitung";
        totalEl.className = "muted italic";
      } else if (disbursed && !full && story.date) {
        totalEl.textContent = story.date.replace("Juli", "Jul");
        totalEl.className = "sum";
      } else {
        totalEl.textContent = rupiah(settledAmount(campaign)!);
        totalEl.className = "sum";
      }
      const side = button.querySelector(".side")!;
      if (!disbursed) {
        side.textContent = rupiah(campaign.target);
      } else {
        side.classList.add("disbursed");
        side.innerHTML = `<span>Tersalurkan</span><strong></strong>`;
        side.querySelector("strong")!.textContent = rupiah(settledAmount(campaign)!);
      }
      button.addEventListener("click", () => choose(campaign));
      return button;
    }),
  );
}

function pickCard(campaign: CampaignView) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pick";
  const story = storyOf(campaign);
  const disbursed = isDisbursed(campaign);
  if (disbursed) button.classList.add("closed");
  button.innerHTML = `<div class="cover">${cover(campaign)}</div><h3></h3><div class="pick-row"></div>${meter(campaign)}`;
  button.querySelector("h3")!.textContent = campaign.title;
  const row = button.querySelector(".pick-row")!;
  if (disbursed) {
    button.querySelector(".cover")!.insertAdjacentHTML("beforeend", `<span class="badge">Tersalurkan</span>`);
    row.innerHTML = `<span></span><span class="stack"><span>Tersalurkan</span><span></span></span>`;
    const amount = settledAmount(campaign)!;
    const label = row.querySelector("span")!;
    label.textContent = `${rupiah(amount)} terkumpul`;
    row.querySelector(".stack span:last-child")!.textContent = `Target ${rupiah(campaign.target)}`;
    if (story.date && story.note) {
      const note = document.createElement("p");
      note.className = "pick-note";
      note.textContent = `${story.date} — ${story.note}`;
      button.append(note);
    }
  } else {
    const waiting = campaign.total === null;
    row.innerHTML = `<span></span><span></span>`;
    const [left, right] = row.querySelectorAll("span");
    left.textContent = waiting ? "belum dihitung" : rupiah(campaign.total!);
    left.className = waiting ? "muted italic" : "";
    right.textContent = `Target ${rupiah(campaign.target)}`;
  }
  button.addEventListener("click", () => choose(campaign));
  return button;
}

function renderPicker(list: CampaignView[]) {
  const live = list.filter((campaign) => !isDisbursed(campaign));
  const closed = list.filter((campaign) => isDisbursed(campaign));
  pickerLive.replaceChildren(...live.map(pickCard));
  pickerClosed.replaceChildren(...closed.map(pickCard));
  closedLabel.hidden = closed.length === 0;
}

function renderHistory(
  campaigns: CampaignView[],
  events: { campaignId: string; campaign: string; tx: string; time: number }[],
) {
  const groups = new Map<string, typeof events>();
  for (const campaign of campaigns) groups.set(campaign.id, []);
  for (const event of events) {
    const rows = groups.get(event.campaignId) ?? [];
    rows.push(event);
    groups.set(event.campaignId, rows);
  }
  if (groups.size === 0) {
    historyEl.innerHTML = `<p class="empty">Belum ada donasi.</p>`;
    return;
  }
  historyEl.replaceChildren(
    ...[...groups.entries()].map(([id, rows]) => {
      const group = document.createElement("div");
      group.className = "group";
      const open = openHistory.has(id);
      group.innerHTML = `<button type="button" class="history-head"><span></span><span class="count"></span></button><div class="entries"></div>`;
      const head = group.querySelector("button")!;
      head.dataset.id = id;
      const campaign = campaigns.find((item) => item.id === id);
      head.querySelector("span")!.textContent = `${open ? "▾" : "▸"}  ${rows[0]?.campaign ?? campaign?.title ?? "Campaign"}`;
      head.querySelector(".count")!.textContent = `${campaign?.donationCount ?? rows.length} donasi`;
      const entries = group.querySelector(".entries") as HTMLElement;
      entries.hidden = !open;
      if (rows.length === 0 && campaign && isDisbursed(campaign)) {
        const story = storyOf(campaign);
        entries.innerHTML = `<p class="empty">${story.date ?? ""} — ${story.note ?? "Sudah ditransfer"}</p>`;
      } else if (rows.length === 0) {
        entries.innerHTML = `<p class="empty">belum dihitung</p>`;
      }
      for (const row of rows) {
        const entry = document.createElement("div");
        entry.className = "entry";
        entry.innerHTML = `<span><code></code><br /><span class="when"></span></span><span class="enc">ENC</span>`;
        const code = entry.querySelector("code")!;
        code.textContent = shortHash(row.tx);
        code.title = row.tx;
        entry.querySelector(".when")!.textContent = whenLabel(row.time);
        entries.append(entry);
      }
      head.addEventListener("click", () => {
        if (openHistory.has(id)) openHistory.delete(id);
        else openHistory.add(id);
        void refresh();
      });
      return group;
    }),
  );
}

async function refresh() {
  const [response, coverResponse] = await Promise.all([
    fetch("/api/campaigns"),
    fetch("/covers/index.json", { cache: "no-store" }),
  ]);
  const body = (await response.json()) as { campaigns: CampaignView[]; donationCount: string };
  covers = coverResponse.ok ? ((await coverResponse.json()) as Record<string, string>) : {};
  donationCount.textContent = body.donationCount;
  campaignCount.textContent = String(body.campaigns.length);
  renderCampaigns(body.campaigns);
  renderPicker(body.campaigns);
  const titles = new Map(body.campaigns.map((campaign) => [campaign.id, campaign.title]));
  renderHistory(body.campaigns, await donationHistory(app.ledger, titles));
}

document.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.querySelector<HTMLInputElement>(`#${button.dataset.toggle}`);
    if (!input) return;
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.textContent = visible ? "tampilkan" : "sembunyikan";
  });
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  registerError.hidden = true;
  const secret = document.querySelector<HTMLInputElement>("#secret-register")!.value;
  registerButton.disabled = true;
  registerButton.textContent = "Mendaftarkan...";
  try {
    await registerIdentity(app.ledger, secret);
  } catch (cause) {
    if (chainError(cause) !== "already") {
      registerError.hidden = false;
      registerError.textContent = chainError(cause);
      return;
    }
  } finally {
    registerButton.disabled = false;
    registerButton.textContent = "Daftarkan";
  }
  sessionStorage.setItem("donor-secret", secret);
  banner.hidden = false;
  selectedId = "";
  show("pick");
  document.querySelector("#panel")?.scrollIntoView({ block: "nearest" });
});

function syncDonateForm() {
  const digits = amountInput.value.trim();
  amountNote.textContent = /^[1-9]\d*$/.test(digits) ? `${Number(digits).toLocaleString("id-ID")} (akan dienkripsi)` : "";
  if (!busy) setBusy(false);
}

amountInput.addEventListener("input", syncDonateForm);
secretField().addEventListener("input", syncDonateForm);

document.querySelector("#show-history")!.addEventListener("click", () => {
  for (const button of historyEl.querySelectorAll<HTMLButtonElement>(".history-head")) {
    if (button.dataset.id) openHistory.add(button.dataset.id);
  }
  void refresh().then(() => historyEl.scrollIntoView({ behavior: "smooth", block: "center" }));
});

document.querySelector("#register-back")!.addEventListener("click", () => {
  registerError.hidden = true;
  show("pick");
});

document.querySelector("#back")!.addEventListener("click", () => {
  if (busy) return;
  show("pick");
});

document.querySelector("#again")!.addEventListener("click", () => {
  amountInput.value = "";
  secretField().value = "";
  amountNote.textContent = "";
  steps.hidden = true;
  show("donate");
  setBusy(false);
});

donateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!formReady()) return;
  errorEl.hidden = true;
  const amount = BigInt(amountInput.value);
  const secret = secretField().value;
  try {
    const hash = await donate({
      ledger: app.ledger,
      publicKey: app.publicKey,
      campaignId: selectedId,
      secret,
      amount,
      onStep: markStep,
    });
    successCampaign.textContent = selected.textContent;
    successHash.textContent = shortHash(hash);
    successHash.title = hash;
    amountInput.value = "";
    secretField().value = "";
    amountNote.textContent = "";
    show("success");
    await refresh();
  } catch (cause) {
    errorEl.hidden = false;
    errorEl.textContent = chainError(cause);
  } finally {
    setBusy(false);
  }
});

show("pick");
if (sessionStorage.getItem("donor-secret")) banner.hidden = false;

setBusy(false);
await refresh();
