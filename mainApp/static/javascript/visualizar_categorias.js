$(document).ready(function() {
    // Inicializar DataTable con opciones de búsqueda, paginación y responsive
    const table = $('#categoriasTable').DataTable({
        paging: true,
        searching: true,
        info: true,
        responsive: true,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay categorías para mostrar"
        }
    });

    // Manejar la eliminación con confirmación
    $('#categoriasTable').on('click', '.btn.borrar', function(event) {
        event.preventDefault();
        const $button = $(this);
        const categoriaId = $button.data('categoriaid');
        const categoriaNombre = $button.data('categorianombre');
        const $form = $('#eliminar-form-' + categoriaId);

        if (confirm(`¿Estás seguro de que deseas eliminar la categoría "${categoriaNombre}"?`)) {
            $form.submit();
        }
    });
});
