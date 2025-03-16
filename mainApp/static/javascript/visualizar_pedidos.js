$(document).ready(function() {
    "use strict";

    // Inicializar DataTable
    const tablaPedidos = $('#tabla-pedidos').DataTable({
      paging: true,
      info: true,
      searching: true, // Dejar searching: true para usar la API
      language: {
        lengthMenu: "Mostrar _MENU_ pedidos",
        zeroRecords: "No se encontraron resultados",
        info: "Mostrando _START_ a _END_ de _TOTAL_ pedidos",
        infoEmpty: "No hay pedidos disponibles",
        infoFiltered: "(filtrado de _MAX_ pedidos totales)",
        paginate: {
          first: "Primero",
          last: "Último",
          next: "Siguiente",
          previous: "Anterior"
        }
      }
    });

    // Filtrado externo
    $('#buscar-pedidos').on('keyup', function() {
      tablaPedidos.search(this.value).draw();
    });

    // Si quisieras manejar botones de acciones, por ejemplo "Ver" o "Editar":
    // $('#tabla-pedidos').on('click', '.btn-ver', function() {
    //   const pedidoId = $(this).data('id');
    //   // Lógica para ver detalles
    // });
});
