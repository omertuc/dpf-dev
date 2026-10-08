"""Check env_schema.yaml against an openshift-dpf checkout.

    python -m dpfgui.check_schema ~/repos/openshift-dpf [path/to/schema.yaml]

Reports settings the repo has but the schema doesn't describe (and vice versa),
literal defaults that disagree with ci/env.defaults, and "removed" entries that
are actually still present. Exits 1 if anything is off.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

from .schema import BUNDLED, Schema


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__.strip())
        return 2
    repo = Path(sys.argv[1]).expanduser()
    path = Path(sys.argv[2]) if len(sys.argv) > 2 else BUNDLED
    sch = Schema(yaml.safe_load(path.read_text()), "bundled")

    template = re.findall(r"^([A-Z_][A-Z0-9_]*)=", (repo / "ci/env.template").read_text(), re.M)
    defaults = dict(re.findall(r"^([A-Z_][A-Z0-9_]*)=\$\{\1:-(.*)\}$", (repo / "ci/env.defaults").read_text(), re.M))
    problems = []

    for key in template:
        if key not in sch.params:
            problems.append(f"{key}: in ci/env.template but not described in the schema")
    for key in sch.params:
        if key not in template:
            problems.append(f"{key}: described in the schema but not in ci/env.template")
    for key, raw in defaults.items():
        p = sch.params.get(key)
        if not p or "${" in raw:
            continue
        want = raw.strip('"')
        have = p.get("default")
        have = "" if have is None else ("true" if have is True else "false" if have is False else str(have))
        if have != want:
            problems.append(f"{key}: default is {want!r} in ci/env.defaults but {have!r} in the schema")
    for key in sch.removed:
        if key in template:
            problems.append(f"{key}: listed as removed but still in ci/env.template")
    for key in sch.not_templated:
        if key in template:
            problems.append(f"{key}: listed as not_templated but it is in ci/env.template now")
    for key, p in sch.params.items():
        if not p.get("description") and not p.get("deprecated"):
            problems.append(f"{key}: has no description")

    for line in problems:
        print(line)
    print(f"{'OK' if not problems else 'FAIL'}: {len(template)} settings in the repo, {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
