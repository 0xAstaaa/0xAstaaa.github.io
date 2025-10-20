(function () {
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const debounce = (fn, ms = 120) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  const normalize = (s) => (s || "").toString().toLowerCase();

  function setupNavActive() {
    // Liquid adds is-active, but keep for baseurl edge cases
    const path = location.pathname.replace(window.SITE_BASEURL || "", "");
    qsa(".nav__link").forEach((a) => {
      try {
        const href = a.getAttribute("href");
        if (!href) return;
        const u = new URL(href, location.origin);
        if (u.pathname === path) a.classList.add("is-active");
      } catch (_) {}
    });
  }

  function setupWriteups() {
    const list = qs("#writeup-list");
    if (!list) return;

    const searchInput = qs("#search-input");
    const searchClear = qs("#search-clear");
    const searchStats = qs("#search-stats");
    const noResultsEl = qs("#no-results");
    const chipsContainer = qs("#category-chips");
    const tagCloud = qs("#tag-cloud");
    const cards = qsa(".writeup-card", list);

    let activeCategories = new Set();
    let activeTags = new Set();
    let searchIndex = [];

    // Build index from DOM
    searchIndex = cards.map((card) => {
      return {
        el: card,
        title: normalize(card.dataset.title),
        url: card.dataset.url,
        categories: normalize(card.dataset.categories),
        tags: normalize(card.dataset.tags),
        content: normalize(card.textContent || "")
      };
    });

    // Build tag cloud with weighted sizes
    const tagCounts = {};
    cards.forEach((c) => {
      (c.dataset.tags || "").split(",").map(t => t.trim()).filter(Boolean).forEach((t) => {
        const key = normalize(t);
        tagCounts[key] = (tagCounts[key] || 0) + 1;
      });
    });
    const entries = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0, 80);
    tagCloud.innerHTML = "";
    const max = entries.length ? entries[0][1] : 1;
    entries.forEach(([tag, count]) => {
      const btn = document.createElement("button");
      btn.className = "tag";
      btn.type = "button";
      btn.setAttribute("data-tag", tag);
      const weight = 0.9 + (count / max) * 0.5; // font scaling
      btn.style.fontSize = `${weight}rem`;
      btn.textContent = `#${tag}`;
      btn.title = `${count} writeup(s)`;
      btn.addEventListener("click", () => {
        if (activeTags.has(tag)) activeTags.delete(tag); else activeTags.add(tag);
        btn.classList.toggle("is-active");
        applyFilters();
      });
      tagCloud.appendChild(btn);
    });

    // Category chips
    if (chipsContainer) {
      qsa(".chip", chipsContainer).forEach((chip) => {
        chip.addEventListener("click", () => {
          const cat = normalize(chip.dataset.category || "");
          if (activeCategories.has(cat)) {
            activeCategories.delete(cat);
            chip.classList.remove("is-active");
          } else {
            activeCategories.add(cat);
            chip.classList.add("is-active");
          }
          applyFilters();
        });
      });
    }

    // Search
    const doFilter = debounce(applyFilters, 80);
    if (searchInput) {
      // Shortcut: "/" to focus search
      window.addEventListener("keydown", (e) => {
        if (e.key === "/" && document.activeElement !== searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        if (e.key === "Escape") {
          clearSearch();
        }
      });
      searchInput.addEventListener("input", doFilter);
    }
    if (searchClear) {
      searchClear.addEventListener("click", () => {
        clearSearch();
        searchInput?.focus();
      });
    }
    function clearSearch() {
      if (searchInput) searchInput.value = "";
      applyFilters();
    }

    function updateStats(visible) {
      if (!searchStats) return;
      const q = normalize(searchInput ? searchInput.value : "");
      let parts = [];
      parts.push(`${visible} result${visible === 1 ? "" : "s"}`);
      if (activeCategories.size) parts.push(`in ${activeCategories.size} categor${activeCategories.size === 1 ? "y" : "ies"}`);
      if (activeTags.size) parts.push(`with ${activeTags.size} tag${activeTags.size === 1 ? "" : "s"}`);
      if (q) parts.push(`for “${q}”`);
      searchStats.textContent = parts.join(" • ");
    }

    function applyFilters() {
      const q = normalize(searchInput ? searchInput.value : "");
      let visibleCount = 0;

      searchIndex.forEach(({ el, title, content, categories, tags }) => {
        let show = true;

        if (q) {
          const inText = title.includes(q) || content.includes(q) || tags.includes(q) || categories.includes(q);
          if (!inText) show = false;
        }
        if (show && activeCategories.size > 0) {
          const cats = categories.split(",").map(s => s.trim()).filter(Boolean);
          const hasCat = cats.some(c => activeCategories.has(c));
          if (!hasCat) show = false;
        }
        if (show && activeTags.size > 0) {
          const tagArr = tags.split(",").map(s => s.trim()).filter(Boolean);
          const hasTag = tagArr.some(t => activeTags.has(t));
          if (!hasTag) show = false;
        }
        el.style.display = show ? "" : "none";
        if (show) visibleCount++;
      });

      if (noResultsEl) noResultsEl.style.display = visibleCount === 0 ? "" : "none";
      updateStats(visibleCount);
    }

    applyFilters();
  }

  async function setupProjects() {
    const grid = qs("#projects-grid");
    const loading = qs("#projects-loading");
    const empty = qs("#projects-empty");
    const error = qs("#projects-error");
    if (!grid) return;

    const username = (window.PROJECT_USERNAME || "").trim();
    if (!username) {
      if (loading) loading.style.display = "none";
      if (error) error.style.display = "";
      if (error) error.textContent = "No username configured.";
      return;
    }

    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100`, {
        headers: { "Accept": "application/vnd.github+json" }
      });
      if (!res.ok) throw new Error("GitHub API error");
      const repos = await res.json();

      const filtered = repos.filter(r => {
        const selfName = username.toLowerCase();
        const isFork = !!r.fork;
        const nameMatchesUser = (r.name || "").toLowerCase().includes(selfName);
        return !isFork && !nameMatchesUser;
      }).sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

      if (loading) loading.style.display = "none";

      if (filtered.length === 0) {
        if (empty) empty.style.display = "";
        return;
      }

      const frag = document.createDocumentFragment();

      filtered.forEach(r => {
        const card = document.createElement("article");
        card.className = "card project";

        const title = document.createElement("a");
        title.className = "project__title";
        title.href = r.html_url;
        title.target = "_blank";
        title.rel = "noopener";
        title.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"></path><path d="M5 5h6V3H3v8h2V5z"></path></svg> ${r.name}`;

        const desc = document.createElement("p");
        desc.className = "muted";
        desc.textContent = r.description || "No description";

        const meta = document.createElement("div");
        meta.className = "project__meta";
        const lang = r.language ? `<span class="tag" data-tag="${(r.language || '').toLowerCase()}">${r.language}</span>` : "";
        const stars = `<span class="chip">★ ${r.stargazers_count}</span>`;
        const updated = `<span class="chip">⏱ ${new Date(r.pushed_at).toISOString().slice(0,10)}</span>`;
        meta.innerHTML = `${lang} ${stars} ${updated}`;

        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(meta);

        frag.appendChild(card);
      });

      grid.appendChild(frag);
    } catch (e) {
      if (loading) loading.style.display = "none";
      if (error) error.style.display = "";
      console.error(e);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupNavActive();
    setupWriteups();
    setupProjects();
  });
})();