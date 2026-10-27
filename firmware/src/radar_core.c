#include "radar_core.h"
#include <string.h>

bool radar_config_valid(const radar_config_t *c) {
  return c && c->mode <= 1 && c->school >= 1 && c->school <= 3 && c->min_shared >= 1 && c->min_shared <= 3
    && (c->tags & ~RADAR_TAG_MASK) == 0 && c->discovery <= 1 && c->require_school <= 1 && c->revision > 0;
}
bool radar_is_active(const radar_config_t *c, uint32_t now) {
  return radar_config_valid(c) && c->discovery && c->tags && now > 0 && now < c->expires_at;
}
uint8_t radar_popcount(uint16_t value) { uint8_t count = 0; for (; value; value &= (uint16_t)(value - 1)) count++; return count; }
bool radar_matches(const radar_config_t *c, const radar_peer_t *p, uint32_t now) {
  if (!radar_is_active(c, now) || !p || c->mode != p->mode) return false;
  if (c->mode == 1 && (c->require_school || p->require_school) && c->school != p->school) return false;
  uint8_t common = radar_popcount(c->tags & p->tags);
  return common >= c->min_shared && common >= p->min_shared;
}
void radar_encode_adv(const radar_config_t *c, const uint8_t token[8], uint8_t out[RADAR_ADV_LENGTH]) {
  /* 0xffff company ID is reserved for internal development; production must use an assigned ID. */
  out[0] = 0xff; out[1] = 0xff; out[2] = 1; out[3] = RADAR_DICTIONARY_VERSION;
  out[4] = c->mode; out[5] = c->school; out[6] = c->min_shared; out[7] = c->require_school;
  out[8] = (uint8_t)c->tags; out[9] = (uint8_t)(c->tags >> 8); memcpy(out + 10, token, 8);
}
bool radar_decode_adv(const uint8_t *data, size_t length, radar_peer_t *p) {
  if (!data || !p || length != RADAR_ADV_LENGTH || data[0] != 0xff || data[1] != 0xff || data[2] != 1 || data[3] != RADAR_DICTIONARY_VERSION
    || data[4] > 1 || data[5] < 1 || data[5] > 3 || data[6] < 1 || data[6] > 3 || data[7] > 1) return false;
  uint16_t mask = (uint16_t)data[8] | ((uint16_t)data[9] << 8);
  if (!mask || (mask & ~RADAR_TAG_MASK)) return false;
  p->mode = data[4]; p->school = data[5]; p->min_shared = data[6]; p->require_school = data[7]; p->tags = mask;
  memcpy(p->token, data + 10, 8); return true;
}
void radar_store_init(radar_store_t *s) { memset(s, 0, sizeof(*s)); s->format = 1; s->next_sequence = 1; }
bool radar_store_valid(const radar_store_t *s) {
  if (!s || s->format != 1 || s->count > RADAR_RECORD_CAPACITY || s->head >= RADAR_RECORD_CAPACITY || !s->next_sequence) return false;
  for (uint16_t i = 0; i < s->count; ++i) {
    const radar_record_t *r = &s->records[(s->head + RADAR_RECORD_CAPACITY - s->count + i) % RADAR_RECORD_CAPACITY];
    if (!r->sequence || r->sequence >= s->next_sequence || r->mode > 1 || r->school < 1 || r->school > 3 || (r->tags & ~RADAR_TAG_MASK)) return false;
  }
  return true;
}
bool radar_store_add(radar_store_t *s, const radar_peer_t *p, uint32_t now) {
  if (!now || s->next_sequence == UINT32_MAX) return false;
  for (uint16_t i = 0; i < s->count; ++i) {
    const radar_record_t *r = &s->records[i];
    if (!memcmp(r->token, p->token, 8) && (now < r->timestamp || now - r->timestamp < RADAR_COOLDOWN_SECONDS)) return false;
  }
  radar_record_t *r = &s->records[s->head]; memset(r, 0, sizeof(*r));
  r->sequence = s->next_sequence++; r->timestamp = now; memcpy(r->token, p->token, 8); r->tags = p->tags; r->mode = p->mode; r->school = p->school;
  s->head = (s->head + 1) % RADAR_RECORD_CAPACITY; if (s->count < RADAR_RECORD_CAPACITY) s->count++;
  return true;
}
size_t radar_store_page(const radar_store_t *s, uint32_t after, radar_record_t *out, size_t limit, bool *more) {
  size_t count = 0; *more = false;
  for (uint16_t i = 0; i < s->count; ++i) {
    const radar_record_t *r = &s->records[(s->head + RADAR_RECORD_CAPACITY - s->count + i) % RADAR_RECORD_CAPACITY];
    if (r->sequence <= after) continue;
    if (count >= limit) { *more = true; break; }
    out[count++] = *r;
  }
  return count;
}
