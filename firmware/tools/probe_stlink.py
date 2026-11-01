"""Inspect an nRF52832 over ST-LINK SWD; optionally save a local backup.

No command in this tool programs, erases, recovers or unlocks the target.
Backups and raw logs stay below the ignored firmware/build/hardware directory.
"""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def literal_path(path):
    value = path.resolve().as_posix()
    if any(c in value for c in '{}\n\r'):
        raise ValueError('The output path must not contain braces or line breaks.')
    return '{' + value + '}'


def locate(executable=None):
    if executable:
        candidate = Path(executable).resolve()
    elif os.environ.get('OPENOCD'):
        candidate = Path(os.environ['OPENOCD']).resolve()
    elif shutil.which('openocd'):
        candidate = Path(shutil.which('openocd')).resolve()
    else:
        core = Path(os.environ.get('PLATFORMIO_CORE_DIR', Path.home() / '.platformio'))
        candidate = core / 'packages/tool-openocd/bin' / ('openocd.exe' if os.name == 'nt' else 'openocd')
    if not candidate.is_file():
        raise RuntimeError('OpenOCD was not found. Set OPENOCD or pass --openocd. See firmware/README.md.')
    return candidate


def script_directory(executable, override=None):
    candidates = [Path(override)] if override else [
        executable.parent.parent / 'openocd/scripts',
        executable.parent.parent / 'share/openocd/scripts',
        executable.parent.parent / 'scripts',
    ]
    for path in candidates:
        if (path / 'interface/stlink.cfg').is_file():
            return path.resolve()
    raise RuntimeError('OpenOCD scripts were not found; pass --scripts with the scripts directory.')


def command(args, executable, scripts, operations):
    target = next((name for name in ['target/nordic/nrf52.cfg', 'target/nrf52.cfg'] if (scripts / name).is_file()), None)
    if not target:
        raise RuntimeError('This OpenOCD package has no nRF52 target configuration.')
    interface, transport = ('interface/stlink-hla.cfg', 'hla_swd') if args.hla else ('interface/stlink.cfg', 'swd')
    return [str(executable), '-s', str(scripts), '-f', interface, '-c', 'transport select ' + transport,
            '-f', target, '-c', f'adapter speed {args.speed}',
            '-c', 'gdb port disabled', '-c', 'tcl port disabled', '-c', 'telnet port disabled',
            '-c', operations]


def execute(argv, log_path, timeout=45):
    try:
        result = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                encoding='utf-8', errors='replace', timeout=timeout, check=False)
        output, code = result.stdout, result.returncode
    except subprocess.TimeoutExpired as error:
        output = error.stdout or b''
        if isinstance(output, bytes):
            output = output.decode('utf-8', errors='replace')
        log_path.write_text(output, encoding='utf-8')
        raise RuntimeError(f'OpenOCD timed out. Inspect the local log: {log_path}') from error
    log_path.write_text(output, encoding='utf-8')
    print(output, end='')
    if code:
        if 'AP lock engaged' in output or 'Debug access is denied' in output:
            raise RuntimeError('Target debug access is locked. No erase/recovery was attempted. Keep the existing data until explicitly approved otherwise.')
        raise RuntimeError(f'OpenOCD failed (exit {code}). Inspect the local log: {log_path}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--openocd', help='Path to the OpenOCD executable')
    parser.add_argument('--scripts', help='Path to OpenOCD scripts')
    parser.add_argument('--speed', type=int, default=100, help='SWD clock in kHz; default 100')
    parser.add_argument('--hla', action='store_true', help='Use legacy HLA SWD for an old ST-LINK; no CTRL-AP recovery support')
    parser.add_argument('--check-config', action='store_true', help='Parse the configuration and exit before opening USB or initialising the target')
    parser.add_argument('--backup', action='store_true', help='After checking chip geometry, temporarily halt and save Flash/UICR/FICR, then resume')
    args = parser.parse_args()
    if not 50 <= args.speed <= 4000:
        parser.error('--speed must be between 50 and 4000 kHz')
    if args.backup and args.check_config:
        parser.error('--backup cannot be combined with --check-config')
    executable = locate(args.openocd)
    scripts = script_directory(executable, args.scripts)
    stamp = datetime.now(timezone(timedelta(hours=8))).strftime('%Y%m%d-%H%M%S-%f')
    output = ROOT / 'build/hardware' / stamp
    output.mkdir(parents=True, exist_ok=False)
    if args.check_config:
        execute(command(args, executable, scripts, 'shutdown'), output / 'configuration.log')
        print('Configuration parsed. USB/target connection was not attempted.')
        return
    info_file = output / 'ficr-info.bin'
    operations = f'init; targets; mdw 0x10000100 5; dump_image {literal_path(info_file)} 0x10000100 20; flash probe 0; flash info 0; shutdown'
    execute(command(args, executable, scripts, operations), output / 'probe.log')
    if not info_file.is_file() or info_file.stat().st_size != 20:
        raise RuntimeError('No complete FICR geometry was read; no backup or programming was attempted.')
    part, variant, package, ram, flash = struct.unpack('<5I', info_file.read_bytes())
    report = {'date': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'part': hex(part),
              'variant': variant.to_bytes(4, 'big').decode('ascii', errors='replace'), 'package': hex(package),
              'ram_kib': ram, 'flash_kib': flash, 'transport': 'hla_swd' if args.hla else 'swd',
              'programmed': False, 'erased': False, 'backup_complete': False}
    (output / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    if args.backup:
        if (part, ram, flash) != (0x52832, 64, 512):
            raise RuntimeError('This firmware expects nRF52832 with 64 KiB RAM and 512 KiB Flash. Backup geometry was not assumed.')
        operations = (
            'init; '
            'if {[mrw 0x10000100] != 0x52832 || [mrw 0x1000010c] != 64 || [mrw 0x10000110] != 512} {error "Chip geometry changed"}; '
            'set backup_rc [catch {halt 5000; '
            f'dump_image {literal_path(output / "flash.bin")} 0 0x80000; '
            f'dump_image {literal_path(output / "uicr.bin")} 0x10001000 0x1000; '
            f'dump_image {literal_path(output / "ficr.bin")} 0x10000000 0x1000'
            '} backup_error]; '
            'set resume_rc [catch {resume} resume_error]; '
            'if {$backup_rc} {error $backup_error}; if {$resume_rc} {error $resume_error}; shutdown'
        )
        execute(command(args, executable, scripts, operations), output / 'backup.log', timeout=240)
        report['backup'] = {}
        for name, size in [('flash.bin', 524288), ('uicr.bin', 4096), ('ficr.bin', 4096)]:
            path = output / name
            if not path.is_file() or path.stat().st_size != size:
                raise RuntimeError(f'Backup size check failed: {name}')
            report['backup'][name] = {'bytes': size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        report['backup_complete'] = True
        (output / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print('Backup sizes/checksums recorded. Target was resumed. No Flash/UICR was programmed or erased.')
    print(f'Local records: {output}')


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    try:
        main()
    except (RuntimeError, ValueError, OSError) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        raise SystemExit(1)
