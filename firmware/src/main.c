/* University Radar v0.1: nRF52832-QFAA, Zephyr Bluetooth controller and host.
 * Pins follow the user's 2026-10-09 schematic, not the nRF52 DK connectors.
 * This application is flashed from address 0 via SWD, without SoftDevice/bootloader.
 */
#include <zephyr.h>
#include <device.h>
#include <drivers/gpio.h>
#include <drivers/adc.h>
#include <bluetooth/bluetooth.h>
#include <bluetooth/conn.h>
#include <bluetooth/gatt.h>
#include <bluetooth/hci.h>
#include <settings/settings.h>
#include <sys/byteorder.h>
#include <data/json.h>
#include <sys/atomic.h>
#include <random/rand32.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>
#include <errno.h>
#include <stdarg.h>
#include "radar_core.h"
#include "wire.h"

#define LED_RED 25
#define LED_GREEN 26
#define LED_BLUE 27
#define PAIRING_WINDOW_MS 60000
#define TOKEN_ROTATION_MS (15u * 60u * 1000u)
static struct bt_uuid_128 service_uuid = BT_UUID_INIT_128(RADAR_SERVICE_UUID_BYTES);
static struct bt_uuid_128 write_uuid = BT_UUID_INIT_128(RADAR_WRITE_UUID_BYTES);
static struct bt_uuid_128 notify_uuid = BT_UUID_INIT_128(RADAR_NOTIFY_UUID_BYTES);
static const struct device *gpio;
static const struct device *adc;
static radar_config_t config = { .revision = 1, .school = 1, .min_shared = 1, .require_school = 1 };
static radar_store_t store, next_store;
static wire_rx_t rx;
static uint8_t token[8], adv_payload[RADAR_ADV_LENGTH];
static uint32_t epoch_base;
static int64_t epoch_uptime, token_uptime, green_until;
static bool advertising, scanning, loaded_config, flash_fault, radio_fault;
static atomic_t radio_dirty = ATOMIC_INIT(1);
static atomic_t notify_enabled;
static struct bt_conn *connection;
K_MUTEX_DEFINE(connection_lock);
typedef struct { uint8_t length; uint8_t data[20]; } rx_frame_t;
typedef struct { radar_peer_t peer; int64_t seen; } sighting_t;
K_MSGQ_DEFINE(rx_queue, sizeof(rx_frame_t), 24, 4);
K_MSGQ_DEFINE(peer_queue, sizeof(sighting_t), 8, 4);
static char response[WIRE_MAX + 1];
static size_t response_length;
static radar_record_t page[8];

static uint32_t epoch_now(void) { return epoch_base ? epoch_base + (uint32_t)((k_uptime_get() - epoch_uptime) / 1000) : 0; }
static void led(unsigned int pin, bool on) { if (gpio) gpio_pin_set(gpio, pin, !on); }
static void error_reply(const char *message) { snprintf(response, sizeof(response), "{\"ok\":false,\"error\":\"%s\"}", message); response_length = strlen(response); }
static bool append(const char *format, ...) {
  va_list args; va_start(args, format);
  int count = vsnprintf(response + response_length, sizeof(response) - response_length, format, args); va_end(args);
  if (count < 0 || (size_t)count >= sizeof(response) - response_length) { error_reply("response_too_large"); return false; }
  response_length += count; return true;
}
static int radar_settings_set(const char *key, size_t length, settings_read_cb read, void *arg) {
  if (!strcmp(key, "config") && length == sizeof(config)) {
    radar_config_t candidate;
    if (read(arg, &candidate, sizeof(candidate)) == sizeof(candidate) && radar_config_valid(&candidate)) { config = candidate; loaded_config = true; }
    return 0;
  }
  if (!strcmp(key, "store") && length == sizeof(store)) {
    if (read(arg, &next_store, sizeof(next_store)) == sizeof(next_store) && radar_store_valid(&next_store)) store = next_store;
    return 0;
  }
  return -ENOENT;
}
SETTINGS_STATIC_HANDLER_DEFINE(radar, "radar", NULL, radar_settings_set, NULL, NULL);

static struct bt_conn *get_connection(void) {
  struct bt_conn *result;
  k_mutex_lock(&connection_lock, K_FOREVER); result = connection ? bt_conn_ref(connection) : NULL; k_mutex_unlock(&connection_lock); return result;
}
static void connected(struct bt_conn *conn, uint8_t error) {
  if (error) { atomic_set(&radio_dirty, 1); return; }
  k_mutex_lock(&connection_lock, K_FOREVER);
  if (connection) bt_conn_unref(connection);
  connection = bt_conn_ref(conn); k_mutex_unlock(&connection_lock);
  atomic_set(&notify_enabled, 0);
  atomic_set(&radio_dirty, 1);
  /* Encrypted transport with Just Works bonding. No MITM protection without an I/O channel. */
  bt_conn_set_security(conn, BT_SECURITY_L2);
}
static void disconnected(struct bt_conn *conn, uint8_t reason) {
  ARG_UNUSED(conn); ARG_UNUSED(reason);
  k_mutex_lock(&connection_lock, K_FOREVER);
  if (connection) { bt_conn_unref(connection); connection = NULL; }
  k_mutex_unlock(&connection_lock);
  atomic_set(&notify_enabled, 0); k_msgq_purge(&rx_queue); atomic_set(&radio_dirty, 1);
}
static struct bt_conn_cb connection_callbacks = { .connected = connected, .disconnected = disconnected };
static void ccc_changed(const struct bt_gatt_attr *attr, uint16_t value) { ARG_UNUSED(attr); atomic_set(&notify_enabled, value == BT_GATT_CCC_NOTIFY); }
static ssize_t write_frame(struct bt_conn *conn, const struct bt_gatt_attr *attr, const void *buffer, uint16_t length, uint16_t offset, uint8_t flags) {
  ARG_UNUSED(attr); ARG_UNUSED(flags);
  if (offset || length < 7 || length > 20 || bt_conn_get_security(conn) < BT_SECURITY_L2) return BT_GATT_ERR(BT_ATT_ERR_WRITE_NOT_PERMITTED);
  rx_frame_t frame = { .length = length }; memcpy(frame.data, buffer, length);
  if (k_msgq_put(&rx_queue, &frame, K_NO_WAIT)) return BT_GATT_ERR(BT_ATT_ERR_INSUFFICIENT_RESOURCES);
  return length;
}
BT_GATT_SERVICE_DEFINE(radar_service,
  BT_GATT_PRIMARY_SERVICE(&service_uuid),
  BT_GATT_CHARACTERISTIC(&write_uuid.uuid, BT_GATT_CHRC_WRITE, BT_GATT_PERM_WRITE_ENCRYPT, NULL, write_frame, NULL),
  BT_GATT_CHARACTERISTIC(&notify_uuid.uuid, BT_GATT_CHRC_NOTIFY, BT_GATT_PERM_NONE, NULL, NULL, NULL),
  BT_GATT_CCC(ccc_changed, BT_GATT_PERM_READ_ENCRYPT | BT_GATT_PERM_WRITE_ENCRYPT)
);
static int send_response(uint16_t id) {
  struct bt_conn *conn = get_connection();
  if (!conn || !atomic_get(&notify_enabled)) { if (conn) bt_conn_unref(conn); return -ENOTCONN; }
  size_t count = (response_length + WIRE_PAYLOAD - 1) / WIRE_PAYLOAD;
  int result = 0;
  for (uint8_t index = 0; index < count; index++) {
    uint8_t frame[20]; size_t length = wire_encode_frame(id, response, response_length, index, frame);
    for (unsigned int retry = 0; retry < 60; retry++) {
      result = bt_gatt_notify(conn, &radar_service.attrs[4], frame, length);
      if (result != -ENOMEM && result != -EAGAIN) break;
      k_sleep(K_MSEC(10));
    }
    if (result) break;
  }
  bt_conn_unref(conn); return result;
}
static uint8_t battery_percent(void) {
  static uint8_t last = 0;
  static int64_t sampled_at = -60000;
  if (!adc || k_uptime_get() - sampled_at < 60000) return last;
  int16_t raw;
  struct adc_sequence sequence = { .channels = BIT(0), .buffer = &raw, .buffer_size = sizeof(raw), .resolution = 12 };
  if (!adc_read(adc, &sequence)) {
    int32_t millivolts = raw; adc_raw_to_millivolts(600, ADC_GAIN_1_6, 12, &millivolts);
    millivolts *= 2; /* R8 = R9 = 1 Mohm, AIN2 sees half of VBAT. */
    last = millivolts <= 3300 ? 0 : millivolts >= 4200 ? 100 : (millivolts - 3300) * 100 / 900;
    sampled_at = k_uptime_get();
  }
  return last;
}
/* One-byte signed fields allow -1 as the missing-boolean sentinel; the JSON parser
 * writes the boolean representation (0 or 1) into that byte. */
struct json_config { int8_t discovery; char *mode; int32_t schoolId; int32_t tags[12]; size_t tags_count; int32_t minSharedTags; int8_t requireSameSchool; int32_t intentExpiresAt; int32_t time; };
static const struct json_obj_descr config_description[] = {
  JSON_OBJ_DESCR_PRIM(struct json_config, discovery, JSON_TOK_TRUE),
  JSON_OBJ_DESCR_PRIM(struct json_config, mode, JSON_TOK_STRING),
  JSON_OBJ_DESCR_PRIM(struct json_config, schoolId, JSON_TOK_NUMBER),
  JSON_OBJ_DESCR_ARRAY(struct json_config, tags, 12, tags_count, JSON_TOK_NUMBER),
  JSON_OBJ_DESCR_PRIM(struct json_config, minSharedTags, JSON_TOK_NUMBER),
  JSON_OBJ_DESCR_PRIM(struct json_config, requireSameSchool, JSON_TOK_TRUE),
  JSON_OBJ_DESCR_PRIM(struct json_config, intentExpiresAt, JSON_TOK_NUMBER),
  JSON_OBJ_DESCR_PRIM(struct json_config, time, JSON_TOK_NUMBER),
};
struct json_request { char *cmd; int32_t protocolVersion; int32_t dictionaryVersion; int32_t revision; struct json_config config; char *cursor; int32_t limit; };
static const struct json_obj_descr request_description[] = {
  JSON_OBJ_DESCR_PRIM(struct json_request, cmd, JSON_TOK_STRING),
  JSON_OBJ_DESCR_PRIM(struct json_request, protocolVersion, JSON_TOK_NUMBER),
  JSON_OBJ_DESCR_PRIM(struct json_request, dictionaryVersion, JSON_TOK_NUMBER),
  JSON_OBJ_DESCR_PRIM(struct json_request, revision, JSON_TOK_NUMBER),
  JSON_OBJ_DESCR_OBJECT(struct json_request, config, config_description),
  JSON_OBJ_DESCR_PRIM(struct json_request, cursor, JSON_TOK_STRING),
  JSON_OBJ_DESCR_PRIM(struct json_request, limit, JSON_TOK_NUMBER),
};
static bool config_request(struct json_request *request, radar_config_t *candidate) {
  struct json_config *c = &request->config;
  if (request->protocolVersion != 1 || request->dictionaryVersion != RADAR_DICTIONARY_VERSION || request->revision <= 0 || !c->mode
    || c->discovery < 0 || c->discovery > 1 || c->requireSameSchool < 0 || c->requireSameSchool > 1 || c->tags_count > 12 || c->intentExpiresAt < 0
    || (strcmp(c->mode, "student") && strcmp(c->mode, "alumni")) || c->schoolId < 1 || c->schoolId > 3 || c->minSharedTags < 1 || c->minSharedTags > 3
    || c->time < 1700000000 || c->time > 2100000000 || (c->discovery && (c->intentExpiresAt <= c->time || c->intentExpiresAt - c->time > 8 * 86400))) return false;
  memset(candidate, 0, sizeof(*candidate)); candidate->revision = request->revision;
  candidate->expires_at = c->intentExpiresAt; candidate->mode = !strcmp(c->mode, "alumni");
  candidate->school = c->schoolId; candidate->min_shared = c->minSharedTags; candidate->require_school = c->requireSameSchool; candidate->discovery = c->discovery;
  for (size_t i = 0; i < c->tags_count; i++) {
    if (c->tags[i] < 1 || c->tags[i] > 12) return false;
    uint16_t bit = BIT(c->tags[i] - 1); if (candidate->tags & bit) return false; candidate->tags |= bit;
  }
  return radar_config_valid(candidate) && (!candidate->discovery || candidate->tags);
}
static void records_response(const struct json_request *request) {
  if (!request->cursor || strlen(request->cursor) > 10 || request->limit < 1 || request->limit > 8) { error_reply("invalid_pagination"); return; }
  for (const char *p = request->cursor; *p; p++) if (*p < '0' || *p > '9') { error_reply("invalid_cursor"); return; }
  unsigned long parsed = strtoul(request->cursor, NULL, 10);
  if (parsed >= store.next_sequence && parsed != 0) { error_reply("cursor_out_of_range_reconnect_and_sync_from_start"); return; }
  uint32_t cursor = parsed;
  bool more;
  size_t count = radar_store_page(&store, cursor, page, request->limit, &more);
  response_length = 0; append("{\"ok\":true,\"records\":[");
  for (size_t i = 0; i < count; i++) {
    const radar_record_t *r = &page[i]; char peer_id[17], day[11];
    for (size_t j = 0; j < 8; j++) snprintf(peer_id + 2 * j, 3, "%02X", r->token[j]);
    time_t local = (time_t)r->timestamp + 8 * 3600; struct tm tm; gmtime_r(&local, &tm); strftime(day, sizeof(day), "%Y-%m-%d", &tm);
    const char *period = tm.tm_hour < 12 ? "上午" : tm.tm_hour < 18 ? "下午" : "晚间";
    if (!append("%s{\"id\":\"%lu\",\"peerId\":\"%s\",\"mode\":\"%s\",\"schoolId\":%u,\"tags\":[", i ? "," : "", (unsigned long)r->sequence, peer_id, r->mode ? "alumni" : "student", r->school)) return;
    bool first = true;
    for (uint8_t id = 1; id <= 12; id++) if (r->tags & BIT(id - 1)) { if (!append("%s%u", first ? "" : ",", id)) return; first = false; }
    if (!append("],\"day\":\"%s\",\"period\":\"%s\",\"context\":\"离线相遇\"}", day, period)) return;
    cursor = r->sequence;
  }
  append("],\"nextCursor\":\"%lu\",\"hasMore\":%s}", (unsigned long)cursor, more ? "true" : "false");
}
static void handle_request(void) {
  struct json_request request = { .config = { .discovery = -1, .requireSameSchool = -1, .tags_count = 13, .intentExpiresAt = -1 } };
  int64_t found = json_obj_parse(rx.json, rx.length, request_description, ARRAY_SIZE(request_description), &request);
  if (found < 0 || !(found & BIT(0)) || !request.cmd) { error_reply("invalid_json"); return; }
  if (!strcmp(request.cmd, "status")) {
    if (request.protocolVersion != 1) { error_reply("protocol_mismatch"); return; }
    response_length = 0; append("{\"ok\":true,\"protocolVersion\":1,\"dictionaryVersion\":1,\"firmware\":\"0.1.0-zephyr\",\"battery\":%u,\"appliedRevision\":%lu,\"clockReady\":%s,\"flashFault\":%s,\"radioFault\":%s}", battery_percent(), (unsigned long)config.revision, epoch_now() ? "true" : "false", flash_fault ? "true" : "false", radio_fault ? "true" : "false");
  } else if (!strcmp(request.cmd, "configure")) {
    radar_config_t candidate;
    if ((found & 0x1f) != 0x1f || !config_request(&request, &candidate)) { error_reply("invalid_configuration"); return; }
    if (settings_save_one("radar/config", &candidate, sizeof(candidate))) { flash_fault = true; error_reply("flash_write_failed"); return; }
    config = candidate; loaded_config = true; epoch_base = request.config.time; epoch_uptime = k_uptime_get();
    atomic_set(&radio_dirty, 1); response_length = 0; append("{\"ok\":true,\"appliedRevision\":%lu}", (unsigned long)config.revision);
  } else if (!strcmp(request.cmd, "encounters")) records_response(&request);
  else error_reply("unknown_command");
}

static bool parse_ad(struct bt_data *data, void *user) {
  if (data->type != BT_DATA_MANUFACTURER_DATA) return true;
  radar_peer_t *peer = user;
  return !radar_decode_adv(data->data, data->data_len, peer);
}
static void scan_received(const bt_addr_le_t *addr, int8_t rssi, uint8_t type, struct net_buf_simple *data) {
  ARG_UNUSED(addr); ARG_UNUSED(type);
  if (rssi < RADAR_MIN_RSSI) return;
  sighting_t sighting = { 0 }; bt_data_parse(data, parse_ad, &sighting.peer);
  if (!sighting.peer.tags || !memcmp(sighting.peer.token, token, sizeof(token))) return;
  sighting.seen = k_uptime_get(); k_msgq_put(&peer_queue, &sighting, K_NO_WAIT);
}
static void add_bond_to_filter(const struct bt_bond_info *info, void *user) {
  bool *has_bond = user;
  if (!bt_le_filter_accept_list_add(&info->addr)) *has_bond = true;
}
static void update_radio(void) {
  radio_fault = false;
  bool active = radar_is_active(&config, epoch_now());
  if (scanning && !active) { bt_le_scan_stop(); scanning = false; }
  if (active && !scanning) {
    struct bt_le_scan_param scan = { .type = BT_LE_SCAN_TYPE_PASSIVE, .options = BT_LE_SCAN_OPT_NONE, .interval = 320, .window = 48 };
    if (!bt_le_scan_start(&scan, scan_received)) scanning = true;
    else radio_fault = true;
  }
  /* Keep a non-connectable matching advertisement while the one GATT link is in use. */
  struct bt_conn *conn = get_connection(); bool connected_now = conn != NULL;
  if (conn) bt_conn_unref(conn);
  if (advertising) { bt_le_adv_stop(); advertising = false; }
  radar_encode_adv(&config, token, adv_payload);
  struct bt_data advertising_data[2] = { BT_DATA_BYTES(BT_DATA_FLAGS, BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR), BT_DATA(BT_DATA_MANUFACTURER_DATA, adv_payload, sizeof(adv_payload)) };
  const struct bt_data scan_response[] = { BT_DATA(BT_DATA_UUID128_ALL, service_uuid.val, 16), BT_DATA(BT_DATA_NAME_COMPLETE, "UR-Radar", 8) };
  bool bonded = false; bt_le_filter_accept_list_clear(); bt_foreach_bond(BT_ID_DEFAULT, add_bond_to_filter, &bonded);
  bool window = k_uptime_get() < PAIRING_WINDOW_MS;
  uint32_t options = BT_LE_ADV_OPT_SCANNABLE;
  if (!connected_now && (window || bonded)) options |= BT_LE_ADV_OPT_CONNECTABLE;
  if (!connected_now && !window && bonded) options |= BT_LE_ADV_OPT_FILTER_CONN;
  struct bt_le_adv_param params = { .id = BT_ID_DEFAULT, .sid = 0, .secondary_max_skip = 0, .options = options, .interval_min = 400, .interval_max = 480, .peer = NULL };
  int result = bt_le_adv_start(&params, advertising_data, active ? 2 : 1, scan_response, ARRAY_SIZE(scan_response));
  if (!result) advertising = true;
  else radio_fault = true;
}
typedef struct { uint8_t token[8]; int64_t first; int64_t last; bool used; } dwell_t;
static dwell_t dwell[8];
static void process_sighting(const sighting_t *s) {
  if (!radar_matches(&config, &s->peer, epoch_now())) return;
  size_t slot = 0; int64_t oldest = INT64_MAX;
  for (size_t i = 0; i < ARRAY_SIZE(dwell); i++) {
    if (dwell[i].used && !memcmp(dwell[i].token, s->peer.token, 8)) { slot = i; oldest = -1; break; }
    if (!dwell[i].used || dwell[i].last < oldest) { slot = i; oldest = dwell[i].used ? dwell[i].last : 0; }
  }
  dwell_t *entry = &dwell[slot];
  if (oldest != -1 || s->seen - entry->last > 5000) { memcpy(entry->token, s->peer.token, 8); entry->used = true; entry->first = s->seen; }
  entry->last = s->seen;
  if (s->seen - entry->first < 2000) return;
  next_store = store;
  if (!radar_store_add(&next_store, &s->peer, epoch_now())) return;
  if (settings_save_one("radar/store", &next_store, sizeof(next_store))) { flash_fault = true; return; }
  store = next_store; green_until = k_uptime_get() + 300;
}
void main(void) {
  gpio = device_get_binding(DT_LABEL(DT_NODELABEL(gpio0)));
  if (gpio) { gpio_pin_configure(gpio, LED_RED, GPIO_OUTPUT_HIGH); gpio_pin_configure(gpio, LED_GREEN, GPIO_OUTPUT_HIGH); gpio_pin_configure(gpio, LED_BLUE, GPIO_OUTPUT_HIGH); }
  adc = device_get_binding(DT_LABEL(DT_NODELABEL(adc)));
  if (adc) {
    struct adc_channel_cfg channel = { .gain = ADC_GAIN_1_6, .reference = ADC_REF_INTERNAL, .acquisition_time = ADC_ACQ_TIME(ADC_ACQ_TIME_MICROSECONDS, 40), .channel_id = 0,
#ifdef CONFIG_ADC_CONFIGURABLE_INPUTS
      .input_positive = 3, /* NRF_SAADC_INPUT_AIN2 = 3, P0.04 */
#endif
    };
    if (adc_channel_setup(adc, &channel)) adc = NULL;
  }
  radar_store_init(&store); wire_reset(&rx);
  bt_conn_cb_register(&connection_callbacks);
  if (bt_enable(NULL)) { led(LED_RED, true); return; }
  if (settings_subsys_init() || settings_load()) flash_fault = true;
  if (!loaded_config) config.discovery = 0;
  /* Power loss destroys the epoch. Require time sync before resuming expiring intents. */
  sys_rand_get(token, sizeof(token)); token_uptime = k_uptime_get();
  update_radio();
  bool was_active = false, window_closed = false;
  for (;;) {
    rx_frame_t frame;
    if (!k_msgq_get(&rx_queue, &frame, K_MSEC(20))) {
      int result = wire_accept(&rx, frame.data, frame.length, k_uptime_get_32());
      if (result == 1) { uint16_t id = rx.id; handle_request(); send_response(id); wire_reset(&rx); }
    }
    sighting_t sighting;
    while (!k_msgq_get(&peer_queue, &sighting, K_NO_WAIT)) process_sighting(&sighting);
    bool active = radar_is_active(&config, epoch_now());
    if (was_active != active) { was_active = active; atomic_set(&radio_dirty, 1); }
    if (!window_closed && k_uptime_get() >= PAIRING_WINDOW_MS) { window_closed = true; atomic_set(&radio_dirty, 1); }
    if (k_uptime_get() - token_uptime >= TOKEN_ROTATION_MS) { sys_rand_get(token, sizeof(token)); token_uptime = k_uptime_get(); atomic_set(&radio_dirty, 1); }
    if (atomic_cas(&radio_dirty, 1, 0)) update_radio();
    led(LED_GREEN, k_uptime_get() < green_until);
    led(LED_BLUE, !window_closed && (k_uptime_get() % 4000 < 25));
    led(LED_RED, (flash_fault || radio_fault) && (k_uptime_get() % 4000 < 25));
  }
}
