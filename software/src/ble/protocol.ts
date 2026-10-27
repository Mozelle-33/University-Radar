import contract from "../../../shared/radar-v1.json";
export const SERVICE = contract.serviceUuid;
export const WRITE = contract.writeUuid;
export const NOTIFY = contract.notifyUuid;
export const DICTIONARY_VERSION = contract.dictionaryVersion;
export const MAX_MESSAGE_BYTES = contract.maxMessageBytes;
const PAYLOAD_BYTES = 14;
export function frameMessage(
  id: number,
  value: unknown,
  kind: 1 | 2 = 1,
): DataView[] {
  const payload = new TextEncoder().encode(JSON.stringify(value));
  if (payload.length > MAX_MESSAGE_BYTES)
    throw new Error("协议消息过大，请减少每批记录数量。");
  const count = Math.ceil(payload.length / PAYLOAD_BYTES);
  return Array.from({ length: count }, (_, index) => {
    const slice = payload.slice(
      index * PAYLOAD_BYTES,
      (index + 1) * PAYLOAD_BYTES,
    );
    const data = new DataView(new ArrayBuffer(6 + slice.length));
    data.setUint8(0, 1);
    data.setUint8(1, kind);
    data.setUint16(2, id, true);
    data.setUint8(4, index);
    data.setUint8(5, count);
    slice.forEach((byte, offset) => data.setUint8(6 + offset, byte));
    return data;
  });
}
export class Reassembler {
  private pending = new Map<
    number,
    { count: number; parts: Map<number, Uint8Array>; started: number }
  >();
  reset() {
    this.pending.clear();
  }
  accept(
    frame: DataView,
    now = Date.now(),
  ): { id: number; value: unknown } | null {
    for (const [id, record] of this.pending)
      if (now - record.started > 15000) this.pending.delete(id);
    if (
      frame.byteLength < 7 ||
      frame.byteLength > 20 ||
      frame.getUint8(0) !== 1 ||
      frame.getUint8(1) !== 2
    )
      throw new Error("设备返回了无效的协议帧。");
    const id = frame.getUint16(2, true),
      index = frame.getUint8(4),
      count = frame.getUint8(5);
    if (
      count === 0 ||
      count > Math.ceil(MAX_MESSAGE_BYTES / PAYLOAD_BYTES) ||
      index >= count
    )
      throw new Error("协议分片序号无效。");
    if (index < count - 1 && frame.byteLength !== 20)
      throw new Error("非末尾分片长度无效。");
    let record = this.pending.get(id);
    if (!record) {
      if (this.pending.size >= 8) throw new Error("未完成的协议消息过多。");
      record = { count, parts: new Map(), started: now };
      this.pending.set(id, record);
    }
    if (record.count !== count) {
      this.pending.delete(id);
      throw new Error("协议分片数量不一致。");
    }
    const part = new Uint8Array(
      frame.buffer,
      frame.byteOffset + 6,
      frame.byteLength - 6,
    ).slice();
    const old = record.parts.get(index);
    if (
      old &&
      (old.length !== part.length || old.some((x, i) => x !== part[i]))
    ) {
      this.pending.delete(id);
      throw new Error("重复分片内容不一致。");
    }
    record.parts.set(index, part);
    if (record.parts.size !== count) return null;
    const bytes = new Uint8Array(
      [...record.parts.values()].reduce((sum, a) => sum + a.length, 0),
    );
    this.pending.delete(id);
    if (bytes.length > MAX_MESSAGE_BYTES) throw new Error("设备响应过大。");
    let offset = 0;
    for (let i = 0; i < count; i++) {
      const chunk = record.parts.get(i)!;
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return {
      id,
      value: JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ),
    };
  }
}
