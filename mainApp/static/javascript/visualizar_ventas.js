/* visualizar_ventas.js */
$(function () {
  "use strict";

  /* ───────── DataTable server-side + buscador externo ───────── */
  const table = $("#ventasTable").DataTable({
    processing : true,
    serverSide : true,
    ajax       : {
      url : ventasDataUrl,   // inyectada desde el template
      type: "GET"
    },
    columns: [
      { data: "ventaid" },    // 0 ID
      { data: "fecha" },      // 1 Fecha
      { data: "hora" },       // 2 Hora
      { data: "cliente" },    // 3 Cliente
      { data: "empleado" },   // 4 Empleado
      { data: "sucursal" },   // 5 Sucursal
      { data: "puntopago" },  // 6 Punto Pago
      { data: "total" },      // 7 Total
      { data: "mediopago" }   // 8 Medio Pago
    ],
    paging      : true,
    pageLength  : 25,
    lengthMenu  : [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
    deferRender : true,
    searching   : true,
    info        : true,
    responsive  : true,
    searchDelay : 250,  // 🔥 evita consulta por cada tecla
    order       : [[0, "desc"]], // más recientes primero (ventaid desc)
    language    : {
      search      : "",
      zeroRecords : "No se encontraron ventas",
      info        : "Mostrando _START_ a _END_ de _TOTAL_ ventas",
      infoEmpty   : "Mostrando 0 a 0 de 0 ventas",
      lengthMenu  : "Mostrar _MENU_ ventas",
      paginate    : {
        first   : "Primero",
        last    : "Último",
        next    : "Siguiente",
        previous: "Anterior"
      },
      processing  : "Cargando..."
    },
    stateSave: true,

    // Mantiene tu diseño responsive con data-label y clase clickable-row
    createdRow: function (row, data) {
      const labels = [
        "ID",
        "Fecha",
        "Hora",
        "Cliente",
        "Empleado",
        "Sucursal",
        "Punto Pago",
        "Total",
        "Medio Pago"
      ];

      $(row).addClass("clickable-row");
      $(row).attr("data-id", data.ventaid);

      $(row).find("td").each(function (i) {
        $(this).attr("data-label", labels[i]);
      });
    }
  });

  // Buscador externo
  $("#buscador-ventas").on("input", function () {
    table.search(this.value).draw();
  });

  // Escondemos la caja de búsqueda nativa de DataTables
  $("#ventasTable_filter").hide();

  // Navegar al detalle al hacer click en la fila
  $("#ventasTable tbody").on("click", "tr.clickable-row", function () {
    const id = $(this).data("id");
    if (id) {
      window.location.href = verVentaUrl.replace("0", id);
    }
  });
});
