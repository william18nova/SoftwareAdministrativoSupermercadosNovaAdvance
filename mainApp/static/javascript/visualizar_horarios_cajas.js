/* visualizar_horarios_cajas.js
   ──────────────────────────────────
   · DataTable
   · Autocomplete sucursal + punto de pago
   · Eliminación AJAX
*/
$(function(){
  "use strict";

  // ── 1) DataTable ──
  const $tbl = $("#horariosTable");
  let dt = null;
  if($tbl.length){
    dt = $tbl.DataTable({
      paging:true, searching:true, info:true, responsive:true,
      language:{
        search:"", zeroRecords:"Sin registros",
        info:"Mostrando _START_ a _END_ de _TOTAL_",
        paginate:{ first:"Prim.", last:"Últ.", next:"Sig.", previous:"Ant." }
      },
      columnDefs:[{ targets:"no-sort", orderable:false }]
    });
  }

  // ── 2) Flash helper ──
  const $flash = $("<div class='alert' style='display:none'></div>")
                 .insertAfter("h2");
  const flash  = (ok,msg)=> $flash
    .removeClass("alert-success alert-error")
    .addClass(ok?"alert-success":"alert-error")
    .text(msg).show();

  // ── 3) Eliminar horario ──
  $tbl.on("click",".btn-eliminar",function(){
    const $btn = $(this), id = $btn.data("id");
    if(!id||!confirm("¿Eliminar este horario?")) return;
    const url = eliminarHorarioUrlPattern.replace("0",id);
    $.post(url,{
      csrfmiddlewaretoken:$("input[name=csrfmiddlewaretoken]").val()
    }).done(res=>{
      if(res.success && dt){
        dt.row($btn.closest("tr")).remove().draw(false);
      }
      flash(res.success, res.message);
    }).fail(()=> flash(false,"Error al eliminar."));
  });

  // ── 4) Autocomplete genérico ──
  function setupAutocomplete($inp, $hid, $box, url, onSelect, filterParams){
    let page=1, term="", loading=false, more=true;
    const cache = {};

    const fetchPage = ()=>{
      if(loading||!more) return;
      loading=true;
      const params = { term, page };
      if(filterParams) Object.assign(params, filterParams());
      const key = `${url}?${$.param(params)}`;
      if(cache[key]) return render(cache[key]);
      $.getJSON(url,params)
        .done(data=>{
          cache[key]=data;
          render(data);
        })
        .always(()=> loading=false);
    };

    const render = data=>{
      if(page===1) $box.empty();
      if(data.results.length){
        data.results.forEach(r=>{
          $("<div>",{
            "class":"autocomplete-option",
            "data-id":r.id,
            text:r.text
          }).appendTo($box);
        });
        more = data.has_more;
      } else if(page===1){
        $box.html('<div class="autocomplete-no-result">Sin resultados</div>');
        more=false;
      }
      $box.show();
    };

    const deb = debounce(()=>{
      page=1; more=true; fetchPage();
    },300);

    $inp
      .on("input",()=>{
        $hid.val(""); term=$.trim($inp.val()); deb();
      })
      .on("focus",()=>{
        term=$.trim($inp.val()); page=1; more=true; fetchPage();
      });

    $box.on("scroll",function(){
      if(this.scrollTop+this.clientHeight>=this.scrollHeight-5 && more&&!loading){
        page++; fetchPage();
      }
    }).on("click",".autocomplete-option",function(){
      const $opt = $(this);
      $inp.val($opt.text());
      $hid.val($opt.data("id"));
      $box.hide().empty();
      onSelect && onSelect($opt.data("id"));
    });

    $(document).on("click",e=>{
      if(!$(e.target).closest($inp).length
         && !$(e.target).closest($box).length){
        $box.hide();
      }
    });
  }

  // ── 4.1) Sucursal ──
  setupAutocomplete(
    $("#id_sucursal_autocomplete"),
    $("#id_sucursal"),
    $("#sucursal-autocomplete-results"),
    sucursalAutocompleteUrl,
    id=>{
      // habilita punto de pago y limpia
      const $pp = $("#id_puntopago_autocomplete");
      $("#id_puntopago").val("");
      $pp.val("").prop("disabled",false);
      $("#puntopago-autocomplete-results").hide().empty();
    }
  );

  // ── 4.2) PuntoPago ──
  setupAutocomplete(
    $("#id_puntopago_autocomplete"),
    $("#id_punto_pago"),
    $("#puntopago-autocomplete-results"),
    puntopagoAutocompleteUrl,
    () => { /* al elegir, enviamos filtro */ $("#filtrosForm").submit(); },
    ()=>({ sucursal_id: $("#id_sucursal").val() })
  );

  // ── 5) debounce ──
  function debounce(fn,ms){
    let t;
    return function(...a){
      clearTimeout(t);
      t = setTimeout(()=>fn.apply(this,a), ms);
    };
  }
});
