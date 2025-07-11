/*  static/javascript/agregar_rol.js
    ──────────────────────────────────────────────────
    Misma lógica que “agregar_sucursal.js”:
      · envíos AJAX
      · resaltado .input-error en rojo
      · alertas globales & de campo
----------------------------------------------------*/
(() => {
  "use strict";

  /* ---------- helpers ---------- */
  const $        = s => document.querySelector(s);
  const iconErr  = txt => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const iconOk   = txt => `<i class="fas fa-check-circle"></i> ${txt}`;

  const form       = $("#rolForm");
  const divError   = $("#error-message");
  const divSuccess = $("#success-message");
  const fieldErrs  = document.querySelectorAll(".field-error");
  const inputs     = form.querySelectorAll("input, textarea");

  /* ---------- UI helpers ---------- */
  const hide = el => { el.style.display = "none"; el.innerHTML = ""; };
  const show = (el, html) => { el.innerHTML = html; el.style.display = "block"; };

  function clearAll() {
    hide(divError); hide(divSuccess);
    fieldErrs.forEach(hide);
    inputs.forEach(i => i.classList.remove("input-error"));
  }

  function showFieldError(name, html) {
    const errBox = document.getElementById(`error-${name}`);
    const inp    = document.getElementById(`id_${name}`);
    if (errBox) show(errBox, html);
    if (inp)    inp.classList.add("input-error");
  }

  /* ---------- submit ---------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    clearAll();

    try {
      const resp = await fetch(form.action, {
        method : "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body   : new FormData(form)
      });
      const data = await resp.json();

      if (resp.ok && data.success) {
        show(divSuccess, iconOk(data.message));
        form.reset();
      } else {
        const errs = data.errors || {};
        if (errs.__all__) {
          show(divError, errs.__all__.map(e => iconErr(e.message)).join("<br>"));
        }
        Object.entries(errs).forEach(([field, arr]) => {
          if (field === "__all__") return;
          showFieldError(field, arr.map(e => iconErr(e.message)).join("<br>"));
        });
      }
    } catch (err) {
      console.error(err);
      show(divError, iconErr("Error de red. Inténtalo nuevamente."));
    }
  });

  /* ---------- quitar resaltado en tiempo real ---------- */
  inputs.forEach(inp => {
    inp.addEventListener("input", () => {
      if (inp.classList.contains("input-error")) {
        inp.classList.remove("input-error");
        const box = document.getElementById(`error-${inp.id.replace("id_", "")}`);
        if (box) hide(box);
        hide(divError);
      }
    });
  });
})();
