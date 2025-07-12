/*  static/javascript/editar_producto.js  */
(() => {
  "use strict";

  /* ───────── helpers ───────── */
  const $  = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);

  /* CSRF (cookie → header) */
  const csrftoken =
    (document.cookie.split(";").map(c => c.trim())
      .find(c => c.startsWith("csrftoken=")) || "")
      .split("=")[1] || "";

  /* UI helpers */
  const iconErr = txt => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const show    = (el, html, flex = false) => {
    if (!el) return;
    el.innerHTML     = html;
    el.style.display = flex ? "flex" : "block";
  };
  const hide   = el => { if (el) { el.style.display = "none"; el.innerHTML = ""; } };

  /* ───────── elementos DOM ───────── */
  const form      = $("#productoForm");
  const errBox    = $("#error-message");
  const okBox     = $("#success-message");
  const catInput  = $("#id_categoria_autocomplete");
  const catHidden = $("#id_categoria");
  const catBox    = $("#categoria-autocomplete-results");

  /* ───────── reset UI ───────── */
  function resetUI () {
    hide(errBox); hide(okBox);

    $$(".field-error").forEach(div => {
      div.classList.remove("visible");
      hide(div);
    });
    $$(".input-error").forEach(inp => inp.classList.remove("input-error"));
  }

  /* ───────── pinta errores del backend ───────── */
  function renderErrors (errs = {}) {
    if (errs.__all__)
      show(errBox, errs.__all__.map(e => iconErr(e.message)).join("<br>"));

    for (const [field, arr] of Object.entries(errs)) {
      if (field === "__all__") continue;

      const div   = $(`#error-id_${field}`);
      const input = $(`#id_${field}`);

      if (div) {
        div.innerHTML = arr.map(e => iconErr(e.message)).join("<br>");
        div.classList.add("visible");
        div.style.display = "block";           /* ← hace visible el texto */
      }
      if (input) input.classList.add("input-error");
    }
  }

  /* ───────── Autocomplete «Categoría» ───────── */
  let page = 1, busy = false, hasMore = true, term = "", debounceTimer;

  const fetchCats = (q, p = 1) => {
    if (busy || !hasMore) return;
    busy = true;

    fetch(`${categoriaAutocompleteUrl}?term=${encodeURIComponent(q)}&page=${p}`)
      .then(r => r.json())
      .then(data => {
        if (p === 1) catBox.innerHTML = "";

        if (data.results.length) {
          data.results.forEach(o => {
            const opt = document.createElement("div");
            opt.className   = "autocomplete-option";
            opt.textContent = o.text;
            opt.dataset.id  = o.id;
            catBox.appendChild(opt);
          });
          hasMore = data.has_more;
        } else if (p === 1) {
          catBox.innerHTML =
            '<div class="autocomplete-no-result">Sin resultados</div>';
          hasMore = false;
        }
        catBox.classList.add("visible");
      })
      .catch(console.error)
      .finally(() => busy = false);
  };

  /* eventos input */
  catInput.addEventListener("input", () => {
    catHidden.value = "";
    term   = catInput.value.trim();
    hasMore = true; page = 1;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchCats(term, 1), 300);
  });

  catInput.addEventListener("focus", () => {
    if (!catInput.value.trim()) return;
    term = catInput.value.trim(); hasMore = true; page = 1;
    fetchCats(term, 1);
  });

  catBox.addEventListener("scroll", () => {
    if (catBox.scrollTop + catBox.clientHeight >= catBox.scrollHeight - 5) {
      if (hasMore && !busy) { page++; fetchCats(term, page); }
    }
  });

  catBox.addEventListener("click", e => {
    if (e.target.classList.contains("autocomplete-option")) {
      catInput.value  = e.target.textContent;
      catHidden.value = e.target.dataset.id;
      catBox.classList.remove("visible");
      catBox.innerHTML = "";
      hasMore = false;
    }
  });

  document.addEventListener("click", e => {
    if (!catInput.contains(e.target) && !catBox.contains(e.target)) {
      catBox.classList.remove("visible");
    }
  });

  /* ───────── envío del formulario ───────── */
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    resetUI();

    /* validación rápida en front */
    if (!catHidden.value) {
      const fld = $("#error-id_categoria");
      show(fld, iconErr("Este campo es obligatorio."));
      fld.classList.add("visible");
      fld.style.display = "block";
      show(errBox, iconErr("Corrige los errores del formulario."));
      return;
    }

    try {
      const resp = await fetch(form.action, {
        method : "POST",
        headers: {
          "X-CSRFToken"      : csrftoken,
          "X-Requested-With" : "XMLHttpRequest",
          "Accept"           : "application/json",
        },
        body : new FormData(form),
      });

      const data = await resp.json();

      if (data.success) {
        /* flash-message para la lista */
        sessionStorage.setItem(
          "flash-producto",
          `<i class="fas fa-check-circle"></i> Producto «${data.nombre}» actualizado correctamente.`
        );
        window.location.href = data.redirect_url;
        return;
      }

      /* errores de validación del servidor */
      renderErrors(typeof data.errors === "string"
                   ? JSON.parse(data.errors)
                   : data.errors);
    } catch (err) {
      console.error(err);
      show(errBox, iconErr("Ocurrió un error inesperado."));
    }
  });
})();
