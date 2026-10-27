#include "radar_core.h"
#include "wire.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static radar_store_t store;
int main(void) {
  radar_config_t c = { .revision = 1, .expires_at = 2000000000, .tags = 3, .mode = 0, .school = 1, .min_shared = 1, .require_school = 1, .discovery = 1 };
  radar_peer_t p = { .tags = 3, .mode = 0, .school = 1, .min_shared = 1, .require_school = 1, .token = {1,2,3,4,5,6,7,8} };
  uint32_t now = 1800000000;
  assert(radar_config_valid(&c)); assert(radar_matches(&c, &p, now));
  c.min_shared = 3; assert(!radar_matches(&c, &p, now)); c.min_shared = 1;
  p.min_shared = 3; assert(!radar_matches(&c, &p, now)); p.min_shared = 1;
  p.mode = 1; assert(!radar_matches(&c, &p, now)); c.mode = 1; assert(radar_matches(&c, &p, now));
  p.school = 2; assert(!radar_matches(&c, &p, now)); c.require_school = 0; assert(!radar_matches(&c, &p, now));
  p.require_school = 0; assert(radar_matches(&c, &p, now));
  assert(!radar_is_active(&c, 0)); assert(!radar_is_active(&c, c.expires_at));
  c.discovery = 0; assert(!radar_is_active(&c, now)); c.discovery = 1;
  c.tags = 0xffff; assert(!radar_config_valid(&c)); c.tags = 3;
  puts("PASS: matching, both thresholds, both school gates, stages, consent, expiry");
  uint8_t adv[RADAR_ADV_LENGTH]; radar_encode_adv(&c, p.token, adv); radar_peer_t decoded = {0};
  assert(radar_decode_adv(adv, sizeof(adv), &decoded)); assert(decoded.tags == c.tags); assert(!memcmp(decoded.token, p.token, 8));
  adv[3] = 2; assert(!radar_decode_adv(adv, sizeof(adv), &decoded)); adv[3] = 1;
  adv[9] = 0xff; assert(!radar_decode_adv(adv, sizeof(adv), &decoded));
  assert(!radar_decode_adv(adv, sizeof(adv) - 1, &decoded));
  puts("PASS: advertisement round trip and malformed/version/tag rejection");
  radar_store_init(&store); assert(radar_store_valid(&store));
  assert(radar_store_add(&store, &p, now)); assert(!radar_store_add(&store, &p, now + 599));
  assert(!radar_store_add(&store, &p, now - 1)); assert(radar_store_add(&store, &p, now + 600));
  for (int i = 0; i < 70; i++) { p.token[0] = i; assert(radar_store_add(&store, &p, now + 1200 + i * 600)); }
  assert(store.count == 64); assert(radar_store_valid(&store));
  radar_record_t out[8]; bool more = false; size_t total = 0, n; uint32_t cursor = 0;
  do { n = radar_store_page(&store, cursor, out, 8, &more); total += n; if (n) cursor = out[n-1].sequence; } while(more);
  assert(total == 64); assert(radar_store_page(&store, cursor, out, 8, &more) == 0); assert(!more);
  store.count = 65; assert(!radar_store_valid(&store));
  puts("PASS: dedup, backwards clock, ring overwrite, validation and cursor pagination");
  wire_rx_t rx; wire_reset(&rx);
  const char *json = "{\"cmd\":\"status\",\"protocolVersion\":1}";
  size_t length = strlen(json), frames = (length + 13) / 14;
  for (uint8_t i = 0; i < frames; i++) {
    uint8_t f[20];
    size_t bytes = wire_encode_frame(42, json, length, i, f);
    f[1] = 1;
    assert(bytes <= 20);
    int result = wire_accept(&rx, f, bytes, 1000 + i);
    assert(result == ((size_t)i + 1u == frames));
  }
  assert(rx.id == 42); assert(!strcmp(rx.json, json));
  uint8_t f[20]; size_t bytes = wire_encode_frame(42, json, length, 0, f); f[1] = 1; f[5] = 0; assert(wire_accept(&rx, f, bytes, 2000) == -1);
  bytes = wire_encode_frame(42, json, length, 0, f); f[1] = 1; assert(wire_accept(&rx, f, bytes, 2000) == 0);
  bytes = wire_encode_frame(42, json, length, 1, f); f[1] = 1; assert(wire_accept(&rx, f, bytes, 18000) == -1);
  assert(!wire_encode_frame(42, json, WIRE_MAX + 1, 0, f));
  puts("PASS: 20-byte wire framing, request reconstruction, timeout and bounds");
  puts("All firmware core assertions passed."); return 0;
}
