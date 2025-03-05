$(document).ready(function() {
    // Inicializar DataTable
    const table = $('#sucursalesTable').DataTable({
        paging: true,
        searching: true,
        info: true,
        responsive: true,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay sucursales para mostrar"
        }
    });

    // Manejar el evento de eliminación de sucursal
    $('#sucursalesTable').on('click', '.btn.borrar', function(event) {
        event.preventDefault();
        const button = $(this);
        const sucursalId = button.data('sucursal-id');
        const sucursalNombre = button.data('sucursal-nombre');
        // Confirmar eliminación
        if (confirm(`¿Está seguro de que desea eliminar la sucursal "${sucursalNombre}"?`)) {
            // Enviar el formulario oculto correspondiente
            $('#eliminar-form-' + sucursalId).submit();
        }
    });
});
