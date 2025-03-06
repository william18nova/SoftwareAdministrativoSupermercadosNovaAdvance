$(document).ready(function() {
    // Inicializar DataTable con opciones básicas
    const table = $('#usuariosTable').DataTable({
        paging: true,
        searching: true,
        info: true,
        responsive: true,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay usuarios para mostrar"
        }
    });
});

// Función para confirmar la eliminación
function confirmDelete(button) {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
        // Se busca el formulario más cercano (dentro de la misma celda) y se envía
        $(button).closest('td').find('.delete-form').submit();
    }
}
