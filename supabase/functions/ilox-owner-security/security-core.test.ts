import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { answerVerifier, chooseThree, constantTimeEqual, normalizeAnswer } from "./security-core.ts";

Deno.test("normalizes Unicode, case, and repeated whitespace", () => {
  assertEquals(normalizeAnswer("  ÁRBOL   Azul  "), "árbol azul");
});

Deno.test("rejects answers that are too short or too long", () => {
  let shortRejected = false;
  try { normalizeAnswer("ab"); } catch { shortRejected = true; }
  assertEquals(shortRejected, true);
  let longRejected = false;
  try { normalizeAnswer("x".repeat(257)); } catch { longRejected = true; }
  assertEquals(longRejected, true);
});

Deno.test("challenge always contains three distinct question ids in range", () => {
  for (let i = 0; i < 1000; i++) {
    const ids = chooseThree();
    assertEquals(ids.length, 3);
    assertEquals(new Set(ids).size, 3);
    assertEquals(ids.every(id => id >= 1 && id <= 10), true);
  }
});

Deno.test("HMAC verifiers are stable and bound to owner and question", async () => {
  const a = await answerVerifier("owner-a", 1, "respuesta segura", "a".repeat(48));
  const same = await answerVerifier("owner-a", 1, "respuesta segura", "a".repeat(48));
  const otherOwner = await answerVerifier("owner-b", 1, "respuesta segura", "a".repeat(48));
  const otherQuestion = await answerVerifier("owner-a", 2, "respuesta segura", "a".repeat(48));
  assertEquals(a, same);
  assertNotEquals(a, otherOwner);
  assertNotEquals(a, otherQuestion);
  assertEquals(a.length, 64);
  assertEquals(constantTimeEqual(a, same), true);
  assertEquals(constantTimeEqual(a, otherOwner), false);
});
