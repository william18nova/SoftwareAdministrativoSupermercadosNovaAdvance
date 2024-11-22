// mainApp/static/javascript/agregar_categorias.js

document.addEventListener('DOMContentLoaded', function() {
    const categoriaForm = document.getElementById('categoriaForm');

    if (categoriaForm) {
        categoriaForm.addEventListener('submit', function(event) {
            let nombre = document.getElementById('id_nombre').value.trim(); // Asegúrate de que el ID coincide

            if (!nombre) {
                event.preventDefault(); // Evita el envío del formulario
                mostrarError('El campo Nombre es obligatorio.');
            }
        });
    }

    function mostrarError(mensaje) {
        // Crear un elemento de alerta
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-error';
        errorDiv.textContent = mensaje;

        // Insertar el error antes del formulario
        const container = document.querySelector('.container-empleado');
        container.insertBefore(errorDiv, container.firstChild);

        // Remover el error después de 5 segundos
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
});
