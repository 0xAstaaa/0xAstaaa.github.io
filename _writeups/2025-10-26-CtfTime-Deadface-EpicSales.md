---
title: "Deadface EpicSales — Full Writeup (DB Script–Based)"
date: 2025-10-28
layout: writeup
categories:
  - ctftime
tags:
  - sql
  - database
---

# EpicSales CTF — Full Writeup (All Phases)

This writeup is built from the automation script used to query the EpicSales database and extract the flags. Each phase includes the objective, the exact SQL used, and the resulting flag. Phases are numbered to match your requested order:

- 1: New Signups
- 2: Top Product
- 3: Low Inventory
- 4: C‑Suite Payroll
- 5: High‑Engagement Customer
- 6: Top Spending Customer
- 7: b1tfr34k identity
- 8: Undervalued

You can run the helper script locally to reproduce all flags.
-> Link : [fetch-database-flags.sh](https://pastebin.com/ZXMMfknM)
```bash
# filename: fetch-database-flags.sh
# Fetches all EpicSales flags via MySQL (replace credentials/host if needed)
set -euo pipefail

HOST="env01.deadface.io"
PORT=3306
USER="epicsales"
PASS="Slighted3-Charting-Valium"
DB="epicsales_db"

MYSQL_OPTS=(
  --host="$HOST"
  --port="$PORT"
  -u"$USER"
  -p"$PASS"
  --ssl=0
  --batch
  --skip-column-names
  --default-character-set=utf8mb4
  -D "$DB"
)

# ... (rest of the provided script)
```

---

## 1) New Customer Signups After 2025‑09‑01

**Objective:** Count customers who signed up on or after 2025‑09‑01.  
**Key column:** `customers.join_date`

```sql
SELECT CONCAT('deadface{', COUNT(*), '}')
FROM customers
WHERE join_date >= '2025-09-01';
```

Flag : `deadface{18}`

---

## 2) Product With Highest Average Rating

**Objective:** Find the product with the highest average review rating (with stable tie‑breakers).  
**Key tables:** `products(product_id, product_name)`, `reviews(product_id, rating)`

```sql
SELECT CONCAT('deadface{', p.product_name, '}') AS flag
FROM products p
JOIN reviews r ON p.product_id = r.product_id
GROUP BY p.product_id, p.product_name
ORDER BY AVG(r.rating) DESC, COUNT(*) DESC, p.product_id ASC
LIMIT 1;
```

Flag : `deadface{VortexAudio Focus}`

---

## 3) Low Inventory by Facility

**Objective:** Among products whose total quantity in a facility is < 5, return the one with the lowest total, formatted as product + facility number.  
**Key tables:** `inventories(product_id, facility_id, quantity)`, `products(product_id, product_name)`, `facilities(facility_id, facility_num)`

```sql
SELECT CONCAT('deadface{', p.product_name, ' ', f.facility_num, '}') AS flag
FROM inventories i
JOIN products p   ON p.product_id = i.product_id
JOIN facilities f ON f.facility_id = i.facility_id
GROUP BY i.product_id, i.facility_id
HAVING SUM(i.quantity) < 5
ORDER BY SUM(i.quantity) ASC, p.product_name ASC, f.facility_num ASC
LIMIT 1;
```

Flag : `deadface{ConnectGear SafeDrive 2TB 16}`

---

## 4) C‑Suite Payroll Impact

**Objective:** Sum the `pay_rate` for roles in `CEO`, `CTO`, `CFO` and format to two decimals.  
**Key table:** `employees(pay_rate, role)`

```sql
SELECT CONCAT('deadface{$', ROUND(SUM(pay_rate), 2), '}') AS flag
FROM employees
WHERE role IN ('CEO','CTO','CFO');
```

Flag : `deadface{$7391.20}`

---

## 5) High‑Engagement Customer (Orders With No Reviews)

**Objective:** Select the customer with the highest order count who never left a review (engaged buyer, zero reviews).  
**Key tables:** `customers`, `orders`, `reviews`

```sql
SELECT CONCAT('deadface{', c.email, '}') AS flag
FROM customers c
JOIN orders   o ON o.customer_id = c.customer_id
LEFT JOIN reviews r ON r.customer_id = c.customer_id
WHERE r.review_id IS NULL
GROUP BY c.customer_id, c.email
ORDER BY COUNT(DISTINCT o.order_id) DESC, c.customer_id ASC
LIMIT 1;
```

Flag : `deadface{dgrimsley2ab@webs.com}`

---

## 6) Top Spending Customer

**Objective:** Find the customer with the highest total spend (sum of quantity × price).  
**Key tables:** `customers`, `orders`, `order_items`, `products(price)`

```sql
SELECT CONCAT('deadface{', c.first_name, ' ', c.last_name, '}') AS flag
FROM customers c
JOIN orders o       ON o.customer_id = c.customer_id
JOIN order_items oi ON oi.order_id   = o.order_id
JOIN products p     ON p.product_id  = oi.product_id
GROUP BY c.customer_id, c.first_name, c.last_name
ORDER BY SUM(oi.quantity * p.price) DESC, c.customer_id ASC
LIMIT 1;
```

Flag : `deadface{Willabella Wain}`

---

## 7) b1tfr34k Identity (Negative Reviews Trail)

**Objective:** Correlate strongly negative review text to a real identity.  
**Key tables:** `reviews(comment, review_id, customer_id)`, `customers(customer_id, first_name, last_name)`

Typical investigation flow:

```sql
-- 1) Inspect reviews to spot a strongly negative comment
SELECT review_id, customer_id, comment
FROM reviews;

-- 2) Resolve that customer to a real name
SELECT first_name, last_name
FROM customers
WHERE customer_id = 14644;  

-- 3) Or collect the flag in one query when the review_id is known
SELECT CONCAT('deadface{', c.first_name, ' ', c.last_name, '}') AS flag
FROM reviews r
JOIN customers c ON c.customer_id = r.customer_id
WHERE r.review_id = 4464;
```

Flag : `deadface{Billie Tournas}`

---

## 8) Undervalued

**Objective:** Find the facility with the lowest average inventory quantity and output the IT Manager’s email there plus the facility’s average.  
**Key tables:** `inventories(facility_id, quantity)`, `employee_assignments(employee_id, facility_id)`, `employees(employee_id, email, role, start_date)`

Step A — find the facility with the lowest average quantity:

```sql
SELECT i.facility_id, AVG(i.quantity) AS avg_qty
FROM inventories i
GROUP BY i.facility_id
ORDER BY avg_qty ASC, i.facility_id ASC
LIMIT 1;
```

Step B — extract the IT Manager email at that facility:

```sql
-- Assume :FACILITY_ID is from Step A
SELECT CONCAT('deadface{', e.email, ' ', FORMAT(:AVG_QTY, 4), '}') AS flag
FROM employee_assignments ea
JOIN employees e ON e.employee_id = ea.employee_id
WHERE ea.facility_id = :FACILITY_ID
  AND e.role LIKE '%IT Manager%'
ORDER BY e.start_date DESC, e.employee_id ASC
LIMIT 1;
```

Flag : `deadface{valera.kenner@epicsales.shop 2274.4626}`

---

## ✅ Consolidated Flags (1–8)

1. New Signups: `deadface{18}`  
2. Top Product: `deadface{VortexAudio Focus}`  
3. Low Inventory: `deadface{ConnectGear SafeDrive 2TB 16}`  
4. C‑Suite Payroll: `deadface{$7391.20}`  
5. High‑Engagement Customer: `deadface{dgrimsley2ab@webs.com}`  
6. Top Spending Customer: `deadface{Willabella Wain}`  
7. b1tfr34k Identity: `deadface{Billie Tournas}`  
8. Undervalued: `deadface{valera.kenner@epicsales.shop 2274.4626}`

---
