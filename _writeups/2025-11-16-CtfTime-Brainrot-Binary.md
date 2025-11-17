---
title: "Brainrot Binary  M*CTF 2025 Quals — Writeup"
date: 2025-11-16
categories:
  - CTF
tags:
  - reverse-engineering
  - crypto
  - forensics
---

# Brainrot Binary M*CTF 2025 Quals — Writeup (revised)

Short, focused writeup following the requested template. Analysis is based on the provided decompiler output (file: `decompiled.txt`) obtained from dogbolt.org — that decompiled output is the only binary-derived artifact used here.

## Summary

The supplied Windows binary reads a string from stdin, computes MD5 over that string, and compares the digest to a hard-coded value. If the digest matches, the program XORs a fixed byte sequence with the input bytes and prints the result — the printed result is the flag.

## Key constants (extracted from decompiled.txt)

- Target MD5:
```
cf7cb41e754acda26d852b51e6d7efa7
```

- Fixed XOR blob (hex):
```
0c110407091d18290b2605035a6c70004f
```
(17 bytes)

## Analysis

The binary implements a simple check-and-decode flow:

1. Read input string S (stdin).
2. Compute MD5(S).
3. Compare MD5(S) to the hard-coded target.
4. If they match, compute flag = XOR(blob, S), where:
   - blob is the 17-byte constant above, and
   - S is used as a byte sequence repeated or truncated to the blob length.

Thus the solution is two-step:
- recover a preimage S such that MD5(S) == target MD5, then
- XOR the fixed blob with S (byte-wise) to recover the flag.

## Recovering the MD5 preimage

MD5 is fast and susceptible to wordlist/GPU attacks. Because the preimage looks like a password, a wordlist attack is appropriate.

Examples:

- John the Ripper:
```bash
# write the hash to a file (hash only)
echo 'cf7cb41e754acda26d852b51e6d7efa7' > hash.txt

# run john with rockyou
john --format=raw-md5 --wordlist=/usr/share/wordlists/rockyou.txt hash.txt

# show cracked results
john --show --format=raw-md5 hash.txt
```

- Hashcat:
```bash
echo cf7cb41e754acda26d852b51e6d7efa7 > hash.txt
hashcat -m 0 hash.txt /path/to/wordlists/rockyou.txt
```

Using a standard rockyou-based crack on a typical Kali setup recovered the preimage:
```
arparpavit1243142
```

(If you do this yourself and don’t find a match, consider adding rule sets or targeted masks.)

## Deriving the flag (Python)

Once you have the preimage S, XOR the hex blob with S (repeat/truncate S to the blob length). Example:

```python
from binascii import unhexlify

HEX_BLOB = '0c110407091d18290b2605035a6c70004f'
blob = unhexlify(HEX_BLOB)

# replace this with the cracked preimage as bytes
pre = b'arparpavit1243142'  # example preimage

res = bytes(blob[i] ^ pre[i % len(pre)] for i in range(len(blob)))
print(res.decode())  # prints the flag
```

With pre = b'arparpavit1243142' the script prints:
```
mctf{my_bR41n_A4}
```

## Reproduction (concise)

1. Save the MD5 target to a file (hash.txt) and crack it with John/Hashcat + a wordlist (e.g., rockyou).
2. Use the Python snippet above (substitute the cracked preimage) to XOR the blob and print the flag.

## Final result (from my run)

- Recovered preimage: arparpavit1243142  
- Flag: mctf{my_bR41n_A4}

## Notes

- This analysis used only the decompiled output provided (decompiled.txt) from dogbolt.org.
- The core weakness is relying on MD5 for a short password-like secret — MD5 is fast and can be cracked with wordlists and GPUs.
- No private machine identifiers or extraneous artifacts are included.
