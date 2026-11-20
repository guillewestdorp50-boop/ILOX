import { answerVerifier, chooseThree, constantTimeEqual, normalizeAnswer } from "./security-core.ts";

function equal(actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}

Deno.test("normalizes Unicode, case, and repeated whitespace", () => {
  equal(normalizeAnswer("  ÁRBOL   Azul  "), "árbol azul");
});

Deno.test("rejects answers that are too short or too long", () => {
  let shortRejected = false;
  try { normalizeAnswer("ab"); } catch { shortRejected = true; }
  equal(shortRejected, true);
  let longRejected = false;
  try { normalizeAnswer("x".repeat(257)); } catch { longRejected = true; }
  equal(longRejected, true);
});

Deno.test("rejects non-string answer values", () => {
  let rejected = false;
  try { normalizeAnswer(null); } catch { rejected = true; }
  equal(rejected, true);
});

Deno.test("challenge always contains three distinct question ids in range", () => {
  for (let i = 0; i < 1000; i++) {
    const ids = chooseThree();
    equal(ids.length, 3);
    equal(new Set(ids).size, 3);
    equal(ids.every(id => id >= 1 && id <= 10), true);
  }
});

Deno.test("HMAC verifiers are stable and bound to owner and question", async () => {
  const pepper = "a".repeat(48);
  const a = await answerVerifier("owner-a", 1, "respuesta segura", pepper);
  const same = await answerVerifier("owner-a", 1, "respuesta segura", pepper);
  const otherOwner = await answerVerifier("owner-b", 1, "respuesta segura", pepper);
  const otherQuestion = await answerVerifier("owner-a", 2, "respuesta segura", pepper);
  equal(a, same);
  equal(a === otherOwner, false);
  equal(a === otherQuestion, false);
  equal(a.length, 64);
  equal(constantTimeEqual(a, same), true);
  equal(constantTimeEqual(a, otherOwner), false);
});
