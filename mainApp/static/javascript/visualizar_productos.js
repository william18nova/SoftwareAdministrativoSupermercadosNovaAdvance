/*  visualizar_productos.js  */
$(function () {
  "use strict";

  /* ───────── DataTable + buscador externo ───────── */
  const table = $("#productosTable").DataTable({
    paging     : true,
    searching  : true,
    info       : true,
    responsive : true,
    columnDefs : [{ targets: "no-sort", orderable: false }],
    language   : {
      search      : "",                      // ocultamos la barra nativa
      zeroRecords : "No se encontraron productos",
      info        : "Mostrando _START_ a _END_ de _TOTAL_ productos",
      infoEmpty   : "Mostrando 0 a 0 de 0 productos",
      paginate    : {
        first   : "Primero",
        last    : "Último",
        next    : "Siguiente",
        previous: "Anterior"
      }
    }
  });

  $("#buscador-productos").on("keyup", function () {
    table.search(this.value).draw();
  });

  /* ───────── eliminar producto ───────── */
  $("#productosTable").on("click", ".btn.borrar", function () {
    const $btn   = $(this);
    const nombre = $btn.data("nombre");
    const $form  = $btn.closest("td").find(".delete-form");

    if (confirm(`¿Desea eliminar el producto «${nombre}»?`)) {
      $form.submit();
    }
  });

  /* ───────── flash-message tras ADD/EDIT ───────── */
  const flash = sessionStorage.getItem("flash-producto");
  if (flash) {
    $(".container h2").after(`
      <div class="messages">
        <div class="alert alert-success">${flash}</div>
      </div>
    `);
    sessionStorage.removeItem("flash-producto");
  }
});
