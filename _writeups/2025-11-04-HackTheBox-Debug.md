---
title: "HTB Debug Challenge — Full Writeup"
date: 2025-11-04
categories:
  - HackTheBox
tags:
  - hardware
  - UART
  - logic-analyzer
---

# HTB Debug Challenge — Full Writeup

This document provides a complete solution for the "Debug" hardware challenge. The goal is to analyze a digital signal capture from a malfunctioning satellite dish to identify and decode a source of serial interference, which in turn reveals the flag.

## 🧩 Overview

The challenge provides a `hw_debug.sal` file, which is a session capture from a Saleae Logic Analyzer. The file contains two distinct digital signals (Channel 0 and Channel 1). The program's "boot sequence" is on one channel, while the "interference" is on the other.

The objective is to use the Saleae Logic 2 software to analyze both signals, determine the correct communication parameters (protocol and baud rate), and extract the flag hidden within the interference signal.

## Phase 1 — Initial Analysis & Channel 0

**Objective:** Find the correct communication protocol and baud rate for the satellite's boot sequence.  
**Tools:** Saleae Logic 2

1. Open the `hw_debug.sal` file in Saleae Logic 2. Two channels appear with data.
2. Add an "Async Serial" analyzer from the "Analyzers" panel.
3. Set the "Input Channel" for this analyzer to Channel 0.
4. Determine the baud rate by measuring the width of the narrowest pulse on Channel 0 (~8.69 µs):

   ```
   Baud rate ≈ 1 / 0.00000869 s ≈ 115074
   ```
   This is very close to the standard 115200 baud.

5. Set the analyzer to 115200 baud. The decoded output shows the satellite's boot log:
   ```
   INFO: AUTORSTARTUP MODE = 1
   NOTICE: Booting Trusted Firmware
   ```
   This confirms Channel 0 is the normal boot log.

## Phase 2 — Finding the Interference

**Objective:** Isolate and analyze the "interference" signal on Channel 1.

1. Add a second "Async Serial" analyzer.
2. Set its "Input Channel" to Channel 1.
3. Use the same 115200 baud rate.
4. The decoded output shows repeated "WARNING" and "INFO" messages, which contain the flag split into pieces.

<img width="1919" height="1006" alt="image" src="https://github.com/user-attachments/assets/481daf80-b84d-4cc7-9aee-c2d2aa79e6ff" />


## Phase 3 — Capturing the Flag

**Objective:** Extract and assemble the flag from the decoded Channel 1 data.

Decoded text from Channel 1:

<img width="1327" height="859" alt="image" src="https://github.com/user-attachments/assets/71efd15c-12a2-466a-9af2-de5e638bec54" />


By combining the `HTB{` prefix with the reference codes in order, we obtain the final flag.

## 🏁 Flag

**Flag:** `HTB{547311173_n37w02k_c0mp20m153d}`
