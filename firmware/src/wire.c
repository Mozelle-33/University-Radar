#include "wire.h"
#include <string.h>
void wire_reset(wire_rx_t *rx) { memset(rx, 0, sizeof(*rx)); }
int wire_accept(wire_rx_t *rx, const uint8_t *f, size_t n, uint32_t now) {
  if (rx->count && (uint32_t)(now - rx->started) > 15000u) wire_reset(rx);
  if (!f || n < 7 || n > 20 || f[0] != 1 || f[1] != 1 || !f[5] || f[5] > (WIRE_MAX + WIRE_PAYLOAD - 1) / WIRE_PAYLOAD || f[4] >= f[5]
      || (f[4] < f[5] - 1 && n != 20)) { wire_reset(rx); return -1; }
  uint16_t id = (uint16_t)f[2] | ((uint16_t)f[3] << 8);
  if (!id) { wire_reset(rx); return -1; }
  if (f[4] == 0) { wire_reset(rx); rx->id = id; rx->count = f[5]; rx->started = now; }
  if (!rx->count || rx->id != id || rx->count != f[5] || rx->next != f[4] || rx->length + n - 6 > WIRE_MAX) { wire_reset(rx); return -1; }
  memcpy(rx->json + rx->length, f + 6, n - 6); rx->length += n - 6; rx->next++;
  if (rx->next == rx->count) { rx->json[rx->length] = 0; return 1; }
  return 0;
}
size_t wire_encode_frame(uint16_t id, const char *json, size_t length, uint8_t index, uint8_t out[20]) {
  size_t count = (length + WIRE_PAYLOAD - 1) / WIRE_PAYLOAD;
  if (!length || length > WIRE_MAX || index >= count) return 0;
  size_t offset = index * WIRE_PAYLOAD, bytes = length - offset;
  if (bytes > WIRE_PAYLOAD) bytes = WIRE_PAYLOAD;
  out[0] = 1; out[1] = 2; out[2] = id & 0xff; out[3] = id >> 8; out[4] = index; out[5] = count;
  memcpy(out + 6, json + offset, bytes); return bytes + 6;
}
