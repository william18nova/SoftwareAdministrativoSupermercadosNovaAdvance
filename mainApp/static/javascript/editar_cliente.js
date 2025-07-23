/*  editar_cliente.js
    (versión con errores por campo)
    ──────────────────────────────────────────────── */
(() => {
  "use strict";

  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const form   = $("#clienteForm");
  const okBox  = $("#success-message");
  const errBox = $("#error-message");

  const csrftoken =
    document.cookie.split(";")
      .map(c => c.trim())
      .find(c => c.startsWith("csrftoken="))
      ?.split("=")[1] || "";

  /* ───────── helpers ───────── */
  const iErr = t => `<i class="fas fa-exclamation-circle"></i> ${t}`;
  const iOk  = t => `<i class="fas fa-check-circle"></i> ${t}`;

  const hide = el => {
    if (!el) return;
    el.style.display = "none";
    el.innerHTML     = "";
    el.classList.remove("visible");
  };
  const show = (el, html) => {
    if (!el) return;
    el.innerHTML = html;
    el.style.display = "block";
    el.classList.add("visible");
  };

  function resetUI() {
    hide(errBox); hide(okBox);
    $$(".field-error").forEach(hide);
    $$(".input-error").forEach(inp => inp.classList.remove("input-error"));
  }

  function toObj(errors) {
    return (typeof errors === "string") ? JSON.parse(errors) : errors;
  }

  /* pinta errores globales + por campo */
  function renderErrors(raw) {
    const errs = toObj(raw);

    if (errs.__all__) {
      show(errBox, errs.__all__.map(e => iErr(e.message)).join("<br>"));
    }
    Object.entries(errs).forEach(([field, arr]) => {
      if (field === "__all__") return;
      const inp = $(`#id_${field}`);
      const div = $(`#error-id_${field}`);
      if (inp) inp.classList.add("input-error");
      if (div) show(div, arr.map(e => iErr(e.message)).join("<br>"));
    });
  }

  /* ───────── submit AJAX ───────── */
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    resetUI();

    try {
      const res = await fetch(form.action, {
        method : "POST",
        headers: {
          "X-CSRFToken"     : csrftoken,
          "X-Requested-With": "XMLHttpRequest",
          "Accept"          : "application/json",
        },
        body   : new FormData(form)
      });
      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem("flash-cliente", "Cliente editado correctamente.");
        window.location.href = data.redirect_url;
      } else {
        renderErrors(data.errors);
      }
    } catch (e) {
      console.error(e);
      show(errBox, iErr("Error de red o servidor."));
    }
  });

  /* ───────── limpiar error on-input ───────── */
  $$("#clienteForm input").forEach(inp => {
    inp.addEventListener("input", () => {
      if (inp.classList.contains("input-error")) {
        inp.classList.remove("input-error");
        hide($(`#error-id_${inp.id.replace("id_", "")}`));
        hide(errBox);
      }
    });
  });
})();
