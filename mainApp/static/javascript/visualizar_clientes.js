$(document).ready(function() {
    // Inicializar DataTable con opciones básicas
    const table = $('#clientesTable').DataTable({
        paging: true,
        searching: true,
        info: true,
        responsive: true,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay clientes para mostrar"
        }
    });

    // Función para confirmar eliminación de un cliente
    window.confirmDelete = function(clienteId, clienteNombre) {
        if (confirm(`¿Estás seguro de que deseas eliminar al cliente "${clienteNombre}"?`)) {
            document.getElementById(`delete-form-${clienteId}`).submit();
        }
    };
});
