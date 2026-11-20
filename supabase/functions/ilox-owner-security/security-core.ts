export function normalizeAnswer(value: unknown): string {
  if (typeof value !== "string") throw new Error("invalid_input");
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase("es-AR").replace(/\\s+/g, " ");
  if (normalized.length < 3 || normalized.length > 256) throw new Error("invalid_input");
  return normalized;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function randomIndex(max: number): number {
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / max) * max;
  const word = new Uint32Array(1);
  do { crypto.getRandomValues(word); } while (word[0] >= limit);
  return word[0] % max;
}

export function chooseThree(): number[] {
  const pool = [1,2,3,4,5,6,7,8,9,10];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

export async function answerVerifier(ownerId: string, questionId: number, answer: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const input = new TextEncoder().encode(`${ownerId}|ilox-owner-v1|${questionId}|${answer}`);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
  return [...signature].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
