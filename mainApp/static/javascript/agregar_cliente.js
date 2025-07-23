/*  static/javascript/agregar_cliente.js
    ─────────────────────────────────────────────────────────
    · Envío AJAX
    · Errores de campo + globales
    · Flashes de éxito / error
    · Misma UX que agregar_rol.js
----------------------------------------------------------*/
(() => {
  "use strict";

  const $          = s => document.querySelector(s);
  const form       = $("#form-agregar-cliente");
  const divError   = $("#error-message");
  const divSuccess = $("#success-message");
  const inputs     = form.querySelectorAll("input");

  const iconErr = t => `<i class="fas fa-exclamation-circle"></i> ${t}`;
  const iconOk  = t => `<i class="fas fa-check-circle"></i> ${t}`;
  const hide    = el => { el.style.display="none"; el.innerHTML=""; };
  const show    = (el,html)=>{ el.innerHTML=html; el.style.display="block"; };

  function clearAll(){
    hide(divError); hide(divSuccess);
    form.querySelectorAll(".field-error").forEach(hide);
    inputs.forEach(i=>i.classList.remove("input-error"));
  }
  function showFieldErr(name, html){
    const errBox = $(`#error-${name}`);
    const inp    = $(`#id_${name}`);
    if(errBox) show(errBox, html);
    if(inp)    inp.classList.add("input-error");
  }

  form.addEventListener("submit", async ev=>{
    ev.preventDefault(); clearAll();

    try{
      const resp = await fetch(form.action,{
        method : "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body   : new FormData(form)
      });
      const data = await resp.json();

      if(resp.ok && data.success){
        show(divSuccess, iconOk("Cliente agregado exitosamente."));
        form.reset();
      }else{
        const errs = data.errors || {};
        if(errs.__all__)
          show(divError, errs.__all__.map(e=>iconErr(e.message)).join("<br>"));
        Object.entries(errs).forEach(([f,arr])=>{
          if(f==="__all__") return;
          showFieldErr(f, arr.map(e=>iconErr(e.message)).join("<br>"));
        });
      }
    }catch(ex){
      console.error(ex);
      show(divError, iconErr("Error de red. Inténtalo nuevamente."));
    }
  });

  /* quita el resaltado “on-the-fly” */
  inputs.forEach(inp=>{
    inp.addEventListener("input", ()=>{
      if(inp.classList.contains("input-error")){
        inp.classList.remove("input-error");
        hide($(`#error-${inp.name}`));
        hide(divError);
      }
    });
  });
})();
