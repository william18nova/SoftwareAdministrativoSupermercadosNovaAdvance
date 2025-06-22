/*  static/javascript/agregar_inventario.js
    — Sin colisión con jQuery, autocompletados funcionales,
      borde rojo al mostrar error de campo.  */

(() => {
  "use strict";

  /* ───────────  0. helpers DOM  ─────────── */
  const qs  = s => document.querySelector(s);
  const qsa = s => document.querySelectorAll(s);

  /* ───────────  1. DataTable  ─────────── */
  const dataTable = $('#productos-list').DataTable({
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

  /* ───────────  2. refs y estado  ─────────── */
  const dom = {
    form      : qs('#inventarioForm'),
    sucInp    : qs('#id_sucursal_autocomplete'),
    sucHid    : qs('#id_sucursal'),
    sucBox    : qs('#sucursal-autocomplete-results'),
    prdInp    : qs('#id_producto_autocomplete'),
    prdHid    : qs('#id_productoid'),
    prdBox    : qs('#producto-autocomplete-results'),
    qtyInp    : qs('#id_cantidad'),
    btnAdd    : qs('#agregarProductoBtn'),
    rowsWrap  : qs('#productos-body'),
    alertErr  : qs('#error-message'),
    alertOk   : qs('#success-message'),
  };

  const st = {
    suc : { page:1, term:"", loading:false, more:true },
    prd : { page:1, term:"", loading:false, more:true },
    items : []               // [{productId, productName, cantidad}]
  };

  /* ───────────  3. UI helpers  ─────────── */
  const ui = {
    hideAlerts(){
      [dom.alertErr, dom.alertOk].forEach(a => { if (!a) return; a.style.display='none'; a.innerHTML=''; });
    },
    alertOK(msg){
      dom.alertOk.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
      dom.alertOk.style.display = 'block';
    },
    alertErr(msg){
      dom.alertErr.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
      dom.alertErr.style.display = 'block';
    },
    clearFieldErrors(){
      /* borrar texto y borde rojo */
      qsa('.field-error').forEach(d => { d.textContent=""; d.classList.remove('visible'); });
      qsa('.input-error').forEach(i => i.classList.remove('input-error'));
    },
    /* pinta error bajo el campo y marca el input con borde rojo */
    fieldErr(field, msg){
      const div = qs(`#error-id_${field}`);
      if (div){
        div.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        div.classList.add('visible');
      }
      /* asocia nombre de campo ⇢ input visible */
      const map = { sucursal: dom.sucInp, productoid: dom.prdInp, cantidad: dom.qtyInp };
      const inp = map[field] || qs(`#id_${field}`);
      if (inp) inp.classList.add('input-error');
    }
  };

  /* ───────────  4. fetch con cache  ─────────── */
  const fetchCache = (() => {
    const memo = new Map();
    return async url => {
      if (memo.has(url)) return memo.get(url);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      memo.set(url, d);
      return d;
    };
  })();

  /* ───────────  5. Debounce  ─────────── */
  const debounce = (fn, ms=300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };

  /* ───────────  6. Factory Autocomplete  ─────────── */
  function createAutocomplete(kind){
    const cfg = kind==='suc' ? {
      inp : dom.sucInp, hid: dom.sucHid, box: dom.sucBox,
      state: st.suc,  url: p => `${sucursalAutocompleteUrl}?${p}`
    } : {
      inp : dom.prdInp, hid: dom.prdHid, box: dom.prdBox,
      state: st.prd,  url : p => {
        const excl = st.items.length ? `&excluded=${st.items.map(i=>i.productId).join(",")}` : "";
        return `${productoAutocompleteUrl}?${p}${excl}`;
      }
    };

    const render = async () => {
      if (cfg.state.loading || !cfg.state.more) return;
      cfg.state.loading = true;

      const params = new URLSearchParams({ term: cfg.state.term, page: cfg.state.page });
      const data   = await fetchCache(cfg.url(params));

      if (cfg.state.page === 1) cfg.box.innerHTML="";

      if (data.results.length){
        for (const r of data.results){
          const d = document.createElement('div');
          d.className='autocomplete-option'; d.dataset.id=r.id; d.textContent=r.text;
          cfg.box.appendChild(d);
        }
        cfg.state.more = data.has_more;
      }else if (cfg.state.page === 1){
        cfg.box.innerHTML = '<div class="autocomplete-no-result">No se encontraron resultados</div>';
        cfg.state.more = false;
      }
      cfg.box.style.display='block';
      cfg.state.loading = false;
    };

    /* input / focus */
    const kick = debounce(() => { cfg.state.page=1; cfg.state.more=true; render(); });
    cfg.inp.addEventListener('input', () => {
      cfg.hid.value = '';
      cfg.state.term = cfg.inp.value.trim();
      if (!cfg.state.term){ cfg.box.style.display='none'; return; }
      kick();
    });
    cfg.inp.addEventListener('focus', () => {
      cfg.state.term = cfg.inp.value.trim();
      cfg.state.page=1; cfg.state.more=true; render();
    });

    /* scroll (infinite) */
    cfg.box.addEventListener('scroll', () => {
      if (cfg.box.scrollTop + cfg.box.clientHeight >= cfg.box.scrollHeight-4){
        if (cfg.state.more && !cfg.state.loading){ cfg.state.page+=1; render(); }
      }
    });

    /* click */
    cfg.box.addEventListener('click', e => {
      const opt = e.target.closest('.autocomplete-option');
      if (!opt) return;
      cfg.inp.value  = opt.textContent;
      cfg.hid.value  = opt.dataset.id;
      cfg.box.style.display='none';
    });

    /* cerrar si clic fuera */
    document.addEventListener('click', e=>{
      if (!cfg.inp.contains(e.target) && !cfg.box.contains(e.target))
        cfg.box.style.display='none';
    });
  }
  createAutocomplete('suc');
  createAutocomplete('prd');

  /* ───────────  7. Añadir producto  ─────────── */
  dom.btnAdd.addEventListener('click', () => {
    ui.hideAlerts(); ui.clearFieldErrors();

    const sid = dom.sucHid.value.trim();
    const pid = dom.prdHid.value.trim();
    const qty = dom.qtyInp.value.trim();
    const pname = dom.prdInp.value.trim();

    let invalid=false;
    if (!sid)       { ui.fieldErr('sucursal','Debe seleccionar una sucursal.'); invalid=true; }
    if (!pid)       { ui.fieldErr('productoid','Debe seleccionar un producto.'); invalid=true; }
    if (!qty || qty<=0){ ui.fieldErr('cantidad','Cantidad debe ser mayor que 0.'); invalid=true; }
    if (invalid) return;

    if (st.items.some(i=>i.productId===pid)){
      ui.fieldErr('productoid','Este producto ya está en la lista.'); return;
    }

    st.items.push({productId:pid,productName:pname,cantidad:qty});

    dataTable.row.add([
      pname,
      `<input type="number" class="qty-input" min="1" value="${qty}">`,
      `<button type="button" class="btn-eliminar d-flex" data-product-id="${pid}">
         <i class="fas fa-trash-alt"></i>
       </button>`
    ]).draw(false);

    dom.prdInp.value=''; dom.prdHid.value=''; dom.qtyInp.value='';
  });

  /* ───────────  8. Eliminar de la tabla  ─────────── */
  dom.rowsWrap.addEventListener('click', e=>{
    const btn=e.target.closest('.btn-eliminar');
    if(!btn) return;
    const pid=btn.dataset.productId;
    st.items=st.items.filter(i=>i.productId!==pid);
    dataTable.row(btn.closest('tr')).remove().draw(false);
  });

  /* ───────────  9. Envío del formulario  ─────────── */
  dom.form.addEventListener('submit', async ev=>{
    ev.preventDefault();
    ui.hideAlerts(); ui.clearFieldErrors();

    if (!st.items.length){ ui.alertErr('Debe agregar al menos un producto.'); return; }

    /* sync cantidades editadas */
    dataTable.rows().every(function(){
      const [nameCell, qtyCell]=this.node().querySelectorAll('td');
      const item=st.items.find(i=>i.productName===nameCell.textContent.trim());
      const inp = qtyCell.querySelector('.qty-input');
      if(item && inp) item.cantidad = inp.value.trim();
    });

    qs('#id_inventarios_temp').value = JSON.stringify(st.items);

    try{
      const resp = await fetch(dom.form.action,{
        method:'POST',
        headers:{
          'X-CSRFToken': document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))?.split('=')[1]||'',
          'Accept':'application/json'
        },
        body:new FormData(dom.form)
      });
      const data = await resp.json();

      if (data.success){
        ui.alertOK('Inventario creado exitosamente.');
        dom.form.reset(); st.items=[]; dataTable.clear().draw();
      }else{
        const errs = JSON.parse(data.errors||'{}');
        Object.entries(errs).forEach(([f,arr])=>arr.forEach(e=>ui.fieldErr(f,e.message)));
      }
    }catch(err){ console.error(err); ui.alertErr('Ocurrió un error inesperado.'); }
  });

})();
