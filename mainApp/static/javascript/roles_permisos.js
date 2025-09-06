/* roles_permisos.js – autocompletes (rol, permiso), DataTable y guardado */
(() => {
  "use strict";

  /* ========= Helpers ========= */
  const $id  = id => document.getElementById(id);
  const $qs  = s  => document.querySelector(s);
  const $qsa = s  => document.querySelectorAll(s);

  async function fetchJSON(url, opts = {}) {
    const r = await fetch(url, opts);
    const txt = await r.text();
    try {
      const j = JSON.parse(txt);
      return j;
    } catch {
      const err = new Error("Respuesta no JSON");
      err.payload = txt;
      throw err;
    }
  }

  function getCSRF() {
    return document.cookie.split(";").map(c=>c.trim()).find(c=>c.startsWith("csrftoken="))?.split("=")[1] || "";
  }

  /* ========= DataTable ========= */
  const dt = $('#permisos-list').DataTable({
    paging:false, searching:true, info:false, responsive:true,
    language:{
      search:"Buscar:", zeroRecords:"No se encontraron permisos",
      emptyTable:"No hay permisos agregados"
    }
  });

  const COL_LABELS = ["Permiso", "Acciones"];
  function setDataLabels($row){
    $row.find("td").each((i,td)=>td.setAttribute("data-label", COL_LABELS[i]||""));
  }
  dt.on("draw", ()=>$('#permisos-list tbody tr').each(function(){ setDataLabels($(this)); }));

  /* ========= DOM ========= */
  const dom = {
    form:$id("rolPermisoForm"),
    rolInp:$id("id_rol_autocomplete"),
    rolHid:$id("id_rol"),
    rolBox:$id("rol-autocomplete-results"),

    perInp:$id("id_permiso_autocomplete"),
    perHid:$id("id_permisoid"),
    perBox:$id("permiso-autocomplete-results"),

    btnAdd:$id("agregarPermisoBtn"),
    tmp:$id("id_permisos_temp"),

    alertErr:$id("error-message"),
    alertOk :$id("success-message"),
  };

  const state = {
    rol:{ page:1, term:"", cache:Object.create(null), more:true, loading:false, aborter:null, reqId:0, basePage:[], baseHasMore:true },
    per:{ page:1, term:"", cache:Object.create(null), more:true, loading:false, aborter:null, reqId:0, basePage:[], baseHasMore:true },
    items:[] // [{permisoId, permisoName}]
  };

  /* ========= UI helpers ========= */
  const UI = {
    clearAlerts(){ [dom.alertErr,dom.alertOk].forEach(a=>{a.style.display="none";a.innerHTML="";}); },
    ok(m){ dom.alertOk.innerHTML=`<i class="fas fa-check-circle"></i> ${m}`; dom.alertOk.style.display="block"; },
    err(m){ dom.alertErr.innerHTML=`<i class="fas fa-exclamation-circle"></i> ${m}`; dom.alertErr.style.display="block"; },
    clearErrors(){ $qsa(".field-error").forEach(d=>{d.classList.remove("visible");d.innerHTML="";}); $qsa(".input-error").forEach(i=>i.classList.remove("input-error")); },
    fieldError(field,msg){
      const box=$qs(`#error-id_${field}`); if(box){ box.innerHTML=`<i class="fas fa-exclamation-circle"></i> ${msg}`; box.classList.add("visible"); }
      ({rol:dom.rolInp, permisoid:dom.perInp}[field]||null)?.classList.add("input-error");
    }
  };

  /* ========= Autocomplete genérico (con exclusión instantánea) ========= */
  function makeAutocomplete(kind){
    const S = state[kind];
    const cfg = (kind==="rol") ? {
      inp:dom.rolInp, hid:dom.rolHid, box:dom.rolBox,
      url:(term,page)=>`${rolAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`
    } : {
      inp:dom.perInp, hid:dom.perHid, box:dom.perBox,
      url:(term,page)=>{
        // Excluir los permisos YA listados en la tabla (instantáneo)
        const ex = state.items.map(i=>i.permisoId).join(",");
        return `${permisoAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}&excluded=${ex}`;
      }
    };

    const open =()=>{ cfg.box.style.display="block"; };
    const close=()=>{ cfg.box.style.display="none"; S.activeIndex=-1; };
    const paint = (list, replace=true)=>{
      requestAnimationFrame(()=>{
        const frag=document.createDocumentFragment();
        list.forEach(r=>{
          const d=document.createElement("div");
          d.className="autocomplete-option";
          d.dataset.id=r.id; d.textContent=r.text;
          frag.appendChild(d);
        });
        if(replace) cfg.box.replaceChildren(frag); else cfg.box.appendChild(frag);
        open();
      });
    };

    async function fetchPage(term,page){
      const key=`${term}::${page}::${kind==='per' ? state.items.map(i=>i.permisoId).join(',') : ''}`;
      if(S.cache[key]) return S.cache[key];
      const data = await fetchJSON(cfg.url(term,page), {signal:S.aborter?.signal});
      S.cache[key]=data;
      return data;
    }

    async function server({reset=true}={}){
      if(S.loading||!S.more) return;
      if(S.aborter){ try{S.aborter.abort();}catch(_){ } }
      S.aborter=new AbortController();
      const myReq=++S.reqId, termAt=S.term, pageAt=S.page;
      S.loading=true;
      try{
        const data=await fetchPage(termAt,pageAt);
        if(myReq!==S.reqId || termAt!==S.term || pageAt!==S.page) return;
        if(reset) cfg.box.innerHTML="";
        const raw = data.results||[];
        // Filtro defensivo en el front (por si backend no excluyó algo)
        const excludeIds = new Set(state.items.map(i=>+i.permisoId));
        const list = (kind==="per") ? raw.filter(r=>!excludeIds.has(+r.id)) : raw;
        if(list.length){
          paint(list, reset);
          S.more=!!data.has_more;
        }else{
          S.more=false;
          if(reset){
            cfg.box.innerHTML=`<div class="autocomplete-no-result">Sin resultados</div>`;
            open();
          }
        }
      }catch(e){
        console.error("Autocomplete error:", e);
      }finally{
        S.loading=false;
      }
    }

    function instant(){
      // pintar de cache/base en <50ms y luego refrescar del servidor
      const key=`${S.term}::1::${kind==='per' ? state.items.map(i=>i.permisoId).join(',') : ''}`;
      let painted=false;

      const excludeIds = new Set(state.items.map(i=>+i.permisoId));
      const filterLocal = arr =>
        (kind==="per") ? arr.filter(x=>!excludeIds.has(+x.id)) : arr;

      if(S.cache[key]?.results){
        paint(filterLocal(S.cache[key].results), true);
        painted=true;
      }else if(S.basePage.length){
        const t=S.term.toLowerCase();
        const local = S.basePage
          .filter(r => r.text.toLowerCase().includes(t))
          .slice(0,50);
        paint(filterLocal(local), true);
        painted=true;
      }
      S.page=1; S.more=true; server({reset:true});
      if(!painted) open();
    }

    cfg.inp.addEventListener("input",()=>{
      cfg.hid.value="";
      S.term=cfg.inp.value.trim();
      if(!S.term){
        S.page=1; S.more=S.baseHasMore;
        if(S.basePage.length) paint(S.basePage, true);
        server({reset:true});
        return;
      }
      instant();
    });

    cfg.inp.addEventListener("focus",()=>{
      S.term=cfg.inp.value.trim();
      S.page=1; S.more=true;
      if(!S.term){
        if(S.basePage.length) paint(S.basePage,true);
        server({reset:true});
      }else instant();
    });

    // Recarga rápida si cambian items (para permisos)
    if (kind === "per") {
      const refreshFast = () => {
        if (cfg.box.style.display !== "none") {
          S.page = 1; S.more = true;
          instant(); // repinta instantáneo + fetch en bg
        }
      };
      // cuando agregamos/eliminamos en la lista:
      document.addEventListener("rolespermisos:items-changed", refreshFast);
    }

    cfg.box.addEventListener("scroll",()=>{
      if(cfg.box.scrollTop + cfg.box.clientHeight >= cfg.box.scrollHeight - 4 && S.more && !S.loading){
        S.page++; server({reset:false});
      }
    });

    cfg.box.addEventListener("click", e=>{
      const opt=e.target.closest(".autocomplete-option"); if(!opt) return;
      cfg.inp.value=opt.textContent; cfg.hid.value=opt.dataset.id; close();
    });

    document.addEventListener("click", e=>{
      if(!cfg.inp.contains(e.target) && !cfg.box.contains(e.target)) close();
    });

    (async function prefetchBase(){
      try{
        const data=await fetchPage("",1);
        S.basePage=data.results||[]; S.baseHasMore=!!data.has_more;
      }catch(_){}
    })();
  }
  makeAutocomplete("rol");
  makeAutocomplete("per");

  /* ========= Agregar permiso a la lista ========= */
  function dispatchItemsChanged(){
    document.dispatchEvent(new CustomEvent("rolespermisos:items-changed"));
  }

  dom.btnAdd.addEventListener("click", ()=>{
    UI.clearAlerts(); UI.clearErrors();

    const rid = dom.rolHid.value.trim();
    const pid = dom.perHid.value.trim();
    const pname = dom.perInp.value.trim();

    let bad=false;
    if(!rid){ UI.fieldError("rol", "Debe seleccionar un rol."); bad=true; }
    if(!pid){ UI.fieldError("permisoid", "Debe seleccionar un permiso."); bad=true; }
    if(bad) return;

    if(state.items.some(i=>i.permisoId===pid)){
      UI.fieldError("permisoid","El permiso ya está en la lista."); return;
    }

    state.items.push({permisoId:pid, permisoName:pname});
    const node = dt.row.add([
      pname,
      `<button type="button" class="btn-eliminar" data-perm-id="${pid}">
         <i class="fas fa-trash-alt"></i>
       </button>`
    ]).draw(false).node();
    setDataLabels($(node));

    dom.perInp.value=""; dom.perHid.value="";
    dom.perBox.style.display="none";

    // invalidar cache de permisos y notificar para refresco instantáneo
    state.per.cache = Object.create(null);
    dispatchItemsChanged();
  });

  /* ========= Eliminar fila ========= */
  $qs("#permisos-body").addEventListener("click", e=>{
    const btn=e.target.closest(".btn-eliminar"); if(!btn) return;
    const pid=btn.dataset.permId;
    dt.row(btn.closest("tr")).remove().draw(false);
    state.items = state.items.filter(i=>i.permisoId!==pid);
    // invalidar cache y refrescar autocomplete de permisos
    state.per.cache = Object.create(null);
    dispatchItemsChanged();
  });

  /* ========= Submit ========= */
  dom.form.addEventListener("submit", async ev=>{
    ev.preventDefault(); UI.clearAlerts(); UI.clearErrors();

    if(!state.items.length){
      UI.err("Debe agregar al menos un permiso.");
      return;
    }
    dom.tmp.value = JSON.stringify(state.items);

    try{
      const data = await fetchJSON(dom.form.action, {
        method:"POST",
        headers:{
          "X-CSRFToken": getCSRF(),
          Accept:"application/json"
        },
        body:new FormData(dom.form)
      });

      if(data.success){
        UI.ok("Permisos asociados correctamente.");
        dom.perInp.value=""; dom.perHid.value="";
        state.items=[]; dt.clear().draw();
        state.per.cache = Object.create(null);
        dispatchItemsChanged();
      }else{
        const errs = JSON.parse(data.errors || "{}");
        for(const [field,arr] of Object.entries(errs)) arr.forEach(e=>UI.fieldError(field, e.message||e));
      }
    }catch(err){
      console.error("Error submit:", err.payload || err);
      UI.err("Error interno del servidor. Revisa logs.");
    }
  });
})();
