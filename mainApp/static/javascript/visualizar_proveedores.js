$(document).ready(function() {
    // Inicializar DataTable con opciones básicas y responsividad
    $('#proveedoresTable').DataTable({
        paging: true,
        searching: true,
        info: true,
        responsive: true,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay proveedores para mostrar"
        }
    });

    // Manejar la eliminación con confirmación
    $('.delete-form').on('submit', function(event) {
        event.preventDefault();
        const form = $(this);
        if (confirm('¿Estás seguro de que deseas eliminar este proveedor?')) {
            form.off('submit').submit();
        }
    });
});
