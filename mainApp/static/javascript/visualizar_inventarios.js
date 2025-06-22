/*  visualizar_inventarios.js
    – DataTable intact
    – Autocomplete de sucursal totalmente visible
    – Eliminación vía AJAX
------------------------------------------------------------------*/
$(function () {
  "use strict";

  /* 1. DataTable ------------------------------------------------- */
  const $tblEl = $("#inventariosTable, #inventarios-list");      // acepta el id viejo o el nuevo
  const tbl = $tblEl.length ? $tblEl.DataTable({
    paging: true,
    searching: true,
    info: true,
    responsive: true,
    language: {
      search       : "",
      zeroRecords  : "No se encontraron registros",
      info         : "Mostrando _START_ a _END_ de _TOTAL_",
      infoEmpty    : "Mostrando 0 a 0 de 0",
      paginate     : { first:"Primero", last:"Último", next:"Sig.", previous:"Ant." }
    }
  }) : null;

  /* 2. Helpers --------------------------------------------------- */
  const csrf  = $("input[name=csrfmiddlewaretoken]").val();
  const $msg  = $("<div class='alert' style='display:none'></div>").insertAfter("h2");

  const flash = (ok, txt) => $msg
      .removeClass("alert-success alert-error")
      .addClass(ok ? "alert-success" : "alert-error")
      .text(txt).show();

  const debounce = (fn, ms=300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };

  /* 3. Eliminar -------------------------------------------------- */
  $("#inventariosTable, #inventarios-list").on("click", ".btn-eliminar", function (e) {
    e.preventDefault();
    const $btn = $(this);
    const id   = $btn.data("inventario-id");
    if (!id || !confirm("¿Eliminar este producto del inventario?")) return;

    $.post(eliminarInventarioUrl.replace("0", id),
           { csrfmiddlewaretoken: csrf })
     .done(r => {
        if (r.success && tbl) { tbl.row($btn.closest("tr")).remove().draw(false); }
        flash(r.success, r.message);
     })
     .fail(() => flash(false, "Error al eliminar el registro."));
  });

  /* 4. Autocomplete Sucursal ------------------------------------ */
  const $inp = $("#id_sucursal_autocomplete");
  const $hid = $("#id_sucursal");
  const $box = $("#sucursal-autocomplete-results");

  let page = 1, more = true, load = false, term = "";

  const draw = data => {
    if (page === 1) { $box.empty(); }

    if (data.results.length) {
      data.results.forEach(r =>
        $("<div>", { "class":"autocomplete-option", text:r.text, "data-id":r.id }).appendTo($box)
      );
      more = data.has_more;
    } else if (page === 1) {
      $box.html('<div class="autocomplete-no-result">Sin resultados</div>');
      more = false;
    }
    /* — FIX clave: forzar display — */
    $box.css("display","block");
  };

  const fetchSuc = () => {
    if (load || !more) return;
    load = true;
    $.getJSON(sucursalAutocompleteUrl, { term, page })
      .done(draw)
      .always(()=> load=false);
  };

  const kick = debounce(() => { page=1; more=true; fetchSuc(); }, 250);

  $inp
    .on("input", () => { $hid.val(""); term=$.trim($inp.val()); kick(); })
    .on("focus", ()  => { term=$.trim($inp.val()); page=1; more=true; fetchSuc(); });

  $box
    .on("scroll", () => {
      if ($box.scrollTop() + $box.innerHeight() >= $box[0].scrollHeight-4 && more && !load) {
        page += 1; fetchSuc();
      }
    })
    .on("click", ".autocomplete-option", function () {
      $inp.val($(this).text());
      $hid.val($(this).data("id"));
      $box.hide();
      $("#sucursalForm").trigger("submit");     // recarga con la sucursal elegida
    });

  $(document).on("click", e => {
    if (!$(e.target).closest("#id_sucursal_autocomplete, #sucursal-autocomplete-results").length) {
      $box.hide();
    }
  });

  /* ----------  DEBUG rápido (opcional) ----------
     descomenta para ver pasos en consola
  // [ "focus","input","scroll","click" ].forEach(evt=>{
  //   $inp.on(evt, ()=>console.log("inp:",evt));
  //   $box.on(evt, ()=>console.log("box:",evt));
  // });
  ---------------------------------------------- */
});
