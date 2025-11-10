---

title: "HTB FlagCasino — Full Writeup"
date: 2025-11-10
categories:
  - HackTheBox
tags:
  - reverse-engineering
---

# HTB FlagCasino — Full Writeup

Small, focused writeup for an easy reverse challenge where the binary validates 29 single-byte seeds by seeding `rand()` with each input and comparing the first `rand()` result to a table.

## Summary 

Binary reads 29 characters; for each it calls `srand(char)` then `rand()` and compares that 32-bit result to a known `check[]` value. Recovering which byte seeds produce those `rand()` outputs yields the 29-byte flag.

## Steps

1. Open the binary in your disassembler. Notice the loop in `main`:

   * `scanf(" %c", &v4)`
   * `srand(v4)`
   * `if (rand() != check[i]) exit(...)`
2. Realize `check[i]` is just the first `rand()` output after `srand(seed)`. So brute-force the 1-byte seed space and match `rand()` to each `check[i]`.
3. Use the system `libc` implementation of `srand`/`rand` (so results match the binary). Try all `char` values (`-128..127` or `0..255` bytes) and record the matching byte for each index.
4. Assemble bytes into ASCII to get the flag.

## Python solver (self-contained)

Save as `solve.py` and run with `python3 solve.py`. It uses `ctypes` to call the system `libc` `srand`/`rand` so behavior matches the target binary.

```python
#!/usr/bin/env python3
# solve.py — recover 29-byte flag by matching libc rand() outputs

import ctypes
import sys

check = [
  608905406,183990277,286129175,128959393,1795081523,1322670498,868603056,
  677741240,1127757600,89789692,421093279,1127757600,1662292864,1633333913,
  1795081523,1819267000,1127757600,255697463,1795081523,1633333913,677741240,
  89789692,988039572,114810857,1322670498,214780621,1473834340,1633333913,
  585743402
]

# load libc (tries common names, falls back to default handle)
libc = None
for name in ("libc.so.6", "libc.so", None):
    try:
        libc = ctypes.CDLL(name) if name is not None else ctypes.CDLL(None)
        break
    except Exception:
        libc = None
if libc is None:
    print("Failed to load libc. Abort.", file=sys.stderr)
    sys.exit(1)

libc.srand.argtypes = (ctypes.c_uint,)
libc.srand.restype = None
libc.rand.argtypes = ()
libc.rand.restype = ctypes.c_int

found = []
for idx, target in enumerate(check):
    matched = False
    # try all possible signed char values (-128..127) which correspond to input bytes
    for s in range(-128, 128):
        seed_u = ctypes.c_uint(ctypes.c_int8(s).value).value
        libc.srand(seed_u)
        r = ctypes.c_uint(libc.rand()).value
        if r == target:
            found.append(seed_u & 0xff)
            matched = True
            break
    if not matched:
        print(f"no seed found for index {idx} (target {target})", file=sys.stderr)
        sys.exit(2)

flag_bytes = bytes(found)
try:
    flag = flag_bytes.decode('ascii')
except UnicodeDecodeError:
    flag = "hex:" + flag_bytes.hex()

print("Flag:", flag)
```

## Result

**Flag:** `HTB{r4nd_1s_v3ry_pr3d1ct4bl3}`

## Notes

* This is a low-effort reverse: the trick is recognizing `srand`+`rand` per-byte.
* Using the system `libc` via `ctypes` (or compiling and running the provided C brute-force) guarantees the same PRNG sequence as the binary.
