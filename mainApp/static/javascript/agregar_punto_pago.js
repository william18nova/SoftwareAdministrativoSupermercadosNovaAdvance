/*  static/javascript/agregar_punto_pago.js
    ────────────────────────────────────────────────────────────
    · Autocomplete con scroll infinito + caché
    · DataTable responsive (card-view ≤ 768 px)
    · Cada <td> recibe data-label para que los encabezados
      sean visibles en la vista móvil
    · Guardado vía AJAX
----------------------------------------------------------------*/
(() => {
  "use strict";

  /* ───── helpers DOM ───── */
  const $id  = id => document.getElementById(id);
  const $qs  = s  => document.querySelector(s);
  const $qsa = s  => document.querySelectorAll(s);

  /* ───── referencias ───── */
  const dom = {
    form   : $id("puntoPagoForm"),

    sucInp : $id("id_sucursal_autocomplete"),
    sucHid : $id("id_sucursal"),
    sucBox : $id("sucursal-autocomplete-results"),

    nomInp : $id("id_nombre"),
    desInp : $id("id_descripcion"),
    cajaInp: $id("id_dinerocaja"),

    btnAdd : $id("agregarPuntoPagoBtn"),
    tbody  : $id("puntos-pago-body"),
    hidden : $id("id_puntos_temp"),

    alertErr: $id("error-message"),
    alertOk : $id("success-message"),
  };

  /* ───── DataTable + labels ───── */
  const COL_LABELS = ["Nombre", "Descripción", "Dinero en Caja", "Acciones"];

  const dt = $("#puntos-pago-list").DataTable({
    paging:false, searching:true, info:false, responsive:true,
    language:{
      search:"Buscar:",
      zeroRecords:"No se encontraron resultados",
      emptyTable:"No hay puntos de pago para mostrar"
    }
  });

  /** Añade data-label a cada <td> de la fila recibida */
  function setDataLabels($row){
    $row.find("td").each((i,td)=>td.setAttribute("data-label", COL_LABELS[i]||""));
  }

  /* ───── estado ───── */
  const state = {
    suc  : { page:1, term:"", loading:false, more:true },
    items: []   // [{nombre, descripcion, dinerocaja}]
  };

  /* ───── UI helpers ───── */
  const UI = {
    clearAlerts(){
      [dom.alertErr, dom.alertOk].forEach(a=>{ a.style.display="none"; a.innerHTML=""; });
    },
    ok(msg){
      dom.alertOk.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
      dom.alertOk.style.display="block";
    },
    err(msg){
      dom.alertErr.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
      dom.alertErr.style.display="block";
    },
    clearFieldErr(){
      $qsa(".field-error").forEach(d=>{ d.classList.remove("visible"); d.innerHTML=""; });
      $qsa(".input-error").forEach(i=>i.classList.remove("input-error"));
    },
    fErr(field,msg){
      const box = $qs(`#error-id_${field}`);
      if(box){
        box.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        box.classList.add("visible");
      }
      const map = {sucursal:dom.sucInp, nombre:dom.nomInp};
      (map[field]||null)?.classList.add("input-error");
    }
  };

  /* ───── cache + utils ───── */
  const cSuc = Object.create(null);
  const fetchCached = async(url,cache)=>{
    if(cache[url]) return cache[url];
    const r = await fetch(url); const j = await r.json();
    cache[url]=j; return j;
  };
  const debounce = (fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};

  /* ───── Autocomplete Sucursal ───── */
  const renderSuc = async()=>{
    const st = state.suc;
    if(st.loading || !st.more) return;
    st.loading = true;

    const qs = new URLSearchParams({term:st.term,page:st.page});
    const data = await fetchCached(`${sucursalAutocompleteUrl}?${qs}`, cSuc);

    if(st.page===1) dom.sucBox.innerHTML="";
    if(data.results.length){
      data.results.forEach(r=>{
        const d=document.createElement("div");
        d.className="autocomplete-option"; d.dataset.id=r.id; d.textContent=r.text;
        dom.sucBox.appendChild(d);
      });
      st.more = data.has_more;
    }else if(st.page===1){
      dom.sucBox.innerHTML='<div class="autocomplete-no-result">No se encontraron resultados</div>';
      st.more=false;
    }
    dom.sucBox.style.display="block";
    st.loading=false;
  };

  const debSuc = debounce(()=>{ state.suc.page=1; state.suc.more=true; renderSuc(); });

  dom.sucInp.addEventListener("input",()=>{
    dom.sucHid.value=""; state.suc.term=dom.sucInp.value.trim();
    if(!state.suc.term){ dom.sucBox.style.display="none"; return; }
    debSuc();
  });
  dom.sucInp.addEventListener("focus",()=>{
    state.suc.term=dom.sucInp.value.trim(); state.suc.page=1; state.suc.more=true; renderSuc();
  });
  dom.sucBox.addEventListener("scroll",()=>{
    if(dom.sucBox.scrollTop+dom.sucBox.clientHeight>=dom.sucBox.scrollHeight-4 && state.suc.more && !state.suc.loading){
      state.suc.page++; renderSuc();
    }
  });
  dom.sucBox.addEventListener("click",e=>{
    const opt=e.target.closest(".autocomplete-option"); if(!opt) return;
    dom.sucInp.value=opt.textContent; dom.sucHid.value=opt.dataset.id;
    dom.sucBox.style.display="none";
  });
  document.addEventListener("click",e=>{
    if(!dom.sucInp.contains(e.target)&&!dom.sucBox.contains(e.target)) dom.sucBox.style.display="none";
  });

  /* ───── Agregar punto de pago ───── */
  dom.btnAdd.addEventListener("click",()=>{
    UI.clearAlerts(); UI.clearFieldErr();

    const sid  = dom.sucHid.value.trim();
    const nombre = dom.nomInp.value.trim();
    const descr  = dom.desInp.value.trim();
    const caja   = dom.cajaInp.value.trim() || "0";

    let bad=false;
    if(!sid){ UI.fErr("sucursal","Debe seleccionar una sucursal."); bad=true; }
    if(!nombre){ UI.fErr("nombre","El nombre es obligatorio."); bad=true; }
    if(bad) return;

    if(state.items.some(i=>i.nombre.toLowerCase()===nombre.toLowerCase())){
      UI.fErr("nombre","Ese nombre ya está en la lista."); return;
    }

    state.items.push({nombre,descripcion:descr,dinerocaja:caja});

    const newRowNode = dt.row.add([
      nombre,
      descr,
      caja,
      `<button type="button" class="btn-eliminar" data-nombre="${nombre}">
         <i class="fas fa-trash-alt"></i>
       </button>`
    ]).draw(false).node();
    setDataLabels($(newRowNode));

    dom.nomInp.value=""; dom.desInp.value=""; dom.cajaInp.value="";
  });

  /* ───── Eliminar ───── */
  dom.tbody.addEventListener("click",e=>{
    const btn=e.target.closest(".btn-eliminar"); if(!btn) return;
    const nombre=btn.dataset.nombre.toLowerCase();
    dt.row(btn.closest("tr")).remove().draw(false);
    state.items = state.items.filter(i=>i.nombre.toLowerCase()!==nombre);
  });

  /* ───── Submit ───── */
  dom.form.addEventListener("submit",async ev=>{
    ev.preventDefault(); UI.clearAlerts(); UI.clearFieldErr();

    if(!state.items.length){
      UI.err("Debe agregar al menos un punto de pago."); return;
    }

    dom.hidden.value = JSON.stringify(state.items);

    try{
      const r = await fetch(dom.form.action,{
        method:"POST",
        headers:{
          "X-CSRFToken":document.cookie.split(";").find(c=>c.trim().startsWith("csrftoken="))?.split("=")[1]||"",
          Accept:"application/json"
        },
        body:new FormData(dom.form)
      });
      const data = await r.json();

      if(data.success){
        UI.ok("Puntos de pago agregados exitosamente.");
        dom.form.reset(); dt.clear().draw(); state.items=[];
        dom.sucBox.style.display="none"; Object.keys(cSuc).forEach(k=>delete cSuc[k]);
      }else{
        const errs = JSON.parse(data.errors||"{}");
        for(const [f,arr] of Object.entries(errs))
          arr.forEach(e=>UI.fErr(f,e.message));
      }
    }catch(err){
      console.error(err);
      UI.err("Ocurrió un error inesperado.");
    }
  });
})();
