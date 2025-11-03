/*  static/javascript/editar_inventario.js
    FAST PATCH FINAL (sin duplicados en autocomplete)
    ──────────────────────────────────────────────────────────────────
    • Autocompletes ultra-rápidos (una petición por término, sin prefetch)
    • Cache local con búsqueda sin acentos y 12 sugerencias máx.
    • ENTER navega entre campos; click selecciona opción
    • Precarga filas existentes + agregar/eliminar dinámico
    • Agregar producto guarda en servidor y recarga la página
    • Producto AC: SOLO productos NO vinculados a la sucursal actual
    • NEW: Deduplicación por id y por nombre normalizado
------------------------------------------------------------------*/
(() => {
  "use strict";

  /* ───────── helpers ───────── */
  const $id  = id => document.getElementById(id);
  const $qs  = s  => document.querySelector(s);
  const $qsa = s  => document.querySelectorAll(s);
  const hasAbort = typeof window.AbortController === "function";
  const getCsrf = () =>
    document.cookie.split(";").find(c=>c.trim().startsWith("csrftoken="))?.split("=")[1] || "";

  const norm = s => (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

  // 🔁 Dedupe por id y por nombre normalizado (evita duplicados visuales)
  function dedupeResults(arr){
    const byId = new Set();
    const byName = new Set();
    const out = [];
    for (const r of (arr||[])) {
      if (!r) continue;
      const id = String(r.id ?? "");
      const n  = norm(r.text ?? "");
      const kName = `n:${n}`;
      if (byId.has(id) || byName.has(kName)) continue;
      byId.add(id); byName.add(kName);
      out.push({ id: r.id, text: r.text, _n: n });
    }
    return out;
  }

  // Fallback robusto para sucursal_id
  function getSucursalId() {
    const fromWindow = (window.currentSucursalId ?? "").toString().trim();
    if (fromWindow) return fromWindow;
    const hid = $id("id_sucursal");
    const fromHidden = (hid?.value ?? "").toString().trim();
    return fromHidden || "";
  }

  /* ───────── refs ───────── */
  const dom = {
    form      : $id("inventarioForm"),
    sucInp    : $id("id_sucursal_autocomplete"),
    sucHid    : $id("id_sucursal"),
    sucBox    : $id("sucursal-autocomplete-results"),
    prdInp    : $id("id_producto_autocomplete"),
    prdHid    : $id("id_productoid"),
    prdBox    : $id("producto-autocomplete-results"),
    qtyInp    : $id("id_cantidad"),
    btnAdd    : $id("agregarProductoBtn"),
    rowsWrap  : $id("productos-body"),
    alertErr  : $id("error-message"),
    hiddenTemp: $id("id_inventarios_temp"),
  };

  const state = {
    suc : { term:"", loading:false, ctrl:null },
    prd : { term:"", loading:false, ctrl:null },
    items : [] // [{ productId, productName, cantidad }]
  };

  /* ───────── Precarga filas existentes ───────── */
  $qsa("#productos-body tr").forEach(tr=>{
    const pid  = tr.dataset.productId;
    const name = tr.children[0].textContent.trim();
    const qty  = tr.querySelector(".qty-input")?.value.trim() || "1";
    state.items.push({ productId: pid, productName: name, cantidad: qty });
  });

  /* ───────── DataTable ───────── */
  const dataTable = $("#productos-list").DataTable({
    paging    : false,
    searching : true,
    info      : false,
    responsive: true,
    language  : {
      search      : "Buscar:",
      zeroRecords : "No se encontraron resultados",
      emptyTable  : "No hay productos para mostrar"
    }
  });

  /* ───────── UI helpers ───────── */
  const UI = {
    clearAlerts(){
      if (dom.alertErr) { dom.alertErr.style.display="none"; dom.alertErr.innerHTML=""; }
      $qsa(".field-error").forEach(d=>{ d.classList.remove("visible"); d.textContent=""; });
      $qsa(".input-error").forEach(i=>i.classList.remove("input-error"));
    },
    err(msg){
      dom.alertErr.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
      dom.alertErr.style.display="block";
    },
    fieldError(field,msg){
      const box = $qs(`#error-id_${field}`);
      if (box){
        box.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        box.classList.add("visible");
      }
      const map = { sucursal: dom.sucInp, productoid: dom.prdInp, cantidad: dom.qtyInp };
      const input = map[field] || $qs(`#id_${field}`);
      if (input) input.classList.add("input-error");
    },
    disable(el){ if (el){ el.disabled = true; el.dataset._txt = el.textContent; el.textContent = "Guardando…"; } },
    enable(el){ if (el){ el.disabled = false; if (el.dataset._txt){ el.textContent = el.dataset._txt; delete el.dataset._txt; } } }
  };

  const cacheSucursal = Object.create(null);
  const cacheProducto = Object.create(null);
  const autos = {};

  /* ───────── Focus helpers ───────── */
  const focusOrder = [ dom.sucInp, dom.prdInp, dom.qtyInp ].filter(Boolean);
  function focusNext(fromEl){
    const idx = focusOrder.indexOf(fromEl);
    const isLast = (idx === focusOrder.length - 1);
    if (isLast) dom.btnAdd?.click();
    else {
      const next = focusOrder[idx + 1];
      next?.focus();
      if (next?.setSelectionRange) {
        const len = next.value.length;
        next.setSelectionRange(len, len);
      }
    }
  }

  /* ───────── Autocomplete genérico ───────── */
  function Autocomplete(kind){
    const MAX_SUGGESTIONS = 12;
    const DEBOUNCE_MS = 140;
    const MAX_EXCLUDED = 800;

    const cfg = (kind==="suc") ? {
      inp : dom.sucInp, hid : dom.sucHid, box : dom.sucBox,
      state : state.suc, cache : cacheSucursal,
      url: (term)=> {
        const currentId = encodeURIComponent(getSucursalId());
        return `${sucursalAutocompleteUrl}?current_sucursal_id=${currentId}&term=${encodeURIComponent(term)}&page=1`;
      },
      extraKey: () => ""
    } : {
      inp : dom.prdInp, hid : dom.prdHid, box : dom.prdBox,
      state : state.prd, cache : cacheProducto,
      url: (term)=>{
        const ids = state.items.map(i=>i.productId).slice(0, MAX_EXCLUDED);
        const excluded = ids.length ? `&excluded=${ids.join(",")}` : "";
        const suc = encodeURIComponent(getSucursalId());
        return `${productoAutocompleteUrl}?term=${encodeURIComponent(term)}&page=1&sucursal_id=${suc}${excluded}`;
      },
      extraKey: () => {
        const ids = state.items.slice(0, MAX_EXCLUDED).map(i=>i.productId);
        return [String(getSucursalId()), ...ids].join("|");
      }
    };

    cfg.box.style.zIndex = "9999";

    const canShow = () => document.activeElement === cfg.inp;

    function draw(items){
      const unique = dedupeResults(items).slice(0, MAX_SUGGESTIONS);
      if (!canShow()) return;
      cfg.box.innerHTML = unique.length
        ? unique.map(r=>`<div class="autocomplete-option" data-id="${r.id}">${r.text}</div>`).join("")
        : '<div class="autocomplete-no-result">No se encontraron resultados</div>';
      cfg.box.style.display = "block";
    }

    function suggestionsFromCache(){
      const t = (cfg.state.term||"").trim();
      const extra = cfg.extraKey();
      const key   = `${t.toLowerCase()}|1|${extra}`;
      const empty = `${""}|1|${extra}`;
      let pool = [];
      if (cfg.cache[key]?.results)   pool = pool.concat(cfg.cache[key].results);
      if (cfg.cache[empty]?.results) pool = pool.concat(cfg.cache[empty].results);
      return dedupeResults(pool).slice(0, MAX_SUGGESTIONS);
    }

    let tmr=null;
    function kickFetch(){
      clearTimeout(tmr);
      tmr = setTimeout(fetchOnce, DEBOUNCE_MS);
    }

    async function fetchOnce(){
      const term  = (cfg.state.term||"").trim();
      const extra = cfg.extraKey();
      const key   = `${term.toLowerCase()}|1|${extra}`;
      if (cfg.cache[key]) draw(suggestionsFromCache());
      if (hasAbort){ try{ cfg.state.ctrl?.abort(); }catch{}; cfg.state.ctrl = new AbortController(); }
      try{
        cfg.state.loading = true;
        const resp = await fetch(cfg.url(term), hasAbort ? { signal: cfg.state.ctrl.signal } : undefined);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        // 🔁 Dedupe inmediatamente lo que responde el servidor
        cfg.cache[key] = { ...data, results: dedupeResults(data?.results || []) };
        if (term !== cfg.state.term) return;
        draw(suggestionsFromCache());
      }catch(e){ if (e.name!=="AbortError") console.error(e); }
      finally{ cfg.state.loading = false; }
    }

    cfg.inp.addEventListener("input", ()=>{
      cfg.hid.value = "";
      cfg.state.term = cfg.inp.value;
      draw(suggestionsFromCache());
      kickFetch();
    });

    cfg.inp.addEventListener("focus", ()=>{
      const prev = cfg.state.term;
      const emptyKey = `${""}|1|${cfg.extraKey()}`;
      if (!cfg.cache[emptyKey]) {
        cfg.state.term = "";
        (async()=>{ await fetchOnce(); cfg.state.term = prev; draw(suggestionsFromCache()); })();
      } else {
        draw(suggestionsFromCache());
        kickFetch();
      }
    });

    cfg.inp.addEventListener("blur", ()=> setTimeout(()=>{ cfg.box.style.display="none"; }, 120));
    cfg.box.addEventListener("mousedown", e=> e.preventDefault());
    cfg.box.addEventListener("click", e=>{
      const opt = e.target.closest(".autocomplete-option"); if (!opt) return;
      cfg.inp.value = opt.textContent;
      cfg.hid.value = opt.dataset.id || "";
      cfg.box.style.display="none";
      if (kind==="suc") focusNext(dom.sucInp); else focusNext(dom.prdInp);
    });

    document.addEventListener("mousedown", e=>{
      if (!cfg.inp.contains(e.target) && !cfg.box.contains(e.target)) cfg.box.style.display="none";
    });
    document.addEventListener("touchstart", e=>{
      if (!cfg.inp.contains(e.target) && !cfg.box.contains(e.target)) cfg.box.style.display="none";
    }, {passive:true});

    function selectFirstVisible(){
      const first = cfg.box.querySelector(".autocomplete-option");
      if (first){
        cfg.inp.value = first.textContent;
        cfg.hid.value = first.dataset.id || "";
        cfg.box.style.display="none";
        return true;
      }
      const arr = suggestionsFromCache();
      if (arr && arr.length){
        cfg.inp.value = arr[0].text;
        cfg.hid.value = arr[0].id;
        cfg.box.style.display="none";
        return true;
      }
      return false;
    }

    autos[kind] = { selectFirstVisible };
    return autos[kind];
  }

  const autoSuc = Autocomplete("suc");
  const autoPrd = Autocomplete("prd");

  /* ───────── ENTER navegación ───────── */
  function handleEnterFor(el, e){
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (el === dom.sucInp){ autos.suc.selectFirstVisible(); focusNext(el); return; }
    if (el === dom.prdInp){ autos.prd.selectFirstVisible(); focusNext(el); return; }
    focusNext(el);
  }
  focusOrder.forEach(inp=>inp?.addEventListener("keydown", e => handleEnterFor(inp, e)));

  /* ───────── Agregar producto ───────── */
  dom.btnAdd.addEventListener("click", async ()=>{
    UI.clearAlerts();
    const sid=dom.sucHid.value.trim() || getSucursalId();
    const pid=dom.prdHid.value.trim();
    const qty=(dom.qtyInp.value||"").trim();
    let bad=false;
    if (!sid){ UI.fieldError("sucursal","Debe seleccionar una sucursal."); bad=true; }
    if (!pid){ UI.fieldError("productoid","Debe seleccionar un producto."); bad=true; }
    if (!qty || Number(qty)<=0){ UI.fieldError("cantidad","Cantidad debe ser mayor que 0."); bad=true; }
    if (bad) return;
    if (state.items.some(i=>i.productId===pid)){ UI.fieldError("productoid","Este producto ya está en la lista."); return; }

    const fd  = new FormData();
    fd.append("sucursal", sid);
    fd.append("productoid", pid);
    fd.append("cantidad", qty);
    fd.append("action", "add_item");
    fd.append("ajax", "1");
    UI.disable(dom.btnAdd);

    try{
      const resp = await fetch(dom.form.action, {
        method:"POST",
        headers:{ "X-CSRFToken": getCsrf(), "Accept":"application/json" },
        body: fd
      });
      if (resp.ok){
        let data = null; try { data = await resp.json(); } catch {}
        if (!data || data.success){ window.location.reload(); return; }
        const errs = JSON.parse(data.errors || "{}");
        Object.entries(errs).forEach(([field, arr])=> arr.forEach(e=>UI.fieldError(field,e.message)));
      } else UI.err(`No se pudo guardar (HTTP ${resp.status}).`);
    }catch(err){ console.error(err); UI.err("Ocurrió un error inesperado al guardar."); }
    finally{ UI.enable(dom.btnAdd); }
  });

  /* ───────── Eliminar fila local ───────── */
  dom.rowsWrap.addEventListener("click",e=>{
    const btn=e.target.closest(".btn-eliminar"); if (!btn) return;
    const pid=btn.dataset.productId;
    state.items=state.items.filter(i=>i.productId!==pid);
    dataTable.row(btn.closest("tr")).remove().draw(false);
  });

  /* ───────── Submit principal ───────── */
  dom.form.addEventListener("submit",async ev=>{
    ev.preventDefault();
    UI.clearAlerts();
    state.items = [];
    dataTable.rows().every(function(){
      const tr = this.node();
      const pid = tr.getAttribute("data-product-id");
      const name = tr.querySelector("td:nth-child(1)")?.textContent.trim() || "";
      const qty  = tr.querySelector(".qty-input")?.value.trim() || "1";
      if (pid) state.items.push({ productId: pid, productName: name, cantidad: qty });
    });
    if (!state.items.length){ UI.err("Debe agregar al menos un producto."); return; }
    if (dom.hiddenTemp){ dom.hiddenTemp.value = JSON.stringify(state.items); }

    try{
      const resp = await fetch(dom.form.action,{
        method:"POST",
        headers:{ "X-CSRFToken": getCsrf(), "Accept":"application/json" },
        body:new FormData(dom.form)
      });
      const data = await resp.json();
      if (data.success){ window.location.href = data.redirect_url || window.location.href; }
      else{
        const errs = JSON.parse(data.errors || "{}");
        Object.entries(errs).forEach(([field, arr])=> arr.forEach(e=>UI.fieldError(field,e.message)));
      }
    }catch(err){ console.error(err); UI.err("Ocurrió un error inesperado."); }
  });
})();
