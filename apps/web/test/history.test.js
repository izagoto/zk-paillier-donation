import test from "node:test";
import assert from "node:assert/strict";
import { historyText, shortHash, whenLabel } from "../src/history.ts";

test("riwayat menampilkan ENC tanpa nominal", () => {
  const text = historyText([
    { campaign: "Bantu Raka kembali bersekolah", tx: "0xabc" },
    { campaign: "Bantu Raka kembali bersekolah", tx: "0xdef" },
  ]);
  assert.equal(text.match(/ENC/g).length, 2);
  assert.equal(text.includes("50000"), false);
  assert.equal(text.includes("20000"), false);
});

test("hash riwayat dipendekkan dan waktu baru ditampilkan", () => {
  assert.equal(shortHash("0xe7fd4d638f71a6446f162ee9b6ae919f2c51453e86858d9bf188596a30bf71e3"), "0xe7fd4d...bf71e3");
  assert.equal(whenLabel(1_000, 1_030), "baru saja");
  assert.equal(shortHash("0xe7fd4d638f71a6446f162ee9b6ae919f2c51453e86858d9bf188596a30bf71e3").includes("50000"), false);
});
