---
title: "HTB Low Logic — Full but Easy Writeup"
date: 2025-11-05
categories:
  - HackTheBox
tags:
  - hardware
  - logic
  - transistor
  - reverse-engineering
---

# 🧩 HTB Low Logic — Full but Easy Writeup

## Overview

This challenge comes from HackTheBox’s **Hardware** category and is named **Low Logic**.  
We are given two main files:

- `chip.jpg` — a photo of a small circuit built with **NPN transistors** and **resistors**.  
- `input.csv` — a dataset containing 192 input combinations for four digital signals (`in0–in3`).

Our job is to **reverse-engineer** the circuit and determine what logical operation it performs.  
Once we understand its logic, we can reproduce its output and decode a hidden message — the flag!

---

## Step 1 — Observing the Circuit

Looking at `chip.jpg`, the layout shows a **transistor logic network** with four labeled inputs and one output node.  
The key takeaway from transistor logic:

- **Transistor ON = path to ground (logic 0)**  
- **Transistor OFF = output stays high (logic 1)**  
- **Series transistors** act like an **AND gate** (all must conduct to pull down the node).  
- **Parallel transistors** act like an **OR gate** (any conducting path will pull the output low).

Hence, the **output is the inverted version** of the pull-down network:
```
OUT = NOT(pull_down_network)
```

This type of logic resembles how early TTL logic gates (like NAND/NOR) were physically implemented.

---

## Step 2 — Understanding the Inputs

From the CSV, we have:
```
in0, in1, in2, in3
```
Each combination (0000 → 1111) appears several times in the file, creating 192 total rows.

At first, we don’t know what logic connects them, so we can’t directly compute the outputs.

Instead of manually tracing the entire schematic, we can take a **computational shortcut**.

---

## Step 3 — Brute-Forcing the Logic

There are **4 input bits**, meaning there are **16 possible input states** (2⁴ = 16).  
Each state could output either 0 or 1 — meaning there are **65,536 possible logic functions**.

So, we can try every possible 16-bit truth table (each one describing an output pattern for 16 inputs).  
For each possible truth table, we simulate the circuit’s outputs and check what ASCII text appears when we interpret the output bits.

Why ASCII?  
Because HTB flags are text strings like `HTB{something}`, so the output should form readable characters if the logic is correct.

---

## Step 4 — Finding the Correct Truth Table

After brute-forcing, one truth table stands out.

It corresponds to a **16-bit mask** value of:
```
MASK = 63624
```

This mask means that the circuit outputs a `1` for some input combinations and `0` for others, following the binary pattern:
```
1111 1000 1111 1000
```
*(if we visualize the mask in binary, depending on input order)*

We then apply this mask to the 192 input rows from `input.csv`.  
This produces the circuit’s predicted output — stored in `outputs.csv`.

---

## Step 5 — Decoding the Output

The outputs are bits (0 or 1). We join them into a long 192-bit string.

Now we decode them as **ASCII** text, grouping every 8 bits into a byte.

Running a simple script shows:

```
HTB{4_G00d_Cm05_3x4mpl3}
```

That’s perfectly formatted as a HackTheBox flag!

---

## Step 6 — Automating the Process

Instead of manually decoding, we can automate everything using a short Python script.

The complete script (`script_with_mask.py`) is available here:

👉 [https://limewire.com/d/pD4NB#J9moW1f11Q](https://limewire.com/d/pD4NB#J9moW1f11Q)

### How to use:
1. Put `script_with_mask.py` and `input.csv` in the same folder.  
2. Run the script:
   ```bash
   python3 script_with_mask.py
   ```
3. The script will:
   - Apply the discovered truth table (`MASK = 63624`)
   - Generate `outputs.csv`
   - Decode the output bits
   - Print the flag automatically

This makes the whole process fully reproducible in seconds.

---

## Step 7 — What We Learned

This challenge is a nice example of **digital logic reconstruction** using minimal hardware data.  
You don’t need electrical simulation tools — just logic reasoning and a bit of scripting.

Key takeaways:
- Transistor networks map directly to AND/OR gates.
- Complex circuits can often be represented as a small truth table.
- With only a CSV of inputs, we can guess the logic and decode hidden data.
- Brute-forcing is practical when the input size is small (2⁴ = 16 possible states).

---

## Tools Used

- **Python 3** — for automating decoding and brute force  
- **pandas** — to read CSV data easily  
- **sympy** — optional for logic simplification  
- **Image viewer** — for studying the schematic  
- **VS Code / Terminal** — for running the scripts  

---

## Step 8 — Conclusion

By reasoning through the circuit and validating the correct truth table mask, we successfully decoded the message embedded in the logic pattern.

The key steps were:
1. Understanding transistor logic (pull-down networks).  
2. Reading input data.  
3. Brute-forcing or simplifying logic.  
4. Translating bits → ASCII.  
5. Recovering the flag.

---

## 🏁 Final Flag

**Flag:** `HTB{4_G00d_Cm05_3x4mpl3}`

---
