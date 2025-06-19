/* static/javascript/editar_sucursal.js */
(() => {
  "use strict";

  const $          = s => document.querySelector(s);
  const form       = $("#sucursalForm");
  const okBox      = $("#success-message");
  const errBox     = $("#error-message");
  const csrftoken  =
        document.cookie.split(";").map(c => c.trim())
               .find(c => c.startsWith("csrftoken="))?.split("=")[1] || "";

  /* --- helpers visibilidad --- */
  const icon = txt => `<i class="fas fa-exclamation-circle"></i> ${txt}`;

  const show = (el, html = "") => {
    el.innerHTML = html;
    el.style.display = "block";
    el.classList.add("visible");   // 👈 ahora sí
  };

  const hide = el => {
    el.style.display = "none";
    el.innerHTML     = "";
    el.classList.remove("visible"); // 👈
  };

  /* --- submit Ajax --- */
  form.addEventListener("submit", async ev => {
    ev.preventDefault();

    /* limpiar estado anterior */
    [okBox, errBox].forEach(hide);
    form.querySelectorAll(".input-error").forEach(i => i.classList.remove("input-error"));
    form.querySelectorAll(".field-error").forEach(hide);

    try {
      const resp = await fetch(form.action, {
        method : "POST",
        headers: {
          "X-CSRFToken"      : csrftoken,
          "X-Requested-With" : "XMLHttpRequest",
          "Accept"           : "application/json"
        },
        body : new FormData(form)
      });

      const data = await resp.json(); // ahora sí es JSON

      if (data.success) {
        if (data.redirect_url) {
          sessionStorage.setItem("flash-sucursal", "Sucursal actualizada correctamente.");
          window.location.href = data.redirect_url;
        } else {
          show(okBox, `<i class="fas fa-check-circle"></i> ${data.message || "Cambios guardados."}`);
        }
      } else {
        renderErrors(data.errors);
      }

    } catch (err) {
      console.error(err);
      show(errBox, icon("Ocurrió un error inesperado."));
    }
  });

  /* --- pintar errores de validación --- */
  function renderErrors(errors){
    if (errors.__all__) {
      show(errBox, errors.__all__.map(e => icon(e.message)).join("<br>"));
    }
    for (const [field, msgs] of Object.entries(errors)) {
      if (field === "__all__") continue;
      const input = document.getElementById(`id_${field}`);
      const div   = document.getElementById(`error-id_${field}`);
      if (input) input.classList.add("input-error");
      if (div)   show(div, msgs.map(e => icon(e.message)).join("<br>"));
    }
  }
})();
