/* static/javascript/agregar_producto.js */
(() => {
  "use strict";

  /* ---------- helpers ---------- */
  const $   = sel => document.querySelector(sel);
  const $$  = sel => document.querySelectorAll(sel);
  const csrftoken =
        document.cookie.split(";").map(c => c.trim())
        .find(c => c.startsWith("csrftoken="))?.split("=")[1] || "";

  const icon = txt => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const show = (el, html) => { el.innerHTML = html; el.style.display = "block"; };
  const hide = el         => { el.style.display = "none"; el.innerHTML = ""; };

  /* ---------- elementos ---------- */
  const form   = $("#productoForm");
  const okBox  = $("#success-message");
  const errBox = $("#error-message");

  const catInput   = $("#id_categoria_autocomplete");
  const catHidden  = $("#id_categoria");
  const catResult  = $("#categoria-autocomplete-results");

  /* ──────────── 1. AUTOCOMPLETE  ──────────── */
  let debounce, page=1, term="", more=true, busy=false;

  function resetAutocomplete(){
    catResult.innerHTML = ""; catResult.classList.remove("visible");
    page=1; more=true; busy=false;
  }

  function fetchCats(){     /* paginado */
    if (busy || !more) return;
    busy = true;
    fetch(`${categoriaAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`)
      .then(r => r.json())
      .then(data => {
        if (page===1) catResult.innerHTML="";
        data.results.forEach(o=>{
          const div = document.createElement("div");
          div.className="autocomplete-option";
          div.dataset.id = o.id;
          div.textContent = o.text;
          catResult.appendChild(div);
        });
        if (!data.results.length && page===1){
          catResult.innerHTML = '<div class="autocomplete-no-result">Sin resultados</div>';
        }
        more = data.has_more; busy=false;
        catResult.classList.add("visible");
      })
      .catch(()=>busy=false);
  }

  catInput.addEventListener("input", e=>{
    term = e.target.value.trim(); page=1; more=true; catHidden.value="";
    clearTimeout(debounce); debounce=setTimeout(fetchCats,300);
  });
  catInput.addEventListener("focus", ()=>{ if (!catResult.childElementCount) fetchCats(); });

  /* scroll infinito */
  catResult.addEventListener("scroll", ()=>{
    if (catResult.scrollTop + catResult.clientHeight >= catResult.scrollHeight - 5){
      if (more && !busy){ page++; fetchCats(); }
    }
  });

  /* seleccionar */
  catResult.addEventListener("click", e=>{
    if (e.target.classList.contains("autocomplete-option")){
      catInput.value  = e.target.textContent;
      catHidden.value = e.target.dataset.id;
      resetAutocomplete();
    }
  });
  document.addEventListener("click", e=>{
    if (!catInput.contains(e.target) && !catResult.contains(e.target)) resetAutocomplete();
  });

  /* ──────────── 2. FORM SUBMIT  ──────────── */
  form.addEventListener("submit", async ev=>{
    ev.preventDefault();

    /* limpiar UI previa */
    [okBox, errBox].forEach(hide);
    $$(".field-error").forEach(div=>{ div.innerHTML=""; div.classList.remove("visible"); });
    $$(".input-error").forEach(i=>i.classList.remove("input-error"));

    /* validación simple de categoría */
    if (!catHidden.value){
      show($("#error-id_categoria"), icon("Selecciona una categoría"));
      $("#error-id_categoria").classList.add("visible");
      show(errBox, icon("Por favor corrige los errores."));
      return;
    }

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
        show(okBox,'<i class="fas fa-check-circle"></i> Producto agregado correctamente.');
        okBox.style.display="flex";
        form.reset(); resetAutocomplete();
        return;
      }
      /* ---------- errores ---------- */
      renderErrors( typeof data.errors === "string" ? JSON.parse(data.errors) : data.errors );

    }catch(err){
      console.error(err);
      show(errBox, icon("Ocurrió un error inesperado."));
    }
  });

  function renderErrors(errors){
    if (errors.__all__) show(errBox, errors.__all__.map(e=>icon(e.message)).join("<br>"));
    Object.entries(errors).forEach(([field,msgs])=>{
      if (field==="__all__") return;
      const div   = $("#error-id_"+field);
      const input = $("#id_"+field);
      if (div){
        div.innerHTML = msgs.map(e=>icon(e.message)).join("<br>");
        div.classList.add("visible");
      }
      if (input) input.classList.add("input-error");
    });
  }
})();
