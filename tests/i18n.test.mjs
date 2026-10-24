import test from "node:test";
import assert from "node:assert/strict";
import en from "../dist/js/locales/en.js";
import ar from "../dist/js/locales/ar.js";

const placeholders = (s) => (typeof s === "string" ? [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort() : []);

test("Arabic covers every English key with the same kind of value", () => {
  assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) assert.equal(typeof ar[key], typeof en[key], key);
});

test("placeholders match between languages", () => {
  for (const key of Object.keys(en)) assert.deepEqual(placeholders(ar[key]), placeholders(en[key]), key);
});

test("Arabic plurals cover one, two, few and many", () => {
  const days = (n) => ar["onboard.days"]({ n, shown: String(n) });
  assert.equal(days(1), "يوم واحد");
  assert.equal(days(2), "يومان");
  assert.equal(days(5), "5 أيام");
  assert.equal(days(14), "14 يوماً");
});
