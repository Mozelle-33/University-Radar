import { describe, expect, it } from "vitest";
import { frameMessage, MAX_MESSAGE_BYTES, Reassembler } from "./protocol";

describe("BLE 20-byte framing", () => {
  it("round trips multibyte UTF-8, out of order, including duplicate fragments", () => {
    const value = { ok: true, text: "校园同频与研究合作".repeat(15) };
    const frames = frameMessage(52, value, 2);
    expect(frames.every((x) => x.byteLength <= 20)).toBe(true);
    const assembler = new Reassembler();
    expect(assembler.accept(frames[0])).toBeNull();
    let result = null;
    for (const frame of [...frames].reverse())
      result = assembler.accept(frame) ?? result;
    expect(result).toEqual({ id: 52, value });
  });
  it("handles DataView offset correctly", () => {
    const frame = frameMessage(3, { ok: true }, 2)[0];
    const buffer = new Uint8Array(frame.byteLength + 5);
    buffer.set(new Uint8Array(frame.buffer), 5);
    expect(new Reassembler().accept(new DataView(buffer.buffer, 5))).toEqual({
      id: 3,
      value: { ok: true },
    });
  });
  it("bounds message size and rejects invalid frame metadata", () => {
    expect(() => frameMessage(1, "x".repeat(MAX_MESSAGE_BYTES))).toThrow();
    const frame = frameMessage(1, { ok: true }, 2)[0];
    frame.setUint8(5, 0);
    expect(() => new Reassembler().accept(frame)).toThrow();
  });
  it("discards abandoned fragments", () => {
    const frames = frameMessage(1, "long message for expiration testing", 2);
    const assembler = new Reassembler();
    assembler.accept(frames[0], 1000);
    for (const frame of frames.slice(1))
      expect(assembler.accept(frame, 17000)).toBeNull();
    expect(assembler.accept(frames[0], 17001)?.value).toBe(
      "long message for expiration testing",
    );
  });
});
