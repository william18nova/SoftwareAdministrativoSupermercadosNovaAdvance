$(document).ready(function() {
    // Inicializar DataTable con opciones de búsqueda, paginación y responsive
    const table = $('#productosTable').DataTable({
        paging: true,
        searching: true,
        info: true,
        responsive: true,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay productos para mostrar"
        }
    });
});

// Función para confirmar eliminación de un producto
function confirmDelete(button) {
    // Obtener el nombre del producto (suponiendo que la columna de Nombre es la segunda)
    var productName = $(button).closest('tr').find('td:eq(1)').text().trim();
    // Buscar el formulario dentro del mismo <td>
    var form = $(button).closest('td').find('.delete-form');
    if (confirm('¿Estás seguro de que deseas eliminar el producto "' + productName + '"?')) {
        form.submit();
    }
}
