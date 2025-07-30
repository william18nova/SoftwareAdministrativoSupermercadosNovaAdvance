// static/javascript/generar_venta.js
$(function(){
  "use strict";
  const $ = window.jQuery;

  console.log("🔧 generar_venta.js cargado — DOM listo");

  // Formatea número a moneda COP
  const money = n =>
    new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP"})
      .format(Number(n)||0);

  // Parsea un string tipo "$ 1.234,56" a número 1234.56
  function parseCurrency(str) {
    let s = (str||"").replace(/[^\d\.,-]/g,"").replace(/\./g,"").replace(/,/,".");
    return parseFloat(s)||0;
  }

  // CSRF para POSTs
  $.ajaxSetup({
    beforeSend:(xhr, settings)=>{
      if(!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type)){
        const m=document.cookie.match(/csrftoken=([^;]+)/);
        if(m) xhr.setRequestHeader("X-CSRFToken",m[1]);
      }
    }
  });

  // Caché simple
  const cache={};
  function fetchCached(url, params={}){
    const key=url+JSON.stringify(params);
    if(cache[key]) return Promise.resolve(cache[key]);
    return $.getJSON(url, params).then(data=>cache[key]=data);
  }

  // Estado global
  let sucursalID = localStorage.getItem("sucursalID")||"";
  const productos=[], cantidades=[];
  const $tbody = $("#detalle-productos tbody");

  // Constructor de autocomplete
  function makeAC({selector,url,extra=()=>({}),parse,onSel}){
    $(selector).autocomplete({
      minLength:0, delay:120,
      source(req,resp){
        fetchCached(url,{term:req.term||"",...extra()})
          .then(d=>resp(parse(d)))
          .catch(()=>resp([]));
      },
      open(){
        $(this).autocomplete("widget").css("z-index",3000);
      },
      select:function(_e,ui){
        $(this).val(ui.item.label);
        onSel(ui.item);
        return false;
      }
    }).on("focus",function(){
      $(this).autocomplete("search","");
    });
  }

  // 1) Sucursal
  if(sucursalID){
    $("#sucursal_autocomplete").val(localStorage.getItem("sucursalName")||"");
    $("#sucursal_id").val(sucursalID);
  }
  makeAC({
    selector:"#sucursal_autocomplete",
    url:sucursalAutocompleteUrl,
    parse:d=>d.results.map(r=>({label:r.text,value:r.text,id:r.id})),
    onSel:({id,label})=>{
      sucursalID=id;
      $("#sucursal_id").val(id);
      localStorage.setItem("sucursalID",id);
      localStorage.setItem("sucursalName",label);
      $("#puntopago_autocomplete,#puntopago_id").val("");
      Object.keys(cache)
        .filter(k=>k.startsWith(puntopagoAutocompleteUrl))
        .forEach(k=>delete cache[k]);
    }
  });

  // 2) Punto de Pago
  makeAC({
    selector:"#puntopago_autocomplete",
    url:puntopagoAutocompleteUrl,
    extra:()=>({sucursal_id:sucursalID}),
    parse:d=>d.results.map(r=>({label:r.text,value:r.text,id:r.id})),
    onSel:({id,label})=>{
      $("#puntopago_autocomplete").val(label);
      $("#puntopago_id").val(id);
    }
  });

  // 3) Cliente (opcional)
  makeAC({
    selector:"#cliente_busqueda",
    url:clienteAutocompleteUrl,
    parse:d=>d.results.map(c=>({label:c.text,value:c.text,id:c.id})),
    onSel:({id,label})=>{
      $("#cliente_busqueda").val(label);
      $("#cliente_id").val(id);
    }
  });

  // 4) Producto
  makeAC({
    selector:"#producto_busqueda_nombre",
    url:productoAutocompleteUrl,
    extra:()=>({sucursal_id:sucursalID}),
    parse:d=>d.results.map(p=>({label:p.text,value:p.text,id:p.id})),
    onSel:item=>{
      const pid=item.id;
      $("#producto_busqueda_nombre").val(item.label);
      $("#producto_id").val(pid);
      // completa código y barras
      $.post(verificarProductoUrl,{producto_id:pid,cantidad:1,sucursal_id:sucursalID})
        .done(r=>{
          if(!r.exists) return alert("Producto no encontrado.");
          $("#producto_busqueda_codigo").val(pid);
          $("#producto_busqueda_codigo_barras").val(r.codigo_de_barras);
          $("#cantidad,#agregar-producto").prop("disabled",false);
        });
    }
  });

  // 5) Quagga (si te hace falta)
  $("#btnEscanear").click(()=>{
    $("#interactive").show();
    Quagga.init({
      inputStream:{type:"LiveStream",target:"#interactive",constraints:{facingMode:"environment"}},
      decoder:{readers:["ean_reader"]}
    },err=>err?console.error(err):Quagga.start());
    Quagga.onDetected(data=>{
      Quagga.stop(); $("#interactive").hide();
      const code=data.codeResult.code;
      $.getJSON(buscarProductoPorCodigoUrl,{codigo_de_barras:code,sucursal_id:sucursalID})
        .done(r=>{
          if(!r.exists) return alert("Producto no encontrado.");
          const p=r.producto;
          $("#producto_busqueda_nombre").val(p.nombre);
          $("#producto_busqueda_codigo").val(p.id);
          $("#producto_busqueda_codigo_barras").val(p.codigo_de_barras);
          $("#producto_id").val(p.id);
          $("#cantidad,#agregar-producto").prop("disabled",false);
        });
    });
  });

  // Calcula total
  function syncTotal(){
    let total=0;
    $tbody.find("td:nth-child(4)").each(function(){
      total+=parseCurrency($(this).text());
    });
    $("#total").text(money(total));
    $("#productos").val(JSON.stringify(productos));
    $("#cantidades").val(JSON.stringify(cantidades));
  }

  // Añadir al carrito
  $("#agregar-producto").click(()=>{
    const pid=$("#producto_id").val(), qty=parseInt($("#cantidad").val(),10);
    if(!pid||!qty||qty<1){ return alert("Datos inválidos."); }
    $.post(verificarProductoUrl,{producto_id:pid,cantidad:qty,sucursal_id:sucursalID})
     .done(r=>{
       if(!r.exists) return alert("Sin stock/sucursal.");
       if(r.cantidad_disponible<qty) return alert(`Solo ${r.cantidad_disponible} disponibles.`);
       const idx=productos.indexOf(pid);
       if(idx>-1){
         cantidades[idx]+=qty;
         const $row=$tbody.find(`td[data-id='${pid}']`).parent();
         $row.children().eq(1).text(cantidades[idx]);
         $row.children().eq(3).text(money(r.precio_unitario*cantidades[idx]));
       } else {
         productos.push(pid); cantidades.push(qty);
         $tbody.prepend(`
           <tr>
             <td data-id="${pid}">${r.nombre}</td>
             <td>${qty}</td>
             <td>${money(r.precio_unitario)}</td>
             <td>${money(r.subtotal)}</td>
             <td class="text-center">
               <button class="btn btn-danger btn-sm eliminar-producto">
                 <i class="fas fa-trash-alt"></i>
               </button>
             </td>
           </tr>
         `);
       }
       syncTotal();
       $("#producto_busqueda_nombre,#producto_busqueda_codigo,#producto_busqueda_codigo_barras").val("");
       $("#producto_id").val("");
       $("#cantidad").val(1);
       $("#cantidad,#agregar-producto").prop("disabled",true);
     });
  });

  // Eliminar
  $tbody.on("click",".eliminar-producto",function(){
    const pid=$(this).closest("tr").find("td:first").data("id").toString(),
          idx=productos.indexOf(pid);
    if(idx>-1){ productos.splice(idx,1); cantidades.splice(idx,1); }
    $(this).closest("tr").remove();
    syncTotal();
  });

  // ─── MODAL DE PAGO ───
  const $modal      = $("#myModal"),
        $radios     = $("input[name='payment_method']"),
        $efOptions  = $("#efectivo-options"),
        $amountIn   = $("#monto-recibido"),
        $changeOut  = $("#cambio"),
        $confirmBtn = $("#confirmar-pago");

  // Muestra modal
  $("#generar-venta").click(()=>{
    if(!productos.length)      return alert("Agregue productos.");
    if(!sucursalID||!$("#puntopago_id").val()) return alert("Seleccione sucursal y punto de pago.");
    $modal.show();
  });
  // Cierra modal
  $(".close").click(()=>$modal.hide());
  $(window).click(e=>{ if(e.target===$modal[0]) $modal.hide(); });

  // Al cambiar método
  $radios.change(function(){
    $efOptions.toggle(this.value==="efectivo");
    $amountIn.val("");
    $changeOut.text("");
  });

  // Calcula cambio al ingresar monto
  $amountIn.on("input",function(){
    const received=parseFloat($(this).val())||0,
          total=parseCurrency($("#total").text()),
          change=received-total;
    $changeOut.text(change>=0?`Cambio: ${money(change)}`:"");
  });

  // Confirmar pago
  $confirmBtn.click(()=>{
    const m=$radios.filter(":checked").val();
    if(!m) return alert("Seleccione medio de pago.");
    if(m==="efectivo"){
      const rec=parseFloat($amountIn.val())||0,
            tot=parseCurrency($("#total").text());
      if(rec<tot) return alert("Monto recibido insuficiente.");
    }
    // guardamos el medio y ocultamos modal
    $("#medio_pago").val(m);
    $modal.hide();
    // enviamos la venta
    $("#venta-form").submit();
  });

  // Submit AJAX fallback
  $("#venta-form").submit(function(e){
    e.preventDefault();
    $.post($(this).attr("action"),$(this).serialize())
      .done(r=>r.success?location.reload():alert(r.error||"Error"))
      .fail(()=>alert("Error de red"));
  });

  // Filtro rápido carrito
  $("#buscar-detalles").on("keyup",function(){
    const t=$(this).val().toLowerCase();
    $tbody.find("tr").each(function(){
      $(this).toggle($(this).text().toLowerCase().includes(t));
    });
  });
});
