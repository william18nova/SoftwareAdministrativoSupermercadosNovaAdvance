$(document).ready(function() {
    $('#ventasTable').DataTable({
        paging: true,
        searching: true,
        info: true,
        responsive: true,
        language: {
            search: "Buscar:",
            zeroRecords: "No se encontraron ventas",
            info: "Mostrando _START_ a _END_ de _TOTAL_ ventas",
            infoEmpty: "Mostrando 0 a 0 de 0 ventas",
            paginate: {
                first: "Primero",
                last: "Último",
                next: "Siguiente",
                previous: "Anterior"
            }
        }
    });
});
