/*  static/javascript/agregar_usuario.js
    — Patrón “agregar_producto.js”: debounce + caché + resaltado de errores — */
(() => {
  "use strict";

  /* ----- helpers DOM / CSRF ----- */
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const csrftoken = document.cookie.split(";").map(c=>c.trim())
                     .find(c=>c.startsWith("csrftoken="))?.split("=")[1] || "";

  const icon   = txt => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const okIcon = txt => `<i class="fas fa-check-circle"></i> ${txt}`;

  const show = (el, html) => { el.innerHTML = html; el.style.display = "block"; };
  const hide = el         => { el.style.display = "none"; el.innerHTML = ""; };

  /* ----- refs ----- */
  const form   = $("#usuarioForm"),
        okBox  = $("#success-message"),
        errBox = $("#error-message");

  const rolInp   = $("#id_rol_autocomplete"),
        rolHid   = $("#id_rolid"),
        rolBox   = $("#rol-autocomplete-results");

  /* ====================================================================== */
  /* 1. AUTOCOMPLETE “ROL”                                                  */
  /* ====================================================================== */
  let term="", page=1, more=true, busy=false, debounce;
  const cache = Object.create(null);

  function resetBox(){ rolBox.innerHTML=""; rolBox.classList.remove("visible"); page=1; more=true; busy=false; }

  function fetchRol(){
    if (busy || !more) return;
    busy = true;

    const key = `${term}_${page}`;
    const handler = data => {
      if (page===1) rolBox.innerHTML="";
      data.results.forEach(o=>{
        rolBox.insertAdjacentHTML("beforeend",
          `<div class="autocomplete-option" data-id="${o.id}">${o.text}</div>`);
      });
      if (!data.results.length && page===1){
        rolBox.innerHTML = '<div class="autocomplete-no-result">Sin resultados</div>';
      }
      more = data.has_more; busy=false; rolBox.classList.add("visible");
    };

    if (cache[key]) { handler(cache[key]); return; }

    fetch(`${rolAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`)
      .then(r=>r.json()).then(json=>{ cache[key]=json; handler(json); })
      .catch(()=>busy=false);
  }

  rolInp.addEventListener("input", e=>{
    term = e.target.value.trim(); page=1; more=true; rolHid.value="";
    clearTimeout(debounce); debounce = setTimeout(fetchRol, 300);
  });
  rolInp.addEventListener("focus", ()=>{ if (!rolBox.childElementCount) fetchRol(); });

  rolBox.addEventListener("scroll", ()=>{
    if (rolBox.scrollTop + rolBox.clientHeight >= rolBox.scrollHeight - 4 && more && !busy){
      page++; fetchRol();
    }
  });

  rolBox.addEventListener("click", e=>{
    const opt = e.target.closest(".autocomplete-option");
    if (!opt) return;
    rolInp.value  = opt.textContent;
    rolHid.value  = opt.dataset.id;
    resetBox();
  });

  document.addEventListener("click", e=>{
    if (!rolInp.contains(e.target) && !rolBox.contains(e.target)) resetBox();
  });

  /* ====================================================================== */
  /* 2. TOGGLE PASSWORD VISIBILITY                                          */
  /* ====================================================================== */
  window.togglePassword = id => {
    const inp  = document.getElementById(id);
    const icon = inp.nextElementSibling;
    if (!inp) return;
    if (inp.type === "password") {
      inp.type = "text";  icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
      inp.type = "password"; icon.classList.replace("fa-eye-slash", "fa-eye");
    }
  };

  /* ====================================================================== */
  /* 3. SUBMIT (AJAX)                                                       */
  /* ====================================================================== */
  form.addEventListener("submit", async ev=>{
    ev.preventDefault();

    /* limpiar estado anterior */
    [okBox, errBox].forEach(hide);
    $$(".field-error").forEach(div=>{ div.innerHTML=""; div.classList.remove("visible"); });
    $$(".input-error").forEach(i=>i.classList.remove("input-error"));

    /* mínimo: rol seleccionado */
    if (!rolHid.value){
      show($("#error-id_rolid"), icon("Seleccione un rol.")); $("#error-id_rolid").classList.add("visible");
      show(errBox, icon("Corrige los errores antes de continuar."));
      return;
    }

    try{
      const resp = await fetch(form.action,{
        method : "POST",
        headers: { "X-CSRFToken": csrftoken, "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" },
        body   : new FormData(form)
      });
      const data = await resp.json();

      if (data.success){
        show(okBox, okIcon("Usuario creado exitosamente.")); okBox.style.display="flex";
        form.reset(); resetBox(); return;
      }
      renderErrors(data.errors);

    }catch(err){
      console.error(err);
      show(errBox, icon("Ocurrió un error inesperado."));
    }
  });

  function renderErrors(errorsJSON){
    const errors = typeof errorsJSON === "string" ? JSON.parse(errorsJSON) : errorsJSON;
    if (errors.__all__) show(errBox, errors.__all__.map(e=>icon(e.message)).join("<br>"));
    Object.entries(errors).forEach(([field,arr])=>{
      if (field==="__all__") return;
      const div   = $("#error-id_"+field);
      const input = $("#id_"+field);
      if (div){ div.innerHTML = arr.map(e=>icon(e.message)).join("<br>"); div.classList.add("visible"); }
      if (input){ input.classList.add("input-error"); }
    });
  }
})();
