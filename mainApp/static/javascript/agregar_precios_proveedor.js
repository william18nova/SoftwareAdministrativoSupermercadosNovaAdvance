/*  agregar_precios_proveedor.js
    ───────────────────────────────────────────────
    · Autocompletados con scroll infinito + caché
    · Tabla DataTables responsive
    · Validación + guardado AJAX
    · Patrón y nomenclatura idénticos a agregar_inventario.js
   ---------------------------------------------------------- */
(() => {
  "use strict";

  /* Helpers DOM ------------------------------------------- */
  const $id  = id => document.getElementById(id);
  const $qs  =  s => document.querySelector(s);
  const $qsa =  s => document.querySelectorAll(s);

  /* DataTable --------------------------------------------- */
  const dt = $('#productos-list').DataTable({
    paging:false, searching:true, info:false, responsive:true,
    language:{
      search:"Buscar:", zeroRecords:"No se encontraron resultados",
      emptyTable:"No hay productos para mostrar"
    }
  });

  /* refs & estado ---------------------------------------- */
  const dom = {
    form:$id("preciosForm"),
    provInp:$id("id_proveedor_autocomplete"),
    provHid:$id("id_proveedor"),
    provBox:$id("proveedor-autocomplete-results"),

    prodInp:$id("id_producto_autocomplete"),
    prodHid:$id("id_productoid"),
    prodBox:$id("producto-autocomplete-results"),

    priceInp:$id("id_precio"),
    btnAdd:$id("agregarProductoBtn"),
    tbody:$id("productos-body"),

    alertErr:$id("error-message"),
    alertOk :$id("success-message"),
  };

  /* estado autocomplete + lista --------------------------- */
  const state = {
    prov:{page:1, term:"", loading:false, more:true},
    prod:{page:1, term:"", loading:false, more:true},
    items:[]   // [{productId, productName, price}]
  };

  /* UI helpers -------------------------------------------- */
  const UI = {
    clearAlerts(){
      [dom.alertErr, dom.alertOk].forEach(a=>{
        a.style.display="none"; a.innerHTML="";
      });
    },
    ok(msg){
      dom.alertOk.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
      dom.alertOk.style.display="block";
    },
    err(msg){
      dom.alertErr.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
      dom.alertErr.style.display="block";
    },
    clearErrors(){
      $qsa(".field-error").forEach(d=>{
        d.classList.remove("visible"); d.innerHTML="";
      });
      $qsa(".input-error").forEach(i=>i.classList.remove("input-error"));
    },
    fieldError(field, msg){
      const box = $qs(`#error-id_${field}`);
      if (box){
        box.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        box.classList.add("visible");
      }
      const map = {proveedor:dom.provInp, productoid:dom.prodInp, precio:dom.priceInp};
      (map[field]||null)?.classList.add("input-error");
    }
  };

  /* caching ---------------------------------------------- */
  const cProv = Object.create(null);
  const cProd = Object.create(null);
  const fetchCached = async (url, cache)=>{
    if (cache[url]) return cache[url];
    const resp = await fetch(url);
    const json = await resp.json();
    cache[url]=json; return json;
  };

  const debounce = (fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(fn,ms,...a);};};

  /* Autocomplete factory --------------------------------- */
  function auto(kind){
    const cfg = (kind==="prov") ? {
      inp:dom.provInp, hid:dom.provHid, box:dom.provBox,
      st:state.prov, cache:cProv,
      url:p=>`${proveedorAutocompleteUrl}?${p}`
    } : {
      inp:dom.prodInp, hid:dom.prodHid, box:dom.prodBox,
      st:state.prod, cache:cProd,
      url:p=>{
        const ex = state.items.map(i=>i.productId).join(",");
        return `${productoAutocompleteUrl}?${p}&excluded=${ex}`;
      }
    };

    const render = async()=>{
      if (cfg.st.loading || !cfg.st.more) return;
      cfg.st.loading=true;
      const params = new URLSearchParams({term:cfg.st.term,page:cfg.st.page});
      const data   = await fetchCached(cfg.url(params), cfg.cache);

      if (cfg.st.page===1) cfg.box.innerHTML="";
      if (data.results.length){
        for (const r of data.results){
          const d=document.createElement("div");
          d.className="autocomplete-option"; d.dataset.id=r.id; d.textContent=r.text;
          cfg.box.appendChild(d);
        }
        cfg.st.more=data.has_more;
      }else if (cfg.st.page===1){
        cfg.box.innerHTML='<div class="autocomplete-no-result">No se encontraron resultados</div>';
        cfg.st.more=false;
      }
      cfg.box.style.display="block"; cfg.st.loading=false;
    };

    const deb = debounce(()=>{cfg.st.page=1;cfg.st.more=true;render();});
    cfg.inp.addEventListener("input",()=>{
      cfg.hid.value=""; cfg.st.term=cfg.inp.value.trim();
      if (!cfg.st.term){cfg.box.style.display="none";return;}
      deb();
    });
    cfg.inp.addEventListener("focus",()=>{
      cfg.st.term=cfg.inp.value.trim(); cfg.st.page=1; cfg.st.more=true; render();
    });
    cfg.box.addEventListener("scroll",()=>{
      if (cfg.box.scrollTop+cfg.box.clientHeight>=cfg.box.scrollHeight-4 && cfg.st.more && !cfg.st.loading){
        cfg.st.page++; render();
      }
    });
    cfg.box.addEventListener("click",e=>{
      const opt=e.target.closest(".autocomplete-option"); if(!opt) return;
      cfg.inp.value=opt.textContent; cfg.hid.value=opt.dataset.id; cfg.box.style.display="none";
    });
    document.addEventListener("click",e=>{
      if(!cfg.inp.contains(e.target)&&!cfg.box.contains(e.target)) cfg.box.style.display="none";
    });
  }
  auto("prov"); auto("prod");

  /* Agregar fila ----------------------------------------- */
  dom.btnAdd.addEventListener("click",()=>{
    UI.clearAlerts(); UI.clearErrors();

    const pid=dom.prodHid.value.trim(), pname=dom.prodInp.value.trim();
    const price=dom.priceInp.value.trim(), provId=dom.provHid.value.trim();

    let bad=false;
    if(!provId){UI.fieldError("proveedor","Debe seleccionar un proveedor.");bad=true;}
    if(!pid){UI.fieldError("productoid","Debe seleccionar un producto.");bad=true;}
    if(!price||parseFloat(price)<=0){UI.fieldError("precio","El precio debe ser mayor que 0.");bad=true;}
    if(bad) return;

    if(state.items.some(i=>i.productId===pid)){
      UI.fieldError("productoid","Este producto ya está en la lista."); return;
    }

    state.items.push({productId:pid,productName:pname,price});
    dt.row.add([
      pname,
      `<input type="number" class="price-input" value="${price}" step="0.01" min="0.01" style="width:80px;">`,
      `<button type="button" class="btn-eliminar" data-product-id="${pid}">
         <i class="fas fa-trash-alt"></i>
       </button>`
    ]).draw(false);

    dom.prodInp.value=""; dom.prodHid.value=""; dom.priceInp.value="";
  });

  /* Eliminar fila ---------------------------------------- */
  dom.tbody.addEventListener("click",e=>{
    const btn=e.target.closest(".btn-eliminar"); if(!btn) return;
    const pid=btn.dataset.productId; dt.row(btn.closest("tr")).remove().draw(false);
    state.items=state.items.filter(i=>i.productId!==pid);
  });

  /* Submit ----------------------------------------------- */
  dom.form.addEventListener("submit",async ev=>{
    ev.preventDefault(); UI.clearAlerts(); UI.clearErrors();

    if(!state.items.length){UI.err("Debe agregar al menos un producto.");return;}

    /* sync precios editados */
    dt.rows().every(function(){
      const [prod,priceCell]=this.node().querySelectorAll("td");
      const item=state.items.find(i=>i.productName===prod.textContent.trim());
      const inp=priceCell.querySelector(".price-input");
      if(item&&inp) item.price=inp.value.trim();
    });

    $id("id_precios_temp").value=JSON.stringify(state.items);

    try{
      const r=await fetch(dom.form.action,{
        method:"POST",
        headers:{
          "X-CSRFToken":document.cookie.split(";")
                          .find(c=>c.trim().startsWith("csrftoken="))?.split("=")[1]||"",
          Accept:"application/json"
        },
        body:new FormData(dom.form)
      });
      const data=await r.json();
      if(data.success){
        UI.ok("Productos y precios agregados exitosamente.");
        dom.form.reset(); state.items=[]; dt.clear().draw();
        [dom.provBox,dom.prodBox].forEach(b=>b.style.display="none");
        // limpiar caches para refrescar datos
        Object.keys(cProv).forEach(k=>delete cProv[k]);
        Object.keys(cProd).forEach(k=>delete cProd[k]);
      }else{
        const errs=JSON.parse(data.errors||"{}");
        for(const [field,arr] of Object.entries(errs))
          arr.forEach(e=>UI.fieldError(field,e.message));
      }
    }catch(err){console.error(err);UI.err("Ocurrió un error inesperado.");}
  });
})();
