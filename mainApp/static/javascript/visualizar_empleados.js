$(document).ready(function() {
    // Inicializar DataTable
    const table = $('#empleadosTable').DataTable({
        paging: true,
        searching: true,
        info: true,
        responsive: true,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay empleados para mostrar"
        }
    });

    // Función para confirmar eliminación
    window.confirmDelete = function(button) {
        if (confirm('¿Estás seguro de que deseas eliminar este empleado?')) {
            // Envía el formulario de eliminación que está cerca del botón
            $(button).closest('form').submit();
        }
    };
});
