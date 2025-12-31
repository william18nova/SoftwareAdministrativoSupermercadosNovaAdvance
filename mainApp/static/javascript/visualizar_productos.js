/*  static/javascript/visualizar_productos.js  */
$(function () {
  "use strict";

  /* ───────── DataTable server-side + buscador externo ───────── */
  const table = $("#productosTable").DataTable({
    processing : true,          // indicador “Cargando…”
    serverSide : true,          // paginación y búsqueda en el servidor
    ajax       : {
      url : window.productosDataUrl,
      type: "GET"
    },
    columns: [
      { data: "productoid" },
      { data: "nombre" },
      { data: "descripcion" },
      { data: "precio" },
      { data: "categoria" },
      { data: "codigo_de_barras" },
      { data: "iva" },

      // ✅ nuevas
      { data: "impuesto_consumo" },
      { data: "icui" },
      { data: "ibua" },
      { data: "rentabilidad" },

      { data: "acciones", orderable: false, searchable: false }
    ],
    paging      : true,
    pageLength  : 25,
    lengthMenu  : [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
    deferRender : true,     // acelera el render en el cliente
    searching   : true,
    info        : true,
    responsive  : true,
    searchDelay : 250,      // 🔥 evita consultas por cada tecla
    columnDefs  : [
      { targets: "no-sort", orderable: false }
    ],
    language    : {
      search      : "",
      lengthMenu  : "Mostrar _MENU_ productos",
      zeroRecords : "No se encontraron productos",
      info        : "Mostrando _START_ a _END_ de _TOTAL_ productos",
      infoEmpty   : "Mostrando 0 a 0 de 0 productos",
      paginate    : {
        first   : "Primero",
        last    : "Último",
        next    : "Siguiente",
        previous: "Anterior"
      },
      processing  : "Cargando..."
    },
    stateSave: true,

    // Mantiene tu diseño responsive con data-label en cada celda
    createdRow: function (row, data) {
      const labels = [
        "ID",
        "Nombre",
        "Descripción",
        "Precio",
        "Categoría",
        "Cód. Barras",
        "IVA",
        "Imp. Consumo",
        "ICUI",
        "IBUA",
        "Rentabilidad",
        "Acciones"
      ];
      $(row).find("td").each(function (i) {
        $(this).attr("data-label", labels[i]);
      });
      // ✅ acciones ahora es la columna 11
      $(row).find("td").eq(11).addClass("actions-cell");
    }
  });

  // Buscador externo (input arriba de la tabla)
  $("#buscador-productos").on("input", function () {
    table.search(this.value).draw();
  });

  // Ocultamos la caja nativa de búsqueda de DataTables
  $("#productosTable_filter").hide();

  /* ───────── CSRF helper para AJAX POST (eliminar) ───────── */
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + "=")) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }
  const csrftoken = getCookie("csrftoken");

  /* ───────── eliminar producto (delegado, vía AJAX) ───────── */
  $("#productosTable").on("click", ".btn.borrar", function () {
    const $btn   = $(this);
    const nombre = $btn.data("nombre");
    const url    = $btn.data("url");

    if (!url) {
      console.error("Sin data-url en botón borrar");
      return;
    }

    if (confirm(`¿Desea eliminar el producto «${nombre}»?`)) {
      $.ajax({
        url     : url,
        type    : "POST",
        headers : { "X-CSRFToken": csrftoken },
        success : function () {
          // Recarga solo los datos de la tabla (manteniendo la página actual)
          table.ajax.reload(null, false);
        },
        error   : function (xhr) {
          console.error("Error al eliminar producto:", xhr.status, xhr.responseText);
          alert("Ocurrió un error al eliminar el producto.");
        }
      });
    }
  });

  /* ───────── flash-message tras ADD/EDIT (opcional) ───────── */
  const flash = sessionStorage.getItem("flash-producto");
  if (flash) {
    $(".container h2").after(`
      <div class="messages">
        <div class="alert alert-success">${flash}</div>
      </div>
    `);
    sessionStorage.removeItem("flash-producto");
  }

  /* ───────── detector de pistola de código de barras ─────────
     - Acumula teclas rápidas
     - Si parece un código, lo pone en #buscador-productos
     - Dispara DataTables.search() → backend usa índices
  ---------------------------------------------------------------- */
  (function barcodeScannerDetector(){
    const CFG = {
      minChars: 8,
      gapMs: 60,
      finishKeys: ['Enter','Tab'],
      debug: false
    };
    const $input = $("#buscador-productos");

    function setBarcodeValue(code){
      $input.val(code);
      $input.trigger("input");
      table.search(code).draw();
      if (CFG.debug) console.log("[scanner] code:", code);
    }

    let buf = "";
    let first = 0;
    let last  = 0;
    let idleTimer = null;

    function reset(){
      buf = "";
      first = 0;
      last = 0;
      if (idleTimer){
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    }

    function handleFinish(){
      const span = last - first;
      const fastEnough = buf && span < buf.length * (CFG.gapMs + 10);
      if (fastEnough && buf.length >= CFG.minChars){
        const code = buf;
        reset();
        setBarcodeValue(code);
        return true;
      }
      reset();
      return false;
    }

    document.addEventListener("keydown", function(e){
      if (e.ctrlKey || e.altKey || e.metaKey) {
        reset();
        return;
      }
      const t = Date.now();

      if (CFG.finishKeys.includes(e.key)){
        if (handleFinish()){
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }

      if (e.key && e.key.length === 1){
        if (buf && (t - last) > CFG.gapMs) {
          buf = "";
          first = t;
        }
        if (!buf) first = t;
        buf += e.key;
        last = t;

        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => { handleFinish(); }, CFG.gapMs * 5);

        if (document.activeElement !== $input[0]) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      } else {
        if (e.key !== "Shift") reset();
      }
    }, true);

    document.addEventListener("paste", e => {
      const txt = (e.clipboardData || window.clipboardData)?.getData("text") || "";
      const val = txt.trim();
      if (val && val.length >= CFG.minChars){
        e.preventDefault();
        setBarcodeValue(val);
      }
    }, true);
  })();

});
