"""Compare the running environment against the pins the artifacts were built with."""
from __future__ import annotations

import importlib.metadata as md
import sys
from pathlib import Path

PINS = Path(__file__).with_name("requirements.txt")


def declared_pins() -> dict[str, str]:
    out = {}
    for line in PINS.read_text().splitlines():
        line = line.split("#")[0].strip()
        if "==" in line:
            name, version = line.split("==", 1)
            out[name.strip().lower()] = version.strip()
    return out


def check() -> list[str]:
    problems = []
    for name, want in declared_pins().items():
        try:
            have = md.version(name)
        except md.PackageNotFoundError:
            problems.append(f"{name}: not installed (pinned {want})")
            continue
        if have != want:
            problems.append(f"{name}: installed {have}, pinned {want}")
    return problems


def main() -> int:
    problems = check()
    py = ".".join(str(v) for v in sys.version_info[:3])
    print(f"python {py}")
    if not problems:
        print(f"all {len(declared_pins())} pinned packages match")
        return 0
    print(f"{len(problems)} mismatch(es) against forecast_v2/requirements.txt:")
    for p in problems:
        print(f"  {p}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
