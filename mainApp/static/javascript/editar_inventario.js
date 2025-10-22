/*  static/javascript/editar_inventario.js
    FAST PATCH
    ──────────────────────────────────────────────────────────────────
    • Autocompletes ultra-rápidos (una petición por término, sin prefetch)
    • Cachean resultados y filtran localmente (sin acentos) al instante
    • 12 sugerencias máx. (mezcla de «término actual» + «semilla vacía»)
    • ENTER navega entre campos; click selecciona opción
    • Mantiene precarga de filas, agregar/eliminar y submit con redirect
    • NUEVO: Al “Agregar producto”, guarda en servidor y recarga la página
------------------------------------------------------------------*/
(() => {
  "use strict";

  /* ───────── helpers ───────── */
  const $id  = id => document.getElementById(id);
  const $qs  = s  => document.querySelector(s);
  const $qsa = s  => document.querySelectorAll(s);
  const hasAbort = typeof window.AbortController === "function";
  const getCsrf = () =>
    document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))?.split('=')[1] || '';

  /* ───────── refs y estado base ───────── */
  const dom = {
    form      : $id('inventarioForm'),
    sucInp    : $id('id_sucursal_autocomplete'),
    sucHid    : $id('id_sucursal'),
    sucBox    : $id('sucursal-autocomplete-results'),

    prdInp    : $id('id_producto_autocomplete'),
    prdHid    : $id('id_productoid'),
    prdBox    : $id('producto-autocomplete-results'),

    qtyInp    : $id('id_cantidad'),
    btnAdd    : $id('agregarProductoBtn'),
    rowsWrap  : $id('productos-body'),

    alertErr  : $id('error-message'),
    hiddenTemp: $id('id_inventarios_temp'),
  };

  const state = {
    suc : { term:'', loading:false, ctrl:null, list:[] },
    prd : { term:'', loading:false, ctrl:null, list:[] },
    items : [] // [{ productId, productName, cantidad }]
  };

  /* ───────── Precarga filas existentes ───────── */
  $qsa('#productos-body tr').forEach(tr=>{
    const pid  = tr.dataset.productId;
    const name = tr.children[0].textContent.trim();
    const qty  = tr.querySelector('.qty-input')?.value.trim() || '1';
    state.items.push({ productId: pid, productName: name, cantidad: qty });
  });

  /* ───────── DataTable ───────── */
  const dataTable = $('#productos-list').DataTable({
    paging    : false,
    searching : true,
    info      : false,
    responsive: true,
    language  : {
      search      : 'Buscar:',
      zeroRecords : 'No se encontraron resultados',
      emptyTable  : 'No hay productos para mostrar'
    }
  });

  /* ───────── UI helpers ───────── */
  const UI = {
    clearAlerts(){
      if (dom.alertErr) { dom.alertErr.style.display='none'; dom.alertErr.innerHTML=''; }
      $qsa('.field-error').forEach(d=>{ d.classList.remove('visible'); d.textContent=''; });
      $qsa('.input-error').forEach(i=>i.classList.remove('input-error'));
    },
    err(msg){
      dom.alertErr.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
      dom.alertErr.style.display='block';
    },
    fieldError(field,msg){
      const box = $qs(`#error-id_${field}`);
      if (box){
        box.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        box.classList.add('visible');
      }
      const map = { sucursal: dom.sucInp, productoid: dom.prdInp, cantidad: dom.qtyInp };
      const input = map[field] || $qs(`#id_${field}`);
      if (input) input.classList.add('input-error');
    },
    disable(el){ if (el){ el.disabled = true; el.dataset._txt = el.textContent; el.textContent = 'Guardando…'; } },
    enable(el){ if (el){ el.disabled = false; if (el.dataset._txt){ el.textContent = el.dataset._txt; delete el.dataset._txt; } } }
  };

  /* ───────── Caché de autocompletes ───────── */
  const cacheSucursal = Object.create(null);
  const cacheProducto = Object.create(null);

  /* ───────── autos registry (para ENTER) ───────── */
  const autos = {};

  /* ───────── Focus order + helpers ───────── */
  const focusOrder = [ dom.sucInp, dom.prdInp, dom.qtyInp ].filter(Boolean);
  function focusNext(fromEl){
    const idx = focusOrder.indexOf(fromEl);
    const isLast = (idx === focusOrder.length - 1);
    if (isLast){
      dom.btnAdd?.click();
    }else{
      const next = focusOrder[idx + 1];
      next?.focus();
      if (next?.setSelectionRange) {
        const len = next.value.length;
        next.setSelectionRange(len, len);
      }
    }
  }

  /* ───────── FAST Autocomplete (una petición por término) ───────── */
  function Autocomplete(kind){
    const MAX_SUGGESTIONS = 12;
    const DEBOUNCE_MS     = 140;

    const cfg = (kind==='suc') ? {
      inp : dom.sucInp, hid : dom.sucHid, box : dom.sucBox,
      state : state.suc, cache : cacheSucursal,
      url: (term)=> {
        const currentId = encodeURIComponent(window.currentSucursalId || "");
        return `${sucursalAutocompleteUrl}?current_sucursal_id=${currentId}&term=${encodeURIComponent(term)}&page=1`;
      },
      extraKey: () => ""
    } : {
      inp : dom.prdInp, hid : dom.prdHid, box : dom.prdBox,
      state : state.prd, cache : cacheProducto,
      url: (term)=>{
        const excluded = state.items.length ? `&excluded=${state.items.map(i=>i.productId).join(',')}` : '';
        return `${productoAutocompleteUrl}?term=${encodeURIComponent(term)}&page=1${excluded}`;
      },
      extraKey: () => state.items.length ? state.items.map(i=>i.productId).join(',') : ""
    };

    cfg.box.style.zIndex = "9999";

    const canShow = () => document.activeElement === cfg.inp;

    const norm = s => (s||"").toString()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase();

    function draw(items){
      if (!canShow()) return;
      cfg.box.innerHTML = items.length
        ? items.map(r=>`<div class="autocomplete-option" data-id="${r.id}">${r.text}</div>`).join("")
        : '<div class="autocomplete-no-result">No se encontraron resultados</div>';
      cfg.box.style.display = 'block';
    }

    function suggestionsFromCache(){
      const t = (cfg.state.term||"").trim();
      const extra = cfg.extraKey();
      const key   = `${t.toLowerCase()}|1|${extra}`;
      const empty = `${""}|1|${extra}`;

      let pool = [];
      if (cfg.cache[key]?.results)   pool = pool.concat(cfg.cache[key].results);
      if (cfg.cache[empty]?.results) pool = pool.concat(cfg.cache[empty].results);

      const nt = norm(t);
      if (!nt) return pool.slice(0, MAX_SUGGESTIONS);

      const seen = new Set();
      const out = [];
      for (const r of pool){
        if (!r || seen.has(r.id)) continue;
        r._n = r._n || norm(r.text);
        if (r._n.includes(nt)){
          out.push(r); seen.add(r.id);
          if (out.length >= MAX_SUGGESTIONS) break;
        }
      }
      return out;
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

      // pinta rápido desde caché
      if (cfg.cache[key]) draw(suggestionsFromCache());

      if (hasAbort){ try{ cfg.state.ctrl?.abort(); }catch{}; cfg.state.ctrl = new AbortController(); }

      try{
        cfg.state.loading = true;
        const resp = await fetch(cfg.url(term), hasAbort ? { signal: cfg.state.ctrl.signal } : undefined);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        cfg.cache[key] = data;

        if (term !== cfg.state.term) return; // cambió el término
        draw(suggestionsFromCache());
      }catch(e){ if (e.name!=='AbortError') console.error(e); }
      finally{ cfg.state.loading = false; }
    }

    // INPUT
    cfg.inp.addEventListener('input', ()=>{
      cfg.hid.value = '';
      cfg.state.term = cfg.inp.value;
      draw(suggestionsFromCache());  // feedback instantáneo
      kickFetch();                   // una petición por término
    });

    // FOCUS → intenta tener semilla vacía
    cfg.inp.addEventListener('focus', ()=>{
      const prev = cfg.state.term;
      // si no existe la “vacía”, la pedimos rápido para tener algo que mostrar
      const emptyKey = `${""}|1|${cfg.extraKey()}`;
      if (!cfg.cache[emptyKey]) {
        cfg.state.term = "";
        fetchOnce().finally(()=>{ cfg.state.term = prev; draw(suggestionsFromCache()); });
      } else {
        draw(suggestionsFromCache());
      }
      // valida término actual
      fetchOnce();
    });

    // BLUR (pequeño delay para permitir click)
    cfg.inp.addEventListener('blur', ()=> setTimeout(()=>{ cfg.box.style.display='none'; }, 120));

    // Dropdown: mantener abierto para click
    cfg.box.addEventListener('mousedown', e=> e.preventDefault());

    // Selección por CLICK
    cfg.box.addEventListener('click', e=>{
      const opt = e.target.closest('.autocomplete-option'); if (!opt) return;
      cfg.inp.value = opt.textContent;
      cfg.hid.value = opt.dataset.id || "";
      cfg.box.style.display='none';
      if (kind==='suc') focusNext(dom.sucInp); else focusNext(dom.prdInp);
    });

    // Cerrar si clic fuera
    document.addEventListener('mousedown', e=>{
      if (!cfg.inp.contains(e.target) && !cfg.box.contains(e.target)) cfg.box.style.display='none';
    });
    document.addEventListener('touchstart', e=>{
      if (!cfg.inp.contains(e.target) && !cfg.box.contains(e.target)) cfg.box.style.display='none';
    }, {passive:true});

    // API pública (para ENTER global)
    function selectFirstVisible(){
      const first = cfg.box.querySelector('.autocomplete-option');
      if (first){
        cfg.inp.value = first.textContent;
        cfg.hid.value = first.dataset.id || "";
        cfg.box.style.display='none';
        return true;
      }
      // fallback a lista en memoria si hubiera
      const arr = suggestionsFromCache();
      if (arr && arr.length){
        cfg.inp.value = arr[0].text;
        cfg.hid.value = arr[0].id;
        cfg.box.style.display='none';
        return true;
      }
      return false;
    }

    const api = { selectFirstVisible };
    autos[kind] = api;
    return api;
  }

  const autoSuc = Autocomplete('suc');
  const autoPrd = Autocomplete('prd');

  /* ───────── ENTER: navegación entre campos ───────── */
  function handleEnterFor(el, e){
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (el === dom.sucInp){
      autos.suc.selectFirstVisible();
      focusNext(el);
      return;
    }
    if (el === dom.prdInp){
      autos.prd.selectFirstVisible();
      focusNext(el);
      return;
    }
    // input normal (cantidad)
    focusNext(el);
  }

  focusOrder.forEach(inp=>{
    inp?.addEventListener('keydown', e => handleEnterFor(inp, e));
  });

  /* ───────── Agregar fila (GUARDAR EN SERVIDOR + RECARGAR) ───────── */
  dom.btnAdd.addEventListener('click', async ()=>{
    UI.clearAlerts();

    const sid=dom.sucHid.value.trim();
    const pid=dom.prdHid.value.trim();
    const qty=(dom.qtyInp.value||'').trim();
    const pname=dom.prdInp.value.trim();

    let bad=false;
    if (!sid){ UI.fieldError('sucursal','Debe seleccionar una sucursal.'); bad=true; }
    if (!pid){ UI.fieldError('productoid','Debe seleccionar un producto.'); bad=true; }
    if (!qty || Number(qty)<=0){ UI.fieldError('cantidad','Cantidad debe ser mayor que 0.'); bad=true; }
    if (bad) return;

    // Evita duplicados en esta pantalla (el servidor igualmente puede validar)
    if (state.items.some(i=>i.productId===pid)){
      UI.fieldError('productoid','Este producto ya está en la lista.'); return;
    }

    // Construir payload mínimo para agregar el item en servidor
    const url = (window.agregarItemUrl || dom.form.action);
    const fd  = new FormData();
    fd.append('sucursal', sid);
    fd.append('productoid', pid);
    fd.append('cantidad', qty);
    fd.append('action', 'add_item'); // <- tu vista puede usar este flag
    fd.append('ajax', '1');

    UI.disable(dom.btnAdd);

    try{
      const resp = await fetch(url, {
        method:'POST',
        headers:{
          'X-CSRFToken': getCsrf(),
          'Accept':'application/json'
        },
        body: fd
      });

      // Si tu vista devuelve HTML (no JSON), igual recargamos ante 2xx
      if (resp.ok){
        // Intentar leer JSON, si falla, igual recargamos
        let data = null;
        try { data = await resp.json(); } catch {}
        if (!data || data.success){
          window.location.reload(); // ✅ recarga y muestra el item recién agregado
          return;
        }
        // Si viene errors en JSON
        const errs = JSON.parse(data.errors || '{}');
        Object.entries(errs).forEach(([field, arr])=>{
          arr.forEach(e=>UI.fieldError(field, e.message));
        });
      }else{
        UI.err(`No se pudo guardar (HTTP ${resp.status}).`);
      }
    }catch(err){
      console.error(err);
      UI.err('Ocurrió un error inesperado al guardar.');
    }finally{
      UI.enable(dom.btnAdd);
    }
  });

  /* ───────── Eliminar fila (local; si quieres server-side, cambia a fetch + reload) ───────── */
  dom.rowsWrap.addEventListener('click',e=>{
    const btn=e.target.closest('.btn-eliminar'); if (!btn) return;
    const pid=btn.dataset.productId;
    state.items=state.items.filter(i=>i.productId!==pid);
    dataTable.row(btn.closest('tr')).remove().draw(false);
  });

  /* ───────── Submit (flujo completo opcional) ───────── */
  dom.form.addEventListener('submit',async ev=>{
    ev.preventDefault();
    UI.clearAlerts();

    if (!state.items.length){
      UI.err('Debe agregar al menos un producto.'); return;
    }

    // sincronizar cantidades editadas
    dataTable.rows().every(function(){
      const [prod, qtyCell] = this.node().querySelectorAll('td');
      const item = state.items.find(i=>i.productName===prod.textContent.trim());
      const inp  = qtyCell.querySelector('.qty-input');
      if (item && inp) item.cantidad = inp.value.trim();
    });

    if (dom.hiddenTemp){
      dom.hiddenTemp.value = JSON.stringify(state.items);
    }

    try{
      const resp = await fetch(dom.form.action,{
        method:'POST',
        headers:{
          'X-CSRFToken': getCsrf(),
          'Accept':'application/json'
        },
        body:new FormData(dom.form)
      });
      const data = await resp.json();

      if (data.success){
        window.location.href = data.redirect_url || window.location.href;
      }else{
        const errs = JSON.parse(data.errors || '{}');
        Object.entries(errs).forEach(([field, arr])=>{
          arr.forEach(e=>UI.fieldError(field, e.message));
        });
      }
    }catch(err){
      console.error(err);
      UI.err('Ocurrió un error inesperado.');
    }
  });
})();
