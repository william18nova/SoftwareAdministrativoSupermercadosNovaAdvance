/* editar_proveedor.js – versión paralela a agregar_proveedor.js */
(() => {
  "use strict";

  /* ---------- helpers DOM ---------- */
  const $id  = id  => document.getElementById(id);
  const $qsa = sel => document.querySelectorAll(sel);

  /* ---------- refs ---------- */
  const form   = $id("form-editar-proveedor");
  const boxErr = $id("error-message");
  const boxOk  = $id("success-message");
  const okTxt  = $id("success-text");

  /* ---------- UI helpers ---------- */
  const UI = {
    reset() {
      boxErr.style.display = "none";
      boxErr.innerHTML     = "";
      boxOk .style.display = "none";
      okTxt.textContent    = "";

      $qsa(".field-error").forEach(div => {
        div.innerHTML = "";
        div.classList.remove("visible");
      });
      $qsa(".input-error").forEach(inp => inp.classList.remove("input-error"));
    },
    errGlobal(msg) {
      boxErr.innerHTML   = msg;
      boxErr.style.display = "block";
    },
    errFields(errors) {
      Object.entries(errors).forEach(([field, arr]) => {
        const div = $id(`error-id_${field}`);
        if (!div) return;

        div.innerHTML = arr
          .map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`)
          .join("<br>");
        div.classList.add("visible");

        const input = $id(`id_${field}`);
        input?.classList.add("input-error");
      });
    },
  };

  /* ---------- CSRF ---------- */
  const getCSRF = () =>
    document.cookie
      .split("; ")
      .find(c => c.startsWith("csrftoken="))
      ?.split("=")[1] || "";

  /* ---------- submit ---------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    UI.reset();

    try {
      const resp = await fetch(form.action, {
        method : "POST",
        headers: { "X-CSRFToken": getCSRF(), Accept: "application/json" },
        body   : new FormData(form),
      });
      const data = await resp.json();

      if (data.success) {
        /* flash en sessionStorage y redirección */
        sessionStorage.setItem(
          "flash-prov",
          "Proveedor actualizado exitosamente."
        );
        window.location.href = data.redirect_url;
      } else {
        UI.errFields(data.errors || {});
        if (data.errors?.__all__) {
          UI.errGlobal(
            data.errors.__all__.map(e => e.message).join("<br>")
          );
        }
      }
    } catch (err) {
      console.error(err);
      UI.errGlobal("Ocurrió un error inesperado.");
    }
  });
})();
