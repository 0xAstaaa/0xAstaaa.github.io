---
layout: page
title: About
permalink: /about/
---

I dive into code and capture the flag challenges to sharpen real-world skills. Most of my work revolves around web exploitation and boot2root machines — from quick scripts to full writeups.

You’ll also find projects around automation and Discord bots, where I explore how code can simplify everyday workflows.

Highlights:
- Focused CTF writeups with clear breakdowns and payloads  
- Clean, category-driven layout for easier navigation  
- Automated project listings fetched directly from GitHub  
- Social and Discord automation experiments showcased with code snippets


<ul class="social-list">
  <li>
    <a class="social-link social-link--instagram"
       href="https://instagram.com/{{ site.author.instagram | default: 'amiinee.bou' }}"
       target="_blank"
       rel="noopener"
       aria-label="Instagram">
      <svg class="icon icon--instagram" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 2C4.24 2 2 4.24 2 7v10c0 2.76 2.24 5 5 5h10c2.76 0 5-2.24 5-5V7c0-2.76-2.24-5-5-5H7Zm0 2h10c1.66 0 3 1.34 3 3v10c0 1.66-1.34 3-3 3H7c-1.66 0-3-1.34-3-3V7c0-1.66 1.34-3 3-3Zm5 3.5A5.5 5.5 0 1 0 17.5 13 5.51 5.51 0 0 0 12 7.5Zm0 2A3.5 3.5 0 1 1 8.5 13 3.5 3.5 0 0 1 12 9.5Zm5.75-3.75a1.25 1.25 0 1 0 1.25 1.25 1.25 1.25 0 0 0-1.25-1.25Z"/>
      </svg>
      <span>@{{ site.author.instagram | default: 'amiinee.bou' }}</span>
    </a>
  </li>

  <li>
    <a class="social-link social-link--github"
       href="https://github.com/{{ site.author.github | default: 'bouaafia' }}/"
       target="_blank"
       rel="noopener"
       aria-label="GitHub">
      <svg class="icon icon--github" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.94c.58.1.79-.25.79-.56v-2.03c-3.2.7-3.87-1.37-3.87-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.74 1.26 3.41.96.1-.76.41-1.26.75-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.3 1.2-3.11-.12-.29-.52-1.46.11-3.04 0 0 .98-.31 3.2 1.19a11.1 11.1 0 0 1 5.83 0c2.22-1.5 3.2-1.19 3.2-1.19.63 1.58.23 2.75.11 3.04.75.81 1.2 1.85 1.2 3.1 0 4.43-2.7 5.41-5.28 5.69.42.36.8 1.07.8 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"/>
      </svg>
      <span>@{{ site.author.github | default: 'bouaafia' }}</span>
    </a>
  </li>

  <li>
    <a class="social-link social-link--tryhackme"
       href="https://tryhackme.com/p/{{ site.author.tryhackme | default: '0xAsta' }}"
       target="_blank"
       rel="noopener"
       aria-label="TryHackMe">
      <svg class="icon icon--thm" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <!-- Simple terminal icon -->
        <path d="M3 4h18v16H3z"></path>
        <path d="M6 8l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M12 16h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path>
      </svg>
      <span>/{{ site.author.tryhackme | default: '0xAsta' }}</span>
    </a>
  </li>
</ul>
