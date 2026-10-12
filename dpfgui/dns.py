"""What a domain's own nameservers say, without leaving anything in a DNS cache.

Asking a resolver about a name before its record exists makes it remember "doesn't exist" for
the zone's negative TTL (often 30 minutes or more); asking it about an old record keeps the old
address around for its TTL. So these lookups use `dig +trace`: it starts at the root servers and
follows the referrals down to the zone's authoritative nameservers itself, with recursion off.
Those answer from the zone and keep nothing; the only thing asked of the local resolver is the
list of root servers.
"""

from __future__ import annotations

import re
import shutil
import subprocess


class DnsError(RuntimeError):
    pass


_RR = re.compile(r"^(\S+)\s+(\d+)\s+IN\s+(A|CNAME|SOA|NS)\s+(.+)$")


def _trace(name: str) -> list[tuple[str, int, str, str]]:
    """The records of the last reply in a trace: the authoritative servers' answer."""
    if not shutil.which("dig"):
        raise DnsError("dig isn't installed on this computer (it's in bind-utils / dnsutils)")
    try:
        r = subprocess.run(["dig", "-4", "+trace", "+nodnssec", "+time=3", "+tries=1", name, "A"],
                           capture_output=True, text=True, timeout=40)
    except subprocess.TimeoutExpired:
        raise DnsError(f"dig +trace {name} took too long")
    blocks, cur = [], []
    for line in r.stdout.splitlines():
        if line.startswith(";; Received"):
            blocks.append(cur)
            cur = []
        elif (m := _RR.match(line.strip())):
            cur.append((m[1].rstrip(".").lower(), int(m[2]), m[3], m[4].strip()))
    if len(blocks) < 2:  # not even past the root
        raise DnsError(f"dig +trace {name} failed: {(r.stderr or r.stdout).strip().splitlines()[-1:] or ['no answer']}")
    return blocks[-1]


def lookup(name: str, _depth: int = 0) -> dict:
    """The A records the authoritative nameservers have for `name`, following CNAMEs (into other
    zones too). {name, addresses, ttl, exists, negative_ttl, cname?}"""
    name = name.rstrip(".").lower()
    rrs = _trace(name)
    # The name and what it's an alias of within this reply; other A records would be glue.
    names = {name}
    for n, _, t, v in rrs:
        if t == "CNAME" and n in names:
            names.add(v.rstrip(".").lower())
    addrs = [(v, ttl) for n, ttl, t, v in rrs if t == "A" and n in names]
    if addrs:
        return {"name": name, "addresses": [a for a, _ in addrs], "ttl": min(t for _, t in addrs), "exists": True}
    cname = next((v.rstrip(".").lower() for n, _, t, v in reversed(rrs) if t == "CNAME" and n in names), None)
    if cname and _depth < 8:
        return {**lookup(cname, _depth + 1), "name": name, "cname": cname}
    soa = next((v.split() for _, _, t, v in rrs if t == "SOA"), None)
    if soa:  # no such record; MINIMUM is how long resolvers may cache that
        return {"name": name, "addresses": [], "exists": False, "negative_ttl": int(soa[-1])}
    raise DnsError(f"the nameservers for {name} didn't answer (dig +trace ended at a referral)")


if __name__ == "__main__":  # python -m dpfgui.dns NAME...
    import json
    import sys
    for n in sys.argv[1:]:
        print(json.dumps(lookup(n)))
