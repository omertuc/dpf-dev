# Runs ON THE HYPERVISOR (piped to `python3 -`, as root); standalone, python 3.9 compatible.
#
# Leases the address the lab's DHCP gives a VM's MAC, before the VM exists: DHCPDISCOVER and
# DHCPREQUEST for that MAC on the bridge, the way the VM itself will (client id = the MAC, as
# NetworkManager sends it). The lease keeps the address for that MAC; run again to renew it.
import json
import os
import select
import socket
import struct
import sys
import time

A = json.loads(sys.argv[1])
BRIDGE, MAC = A["bridge"], A["mac"].lower()
mac = bytes.fromhex(MAC.replace(":", ""))


def csum(data):
    if len(data) % 2:
        data += b"\0"
    s = sum(struct.unpack("!%dH" % (len(data) // 2), data))
    s = (s >> 16) + (s & 0xFFFF)
    s += s >> 16
    return ~s & 0xFFFF


def packet(xid, kind, extra=b""):
    opts = bytes([53, 1, kind])                       # 1 = DHCPDISCOVER, 3 = DHCPREQUEST
    opts += bytes([61, 7, 1]) + mac                   # client id: the MAC, as NetworkManager sends it
    opts += extra
    opts += bytes([55, 6, 1, 3, 6, 15, 51, 54])       # mask, router, DNS, domain, lease time, server
    opts += bytes([255])
    bootp = struct.pack("!BBBBIHH4s4s4s4s16s64s128s", 1, 1, 6, 0, xid, 0, 0x8000,  # broadcast flag
                        b"\0" * 4, b"\0" * 4, b"\0" * 4, b"\0" * 4, mac + b"\0" * 10, b"", b"")
    payload = bootp + b"\x63\x82\x53\x63" + opts
    udp = struct.pack("!HHHH", 68, 67, 8 + len(payload), 0) + payload
    ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20 + len(udp), 0, 0, 64, 17, 0, b"\0" * 4, b"\xff" * 4)
    ip = ip[:10] + struct.pack("!H", csum(ip)) + ip[12:]
    own = bytes.fromhex(open("/sys/class/net/%s/address" % BRIDGE).read().strip().replace(":", ""))
    return b"\xff" * 6 + own + b"\x08\x00" + ip + udp


def parse(frame, xid, want):
    if len(frame) < 14 + 20 + 8 + 240 or frame[12:14] != b"\x08\x00":
        return None
    ihl = (frame[14] & 0x0F) * 4
    if frame[14 + 9] != 17:
        return None
    udp = frame[14 + ihl:]
    if struct.unpack("!H", udp[2:4])[0] != 68:
        return None
    b = udp[8:]
    if b[0] != 2 or struct.unpack("!I", b[4:8])[0] != xid or b[28:34] != mac:
        return None
    out = {"ip": socket.inet_ntoa(b[16:20]), "type": None}
    i, opts = 240, {}
    while i < len(b) and b[i] != 255:
        if b[i] == 0:
            i += 1
            continue
        opts[b[i]] = b[i + 2:i + 2 + b[i + 1]]
        i += 2 + b[i + 1]
    out["type"] = opts.get(53, b"\0")[0]
    if out["type"] not in want:
        return None
    out["server_id"] = opts.get(54)
    if 54 in opts:
        out["server"] = socket.inet_ntoa(opts[54])
    if 51 in opts:
        out["lease_seconds"] = struct.unpack("!I", opts[51])[0]
    return out


def exchange(s, xid, frame, want):
    for attempt in range(2):
        s.send(frame)
        end = time.time() + 4
        while time.time() < end:
            r, _, _ = select.select([s], [], [], max(0, end - time.time()))
            if not r:
                break
            got = parse(s.recv(4096), xid, want)
            if got:
                return got
    return None


def main():
    s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0800))
    s.bind((BRIDGE, 0))
    xid = struct.unpack("!I", os.urandom(4))[0]
    offer = exchange(s, xid, packet(xid, 1), (2,))    # DHCPOFFER
    if not offer:
        return {"ip": None, "error": "The DHCP server didn't answer"}
    req = bytes([50, 4]) + socket.inet_aton(offer["ip"])
    if offer["server_id"]:
        req += bytes([54, 4]) + offer["server_id"]
    ack = exchange(s, xid, packet(xid, 3, req), (5, 6))  # DHCPACK / DHCPNAK
    out = {k: v for k, v in (ack or offer).items() if k not in ("type", "server_id")}
    out["leased"] = bool(ack and ack["type"] == 5)
    if ack and ack["type"] == 6:
        out["error"] = "The DHCP server refused the lease (DHCPNAK)"
    elif not ack:
        out["error"] = "The DHCP server offered an address but didn't confirm the lease"
    return out


try:
    print(json.dumps(main()))
except (OSError, ValueError) as e:
    print(json.dumps({"error": str(e)}))
