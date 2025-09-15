/*  static/javascript/agregar_inventario.js
    • Autocomplete instantáneo + scroll infinito + caché
    • Muestra opciones SOLO si el input está enfocado
    • Enter: avanza, elige 1ª opción en autocomplete, y al final agrega
    • MEJORA: filtro local “parecido” sobre todas las páginas cacheadas
              + prefetch automático de páginas adicionales
------------------------------------------------------------------*/
(() => {
  "use strict";

  /* ======== helpers generales ======== */
  const $id  = id => document.getElementById(id);
  const $qs  = s  => document.querySelector(s);
  const $qsa = s  => document.querySelectorAll(s);

  const hasAbort = typeof window.AbortController === "function";

  // Normaliza: quita acentos y pasa a minúscula
  const norm = (s) => (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const uniqById = (arr) => {
    const m = new Map();
    for (const r of arr) if (r && r.id != null && !m.has(r.id)) m.set(r.id, r);
    return Array.from(m.values());
  };

  /* ======== DataTable de la lista ======== */
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

  const COL_LABELS = ["Producto", "Cantidad", "Acciones"];
  function setDataLabels($row){
    $('td', $row).each(function(i){ this.setAttribute('data-label', COL_LABELS[i] || ""); });
  }
  $('#productos-list').on('draw.dt', function(){
    $('#productos-list tbody tr').each(function(){ setDataLabels($(this)); });
  });

  /* ======== refs DOM ======== */
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
    alertOk   : $id('success-message'),
  };

  const state = {
    suc : { page:1, term:'', loading:false, more:true, list:[], ctrl:null, focused:false },
    prd : { page:1, term:'', loading:false, more:true, list:[], ctrl:null, focused:false },
    items : [] // [{ productId, productName, cantidad }]
  };

  /* ======== UI helpers ======== */
  const UI = {
    clearAlerts(){
      [dom.alertOk, dom.alertErr].forEach(a=>{ if (!a) return; a.style.display='none'; a.innerHTML=''; });
    },
    ok(msg){ dom.alertOk.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`; dom.alertOk.style.display='block'; },
    err(msg){ dom.alertErr.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`; dom.alertErr.style.display='block'; },
    clearFieldErrors(){
      $qsa('.field-error').forEach(d=>{ d.classList.remove('visible'); d.textContent=''; });
      $qsa('.input-error').forEach(inp=>inp.classList.remove('input-error'));
    },
    fieldError(field, msg){
      const box = $qs(`#error-id_${field}`);
      if (box){ box.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`; box.classList.add('visible'); }
      const map = { sucursal: dom.sucInp, productoid: dom.prdInp, cantidad: dom.qtyInp };
      const input = map[field] || $qs(`#id_${field}`);
      if (input) input.classList.add('input-error');
    }
  };

  /* ======== caché en memoria ======== */
  const cacheSucursal = Object.create(null);
  const cacheProducto = Object.create(null);
  const cacheKey = (term, page, extra="") => `${(term||"").trim().toLowerCase()}|${page}|${extra}`;

  // Devuelve TODAS las páginas cacheadas para (term, extra), en orden de página
  function allCachedPages(cache, term, extra=""){
    const t = (term||"").trim().toLowerCase();
    const out = [];
    Object.keys(cache).forEach(k=>{
      const [kt, kp, ke] = k.split("|");
      if (kt === t && ke === (extra||"")){
        const pg = parseInt(kp,10) || 1;
        out.push({ page: pg, data: cache[k] });
      }
    });
    out.sort((a,b)=>a.page-b.page);
    return out;
  }

  /* ======== tools ======== */
  const debounce = (fn, ms=90) => { let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),ms); }; };
  const hideBox = el => { el.style.display = 'none'; };
  const showBox = el => { el.style.display = 'block'; };
  const abortCtrl = c => { try{ c?.abort(); }catch(_){} };
  const isBoxVisible = el => !!el && window.getComputedStyle(el).display !== 'none';

  function hideAllExcept(kind){
    if (kind === 'suc'){
      hideBox(dom.prdBox); abortCtrl(state.prd.ctrl); state.prd.focused = false;
    } else if (kind === 'prd'){
      hideBox(dom.sucBox); abortCtrl(state.suc.ctrl); state.suc.focused = false;
    } else {
      hideBox(dom.sucBox); hideBox(dom.prdBox);
      state.suc.focused = state.prd.focused = false;
    }
  }

  /* ======== ENTER NAV ======== */
  const NAV_ORDER = ['suc','prd','qty'];
  const getByKey = key => key==='suc' ? dom.sucInp : key==='prd' ? dom.prdInp : dom.qtyInp;

  function focusNext(fromKey){
    const idx = NAV_ORDER.indexOf(fromKey);
    if (idx < 0) return;
    if (idx < NAV_ORDER.length - 1){
      getByKey(NAV_ORDER[idx + 1]).focus();
    } else {
      dom.btnAdd.click();
    }
  }

  function selectFirstAndAdvance(kind){
    if (kind === 'suc'){
      const first = dom.sucBox.querySelector('.autocomplete-option');
      if (isBoxVisible(dom.sucBox) && first){
        dom.sucInp.value = first.textContent;
        dom.sucHid.value = first.dataset.id;
      }
      hideBox(dom.sucBox);
      focusNext('suc');
    } else if (kind === 'prd'){
      const first = dom.prdBox.querySelector('.autocomplete-option');
      if (isBoxVisible(dom.prdBox) && first){
        dom.prdInp.value = first.textContent;
        dom.prdHid.value = first.dataset.id;
      }
      hideBox(dom.prdBox);
      focusNext('prd');
    }
  }

  /* ======== Autocomplete mejorado ======== */
  function Autocomplete(kind){
    // Parámetros de “prefetch” para que aparezcan similares aunque no estén en la 1ª página
    const TARGET_SUGGESTIONS = 12;   // cuántas sugerencias intentamos mostrar
    const MAX_AUTO_PAGES     = 6;    // páginas extra a descargar automáticamente (además de la 1ª)

    const cfg = (kind === 'suc') ? {
      inp : dom.sucInp, hid : dom.sucHid, box : dom.sucBox,
      state : state.suc,  cache : cacheSucursal,
      url: (term,page)=> `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`,
      extraKey: () => "" // sin extra
    } : {
      inp : dom.prdInp, hid : dom.prdHid, box : dom.prdBox,
      state : state.prd,  cache : cacheProducto,
      url: (term,page)=>{
        const excluded = state.items.length ? `&excluded=${state.items.map(i=>i.productId).join(',')}` : '';
        return `${productoAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}${excluded}`;
      },
      extraKey: () => state.items.length ? state.items.map(i=>i.productId).join(',') : ""
    };

    cfg.box.style.zIndex = "9999";
    const canShow = () => cfg.state.focused && document.activeElement === cfg.inp;

    // Pinta opciones en la caja
    const drawItems = (items, replace=true) => {
      if (!canShow()) return;
      if (replace) cfg.box.innerHTML = "";
      if (items.length){
        const frag = document.createDocumentFragment();
        items.forEach(r=>{
          const div = document.createElement('div');
          div.className = 'autocomplete-option';
          div.dataset.id = r.id;
          div.textContent = r.text;
          frag.appendChild(div);
        });
        cfg.box.appendChild(frag);
      }else{
        cfg.box.innerHTML = '<div class="autocomplete-no-result">No se encontraron resultados</div>';
      }
      if (canShow()) showBox(cfg.box);
    };

    // Devuelve las mejores sugerencias usando todas las páginas cacheadas del término
    function buildSuggestions(){
      const t  = cfg.state.term;
      const nt = norm(t);
      const extra = cfg.extraKey();

      // ① Todas las páginas cacheadas del término actual
      let pool = [];
      for (const p of allCachedPages(cfg.cache, t, extra)){
        if (p.data && Array.isArray(p.data.results)) pool = pool.concat(p.data.results);
      }
      // ② También la página vacía (populares) como “semilla”
      const emptyKey = cacheKey("", 1, cfg.extraKey());
      if (cfg.cache[emptyKey]?.results) pool = pool.concat(cfg.cache[emptyKey].results);

      // Únicos y filtrados por “parecido”
      pool = uniqById(pool);
      if (!nt) return pool.slice(0, TARGET_SUGGESTIONS);

      const filtered = pool.filter(r => norm(r.text).includes(nt));
      return filtered.slice(0, TARGET_SUGGESTIONS);
    }

    // Descarga páginas extra hasta alcanzar TARGET_SUGGESTIONS o agotar páginas
    async function autoFetchMoreIfNeeded(){
      if (!canShow()) return;
      let suggestions = buildSuggestions();
      if (suggestions.length >= TARGET_SUGGESTIONS || !cfg.state.more) {
        drawItems(suggestions, true);
        return;
      }
      // Trae más páginas automáticamente (sin scroll)
      let fetched = 0;
      while (suggestions.length < TARGET_SUGGESTIONS && cfg.state.more && fetched < MAX_AUTO_PAGES){
        cfg.state.page += 1;
        await fetchPage(cfg.state.page, {silentReplace:true});
        fetched += 1;
        if (!canShow()) return;
        suggestions = buildSuggestions();
      }
      drawItems(suggestions, true);
    }

    // Filtro instantáneo con lo ya cacheado (y luego auto-prefetch si hace falta)
    const immediateFilter = () => {
      if (!canShow()){ hideBox(cfg.box); return; }
      const suggestions = buildSuggestions();
      if (suggestions.length){
        drawItems(suggestions, true);
      } else {
        // Si no hay nada aún, asegura que haya al menos la página 1 del término
        if (cfg.state.list.length) drawItems([], true);
        else hideBox(cfg.box);
      }
      // Y si no alcanzamos el objetivo, intenta traer más
      autoFetchMoreIfNeeded(); // se ejecuta en segundo plano
    };

    // Descarga página concreta (queda cacheada)
    async function fetchPage(page=1, opts={}){
      const { silentReplace=false } = opts;
      const term  = cfg.state.term;
      const extra = cfg.extraKey();
      const key   = cacheKey(term, page, extra);

      // Si estaba en caché, pinta al instante y sal (igualmente recargamos en segundo plano)
      if (cfg.cache[key] && canShow()){
        const data = cfg.cache[key];
        if (page === 1) cfg.state.list = data.results.slice(0);
        if (!silentReplace) drawItems(buildSuggestions(), true);
      }

      if (hasAbort){ abortCtrl(cfg.state.ctrl); cfg.state.ctrl = new AbortController(); }
      else { cfg.state.ctrl = null; }

      try{
        cfg.state.loading = true;
        const resp = await fetch(cfg.url(term, page), hasAbort ? { signal: cfg.state.ctrl.signal } : undefined);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        cfg.cache[key] = data;

        // Si cambió el término mientras pedíamos, no pintes nada
        if (term !== cfg.state.term) return;
        if (!canShow()) return;

        if (page === 1) cfg.state.list = (data.results || []).slice(0);
        cfg.state.more = !!(data && data.has_more);

        // Pinta con las “mejores” sugerencias tras actualizar caché
        if (!silentReplace) drawItems(buildSuggestions(), true);
      }catch(e){
        if (e.name !== 'AbortError') console.error(e);
      }finally{
        cfg.state.loading = false;
      }
    }

    const kickFetch = debounce(()=>{ cfg.state.page=1; cfg.state.more=true; fetchPage(1); }, 90);

    // input
    cfg.inp.addEventListener('input', ()=>{
      cfg.hid.value = '';
      cfg.state.term = cfg.inp.value;
      immediateFilter();
      kickFetch();
    });

    // focus
    cfg.inp.addEventListener('focus', ()=>{
      hideAllExcept(kind);
      cfg.state.focused = true;
      cfg.state.term = cfg.inp.value;

      // Asegura tener semilla vacía (populares)
      if (!cfg.cache[cacheKey("",1,cfg.extraKey())]) {
        const prevTerm = cfg.state.term;
        cfg.state.term = "";
        cfg.state.page = 1; cfg.state.more = true;
        fetchPage(1, {silentReplace:true}).finally(()=>{
          cfg.state.term = prevTerm; // restaura
        });
      }

      // Pinta con lo que haya y trae la 1ª del término
      immediateFilter();
      cfg.state.page = 1; cfg.state.more = true;
      fetchPage(1).then(()=> autoFetchMoreIfNeeded());
    });

    // blur (pequeño delay para permitir click)
    cfg.inp.addEventListener('blur', ()=>{
      cfg.state.focused = false;
      setTimeout(()=> hideBox(cfg.box), 120);
    });

    // ESC
    cfg.inp.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape'){ cfg.state.focused = false; hideBox(cfg.box); }
    });

    // ENTER → seleccionar 1ª opción y avanzar
    cfg.inp.addEventListener('keydown', (e)=>{
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (kind === 'suc') selectFirstAndAdvance('suc');
      else selectFirstAndAdvance('prd');
    });

    // infinite scroll (sigue funcionando)
    cfg.box.addEventListener('scroll', ()=>{
      if (!canShow()) return;
      if (cfg.box.scrollTop + cfg.box.clientHeight >= cfg.box.scrollHeight - 4){
        if (cfg.state.more && !cfg.state.loading){
          cfg.state.page += 1; fetchPage(cfg.state.page);
        }
      }
    });

    // evitar que el blur cierre antes del click
    cfg.box.addEventListener('mousedown', e=> e.preventDefault());

    // selección por click (ratón / táctil)
    cfg.box.addEventListener('click', e=>{
      const opt = e.target.closest('.autocomplete-option');
      if (!opt) return;
      cfg.inp.value = opt.textContent;
      cfg.hid.value = opt.dataset.id;
      hideBox(cfg.box);
      if (kind === 'suc') focusNext('suc'); else focusNext('prd');
    });

    // click/touch fuera
    document.addEventListener('mousedown', e=>{
      if (!cfg.inp.contains(e.target) && !cfg.box.contains(e.target)) { cfg.state.focused = false; hideBox(cfg.box); }
    });
    document.addEventListener('touchstart', e=>{
      if (!cfg.inp.contains(e.target) && !cfg.box.contains(e.target)) { cfg.state.focused = false; hideBox(cfg.box); }
    }, {passive:true});
  }

  Autocomplete('suc');
  Autocomplete('prd');

  /* ======== Enter en inputs normales ======== */
  dom.qtyInp.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter'){ e.preventDefault(); dom.btnAdd.click(); }
  });

  // Evita submits por Enter fuera del flujo
  dom.form.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && e.target !== dom.qtyInp && e.target !== dom.sucInp && e.target !== dom.prdInp){
      e.preventDefault();
      const key = e.target === dom.sucInp ? 'suc' : e.target === dom.prdInp ? 'prd' : e.target === dom.qtyInp ? 'qty' : null;
      if (key) focusNext(key);
    }
  });

  /* ======== Agregar a la tabla ======== */
  dom.btnAdd.addEventListener('click', ()=>{
    UI.clearAlerts(); UI.clearFieldErrors();

    const sid = dom.sucHid.value.trim();
    const pid = dom.prdHid.value.trim();
    const qty = dom.qtyInp.value.trim();
    const pname = dom.prdInp.value.trim();

    let bad=false;
    if (!sid){ UI.fieldError('sucursal','Debe seleccionar una sucursal.'); bad=true; }
    if (!pid){ UI.fieldError('productoid','Debe seleccionar un producto.'); bad=true; }
    if (!qty || qty<=0){ UI.fieldError('cantidad','Cantidad debe ser mayor que 0.'); bad=true; }
    if (bad) return;

    if (state.items.some(i=>i.productId === pid)){
      UI.fieldError('productoid','Este producto ya está en la lista.'); return;
    }

    state.items.push({ productId:pid, productName:pname, cantidad:qty });

    const newRowNode = dataTable.row.add([
      pname,
      `<input type="number" class="qty-input" min="1" value="${qty}">`,
      `<button type="button" class="btn-eliminar" data-product-id="${pid}">
         <i class="fas fa-trash-alt"></i>
       </button>`
    ]).draw(false).node();

    setDataLabels($(newRowNode));

    // Reset & focus para flujo rápido
    dom.prdInp.value=''; dom.prdHid.value='';
    dom.qtyInp.value='';
    dom.prdInp.focus();
  });

  /* ======== Eliminar fila ======== */
  dom.rowsWrap.addEventListener('click', e=>{
    const btn = e.target.closest('.btn-eliminar');
    if (!btn) return;
    const pid = btn.dataset.productId;
    state.items = state.items.filter(i=>i.productId!==pid);
    dataTable.row(btn.closest('tr')).remove().draw(false);
  });

  /* ======== Submit ======== */
  dom.form.addEventListener('submit', async ev=>{
    ev.preventDefault();
    UI.clearAlerts(); UI.clearFieldErrors();

    if (!state.items.length){ UI.err('Debe agregar al menos un producto.'); return; }

    dataTable.rows().every(function(){
      const [prod, qtyCell] = this.node().querySelectorAll('td');
      const item = state.items.find(i=>i.productName === prod.textContent.trim());
      const inp  = qtyCell.querySelector('.qty-input');
      if (item && inp) item.cantidad = inp.value.trim();
    });

    $id('id_inventarios_temp').value = JSON.stringify(state.items);

    try{
      const resp = await fetch(dom.form.action,{
        method : 'POST',
        headers: {
          'X-CSRFToken': document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))?.split('=')[1] || '',
          'Accept'     : 'application/json'
        },
        body   : new FormData(dom.form)
      });
      const data = await resp.json();

      if (data.success){
        UI.ok('Inventario creado exitosamente.');
        dom.form.reset();
        state.items = [];
        dataTable.clear().draw();

        // limpia caché
        Object.keys(cacheSucursal).forEach(k=>delete cacheSucursal[k]);
        Object.keys(cacheProducto).forEach(k=>delete cacheProducto[k]);

        dom.sucInp.value=''; dom.sucHid.value='';
        dom.prdInp.value=''; dom.prdHid.value='';
        hideAllExcept(null);
        dom.sucInp.focus();
      }else{
        const errs = JSON.parse(data.errors || '{}');
        Object.entries(errs).forEach(([field, arr])=>{ arr.forEach(e=>UI.fieldError(field, e.message)); });
      }
    }catch(err){
      console.error(err);
      UI.err('Ocurrió un error inesperado.');
    }
  });

  // draw inicial por si hay filas
  $('#productos-list').trigger('draw.dt');
})();
