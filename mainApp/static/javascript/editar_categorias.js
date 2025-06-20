/* static/javascript/editar_categorias.js
   ⇢ Versión alineada con “agregar” — muestra los mensajes correctamente      */

(() => {
  "use strict";

  /* ----------- utilidades DOM ----------- */
  const $ = s => document.querySelector(s);

  const form      = $("#categoriaEditForm");
  const errBox    = $("#error-message");
  const okBox     = $("#success-message");   /* (no se usa, pero lo limpiamos) */
  const csrftoken = document.cookie
                      .split(";")
                      .map(c => c.trim())
                      .find(c => c.startsWith("csrftoken="))
                      ?.split("=")[1] || "";

  const icon = txt => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const show = (el, html) => { el.innerHTML = html; el.style.display = "block"; };
  const hide = el         => { el.style.display = "none"; el.innerHTML = "";   };

  /* ----------- limpiar interfaz antes de cada submit ----------- */
  function resetUI () {
    hide(errBox); hide(okBox);

    form.querySelectorAll(".field-error").forEach(div => {
      div.classList.remove("visible");
      div.innerHTML = "";
      div.style.display = "none";
    });
    form.querySelectorAll(".input-error").forEach(i => i.classList.remove("input-error"));
  }

  /* ----------- pintar errores de validación ----------- */
  function renderErrors (errors){
    /* globales */
    if (errors.__all__)
      show(errBox, errors.__all__.map(e => icon(e.message)).join("<br>"));

    /* por-campo */
    for (const [field,msgArr] of Object.entries(errors)){
      if (field === "__all__") continue;
      const div   = document.getElementById(`error-id_${field}`);
      const input = document.getElementById(`id_${field}`);

      if (div){
        div.innerHTML = msgArr.map(e => icon(e.message)).join("<br>");
        div.classList.add("visible");
        div.style.display = "block";
      }
      if (input) input.classList.add("input-error");
    }
  }

  /* ----------- envío AJAX ----------- */
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    resetUI();

    try{
      const resp = await fetch(form.action,{
        method:"POST",
        headers:{
          "X-CSRFToken"      : csrftoken,
          "X-Requested-With" : "XMLHttpRequest",
          "Accept"           : "application/json"
        },
        body:new FormData(form)
      });
      const data = await resp.json();

      if (data.success){
        /* flash-message para la tabla de categorías */
        sessionStorage.setItem(
          "flash-categoria",
          `Categoría «${form.nombre.value}» actualizada correctamente.`
        );
        /* redirección al listado */
        window.location.href = data.redirect_url;
        return;
      }

      /* errores → asegurarse de que es objeto (el backend puede enviar string) */
      const errs = typeof data.errors === "string" ? JSON.parse(data.errors) : data.errors;
      renderErrors(errs);

    }catch(err){
      console.error(err);
      show(errBox, icon("Ocurrió un error inesperado."));
    }
  });
})();
