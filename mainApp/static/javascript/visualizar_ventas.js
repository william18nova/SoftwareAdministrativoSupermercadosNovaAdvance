/* static/javascript/visualizar_ventas.js */
$(document).ready(function () {
  "use strict";

  /* ─────  DataTable  ───── */
  const tabla = $("#ventasTable").DataTable({
    paging: true,
    pageLength: 10,
    lengthChange: false,
    searching: true,
    info: true,
    responsive: true,
    order: [[1, "desc"], [2, "desc"]],
    language: {
      search: "",
      zeroRecords: "No hay ventas que coincidan",
      info: "Mostrando _START_-_END_ de _TOTAL_",
      infoEmpty: "Sin ventas",
      paginate: {
        first: "Primero", last: "Último",
        next: "Siguiente", previous: "Anterior"
      }
    },
    columnDefs: [
      { targets: 7, className: "dt-right" } // Total alineado a la derecha
    ]
  });

  /* Ocultamos el buscador interno de DT */
  $(".dataTables_filter").hide();

  /* ─────  Buscador externo  ───── */
  $("#buscador-ventas").on("keyup", function () {
    tabla.search(this.value).draw();
  });

  /* ─────  Formato moneda COP  ───── */
  $("#ventasTable td.money").each(function () {
    const valor = parseFloat($(this).text());
    $(this).text(
      new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(valor)
    );
  });
});
