/*  static/javascript/agregar_pedido.js
    ──────────────────────────────────────────────────────────────
    · Autocompletados con scroll infinito + caché
    · “Producto” depende del proveedor y excluye los ya listados
    · Tabla DataTables responsive (data-label)
    · Mensajes de error simultáneos + borde rojo
    · Envío AJAX + flashes
    · Date-picker: se abre al hacer clic o foco
---------------------------------------------------------------- */
(() => {
  "use strict";

  /* ───────── helpers DOM ───────── */
  const $id = id  => document.getElementById(id);
  const $qs = sel => document.querySelector(sel);

  /* ───────── DataTable ─────────── */
  const HEADERS = ["Producto","Cantidad","Precio U.","Subtotal","Acciones"];
  const dt = $("#detalle-pedido").DataTable({
    paging:false, searching:false, info:false, responsive:true,
    columnDefs:[{targets:4,orderable:false}],
    rowCallback: row =>
      $("td",row).each((i,td)=>td.setAttribute("data-label",HEADERS[i]))
  });

  /* ───────── state ─────────────── */
  const state = {
    detalles : [],
    priceSel : 0,
    caches   : { proveedor:{}, sucursal:{}, producto:{} }
  };

  /* ═════ UI helpers & errores ═════ */
  const ERR_BOX_MAP = {
    detalles:"detalles", producto:"detalles", cantidad:"cantidad",
    proveedor:"proveedor", proveedor_autocomplete:"proveedor",
    sucursal:"sucursal",  sucursal_autocomplete:"sucursal",
    fechaestimadaentrega:"fechaestimadaentrega"
  };
  const INPUT_MAP = {
    detalles:$id("producto-input"), producto:$id("producto-input"),
    cantidad:$id("cantidad-input"),
    proveedor:$id("id_proveedor_autocomplete"),
    proveedor_autocomplete:$id("id_proveedor_autocomplete"),
    sucursal:$id("id_sucursal_autocomplete"),
    sucursal_autocomplete:$id("id_sucursal_autocomplete"),
    fechaestimadaentrega:$id("id_fechaestimadaentrega")
  };

  const UI = {
    ok(msg){
      const b=$id("success-message");
      b.innerHTML=`<i class="fas fa-check-circle"></i> ${msg}`;
      b.style.display="block";
    },
    err(msg){
      const b=$id("error-message");
      b.innerHTML=`<i class="fas fa-exclamation-circle"></i> ${msg}`;
      b.style.display="block";
    },
    clearAlerts(){
      ["success-message","error-message"].forEach(id=>{
        const e=$id(id); e.style.display="none"; e.innerHTML="";
      });
    },
    clearFieldErrors(){
      document.querySelectorAll(".field-error").forEach(b=>{
        b.classList.remove("visible"); b.innerHTML="";
      });
      document.querySelectorAll(".input-error")
        .forEach(i=>i.classList.remove("input-error"));
    },
    fieldError(field,msg){
      const key   = ERR_BOX_MAP[field] || field;
      let   box   = $qs(`#error-id_${key}`);
      const input = INPUT_MAP[field] || INPUT_MAP[key];

      if(!box && input){                      /* si no existe → lo creamos */
        box = document.createElement("div");
        box.id = `error-id_${key}`;
        box.className = "field-error";
        input.parentNode.insertBefore(box, input.nextSibling);
      }
      if(box){
        box.innerHTML =
          `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        box.classList.add("visible");
      }
      input?.classList.add("input-error");
    }
  };

  /* ───────── Autocomplete factory ───────── */
  function addAutocomplete({
      inp, hidden, box, url,
      extraParams=()=>({}), before=()=>true, onSelect=null
  }){
    const cache = state.caches[box.dataset.cacheKey];
    let page=1, term="", more=true, loading=false;
    const debounce=(fn,ms=300)=>{
      let t; return(...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); };
    };

    async function render(){
      if(loading||!more||!before()) return;
      loading=true;
      const qs  = new URLSearchParams({term,page, ...extraParams()});
      const key = `${url}?${qs}`;
      let data  = cache[key];
      if(!data){ const r=await fetch(key); data=await r.json(); cache[key]=data; }

      if(page===1) box.innerHTML="";
      if(data.results.length){
        data.results.forEach(r=>{
          box.insertAdjacentHTML(
            "beforeend",
            `<div class="autocomplete-option"
                 data-id="${r.id}"
                 ${r.precio!==undefined?`data-precio="${r.precio}"`:""}>
               ${r.text.trimStart()}
             </div>`);           /* 🔸 sin espacios al inicio */
        });
        more=data.has_more;
      }else if(page===1){
        box.innerHTML='<div class="autocomplete-no-result">Sin resultados</div>';
        more=false;
      }
      box.style.display="block"; loading=false;
    }
    const debRender = debounce(()=>{page=1;more=true;render();});

    inp.addEventListener("input",()=>{
      hidden.value="";
      term=inp.value.trim();
      if(!term){ box.style.display="none"; return; }
      debRender();
    });
    inp.addEventListener("focus",()=>{
      term=inp.value.trim(); page=1; more=true; render();
    });
    box.addEventListener("scroll",()=>{
      if(box.scrollTop+box.clientHeight>=box.scrollHeight-4 && more && !loading){
        page++; render();
      }
    });
    box.addEventListener("click",e=>{
      const opt=e.target.closest(".autocomplete-option"); if(!opt) return;
      inp.value   = opt.textContent.trimStart();   /* 🔸  pega limpio */
      hidden.value= opt.dataset.id;
      box.style.display="none";
      onSelect && onSelect(opt);
    });
    document.addEventListener("click",e=>{
      if(!inp.contains(e.target)&&!box.contains(e.target)) box.style.display="none";
    });
  }

  /* ═════ Instancias autocomplete ═════ */
  addAutocomplete({
    inp:$id("id_proveedor_autocomplete"),
    hidden:$id("id_proveedor"),
    box:(()=>{const b=$id("proveedor-autocomplete-results");
              b.dataset.cacheKey="proveedor";return b;})(),
    url:proveedorAutocompleteUrl,
    onSelect:()=>{
      state.caches.producto={}; state.detalles=[]; dt.clear().draw();
      $id("producto-input").value=""; $id("producto-id").value="";
      state.priceSel=0; UI.clearAlerts(); UI.clearFieldErrors();
    }
  });
  addAutocomplete({
    inp:$id("id_sucursal_autocomplete"),
    hidden:$id("id_sucursal"),
    box:(()=>{const b=$id("sucursal-autocomplete-results");
              b.dataset.cacheKey="sucursal";return b;})(),
    url:sucursalAutocompleteUrl
  });
  addAutocomplete({
    inp:$id("producto-input"),
    hidden:$id("producto-id"),
    box:(()=>{const b=$id("producto-autocomplete-results");
              b.dataset.cacheKey="producto";return b;})(),
    url:productoPedidoAutocompleteUrl,
    extraParams:()=>({
      proveedor_id:$id("id_proveedor").value.trim(),
      excluded:state.detalles.map(d=>d.productoid).join(",")
    }),
    before:()=>!!$id("id_proveedor").value.trim(),
    onSelect:o=>{state.priceSel=parseFloat(o.dataset.precio)||0;}
  });

  /* ═════ util money ═════ */
  const money = n =>
    new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP"}).format(n);

  function redrawTable(){
    dt.clear(); let total=0;
    state.detalles.forEach(d=>{
      total+=d.subtotal;
      dt.row.add([
        d.producto,
        d.cantidad,
        money(d.precio_unitario),
        money(d.subtotal),
        `<button type="button" class="btn-eliminar" data-id="${d.productoid}">
           <i class="fas fa-trash-alt"></i>
         </button>`
      ]);
    });
    dt.draw(false);
    $qs("#total-valor").textContent = money(total);
  }

  /* ═════ Añadir producto ═════ */
  $id("agregarDetalleBtn").addEventListener("click",()=>{
    UI.clearAlerts(); UI.clearFieldErrors();
    let valid=true;

    if(!$id("id_proveedor").value.trim()){
      UI.fieldError("proveedor","Seleccione un proveedor."); valid=false;
    }
    if(!$id("id_sucursal").value.trim()){
      UI.fieldError("sucursal","Seleccione una sucursal."); valid=false;
    }
    const pid=$id("producto-id").value.trim();
    if(!pid){ UI.fieldError("producto","Seleccione un producto."); valid=false; }

    const rawQty=$id("cantidad-input").value.trim();
    const qty=parseInt(rawQty,10);
    if(!rawQty || isNaN(qty) || qty<1){
      UI.fieldError("cantidad","Cantidad inválida."); valid=false;
    }
    if(!valid) return;

    const pu=state.priceSel;
    const existing=state.detalles.find(r=>r.productoid===pid);
    if(existing){
      existing.cantidad+=qty;
      existing.subtotal=existing.cantidad*existing.precio_unitario;
    }else{
      state.detalles.push({
        productoid:pid,
        producto:$id("producto-input").value.trim(),
        cantidad:qty,
        precio_unitario:pu,
        subtotal:pu*qty
      });
    }
    state.caches.producto={}; redrawTable();
    $id("producto-input").value=""; $id("producto-id").value="";
    $id("cantidad-input").value="1"; state.priceSel=0;
  });

  /* ═════ Eliminar fila ═════ */
  $("#detalle-pedido tbody").on("click",".btn-eliminar",function(){
    const pid=this.dataset.id;
    state.detalles=state.detalles.filter(r=>r.productoid!==pid);
    state.caches.producto={};
    dt.row($(this).parents("tr")).remove().draw(false);
    redrawTable();
  });

  /* ═════ Submit form ═════ */
  $id("pedidoForm").addEventListener("submit",async e=>{
    e.preventDefault(); UI.clearAlerts(); UI.clearFieldErrors();
    let valid=true;
    if(!$id("id_proveedor").value.trim()){
      UI.fieldError("proveedor","Seleccione un proveedor."); valid=false;
    }
    if(!$id("id_sucursal").value.trim()){
      UI.fieldError("sucursal","Seleccione una sucursal."); valid=false;
    }
    if(!state.detalles.length){
      UI.fieldError("detalles","Agregue al menos un producto."); valid=false;
    }
    if(!valid) return;

    $id("id_detalles").value = JSON.stringify(state.detalles);

    try{
      const r=await fetch(e.target.action,{
        method:"POST",
        headers:{
          "X-CSRFToken":document.cookie.split(";")
                         .find(c=>c.trim().startsWith("csrftoken=")).split("=")[1],
          "Accept":"application/json"
        },
        body:new FormData(e.target)
      });
      const js=await r.json();
      if(js.success){
        UI.ok(js.message||"Pedido guardado exitosamente.");
        e.target.reset(); state.detalles=[]; dt.clear().draw(); redrawTable();
        state.caches.producto={};
      }else if(js.errors){
        const errs=JSON.parse(js.errors);
        Object.entries(errs)
          .forEach(([f,arr])=>arr.forEach(er=>UI.fieldError(f,er.message)));
      }else UI.err(js.message||"Error desconocido.");
    }catch(err){ console.error(err); UI.err("Error de red."); }
  });

  /* ═════ Date-picker ═════ */
  const fecha=$id("id_fechaestimadaentrega");
  if(fecha && fecha.showPicker){
    ["mousedown","focus"].forEach(evt=>
      fecha.addEventListener(evt,e=>{ e.preventDefault(); fecha.showPicker(); })
    );
  }

})();
