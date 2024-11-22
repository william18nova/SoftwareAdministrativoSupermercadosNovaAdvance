// mainApp/static/javascript/agregar_categorias.js

document.addEventListener('DOMContentLoaded', function() {
    const categoriaForm = document.getElementById('categoriaForm');

    if (categoriaForm) {
        categoriaForm.addEventListener('submit', function(event) {
            let nombre = document.getElementById('nombre').value.trim();

            if (!nombre) {
                alert('El campo Nombre es obligatorio.');
                event.preventDefault(); // Evita el envío del formulario
            }
        });
    }
});
