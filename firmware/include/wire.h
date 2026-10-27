#ifndef RADAR_WIRE_H
#define RADAR_WIRE_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define WIRE_MAX 3072
#define WIRE_PAYLOAD 14
typedef struct { uint16_t id; uint16_t length; uint8_t count; uint8_t next; uint32_t started; char json[WIRE_MAX + 1]; } wire_rx_t;
void wire_reset(wire_rx_t *rx);
/* Returns 1 when complete, 0 when incomplete, -1 for malformed or stale frames. */
int wire_accept(wire_rx_t *rx, const uint8_t *frame, size_t length, uint32_t uptime_ms);
size_t wire_encode_frame(uint16_t id, const char *json, size_t length, uint8_t index, uint8_t out[20]);
#endif
