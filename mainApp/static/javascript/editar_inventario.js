/*  static/javascript/editar_inventario.js
    ───────────────────────────────────────────────
    Variante de agregar_inventario.js PARA “Editar”.
    Cambios:
      • Precarga de filas existentes en state.items.
      • Tras guardar, redirige a data.redirect_url.
   ------------------------------------------------ */
(() => {
  "use strict";

  /* ───────── 0. helpers DOM ───────── */
  const $id  = id => document.getElementById(id);
  const $qs  = s  => document.querySelector(s);
  const $qsa = s  => document.querySelectorAll(s);

  /* ───────── 1. refs y estado ───────── */
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
    suc : { page:1, term:'', loading:false, more:true },
    prd : { page:1, term:'', loading:false, more:true },
    items : []      // [{ productId, productName, cantidad }]
  };

  /* ───────── 2. precargar filas existentes ───────── */
  $qsa('#productos-body tr').forEach(tr=>{
    const pid  = tr.dataset.productId;
    const name = tr.children[0].textContent.trim();
    const qty  = tr.querySelector('.qty-input')?.value.trim() || '1';
    state.items.push({ productId: pid, productName: name, cantidad: qty });
  });

  /* ───────── 3. DataTable ───────── */
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

  /* ───────── 4. utilidades UI ───────── */
  const UI = {
    clearAlerts(){
      [dom.alertOk, dom.alertErr].forEach(a=>{
        if (!a) return; a.style.display='none'; a.innerHTML='';
      });
    },
    err(msg){
      dom.alertErr.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
      dom.alertErr.style.display='block';
    },
    clearFieldErrors(){
      $qsa('.field-error').forEach(d=>{ d.classList.remove('visible'); d.textContent=''; });
      $qsa('.input-error').forEach(i=>i.classList.remove('input-error'));
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
    }
  };

  /* ───────── 5. cachés y fetchCached ───────── */
  const cacheSucursal = Object.create(null);
  const cacheProducto = Object.create(null);

  async function fetchCached(url, cache){
    if (cache[url]) return cache[url];
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    cache[url]=data; return data;
  }

  /* ───────── 6. debounce ───────── */
  const debounce = (fn,ms=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };

  /* ───────── 7. Autocomplete Factory ───────── */
  function Autocomplete(kind){
    const cfg = (kind==='suc') ? {
      inp:dom.sucInp, hid:dom.sucHid, box:dom.sucBox,
      state:state.suc, cache:cacheSucursal,
      url  : p => `${sucursalAutocompleteUrl}?current_sucursal_id=${currentSucursalId}&${p}`
    } : {
      inp:dom.prdInp, hid:dom.prdHid, box:dom.prdBox,
      state:state.prd, cache:cacheProducto,
      url:p=>{
        const excluded = state.items.length
              ? `&excluded=${state.items.map(i=>i.productId).join(',')}` : '';
        return `${productoAutocompleteUrl}?${p}${excluded}`;
      }
    };

    const render = async ()=>{
      if (cfg.state.loading || !cfg.state.more) return;
      cfg.state.loading=true;

      const params = new URLSearchParams({ term:cfg.state.term, page:cfg.state.page });
      try{
        const data = await fetchCached(cfg.url(params), cfg.cache);
        if (cfg.state.page===1) cfg.box.innerHTML='';

        if (data.results.length){
          data.results.forEach(r=>{
            const div=document.createElement('div');
            div.className='autocomplete-option';
            div.dataset.id=r.id; div.textContent=r.text;
            cfg.box.appendChild(div);
          });
          cfg.state.more = data.has_more;
        }else if (cfg.state.page===1){
          cfg.box.innerHTML = '<div class="autocomplete-no-result">No se encontraron resultados</div>';
          cfg.state.more=false;
        }
        cfg.box.style.display='block';
      }catch(err){ console.error(err); }
      cfg.state.loading=false;
    };

    const delayed = debounce(()=>{ cfg.state.page=1; cfg.state.more=true; render(); });
    cfg.inp.addEventListener('input',()=>{
      cfg.hid.value=''; cfg.state.term=cfg.inp.value.trim();
      if (!cfg.state.term){ cfg.box.style.display='none'; return; }
      delayed();
    });
    cfg.inp.addEventListener('focus',()=>{
      cfg.state.term=cfg.inp.value.trim(); cfg.state.page=1; cfg.state.more=true; render();
    });
    cfg.box.addEventListener('scroll',()=>{
      if (cfg.box.scrollTop+cfg.box.clientHeight>=cfg.box.scrollHeight-4)
        if (cfg.state.more && !cfg.state.loading){ cfg.state.page++; render(); }
    });
    cfg.box.addEventListener('click',e=>{
      const opt=e.target.closest('.autocomplete-option'); if (!opt) return;
      cfg.inp.value=opt.textContent; cfg.hid.value=opt.dataset.id; cfg.box.style.display='none';
    });
    document.addEventListener('click',e=>{
      if (!cfg.inp.contains(e.target) && !cfg.box.contains(e.target))
        cfg.box.style.display='none';
    });
  }
  Autocomplete('suc');
  Autocomplete('prd');

  /* ───────── 8. Agregar fila ───────── */
  dom.btnAdd.addEventListener('click', ()=>{
    UI.clearAlerts(); UI.clearFieldErrors();

    const sid=dom.sucHid.value.trim();
    const pid=dom.prdHid.value.trim();
    const qty=dom.qtyInp.value.trim();
    const pname=dom.prdInp.value.trim();

    let bad=false;
    if (!sid){ UI.fieldError('sucursal','Debe seleccionar una sucursal.'); bad=true; }
    if (!pid){ UI.fieldError('productoid','Debe seleccionar un producto.'); bad=true; }
    if (!qty || qty<=0){ UI.fieldError('cantidad','Cantidad debe ser mayor que 0.'); bad=true; }
    if (bad) return;

    if (state.items.some(i=>i.productId===pid)){
      UI.fieldError('productoid','Este producto ya está en la lista.'); return;
    }

    state.items.push({ productId:pid, productName:pname, cantidad:qty });

    dataTable.row.add([
      pname,
      `<input type="number" class="qty-input" min="1" value="${qty}">`,
      `<button type="button" class="btn-eliminar" data-product-id="${pid}">
         <i class="fas fa-trash-alt"></i>
       </button>`
    ]).draw(false);

    dom.prdInp.value=''; dom.prdHid.value=''; dom.qtyInp.value='';
  });

  /* ───────── 9. Eliminar fila ───────── */
  dom.rowsWrap.addEventListener('click',e=>{
    const btn=e.target.closest('.btn-eliminar'); if (!btn) return;
    const pid=btn.dataset.productId;
    state.items=state.items.filter(i=>i.productId!==pid);
    dataTable.row(btn.closest('tr')).remove().draw(false);
  });

  /* ───────── 10. submit ───────── */
  dom.form.addEventListener('submit',async ev=>{
    ev.preventDefault();
    UI.clearAlerts(); UI.clearFieldErrors();

    if (!state.items.length){
      UI.err('Debe agregar al menos un producto.'); return;
    }

    /* sincronizar cantidades editadas */
    dataTable.rows().every(function(){
      const [prod, qtyCell] = this.node().querySelectorAll('td');
      const item = state.items.find(i=>i.productName===prod.textContent.trim());
      const inp  = qtyCell.querySelector('.qty-input');
      if (item && inp) item.cantidad = inp.value.trim();
    });

    $id('id_inventarios_temp').value = JSON.stringify(state.items);

    try{
      const resp = await fetch(dom.form.action,{
        method:'POST',
        headers:{
          'X-CSRFToken': document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))?.split('=')[1] || '',
          'Accept':'application/json'
        },
        body:new FormData(dom.form)
      });
      const data = await resp.json();

      if (data.success){
        /* Éxito → redirige */
        window.location.href = data.redirect_url || window.location.href;
      }else{
        /* errores de validación */
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
