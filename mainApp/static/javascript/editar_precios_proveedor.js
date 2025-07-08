/*  editar_precios_proveedor.js
    ────────────────────────────────────────────────────────────────
    • Mantiene selectedProvId para que el proveedor actual
      siga apareciendo en el autocomplete, aunque el usuario
      borre el texto del input.
    • El formulario sólo borra el hidden cuando REALMENTE
      se confirma otro proveedor.
    • Por lo demás es idéntico a la versión anterior.
*/
(() => {
  "use strict";

  /* Helpers */
  const $id  = id  => document.getElementById(id);
  const $qs  = sel => document.querySelector(sel);
  const $qsa = sel => document.querySelectorAll(sel);

  /* Refs DOM */
  const dom = {
    form      : $id("preciosForm"),
    provInp   : $id("id_proveedor_autocomplete"),
    provHid   : $id("id_proveedor"),
    provBox   : $id("proveedor-autocomplete-results"),
    prodInp   : $id("id_producto_autocomplete"),
    prodHid   : $id("id_productoid"),
    prodBox   : $id("producto-autocomplete-results"),
    priceInp  : $id("id_precio"),
    btnAdd    : $id("agregarProductoBtn"),
    tbody     : $id("productos-body"),
    hidden    : $id("id_precios_temp"),
    alertErr  : $id("error-message"),
    alertOk   : $id("success-message"),
  };

  /* DataTable */
  const dt = $("#productos-list").DataTable({
    paging:false, searching:true, info:false, responsive:true,
    language:{
      search:"Buscar:",
      zeroRecords:"No se encontraron resultados",
      emptyTable:"No hay productos para mostrar"
    }
  });

  /* State */
  const state = {
    prov : { page:1, term:"", loading:false, more:true },
    prod : { page:1, term:"", loading:false, more:true },
    items: []                // [{productId, productName, price}]
  };

  /* ------- proveedor seleccionado actual ------- */
  let selectedProvId = dom.provHid.value || "";   // se carga con el valor inicial

  /* UI helpers */
  const UI = {
    clrAlerts(){
      [dom.alertErr, dom.alertOk].forEach(el=>{ el.style.display="none"; el.innerHTML=""; });
    },
    ok(msg){ dom.alertOk.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`; dom.alertOk.style.display="block"; },
    err(msg){ dom.alertErr.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`; dom.alertErr.style.display="block"; },
    clrFieldErr(){
      $qsa(".field-error").forEach(d=>{ d.classList.remove("visible"); d.innerHTML=""; });
      $qsa(".input-error").forEach(i=>i.classList.remove("input-error"));
    },
    fErr(field,msg){
      const box = $qs(`#error-id_${field}`);
      if(box){
        box.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        box.classList.add("visible");
      }
      const map = { proveedor:dom.provInp, productoid:dom.prodInp, precio:dom.priceInp };
      (map[field]||null)?.classList.add("input-error");
    }
  };

  /* --- cache util --- */
  const caches = { prov:Object.create(null), prod:Object.create(null) };
  const fetchC = async(url, type)=>{
    if(caches[type][url]) return caches[type][url];
    const r = await fetch(url); const j = await r.json();
    caches[type][url]=j; return j;
  };
  const debounce = (fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);};};

  /* ---------- autocomplete factory ---------- */
  function makeAuto(kind){
    const cfg = (kind==="prov") ? {
      inp   : dom.provInp,
      hid   : dom.provHid,
      box   : dom.provBox,
      st    : state.prov,
      cache : "prov",
      url   : p => {
        const cur = selectedProvId ? `&current=${selectedProvId}` : "";
        return `${proveedorAutocompleteUrl}?${p}${cur}`;
      },
      onPick: (id)=>{               // si elige otro proveedor…
        selectedProvId = id;
        dom.provHid.value = id;
        /* si cambió, vaciamos caché de productos */
        Object.keys(caches.prod).forEach(k=>delete caches.prod[k]);
      }
    } : {
      inp   : dom.prodInp,
      hid   : dom.prodHid,
      box   : dom.prodBox,
      st    : state.prod,
      cache : "prod",
      url   : p =>{
        const exc = state.items.map(i=>i.productId).join(",");
        return `${productoPreciosAutocompleteUrl}?${p}&excluded=${exc}`;
      },
      onPick: ()=>{}
    };

    /* render opciones */
    const render = async()=>{
      if(cfg.st.loading || !cfg.st.more) return;
      cfg.st.loading=true;
      const qs = new URLSearchParams({term:cfg.st.term,page:cfg.st.page});
      const data = await fetchC(cfg.url(qs), cfg.cache);

      if(cfg.st.page===1) cfg.box.innerHTML="";
      if(data.results.length){
        data.results.forEach(r=>{
          const d=document.createElement("div");
          d.className="autocomplete-option"; d.dataset.id=r.id; d.textContent=r.text;
          cfg.box.appendChild(d);
        });
        cfg.st.more = data.has_more;
      }else if(cfg.st.page===1){
        cfg.box.innerHTML='<div class="autocomplete-no-result">No se encontraron resultados</div>';
        cfg.st.more=false;
      }
      cfg.box.style.display="block"; cfg.st.loading=false;
    };

    /* event bindings */
    const deb = debounce(()=>{ cfg.st.page=1; cfg.st.more=true; render(); });

    cfg.inp.addEventListener("input",()=>{
      cfg.st.term = cfg.inp.value.trim();
      cfg.st.page = 1; cfg.st.more = true;
      deb();
    });

    cfg.inp.addEventListener("focus",()=>{
      cfg.st.term = cfg.inp.value.trim();
      cfg.st.page = 1; cfg.st.more = true;
      render();
    });

    cfg.box.addEventListener("scroll",()=>{
      if(cfg.box.scrollTop+cfg.box.clientHeight>=cfg.box.scrollHeight-4 && cfg.st.more && !cfg.st.loading){
        cfg.st.page++; render();
      }
    });

    cfg.box.addEventListener("click",e=>{
      const opt=e.target.closest(".autocomplete-option"); if(!opt) return;
      cfg.inp.value = opt.textContent;
      cfg.onPick(opt.dataset.id);
      cfg.box.style.display="none";
      if(kind==="prod"){ cfg.hid.value = opt.dataset.id; }
    });

    document.addEventListener("click",e=>{
      if(!cfg.inp.contains(e.target) && !cfg.box.contains(e.target))
        cfg.box.style.display="none";
    });
  }
  makeAuto("prov");
  makeAuto("prod");

  /* ---------- precarga productos ---------- */
  if(Array.isArray(existingProducts)){
    existingProducts.forEach(p=>{
      state.items.push({productId:String(p.productId),productName:p.productName,price:String(p.price)});
      dt.row.add([
        p.productName,
        `<input type="number" class="price-input" value="${p.price}" step="0.01" min="0.01" style="width:80px;">`,
        `<button type="button" class="btn-eliminar" data-product-id="${p.productId}">
           <i class="fas fa-trash-alt"></i>
         </button>`
      ]).draw(false);
    });
  }

  /* ---------- agregar / actualizar fila ---------- */
  dom.btnAdd.addEventListener("click",()=>{
    UI.clrAlerts(); UI.clrFieldErr();

    const pid   = dom.prodHid.value.trim();
    const pname = dom.prodInp.value.trim();
    const price = dom.priceInp.value.trim();
    const provId= selectedProvId;

    let bad=false;
    if(!provId){ UI.fErr("proveedor","Debe seleccionar un proveedor."); bad=true; }
    if(!pid){   UI.fErr("productoid","Debe seleccionar un producto."); bad=true; }
    if(!price || parseFloat(price)<=0){ UI.fErr("precio","El precio debe ser mayor que 0."); bad=true; }
    if(bad) return;

    const idx = state.items.findIndex(i=>i.productId===pid);
    if(idx>=0){
      state.items[idx].price = price;
      dt.rows().every(function(){
        const btn=this.node().querySelector(".btn-eliminar");
        if(btn?.dataset.productId===pid)
          this.node().querySelector(".price-input").value = price;
      });
    }else{
      state.items.push({productId:pid,productName:pname,price});
      dt.row.add([
        pname,
        `<input type="number" class="price-input" value="${price}" step="0.01" min="0.01" style="width:80px;">`,
        `<button type="button" class="btn-eliminar" data-product-id="${pid}">
           <i class="fas fa-trash-alt"></i>
         </button>`
      ]).draw(false);
    }
    dom.prodInp.value  = "";
    dom.prodHid.value  = "";
    dom.priceInp.value = "";
  });

  /* eliminar fila */
  dom.tbody.addEventListener("click",e=>{
    const btn=e.target.closest(".btn-eliminar"); if(!btn) return;
    const pid=btn.dataset.productId;
    dt.row(btn.closest("tr")).remove().draw(false);
    state.items = state.items.filter(i=>i.productId!==pid);
  });

  /* submit */
  dom.form.addEventListener("submit",async ev=>{
    ev.preventDefault(); UI.clrAlerts(); UI.clrFieldErr();

    /* sync precios editados */
    dt.rows().every(function(){
      const pid=this.node().querySelector(".btn-eliminar")?.dataset.productId;
      if(!pid) return;
      const val=this.node().querySelector(".price-input")?.value.trim();
      const item=state.items.find(i=>i.productId===pid);
      if(item) item.price = val;
    });

    dom.hidden.value = JSON.stringify(state.items);

    try{
      const r=await fetch(dom.form.action,{
        method:"POST",
        headers:{
          "X-CSRFToken":document.cookie.split(";").find(c=>c.trim().startsWith("csrftoken="))?.split("=")[1]||"",
          Accept:"application/json"
        },
        body:new FormData(dom.form)
      });
      const data=await r.json();
      if(data.success){
        window.location.href = data.redirect_url;
      }else{
        const errs = JSON.parse(data.errors||"{}");
        for(const [field,arr] of Object.entries(errs))
          arr.forEach(e=>UI.fErr(field,e.message));
      }
    }catch(err){
      console.error(err);
      UI.err("Ocurrió un error inesperado al guardar.");
    }
  });
})();
