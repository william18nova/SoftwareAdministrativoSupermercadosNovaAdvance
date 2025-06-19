/* static/javascript/agregar_categorias.js */
(() => {
  "use strict";

  const $       = sel => document.querySelector(sel);
  const form    = $("#categoriaForm");
  const errBox  = $("#error-message");
  const okBox   = $("#success-message");
  const okText  = $("#success-text");

  const icon = txt => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const show = (el, html) => { el.innerHTML = html; el.style.display = "block"; };
  const hide = el         => { el.style.display = "none"; el.innerHTML = ""; };

  function resetUI () {
    hide(errBox); hide(okBox); okText.textContent = "";
    form.querySelectorAll(".field-error").forEach(div => {
      div.classList.remove("visible");
      div.innerHTML = "";
      div.style.display = "none";
    });
    form.querySelectorAll(".input-error").forEach(i => i.classList.remove("input-error"));
  }

  function renderErrors (errors){
    if (errors.__all__)
      show(errBox, errors.__all__.map(e => icon(e.message)).join("<br>"));

    for (const [field,msgArr] of Object.entries(errors)){
      if (field === "__all__") continue;
      const div   = document.getElementById(`error-id_${field}`);
      const input = document.getElementById(`id_${field}`);
      if (div){
        div.innerHTML = msgArr.map(e => icon(e.message)).join("<br>");
        div.classList.add("visible"); div.style.display="block";
      }
      if (input) input.classList.add("input-error");
    }
  }

  const csrftoken = document.cookie.split(";").map(c=>c.trim())
                     .find(c=>c.startsWith("csrftoken="))?.split("=")[1] || "";

  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    resetUI();

    try{
      const resp = await fetch(form.action,{
        method:"POST",
        headers:{
          "X-CSRFToken":csrftoken,
          "X-Requested-With":"XMLHttpRequest",
          "Accept":"application/json"
        },
        body:new FormData(form)
      });
      const data = await resp.json();

      if (data.success){
        okBox.innerHTML     = '<i class="fas fa-check-circle"></i> Categoría agregada exitosamente.';
        okBox.style.display = "flex";
        form.reset();
      }else{
        /* ← aquí la corrección */
        renderErrors(
          typeof data.errors === "string" ? JSON.parse(data.errors) : data.errors
        );
      }
    }catch(err){
      console.error(err);
      show(errBox, icon("Ocurrió un error inesperado."));
    }
  });
})();
