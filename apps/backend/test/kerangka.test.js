import test from "node:test";
import assert from "node:assert/strict";

test("backend tidak memakai basis data", () => {
  assert.equal(process.env.DATABASE_URL, undefined);
});
