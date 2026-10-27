"""Check built firmware and native metadata without implying real-device validation."""
import argparse
import hashlib
import json
from pathlib import Path
import plistlib
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def verify():
    image = ROOT / 'firmware/build/nrf52832/zephyr/zephyr.hex'
    binary = image.with_suffix('.bin')
    memory, base, eof, records = {}, 0, False, 0
    for line in image.read_text(encoding='ascii').splitlines():
        assert not eof and line.startswith(':'), 'Invalid record after EOF'
        record = bytes.fromhex(line[1:])
        assert len(record) == record[0] + 5 and sum(record) % 256 == 0, 'HEX checksum'
        address, kind, data = int.from_bytes(record[1:3], 'big'), record[3], record[4:-1]
        if kind == 0:
            for i, value in enumerate(data):
                target = base + address + i
                assert target not in memory or memory[target] == value, 'Conflicting HEX data'
                memory[target] = value
        elif kind == 1:
            assert len(data) == 0
            eof = True
        elif kind in (2, 4):
            assert len(data) == 2
            base = int.from_bytes(data, 'big') << (4 if kind == 2 else 16)
        else:
            assert kind in (3, 5) and len(data) == 4, 'Unknown HEX record'
        records += 1
    assert eof and min(memory) == 0 and max(memory) < 0x7a000, 'Application overlaps NVS'
    stack, reset = struct.unpack('<II', bytes(memory[i] for i in range(8)))
    assert 0x20000000 <= stack <= 0x20010000 and reset & 1
    assert (reset & ~1) in memory, 'Reset vector outside firmware'
    expected = bytes(memory.get(i, 255) for i in range(max(memory) + 1))
    assert binary.read_bytes() == expected, 'BIN differs from HEX'
    config = image.with_name('.config').read_text()
    for setting in ['CONFIG_FLASH_SIZE=512', 'CONFIG_FLASH_LOAD_OFFSET=0x0',
                    'CONFIG_FLASH_LOAD_SIZE=0x7a000', 'CONFIG_NVS=y', 'CONFIG_BT_SETTINGS=y']:
        assert setting in config, f'Missing {setting}'
    ns = '{http://schemas.android.com/apk/res/android}'
    manifest = ET.parse(ROOT/'software/android/app/src/main/AndroidManifest.xml').getroot()
    permissions = {p.attrib[ns+'name']: p.attrib for p in manifest.findall('uses-permission')}
    assert permissions['android.permission.BLUETOOTH_SCAN'][ns+'usesPermissionFlags'] == 'neverForLocation'
    assert permissions['android.permission.ACCESS_FINE_LOCATION'][ns+'maxSdkVersion'] == '30'
    assert manifest.find('application').attrib[ns+'allowBackup'] == 'false'
    ios = ROOT/'software/ios/App/App'
    info = plistlib.loads((ios/'Info.plist').read_bytes())
    assert info.get('NSBluetoothAlwaysUsageDescription'), 'Missing iOS BLE purpose'
    privacy = plistlib.loads((ios/'PrivacyInfo.xcprivacy').read_bytes())
    assert isinstance(privacy, dict)
    return {
        'hex_records': records, 'hex_checksum': 'PASS', 'binary_matches_hex': True,
        'application_start': 0, 'highest_address': max(memory), 'nvs_start': 0x7a000,
        'initial_stack': hex(stack), 'reset_handler': hex(reset),
        'firmware_bytes': len(expected), 'native_metadata': 'PASS',
        'firmware_sha256': hashlib.sha256(image.read_bytes()).hexdigest(),
        'real_device_tests': 'NOT RUN', 'android_apk_build': 'NOT RUN', 'ios_ipa_build': 'NOT RUN',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    result = verify()
    text = json.dumps(result, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text+'\n', encoding='utf-8')
    print(text)
