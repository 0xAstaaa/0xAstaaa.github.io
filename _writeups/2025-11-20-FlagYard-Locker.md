---
title: "Locker — Writeup"
date: 2025-11-20
categories:
  - FlagYard
tags:
  - reverse-engineering
  - xor
  - permutation
  - glibc
  - dogbolt
---

# Locker —  writeup

This writeup explains the Locker challenge in plain language so anyone can understand what happened and why the file decrypts. I start with the basic idea you must know (XOR), then walk through how the program scrambled bytes, why the scramble is reversible, and finally give a simple script you can run to recover the original file.

If you like hands-on, there are small examples and a compact Python script at the end. Everything is explained step by step.

---

## TL;DR (short summary)

- The program shuffles indices using a fixed random seed (srand(0x1337) → deterministic).
- For each output byte, it XORs together 123 bytes from the input by "walking" the shuffled indices.
- XOR has a useful property: identical values cancel (A ⊕ A = 0). That lets us cancel overlapping parts of two nearby outputs.
- By splitting the permutation into cycles and using that canceling trick, we can solve for the original bytes.
- I reproduce the shuffle using the system libc (so rand() matches), solve every cycle, and write the decrypted PNG.

Final recovered flag (from the decrypted PNG)

---

## Part 1 — What does ⊕ (XOR) mean? (very plain English)

The symbol ⊕ means XOR, short for exclusive OR.

- For single bits:
  - 0 ⊕ 0 = 0
  - 0 ⊕ 1 = 1
  - 1 ⊕ 0 = 1
  - 1 ⊕ 1 = 0

Think of XOR as a toggle:
- XOR with 0 → does nothing (keeps the bit).
- XOR with 1 → flips the bit.

Important properties (why we use XOR in reversals):
- a ⊕ a = 0 (XORing a value with itself cancels it).
- a ⊕ 0 = a (XOR with zero keeps the value).
- XOR is associative and commutative (order doesn't matter).
- These properties let you cancel repeated terms and rearrange XOR sums easily.

Examples:
- Byte example: 0x55 ⊕ 0xFF = 0xAA
- ASCII example: 'A' (0x41) ⊕ 0x20 = 'a' (0x61) — toggles uppercase to lowercase.

Tiny Python demo:
```python
a = 0x55
b = 0xFF
print(hex(a ^ b))  # 0xaa

print(chr(ord('A') ^ 0x20))  # prints 'a'
```

---

## Part 2 — What the Locker binary does (plain steps)

1. It creates an array P of indices [0, 1, 2, ..., N-1].
2. It calls srand(0x1337) — a fixed seed. That means the following rand() calls are the same every run (on the same libc).
3. It shuffles P using a Fisher–Yates style method, where each swap uses rand().
4. For each output position, it:
   - Starts at some index `idx`.
   - Repeats 123 times:
     - XORs the input byte at position P[idx] into an accumulator.
     - Sets idx = P[idx] (so it follows the permutation like a linked list).
   - Stores accumulator as the output byte for that position.

Because the seed is fixed, the shuffle is reproducible — we can rebuild P exactly and then reverse the transformation.

---

## Part 3 — Why the transform is reversible (intuition)

Rewrite the behavior on a single permutation cycle:

- Look at one cycle of the permutation. Put the input bytes in cycle order: X[0], X[1], ..., X[L-1] (L is cycle length).
- The program produces outputs Y[i] which equal the XOR of the 123 bytes after position i:

  Y[i] = X[i+1] ⊕ X[i+2] ⊕ ... ⊕ X[i+123]   (indices wrap around modulo L)

- Now look at Y[i] and Y[i−1]:
  - Y[i−1] = X[i] ⊕ X[i+1] ⊕ ... ⊕ X[i+122]

- XOR Y[i] with Y[i−1]:
  - Y[i] ⊕ Y[i−1] = (X[i+1] ⊕ ... ⊕ X[i+123]) ⊕ (X[i] ⊕ ... ⊕ X[i+122])
  - Every term from X[i+1] to X[i+122] appears twice → they cancel (because A ⊕ A = 0).
  - Leftover terms: X[i+123] ⊕ X[i]

So:
  X[i+123] = X[i] ⊕ (Y[i] ⊕ Y[i−1])

This is a recurrence: it links values separated by 123 positions in the cycle. Jumping repeatedly by 123 splits a cycle into gcd(123, L) independent chains. Each chain can be propagated, but each chain has one unknown constant to solve for. Those constants are found by substituting back into the original Y equations and solving a small linear system (over bytes, using XOR arithmetic). Because the system is small (size = gcd(123, L)), it's computationally easy.

Short analogy: imagine a long loop of beads. Each bead's color is defined relative to beads 1..123 ahead. Comparing two neighboring sums cancels the middle beads and leaves only the bead that entered and the bead that left the window. That gives a simple link you can walk along.

---

## Part 4 — A tiny worked example (small numbers so it's easy)

To see the idea with small numbers, pretend the code XORs 3 bytes (not 123) and we have a tiny cycle.

Let cycle length L = 5, window = 3 (for example only).

Then:
Y[i] = X[i+1] ⊕ X[i+2] ⊕ X[i+3]

Y[i] ⊕ Y[i−1] = (X[i+1] ⊕ X[i+2] ⊕ X[i+3]) ⊕ (X[i] ⊕ X[i+1] ⊕ X[i+2]) = X[i+3] ⊕ X[i]

So X[i+3] = X[i] ⊕ (Y[i] ⊕ Y[i−1]) — same pattern with smaller numbers. If you jump by 3 around the cycle you get chains and can solve.

---

## Part 5 — Practical steps to decrypt (what I did)

1. Reproduce the permutation P using the same rand() sequence:
   - Call srand(0x1337) and the same rand() calls in the same order the binary does.
   - I used ctypes to call libc.srand and libc.rand on Linux.
2. Find cycles in P.
3. For each cycle:
   - Build Y (the known encrypted bytes from the file) placed in cycle order.
   - Compute Z[k] = Y[k] ⊕ Y[k−1].
   - Propagate X values along each chain defined by stepping +123, using Z to compute relative values.
   - Build and solve a tiny XOR linear system (size = gcd(123, L)) to get constants for each chain.
   - Reconstruct plaintext bytes and place them back into the output buffer.
4. Save output as `flag.png`.

---

## Part 6 — Simple Python solver (run on Linux)

This version is straightforward and commented so you can follow each step. It uses ctypes to call the system libc rand/srand so the shuffle matches the binary's shuffle on glibc.

```python
import ctypes
import math
import os
import sys

# Load libc to reproduce the exact random sequence used by the binary
try:
    libc = ctypes.CDLL("libc.so.6")
except OSError:
    print("Error: Could not load libc.so.6. Please run this on Linux.")
    sys.exit(1)

def get_permutation_table(size):
    """
    Replicates the shuffle logic from sub_4011e0 using libc rand
    """
    print(f"[*] Generating permutation table for size {size}...")
    
    # Replicate srand(0x1337)
    libc.srand(0x1337)
    
    # Initialize table with 0..size-1
    p_table = list(range(size))
    
    # Replicate the Fisher-Yates shuffle loop
    # The decompilation shows loop var_30 from 0 to size-2 (inclusive) (arg3 - 1 limit)
    for i in range(size - 1):
        # int32_t rdx_5 = rand() % (arg3 - (var_30 + 1)) + var_30 + 1;
        rand_val = libc.rand()
        swap_idx = (rand_val % (size - (i + 1))) + i + 1
        
        # Swap
        p_table[i], p_table[swap_idx] = p_table[swap_idx], p_table[i]
        
    return p_table

def solve_cycle(cycle_indices, encrypted_data, decrypted_buffer):
    """
    Solves the XOR summation for a single permutation cycle.
    Equation: Y[i] = XOR_SUM( X[i+1] ... X[i+123] ) (indices relative to cycle)
    """
    L = len(cycle_indices)
    
    # Extract the encrypted bytes corresponding to this cycle
    Y = [encrypted_data[idx] for idx in cycle_indices]
    
    # We derived that: X[(k + 123) % L] = X[k] ^ Y[k] ^ Y[k-1]
    # Let Z[k] = Y[k] ^ Y[k-1]
    # Then X[(k + 123) % L] = X[k] ^ Z[k]
    
    Z = [(Y[k] ^ Y[(k - 1) % L]) for k in range(L)]
    
    # The cycle might be split into multiple independent chains if gcd(123, L) > 1
    num_chains = math.gcd(123, L)
    
    # Temporary buffer for relative values (X_temp)
    X_temp = [0] * L
    
    # 1. Resolve relative values within each chain
    for leader in range(num_chains):
        curr = leader
        # We assume X_temp[leader] = 0. The real value is 0 ^ Constant_for_this_chain.
        # We propagate this assumption through the chain.
        while True:
            next_idx = (curr + 123) % L
            if next_idx == leader:
                break
            
            # X_next = X_curr ^ Z_curr
            X_temp[next_idx] = X_temp[curr] ^ Z[curr]
            curr = next_idx

    # 2. Solve for the unknown Constants (K) for each chain.
    # We set up a small linear system: M * K = B
    # We assume X[i] = X_temp[i] ^ K[chain_id]
    # Original Eq: Y[u] = Sum(X[u+j]) for j in 1..123
    
    matrix = []
    vector = []
    
    # We need 'num_chains' equations. We can just use the first 'num_chains' Y values.
    for u in range(num_chains):
        row = [0] * num_chains
        target_val = Y[u]
        
        # Reconstruct the summation based on our X_temp and Unknowns K
        for j in range(1, 124): # Loop 123 times
            cycle_idx = (u + j) % L
            
            # The value contributes X_temp[idx] to the XOR sum
            target_val ^= X_temp[cycle_idx]
            
            # It also contributes K[chain_id] to the XOR sum
            chain_id = cycle_idx % num_chains
            row[chain_id] ^= 1
        
        matrix.append(row)
        vector.append(target_val)

    # 3. Gaussian Elimination to find K values (Constants)
    # This solves the system over GF(2)
    k_values = [0] * num_chains
    
    # Forward elimination
    for i in range(num_chains):
        # Find pivot
        if matrix[i][i] == 0:
            for j in range(i + 1, num_chains):
                if matrix[j][i] == 1:
                    matrix[i], matrix[j] = matrix[j], matrix[i]
                    vector[i], vector[j] = vector[j], vector[i]
                    break
        
        # Eliminate lower rows
        if matrix[i][i] == 1:
            for j in range(i + 1, num_chains):
                if matrix[j][i] == 1:
                    for col in range(i, num_chains):
                        matrix[j][col] ^= matrix[i][col]
                    vector[j] ^= vector[i]

    # Back substitution
    for i in range(num_chains - 1, -1, -1):
        if matrix[i][i] == 1:
            sum_val = 0
            for j in range(i + 1, num_chains):
                if matrix[i][j] == 1:
                    sum_val ^= k_values[j]
            k_values[i] = sum_val ^ vector[i]

    # 4. Reconstruct final plaintext and write to buffer
    for k in range(L):
        chain_id = k % num_chains
        plaintext_byte = X_temp[k] ^ k_values[chain_id]
        
        original_file_index = cycle_indices[k]
        decrypted_buffer[original_file_index] = plaintext_byte

def main():
    filename = "flag.png.enc"
    
    if not os.path.exists(filename):
        print(f"Error: {filename} not found.")
        return

    with open(filename, "rb") as f:
        data = bytearray(f.read())
    
    filesize = len(data)
    print(f"[*] File size: {filesize} bytes")
    
    # 1. Regenerate the permutation
    p_table = get_permutation_table(filesize)
    
    # 2. Decompose permutation into cycles
    print("[*] Decomposing cycles...")
    visited = [False] * filesize
    decrypted_data = bytearray(filesize)
    
    cycles_found = 0
    
    for i in range(filesize):
        if visited[i]:
            continue
            
        # Trace a new cycle
        current_cycle = []
        curr = i
        while not visited[curr]:
            visited[curr] = True
            current_cycle.append(curr)
            curr = p_table[curr]
            
        # 3. Solve this cycle
        solve_cycle(current_cycle, data, decrypted_data)
        cycles_found += 1
        
        if cycles_found % 100 == 0:
            print(f"\r[*] Solved {cycles_found} cycles...", end="")
            
    print(f"\n[*] Finished. Recovered {cycles_found} cycles.")
    
    out_filename = "flag.png"
    with open(out_filename, "wb") as f:
        f.write(decrypted_data)
    
    print(f"[+] Decrypted file saved to: {out_filename}")

if __name__ == "__main__":
    main()
```

How to run:
1. Save as `decrypt_locker.py`.
2. Put `flag.png.enc` in the same directory.
3. Run on Linux: `python3 decrypt_locker.py`
4. Open `flag.png` with an image viewer.

---

## Part 7 — Recap (simple story of what we did)

- You saw a binary that shuffled indices with a fixed seed and XORed windows of input bytes.
- XOR is a toggling operation that cancels duplicates. That cancellation is the key to reversing the windowed XOR.
- By reproducing the permutation and solving along permutation cycles we can recover the original bytes.
- The process is fully deterministic and straightforward to automate.

---

## Final note and flag

This method recovers the PNG, which contains the flag:

**FlagY{[redacted]}**

---
