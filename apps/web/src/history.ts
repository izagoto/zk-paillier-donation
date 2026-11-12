export type HistoryEvent = {
  campaign: string;
  tx: string;
};

export function historyText(events: HistoryEvent[]) {
  return events
    .map((event) => `${event.campaign}\n${event.tx}\nENC`)
    .join("\n");
}

export function shortHash(tx: string) {
  return `${tx.slice(0, 8)}...${tx.slice(-6)}`;
}

export function whenLabel(unixSeconds: number, now = Date.now() / 1000) {
  const delta = now - unixSeconds;
  if (delta < 90) return "baru saja";
  if (delta < 3600) return `${Math.max(1, Math.floor(delta / 60))} menit lalu`;
  if (delta < 86400) return `${Math.floor(delta / 3600)} jam lalu`;
  return new Date(unixSeconds * 1000).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
