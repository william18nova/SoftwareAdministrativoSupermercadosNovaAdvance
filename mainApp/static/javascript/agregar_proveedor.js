/* agregar_proveedor.js — versión “segura DOMContentLoaded” */
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* ---------- Helpers ---------- */
  const $id  = id  => document.getElementById(id);
  const $qsa = sel => document.querySelectorAll(sel);

  /* ---------- refs ---------- */
  const form   = $id("form-agregar-proveedor");
  if (!form) return;                 // si el ID cambiara, salimos

  const boxErr = $id("error-message");
  const boxOk  = $id("success-message");
  const okText = $id("success-text");

  /* ---------- UI helpers ---------- */
  const UI = {
    reset() {
      boxErr.style.display = boxOk.style.display = "none";
      boxErr.innerHTML = okText.textContent = "";

      $qsa(".field-error").forEach(d => {
        d.textContent = "";
        d.classList.remove("visible");
      });
      $qsa(".input-error").forEach(i => i.classList.remove("input-error"));
    },
    ok(msg) {
      okText.textContent  = msg;
      boxOk.style.display = "flex";
      form.reset();
    },
    errGlobal(msg) {
      boxErr.innerHTML    = msg;
      boxErr.style.display = "block";
    },
    errFields(errObj = {}) {
      Object.entries(errObj).forEach(([field, list]) => {
        const div = $id(`error-id_${field}`);
        if (!div) return;
        div.innerHTML = list
          .map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`)
          .join("<br>");
        div.classList.add("visible");

        const inp = $id(`id_${field}`);
        if (inp) inp.classList.add("input-error");
      });
    }
  };

  /* ---------- CSRF ---------- */
  const getCookie = name =>
    document.cookie.split("; ")
      .find(c => c.startsWith(name + "="))
      ?.split("=")[1] || "";

  /* ---------- submit ---------- */
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    UI.reset();

    try {
      const resp = await fetch(form.action, {
        method : "POST",
        headers: {
          "X-CSRFToken": getCookie("csrftoken"),
          Accept       : "application/json"
        },
        body: new FormData(form)
      });
      const data = await resp.json();

      if (resp.ok && data.success) {
        UI.ok(data.message || "Proveedor agregado.");
      } else {
        UI.errFields(data.errors);
        if (data.errors?.__all__)
          UI.errGlobal(data.errors.__all__.map(e => e.message).join("<br>"));
      }
    } catch (err) {
      console.error(err);
      UI.errGlobal("Ocurrió un error inesperado.");
    }
  });
});
