/*  visualizar_horarios.js
    ─────────────────────────────────────────
    · DataTable responsivo
    · Autocomplete sucursal (scroll infinito + debounce + caché)
    · Eliminación vía AJAX
*/
$(function () {
  "use strict";

  /* ---------- DataTable ---------- */
  const $tbl = $("#horariosTable");
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
  const flash  = (ok,msg)=> $flash.removeClass("alert-success alert-error")
                                  .addClass(ok?"alert-success":"alert-error")
                                  .text(msg).show();

  /* ---------- eliminar horario ---------- */
  $tbl.on("click",".btn-eliminar",function(){
    const $btn = $(this), id = $btn.data("h-id");
    if(!id || !confirm("¿Eliminar este horario?")) return;

    $.post(eliminarHorarioUrl.replace("0", id),{
      csrfmiddlewaretoken:$("input[name=csrfmiddlewaretoken]").val()
    }).done(res=>{
      if(res.success && dt){ dt.row($btn.closest("tr")).remove().draw(false); }
      flash(res.success,res.message);
    }).fail(()=> flash(false,"Error al eliminar el horario."));
  });

  /* ---------- autocomplete sucursal ---------- */
  const $inp = $("#id_sucursal_autocomplete"),
        $hid = $("#id_sucursal"),
        $box = $("#sucursal-autocomplete-results");

  let pg=1, term="", loading=false, more=true;
  const cache = Object.create(null);

  const fetchSuc = ()=>{
    if(loading||!more) return;
    loading=true;
    const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${pg}`;
    if(cache[url]){ render(cache[url]); return; }
    $.getJSON(url).done(data=>{ cache[url]=data; render(data); })
                  .always(()=> loading=false);
  };
  const render = data=>{
    if(pg===1){ $box.empty(); }
    if(data.results.length){
      data.results.forEach(r=>{
        $("<div>",{"class":"autocomplete-option",text:r.text,"data-id":r.id})
          .appendTo($box);
      });
      more=data.has_more;
    }else if(pg===1){
      $box.html('<div class="autocomplete-no-result">Sin resultados</div>');
      more=false;
    }
    $box.show();
  };
  const deb = (fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(fn,ms,...a);};};

  const kick = deb(()=>{pg=1;more=true;fetchSuc();},300);

  $inp.on("input",()=>{
    $hid.val(""); term=$.trim($inp.val()); kick();
  }).on("focus",()=>{
    term=$.trim($inp.val()); pg=1; more=true; fetchSuc();
  });

  $box.on("click",".autocomplete-option",function(){
    $inp.val($(this).text()); $hid.val($(this).data("id"));
    $box.hide(); $("#sucursalForm").submit();
  }).on("scroll",function(){
    if(this.scrollTop+this.clientHeight>=this.scrollHeight-5 && more && !loading){
      pg++; fetchSuc();
    }
  });

  $(document).on("click",e=>{
    if(!$(e.target).closest("#id_sucursal_autocomplete, #sucursal-autocomplete-results").length){
      $box.hide();
    }
  });
});
