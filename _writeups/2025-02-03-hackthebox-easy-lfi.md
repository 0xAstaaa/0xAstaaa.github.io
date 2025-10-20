---
title: "HackTheBox: Easy LFI"
date: 2025-02-03
categories:
  - HackTheBox
tags:
  - lfi
  - logs
  - php
---

## Summary

Local File Inclusion (LFI) to read sensitive files and escalate with log poisoning.

### Steps
- Baseline recon and parameter discovery
- Testing inclusion vectors
- PoC and reading creds
- Privilege escalation