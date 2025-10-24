// Menú móvil y dropdowns con auto-alineación y cierre con retardo
(function () {
  const burger = document.getElementById("nvBurger");
  const links  = document.getElementById("nvLinks");

  if (burger && links) {
    burger.addEventListener("click", () => {
      links.classList.toggle("is-open");
    });
  }

  const isMobile = () => window.matchMedia("(max-width: 720px)").matches;
  const isNarrowDesktop = () => window.matchMedia("(max-width: 1100px)").matches;
  const parents = Array.from(document.querySelectorAll(".nv__item.has-dd"));

  // Apertura por CLICK en móvil y en escritorio estrecho (<=1100px)
  function bindClickMode() {
    parents.forEach(li => {
      const a  = li.querySelector(":scope > a");
      const dd = li.querySelector(":scope > .nv__dd");
      if (!a || !dd) return;

      a.__nvClickHandler && a.removeEventListener("click", a.__nvClickHandler);
      const handler = (e) => {
        if (!(isMobile() || isNarrowDesktop())) return; // en desktop ancho, no interferir
        e.preventDefault();
        // cerrar otros
        document.querySelectorAll(".nv__item.has-dd.is-open")
          .forEach(x => { if (x !== li) x.classList.remove("is-open"); });
        li.classList.toggle("is-open");
        positionDropdown(li, dd);
      };
      a.addEventListener("click", handler);
      a.__nvClickHandler = handler;
    });
  }

  // Hover intent en desktop “normal”
  function bindHoverMode() {
    parents.forEach(li => {
      const dd = li.querySelector(":scope > .nv__dd");
      if (!dd) return;

      // limpia handlers previos
      li.__enter && li.removeEventListener("mouseenter", li.__enter);
      li.__leave && li.removeEventListener("mouseleave", li.__leave);

      const enter = () => {
        if (isMobile() || isNarrowDesktop()) return;
        li.classList.add("is-open");
        positionDropdown(li, dd);
        clearTimeout(li.__leaveTimer);
      };
      const leave = () => {
        if (isMobile() || isNarrowDesktop()) return;
        clearTimeout(li.__leaveTimer);
        li.__leaveTimer = setTimeout(() => { li.classList.remove("is-open"); }, 120); // pequeño retardo
      };
      li.addEventListener("mouseenter", enter);
      li.addEventListener("mouseleave", leave);
      li.__enter = enter; li.__leave = leave;
    });
  }

  // Coloca el dropdown hacia derecha/arriba si hace falta
  function positionDropdown(li, dd) {
    if (!dd) return;
    dd.classList.remove("is-right", "is-top");

    // mostrar temporalmente para medir
    const wasHidden = getComputedStyle(dd).display === "none";
    if (wasHidden) dd.style.display = "block";
    const rect = dd.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    if (rect.right > vw - 8) dd.classList.add("is-right");
    if (rect.bottom > vh - 8) dd.classList.add("is-top");

    if (wasHidden) dd.style.display = "";
  }

  // Click fuera: cerrar menús abiertos
  document.addEventListener("click", (e) => {
    if (!links) return;
    if (!links.contains(e.target)) {
      links.classList.remove("is-open");
      document.querySelectorAll(".nv__item.has-dd.is-open")
        .forEach(x => x.classList.remove("is-open"));
    }
  });

  // Al redimensionar, re-enlazar comportamiento y cerrar estados raros
  function refreshBindings() {
    links && links.classList.remove("is-open");
    document.querySelectorAll(".nv__item.has-dd.is-open")
      .forEach(x => x.classList.remove("is-open"));
    bindClickMode();
    bindHoverMode();
  }
  window.addEventListener("resize", refreshBindings);

  // Inicial
  refreshBindings();
})();
