#ifndef RADAR_CORE_H
#define RADAR_CORE_H
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include "radar_dictionary.h"
#define RADAR_RECORD_CAPACITY 64
#define RADAR_ADV_LENGTH 18
#define RADAR_COOLDOWN_SECONDS 600
#define RADAR_MIN_RSSI (-80)
typedef struct {
  uint32_t revision;
  uint32_t expires_at;
  uint16_t tags;
  uint8_t mode;
  uint8_t school;
  uint8_t min_shared;
  uint8_t require_school;
  uint8_t discovery;
  uint8_t reserved;
} radar_config_t;
typedef struct {
  uint8_t token[8];
  uint16_t tags;
  uint8_t mode;
  uint8_t school;
  uint8_t min_shared;
  uint8_t require_school;
} radar_peer_t;
typedef struct {
  uint32_t sequence;
  uint32_t timestamp;
  uint8_t token[8];
  uint16_t tags;
  uint8_t mode;
  uint8_t school;
} radar_record_t;
typedef struct {
  uint32_t format;
  uint32_t next_sequence;
  uint16_t count;
  uint16_t head;
  radar_record_t records[RADAR_RECORD_CAPACITY];
} radar_store_t;
bool radar_config_valid(const radar_config_t *config);
bool radar_is_active(const radar_config_t *config, uint32_t now);
uint8_t radar_popcount(uint16_t value);
bool radar_matches(const radar_config_t *local, const radar_peer_t *peer, uint32_t now);
void radar_encode_adv(const radar_config_t *config, const uint8_t token[8], uint8_t out[RADAR_ADV_LENGTH]);
bool radar_decode_adv(const uint8_t *data, size_t length, radar_peer_t *peer);
void radar_store_init(radar_store_t *store);
bool radar_store_valid(const radar_store_t *store);
bool radar_store_add(radar_store_t *store, const radar_peer_t *peer, uint32_t now);
size_t radar_store_page(const radar_store_t *store, uint32_t after, radar_record_t *out, size_t limit, bool *more);
#endif
