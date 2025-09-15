/*  visualizar_productos.js  */
$(function () {
  "use strict";

  /* ───────── DataTable + buscador externo ───────── */
  const table = $("#productosTable").DataTable({
    // Paginación 100% en el cliente
    paging      : true,
    pageLength  : 25,                               // tamaño inicial de página
    lengthMenu  : [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
    deferRender : true,                             // acelera con muchas filas
    searching   : true,
    info        : true,
    responsive  : true,
    columnDefs  : [{ targets: "no-sort", orderable: false }],
    language    : {
      // ocultamos la caja nativa de búsqueda
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
      }
    },
    // Opcional: guarda estado (página, orden, etc.) entre recargas
    stateSave: true
  });

  // Buscador externo
  $("#buscador-productos").on("input", function () {
    table.search(this.value).draw();
  });

  // Por si DataTables llegó a pintar la barra nativa, la escondemos
  $("#productosTable_filter").hide();

  /* ───────── eliminar producto (delegado) ───────── */
  $("#productosTable").on("click", ".btn.borrar", function () {
    const $btn   = $(this);
    const nombre = $btn.data("nombre");
    const $form  = $btn.closest("td").find(".delete-form");

    if (confirm(`¿Desea eliminar el producto «${nombre}»?`)) {
      $form.trigger("submit");
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
     - Escribe el código en #buscador-productos
     - Dispara el filtrado de DataTables
  ---------------------------------------------------------------- */
  (function barcodeScannerDetector(){
    const CFG = {
      minChars: 8,         // mínimo de dígitos para considerar un código
      gapMs: 60,           // intervalo máximo entre teclas para considerarlo “rápido”
      finishKeys: ['Enter','Tab'],
      debug: false
    };
    const $input = $("#buscador-productos");

    function setBarcodeValue(code){
      $input.val(code);
      // dispara búsqueda
      $input.trigger("input");
      table.search(code).draw();
      if (CFG.debug) console.log("[scanner] code:", code);
    }

    let buf="", first=0, last=0, idleTimer=null;
    function reset(){ buf=""; first=0; last=0; if(idleTimer){clearTimeout(idleTimer); idleTimer=null;} }

    function handleFinish(){
      const span = last - first;
      const fastEnough = buf && span < buf.length * (CFG.gapMs+10);
      if (fastEnough && buf.length >= CFG.minChars){
        const code = buf; reset(); setBarcodeValue(code); return true;
      }
      reset(); return false;
    }

    document.addEventListener("keydown", function(e){
      if (e.ctrlKey || e.altKey || e.metaKey) { reset(); return; }
      const t = Date.now();

      if (CFG.finishKeys.includes(e.key)){
        if (handleFinish()){ e.preventDefault(); e.stopImmediatePropagation(); }
        return;
      }

      if (e.key && e.key.length === 1){
        if (buf && (t-last) > CFG.gapMs) { buf=""; first=t; }
        if (!buf) first=t;
        buf+=e.key; last=t;

        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(()=>{ handleFinish(); }, CFG.gapMs*5);

        // Evita escribir caracteres en otros inputs si no estamos en el buscador
        if (document.activeElement !== $input[0]) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }else{
        if (e.key !== "Shift") reset();
      }
    }, true);

    document.addEventListener("paste", e=>{
      const txt=(e.clipboardData||window.clipboardData)?.getData("text")||"";
      const val=txt.trim();
      if(val && val.length>=CFG.minChars){
        e.preventDefault();
        setBarcodeValue(val);
      }
    }, true);
  })();

});
