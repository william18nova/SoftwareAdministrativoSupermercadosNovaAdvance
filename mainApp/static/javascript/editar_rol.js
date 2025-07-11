/*  editar_rol.js
    ──────────────────────────────────────────────────────────
    • AJAX Submit idéntico al usado en “Editar Sucursal”
    • Resaltado de campos .input-error
----------------------------------------------------------------*/
(() => {
  "use strict";

  const $   = s => document.querySelector(s);
  const $$  = s => document.querySelectorAll(s);

  const form   = $("#rolForm");
  const okBox  = $("#success-message");
  const errBox = $("#error-message");

  const csrftoken =
    document.cookie.split(";").map(c => c.trim())
           .find(c => c.startsWith("csrftoken="))?.split("=")[1] || "";

  /* ---------- helpers ---------- */
  const icon = t => `<i class="fas fa-exclamation-circle"></i> ${t}`;

  const show = (el, html) => {
    el.innerHTML = html;
    el.style.display = "block";
    el.classList.add("visible");
  };
  const hide = el => {
    el.style.display = "none";
    el.innerHTML     = "";
    el.classList.remove("visible");
  };
  const clear = () => {
    [okBox, errBox].forEach(hide);
    $$(".field-error").forEach(hide);
    $$(".input-error").forEach(i => i.classList.remove("input-error"));
  };

  /* ---------- submit ---------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    clear();

    try{
      const resp = await fetch(form.action, {
        method : "POST",
        headers: {
          "X-CSRFToken"      : csrftoken,
          "X-Requested-With" : "XMLHttpRequest",
          "Accept"           : "application/json",
        },
        body : new FormData(form)
      });
      const data = await resp.json();

      if(data.success){
        if(data.redirect_url){
          sessionStorage.setItem("flash-rol", "Rol actualizado correctamente.");
          window.location.href = data.redirect_url;
        }else{
          show(okBox, `<i class="fas fa-check-circle"></i> ${data.message}`);
        }
      }else{
        renderErrors(data.errors);
      }
    }catch(err){
      console.error(err);
      show(errBox, icon("Ocurrió un error inesperado."));
    }
  });

  /* ---------- pintar errores ---------- */
  function renderErrors(errors){
    if(errors.__all__){
      show(errBox, errors.__all__.map(e=>icon(e.message)).join("<br>"));
    }
    Object.entries(errors).forEach(([field,msgs])=>{
      if(field==="__all__") return;
      const input = document.getElementById(`id_${field}`);
      const div   = document.getElementById(`error-id_${field}`);
      if(input) input.classList.add("input-error");
      if(div)   show(div, msgs.map(e=>icon(e.message)).join("<br>"));
    });
  }

  /* ---------- limpiar error al teclear ---------- */
  $$("#rolForm input, #rolForm textarea").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      if(inp.classList.contains("input-error")){
        inp.classList.remove("input-error");
        const div = document.getElementById(`error-id_${inp.id.replace("id_","")}`);
        if(div) hide(div);
        hide(errBox);
      }
    });
  });
})();
