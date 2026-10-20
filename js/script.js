// =========================================================
// Banho e Tosa Pet Peludinho — script.js
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  /* ---- Menu mobile ---- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => nav.classList.remove("is-open"));
    });
  }

  /* ---- Ano no rodapé ---- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Placeholder elegante para fotos que ainda não foram enviadas ----
     Basta colocar os arquivos de foto nas pastas /images/dogs/ ou
     /images/local/ com o nome esperado (ver README.md) que a foto
     real substitui automaticamente este aviso. */
  const pawIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.5 12.5c1.1 0 2-1.12 2-2.5s-.9-2.5-2-2.5-2 1.12-2 2.5.9 2.5 2 2.5Zm5-4c1.1 0 2-1.12 2-2.5S10.6 3.5 9.5 3.5 7.5 4.62 7.5 6s.9 2.5 2 2.5Zm5 0c1.1 0 2-1.12 2-2.5S15.6 3.5 14.5 3.5s-2 1.12-2 2.5.9 2.5 2 2.5Zm4.5 1.5c-1.1 0-2 1.12-2 2.5s.9 2.5 2 2.5 2-1.12 2-2.5-.9-2.5-2-2.5ZM12 12c-2.5 0-6 1.7-6 4.6 0 1.6 1.3 2.9 2.9 2.9.9 0 1.5-.3 2.3-.6.6-.3 1.2-.5 1.8-.5s1.2.2 1.8.5c.8.3 1.4.6 2.3.6 1.6 0 2.9-1.3 2.9-2.9 0-2.9-3.5-4.6-6-4.6Z"/>
    </svg>`;

  document.querySelectorAll("img[data-fallback]").forEach((img) => {
    const wrapper = img.closest(".gallery-item");
    img.addEventListener("error", () => {
      if (!wrapper) return;
      wrapper.classList.add("is-empty");
      wrapper.innerHTML = `${pawIcon}<span>${img.dataset.fallback}</span>`;
    });
  });
});
