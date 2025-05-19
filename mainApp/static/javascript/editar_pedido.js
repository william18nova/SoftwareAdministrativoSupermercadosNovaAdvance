/* static/javascript/editar_pedido.js */
$(document).ready(function () {
  "use strict";

  /* ─────────  INIT  ───────── */
  $("#id_fechaestimadaentrega").datepicker({ minDate: 0, dateFormat: "dd/mm/yy" });

  const table = $("#detalle-productos").DataTable({
    paging:false, info:false, searching:true, dom:"t", language:{ emptyTable:"" }
  });

  let detalles = initialDetalles || [];
  window.selectedProductPrice = 0;

  /* ─────────  HELPER ALERTAS  ───────── */
  function showError(msg){
    $("#error-message").hide().text(msg).fadeIn();
  }
  function clearAlerts(){ $("#success-message,#error-message").hide().text(""); }

  /* ─────────  ACTUALIZAR TABLA  ───────── */
  function refrescarTabla(){
    table.clear();
    let total=0;
    detalles.forEach(d=>{
      total += +d.subtotal;
      table.row.add([
        d.producto,
        d.cantidad,
        (+d.precio_unitario).toFixed(2),
        (+d.subtotal).toFixed(2),
        `<button class="btn-eliminar btn-eliminar-producto" data-id="${d.detallepedidoid}">
           <i class="fas fa-trash-alt"></i>
         </button>`
      ]);
    });
    table.draw();
    $("#id_detalles").val(JSON.stringify(detalles));
    $("#total-valor").text(
      new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP"}).format(total)
    );
  }
  refrescarTabla();

  /* ─────────  AGREGAR / ELIMINAR PRODUCTOS  ───────── */
  $("#agregarProductoPedido").on("click",()=>{
    clearAlerts();
    const prodIdTxt=$("#producto_id").val().trim(),
          prodName=$("#producto_autocomplete").val().trim(),
          cant=parseInt($("#cantidad").val(),10),
          pu=window.selectedProductPrice||0;

    if(!prodIdTxt)               return showError("Debe seleccionar un producto.");
    if(isNaN(cant)||cant<1)      return showError("Ingrese una cantidad válida.");

    const prodId=+prodIdTxt;
    const existe=detalles.find(i=>+i.productoid===prodId);
    if(existe){
      existe.cantidad += cant;
      existe.subtotal  = existe.cantidad * existe.precio_unitario;
    }else{
      detalles.push({
        detallepedidoid:"tmp-"+Date.now(),
        productoid:prodId,
        producto:prodName,
        cantidad:cant,
        precio_unitario:pu,
        subtotal:pu*cant
      });
    }
    $("#producto_autocomplete,#producto_id").val("");
    $("#cantidad").val("1"); window.selectedProductPrice=0;
    refrescarTabla();
  });

  $("#detalle-productos").on("click",".btn-eliminar-producto",function(){
    detalles = detalles.filter(d=>d.detallepedidoid!=$(this).data("id"));
    refrescarTabla();
  });

  $("#buscador-detalles").on("keyup",function(){ table.search(this.value).draw(); });

  /* ─────────  VALIDAR PRODUCTOS vs PROVEEDOR  ───────── */
  function validarConProveedor(provId, onOk){
    $.getJSON(
      productoPedidoAutocompleteUrl,
      { proveedor_id: provId, term: "" },
      data=>{
        const permitidos = data.results.map(r=> +r.id);
        const prohibidos = detalles.filter(d=>!permitidos.includes(+d.productoid));
        if(prohibidos.length){
          const nombres = prohibidos.map(p=>p.producto).join(", ");
          showError("El proveedor no vende los siguientes productos: "+nombres);
        }else{
          onOk(); // todo correcto, continuar
        }
      }
    ).fail(()=> showError("No se pudo validar productos del proveedor."));
  }

  /* ─────────  SUBMIT  ───────── */
  $("#pedidoForm").on("submit",function(e){
    e.preventDefault(); clearAlerts();
    if(!detalles.length) return showError("Debe agregar al menos un producto.");

    const proveedorId = $("#id_proveedor").val();
    if(!proveedorId)    return showError("Seleccione un proveedor.");

    $("#id_detalles").val(JSON.stringify(detalles));

    validarConProveedor(proveedorId, () => {
      // solo si pasa la validación
      $.post({
        url: $(this).attr("action"),
        data: $(this).serialize(),
        dataType:"json",
        success:data=>{
          if(data.success){
            window.location.href = visualizarPedidosUrl + "?updated=1";
          }else if(data.errors){
            let msg=""; Object.values(data.errors).forEach(errs=>errs.forEach(e=>msg+=e.message+"\n"));
            showError(msg||"Error al actualizar.");
          }else showError(data.message||"Error inesperado.");
        },
        error:()=> showError("Error al conectar con el servidor.")
      });
    });
  });

  /* ─────────  AUTOCOMPLETES  ───────── */
  function auto($inp, url, hiddenSel){
    $inp.autocomplete({
      delay:100, minLength:0,
      source:(r,resp)=>$.getJSON(url,{term:r.term},d=>resp(
        d.results.map(i=>({label:i.text, id:i.id}))
      )),
      select:(e,ui)=>{
        $inp.val(ui.item.label);
        if(hiddenSel) $(hiddenSel).val(ui.item.id);
        return false;
      }
    }).on("focus",function(){ $(this).autocomplete("search",""); });
  }

  // Proveedor con pre-validación al cambiar
  $("#id_proveedor_autocomplete").autocomplete({
    delay:100,minLength:0,
    source:(r,resp)=>$.getJSON(proveedorAutocompleteUrl,{term:r.term},d=>resp(
      d.results.map(i=>({label:i.text,id:i.id}))
    )),
    select:(e,ui)=>{
      $("#id_proveedor_autocomplete").val(ui.item.label);
      $("#id_proveedor").val(ui.item.id);
      // Revisar incompatibilidades inmediatamente
      validarConProveedor(ui.item.id, ()=>{});
      return false;
    }
  }).on("focus",function(){ $(this).autocomplete("search",""); });

  auto($("#id_sucursal_autocomplete"), sucursalAutocompleteUrl, "#id_sucursal");

  $("#producto_autocomplete").autocomplete({
    delay:100,minLength:0,
    source:(r,resp)=>$.getJSON(
      productoPedidoAutocompleteUrl,
      { term:r.term, proveedor_id: $("#id_proveedor").val() },
      d=>resp(d.results.map(i=>({ label:i.text, id:i.id, precio:i.precio||0 })))
    ),
    select:(e,ui)=>{
      $("#producto_autocomplete").val(ui.item.label);
      $("#producto_id").val(ui.item.id);
      window.selectedProductPrice = parseFloat(ui.item.precio)||0;
      return false;
    }
  }).on("focus",function(){ $(this).autocomplete("search",""); });
});
