/* eslint-env jquery */
$(function () {
  "use strict";

  /* ----------  DataTable + buscador externo  ---------- */
  const table = $("#sucursalesTable").DataTable({
    paging: true,
    searching: true,
    info: true,
    responsive: true,
    order: [[0, "asc"]],
    language: {
      search: "",
      zeroRecords: "No se encontraron sucursales",
      info: "Mostrando _START_ a _END_ de _TOTAL_ sucursales",
      infoEmpty: "Mostrando 0 a 0 de 0 sucursales",
      paginate: {
        first: "Primero",
        last: "Último",
        next: "Siguiente",
        previous: "Anterior",
      },
    },
  });

  $("#buscador-sucursales").on("keyup", function () {
    table.search(this.value).draw();
  });

  /* ----------  Eliminar con confirmación  ---------- */
  $("#sucursalesTable").on("click", ".btn.borrar", function (e) {
    e.preventDefault();
    const id = $(this).data("sucursal-id");
    const nombre = $(this).data("sucursal-nombre");
    if (confirm(`¿Eliminar la sucursal «${nombre}»?`)) {
      $(`#eliminar-form-${id}`).submit();
    }
  });
});
