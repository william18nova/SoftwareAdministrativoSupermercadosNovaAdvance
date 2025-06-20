/* static/javascript/editar_producto.js
   — Sin jQuery | mismo estilo que agregar_producto.js
   — Redirige a la lista y pasa 1 solo flash-message vía sessionStorage. */
(() => {
  "use strict";

  /* ───────── helpers ───────── */
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const form      = $("#productoForm");
  const errBox    = $("#error-message");
  const okBox     = $("#success-message");
  const catInput  = $("#id_categoria_autocomplete");
  const catHidden = $("#id_categoria");
  const catBox    = $("#categoria-autocomplete-results");

  const csrftoken =
    document.cookie.split(";").map((c) => c.trim())
      .find((c) => c.startsWith("csrftoken="))?.split("=")[1] || "";

  /* html helpers */
  const iconErr = (txt) => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const show    = (el, html, flex = false) => {
    el.innerHTML   = html;
    el.style.display = flex ? "flex" : "block";
  };
  const hide    = (el) => { el.style.display = "none"; el.innerHTML = ""; };

  /* ───────── limpiar interfaz ───────── */
  function resetUI () {
    hide(errBox); hide(okBox);
    $$(".field-error").forEach((d) => {
      d.innerHTML = ""; d.classList.remove("visible"); d.style.display = "none";
    });
    $$(".input-error").forEach((i) => i.classList.remove("input-error"));
  }

  /* ───────── pintar errores ───────── */
  function renderErrors (errs = {}) {
    if (errs.__all__)
      show(errBox, errs.__all__.map((e) => iconErr(e.message)).join("<br>"));

    for (const [field, arr] of Object.entries(errs)) {
      if (field === "__all__") continue;
      const div   = $(`#error-id_${field}`);
      const input = $(`#id_${field}`);
      if (div) {
        div.innerHTML = arr.map((e) => iconErr(e.message)).join("<br>");
        div.classList.add("visible"); div.style.display = "block";
      }
      if (input) input.classList.add("input-error");
    }
  }

  const getCookie = (name) => {
    const cookie = document.cookie.split(";")
      .map((c) => c.trim()).find((c) => c.startsWith(name + "="));
    return cookie ? decodeURIComponent(cookie.split("=")[1]) : "";
  };

  const showError = (txt) => show(errBox, iconErr(txt));

  /* ───────── AUTOCOMPLETE CATEGORÍAS ───────── */
  let page = 1, loading = false, hasMore = true, term = "", timer;

  function fetchCats (q, p = 1) {
    if (loading || !hasMore) return;
    loading = true;

    fetch(`${categoriaAutocompleteUrl}?term=${encodeURIComponent(q)}&page=${p}`)
      .then((r) => r.json())
      .then((data) => {
        if (p === 1) catBox.innerHTML = "";

        if (data.results.length) {
          data.results.forEach((i) => {
            const opt = document.createElement("div");
            opt.className  = "autocomplete-option";
            opt.textContent = i.text;
            opt.dataset.id  = i.id;
            catBox.appendChild(opt);
          });
          hasMore = data.has_more;
        } else if (p === 1) {
          catBox.innerHTML =
            '<div class="autocomplete-no-result">No se encontraron resultados</div>';
          hasMore = false;
        }
        catBox.classList.add("visible");
      })
      .catch(console.error)
      .finally(() => loading = false);
  }

  if (catInput) {
    catInput.addEventListener("input", () => {
      term = catInput.value.trim();
      catHidden.value = "";
      hasMore = true; page = 1;
      clearTimeout(timer);
      timer = setTimeout(() => fetchCats(term, 1), 300);
    });

    catInput.addEventListener("focus", () => {
      term = catInput.value.trim();
      hasMore = true; page = 1;
      fetchCats(term, 1);
    });

    catBox.addEventListener("scroll", () => {
      if (catBox.scrollTop + catBox.clientHeight >= catBox.scrollHeight - 5) {
        if (hasMore && !loading) { page += 1; fetchCats(term, page); }
      }
    });

    catBox.addEventListener("click", (e) => {
      if (e.target.classList.contains("autocomplete-option")) {
        catInput.value  = e.target.textContent;
        catHidden.value = e.target.dataset.id;
        catBox.innerHTML = ""; catBox.classList.remove("visible"); hasMore = false;
      }
    });

    document.addEventListener("click", (e) => {
      if (!catInput.contains(e.target) && !catBox.contains(e.target)) {
        catBox.classList.remove("visible");
        catBox.innerHTML = "";
      }
    });
  }

  /* ───────── envío del formulario ───────── */
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    resetUI();

    /* validación local: categoría obligatoria */
    if (!catHidden.value) {
      show($("#error-id_categoria"), iconErr("Este campo es obligatorio."));
      $("#error-id_categoria").classList.add("visible");
      showError("Por favor corrige los errores del formulario.");
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
        body   : new FormData(form),
      });

      const data = await resp.json();

      if (data.success) {
        /* Guardamos UNA flash-message para la lista */
        sessionStorage.setItem(
          "flash-producto",
          `<i class="fas fa-check-circle"></i> Producto «${data.nombre}» actualizado correctamente.`
        );
        window.location.href = data.redirect_url;
        return;
      }
      /* errores de validación del servidor */
      renderErrors(
        typeof data.errors === "string" ? JSON.parse(data.errors) : data.errors
      );
    } catch (err) {
      console.error(err);
      showError("Ocurrió un error inesperado.");
    }
  });

  /* ───────── escáner de barras (opcional) ───────── */
  const scanBtn  = $("#btnEscanear"),
        viewport = $("#interactive");
  if (scanBtn && viewport && window.Quagga) {
    scanBtn.addEventListener("click", () => {
      viewport.style.display = "block";
      Quagga.init({
        inputStream: {
          type       : "LiveStream",
          target     : viewport,
          constraints: { facingMode: "environment" },
        },
        decoder: { readers: ["ean_reader"] },
        locate : true,
      }, (err) => {
        if (err) { console.error(err); return; }
        Quagga.start();
      });

      Quagga.onDetected((d) => {
        $("#id_codigo_de_barras").value = d.codeResult.code || "";
        Quagga.stop();
        viewport.style.display = "none";
      });
    });
  }
})();
