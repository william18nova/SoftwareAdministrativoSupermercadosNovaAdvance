/* static/javascript/agregar_sucursal.js
   — versión con resaltado de input, idéntico al usado en “Editar Sucursal” — */
(() => {
  "use strict";

  /* -----------------  helpers ----------------- */
  const $ = s => document.querySelector(s);

  const form         = $("#sucursalForm");
  const errorDiv     = $("#error-message");
  const successDiv   = $("#success-message");
  const successText  = $("#success-text");
  const fieldErrors  = document.querySelectorAll(".field-error");
  const inputs       = form.querySelectorAll("input, textarea");

  const icon  = txt => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const okIcon= txt => `<i class="fas fa-check-circle success-icon"></i> ${txt}`;

  const show = (div, html, flex = false) => {
    div.innerHTML     = html;
    div.style.display = flex ? "flex" : "block";
    div.classList.add("visible");
  };
  const hide = div => {
    div.style.display = "none";
    div.innerHTML     = "";
    div.classList.remove("visible");
  };

  /* -----------------  limpieza ----------------- */
  function clearAll() {
    hide(errorDiv);
    hide(successDiv);
    fieldErrors.forEach(hide);
    inputs.forEach(i => i.classList.remove("input-error"));
  }

  /* -----------------  errores de campo ----------------- */
  function showFieldError(field, html) {
    const div   = document.getElementById(`error-${field}`);
    const input = document.getElementById(`id_${field}`); // <-- Django genera id_{field}

    if (div)  show(div, html);
    if (input) input.classList.add("input-error");
  }

  /* -----------------  evento submit ----------------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    clearAll();

    try {
      const resp  = await fetch(form.action, {
        method : "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body   : new FormData(form)
      });
      const data = await resp.json();

      if (resp.ok && data.success) {
        show(successDiv, okIcon(data.message), true);
        form.reset();
      } else {
        const errs = data.errors || {};
        if (errs.__all__) {
          show(errorDiv, errs.__all__.map(e => icon(e.message)).join("<br>"));
        }
        Object.keys(errs).forEach(field => {
          if (field === "__all__") return;
          const html = errs[field]
              .map(e => icon(e.message))
              .join("<br>");
          showFieldError(field, html);
        });
      }
    } catch (err) {
      console.error(err);
      show(errorDiv, icon("Error de red. Inténtalo de nuevo."));
    }
  });

  /* -----------------  quitar resaltado al teclear ----------------- */
  inputs.forEach(input => {
    input.addEventListener("input", () => {
      if (input.classList.contains("input-error")) {
        input.classList.remove("input-error");
        const field        = input.id.replace("id_", "");
        const errContainer = document.getElementById(`error-${field}`);
        if (errContainer) hide(errContainer);
        hide(errorDiv); // opcional: cierra alerta global al empezar a corregir
      }
    });
  });
})();
