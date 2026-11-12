import test from "node:test";
import assert from "node:assert/strict";

test("antarmuka menyiapkan tempat uji", () => {
  assert.equal(typeof window, "undefined");
});
