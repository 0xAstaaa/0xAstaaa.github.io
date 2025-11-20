// Simple mobile menu toggle. Add this script tag with defer in head.
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (!btn || !mobileNav) return;
  btn.addEventListener('click', function () {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    mobileNav.style.display = expanded ? 'none' : 'flex';
  });
});
