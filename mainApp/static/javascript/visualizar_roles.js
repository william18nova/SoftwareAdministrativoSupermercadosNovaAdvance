$(document).ready(function() {
    // Inicializar DataTable con búsqueda, paginación y responsive
    const table = $('#rolesTable').DataTable({
        paging: true,
        searching: true,
        info: true,
        responsive: true,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron resultados",
            emptyTable: "No hay roles para mostrar"
        }
    });

    // Manejar la eliminación con confirmación
    $('#rolesTable').on('click', '.btn.borrar', function(event) {
        event.preventDefault();
        const button = $(this);
        const rolId = button.data('rol-id');
        const rolNombre = button.data('rol-nombre');
        // Formulario oculto que hará la petición POST
        const form = $('#eliminar-form-' + rolId);

        if (confirm(`¿Está seguro de que desea eliminar el rol "${rolNombre}"?`)) {
            form.submit();
        }
    });
});
