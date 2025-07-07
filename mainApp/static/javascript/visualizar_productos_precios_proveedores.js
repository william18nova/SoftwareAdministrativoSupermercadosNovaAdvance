/*  visualizar_productos_precios_proveedores.js
    ────────────────────────────────────────────
    • DataTable responsivo + castellano
    • Autocomplete proveedor (scroll infinito + debounce)
    • Eliminación vía AJAX
--------------------------------------------------------------*/
$(function () {
  "use strict";

  /* ---------- DataTable ---------- */
  const $tbl = $("#preciosTable");
  const dt   = $tbl.length ? $tbl.DataTable({
    paging:true, searching:true, info:true, responsive:true,
    language:{
      search:"", zeroRecords:"Sin registros",
      info:"Mostrando _START_ a _END_ de _TOTAL_",
      paginate:{ first:"Prim.", last:"Últ.", next:"Sig.", previous:"Ant." }
    },
    columnDefs:[{ targets:"no-sort", orderable:false }]
  }) : null;

  /* ---------- flash helper ---------- */
  const $flash = $("<div class='alert' style='display:none'></div>")
                 .insertAfter("h2");
  const showFlash = (ok,msg) =>
    $flash.removeClass("alert-success alert-error")
          .addClass(ok?"alert-success":"alert-error")
          .text(msg).show();

  /* ---------- eliminar precio ---------- */
  $tbl.on("click",".btn-eliminar",function(){
    const $btn = $(this), id = $btn.data("precio-id");
    if (!id || !confirm("¿Eliminar este precio?")) return;

    $.post(eliminarPrecioUrl.replace("0", id), {
      csrfmiddlewaretoken: $("input[name=csrfmiddlewaretoken]").val()
    })
    .done(res=>{
      if(res.success && dt){ dt.row($btn.closest("tr")).remove().draw(false); }
      showFlash(res.success, res.message);
    })
    .fail(()=> showFlash(false,"Error al eliminar el precio."));
  });

  /* ---------- autocomplete proveedor ---------- */
  const $inp = $("#id_proveedor_autocomplete"),
        $hid = $("#id_proveedor"),
        $box = $("#proveedor-autocomplete-results");

  let page=1, term="", loading=false, more=true;

  const fetchProv = ()=>{
    if(loading||!more) return;
    loading=true;
    $.getJSON(proveedorAutocompleteUrl, { term, page })
      .done(data=>{
        if(page===1){ $box.empty(); }
        if(data.results.length){
          data.results.forEach(r=>{
            $("<div>",{"class":"autocomplete-option",text:r.text,"data-id":r.id})
              .appendTo($box);
          });
          more=data.has_more;
        }else if(page===1){
          $box.html('<div class="autocomplete-no-result">Sin resultados</div>');
          more=false;
        }
        $box.show(); loading=false;
      })
      .fail(()=> loading=false);
  };
  const deb = (fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(fn,ms,...a);};};

  const kick = deb(()=>{page=1;more=true;fetchProv();},250);

  $inp.on("input",()=>{
    $hid.val(""); term=$.trim($inp.val()); kick();
  }).on("focus",()=>{
    term=$.trim($inp.val()); page=1; more=true; fetchProv();
  });

  $box.on("click",".autocomplete-option",function(){
    $inp.val($(this).text()); $hid.val($(this).data("id"));
    $box.hide(); $("#proveedorForm").submit();
  }).on("scroll",function(){
    if(this.scrollTop + this.clientHeight >= this.scrollHeight-4 && more && !loading){
      page++; fetchProv();
    }
  });

  $(document).on("click",e=>{
    if(!$(e.target).closest("#id_proveedor_autocomplete, #proveedor-autocomplete-results").length){
      $box.hide();
    }
  });
});
