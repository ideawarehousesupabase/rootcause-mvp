import { describe, expect, it } from "vitest";
import { CHUNK_BYTES, joinBytes, splitBytes } from "./cvFiles";

describe("CV file pieces", () => {
  it("splits a file into pieces under Firestore's document limit and rejoins it exactly", () => {
    const file = Uint8Array.from({ length: CHUNK_BYTES * 2 + 1234 }, (_, i) => (i * 31) % 256);
    const pieces = splitBytes(file);
    expect(pieces.map((p) => p.length)).toEqual([CHUNK_BYTES, CHUNK_BYTES, 1234]);
    expect(joinBytes(pieces)).toEqual(file);
  });

  it("keeps a 5 MB file in eight pieces and an empty file in one", () => {
    expect(splitBytes(new Uint8Array(5 * 1024 * 1024))).toHaveLength(8);
    expect(splitBytes(new Uint8Array())).toHaveLength(1);
  });
});
