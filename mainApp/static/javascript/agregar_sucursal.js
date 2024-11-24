// agregar_sucursal.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('sucursalForm');

    form.addEventListener('submit', function(event) {
        // Limpiar mensajes de error anteriores
        const errorMessages = document.querySelectorAll('.field-error');
        errorMessages.forEach(function(error) {
            error.innerHTML = '';
            error.classList.remove('visible');
        });

        let hasErrors = false;

        // Validar Nombre
        const nombreInput = document.getElementById('id_nombre');
        const nombre = nombreInput.value.trim();
        const nombreRegex = /^[A-Za-z\s]+$/;
        if (nombre === '') {
            const errorDiv = document.getElementById('error-id_nombre');
            errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> El nombre es obligatorio.';
            errorDiv.classList.add('visible');
            hasErrors = true;
        } else if (!nombreRegex.test(nombre)) {
            const errorDiv = document.getElementById('error-id_nombre');
            errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> El nombre solo debe contener letras y espacios.';
            errorDiv.classList.add('visible');
            hasErrors = true;
        }

        // Validar Dirección
        const direccionInput = document.getElementById('id_direccion');
        const direccion = direccionInput.value.trim();
        if (direccion === '') {
            const errorDiv = document.getElementById('error-id_direccion');
            errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> La dirección es obligatoria.';
            errorDiv.classList.add('visible');
            hasErrors = true;
        }

        // Validar Teléfono
        const telefonoInput = document.getElementById('id_telefono');
        const telefono = telefonoInput.value.trim();
        const telefonoRegex = /^\d{10}$/;
        if (!telefonoRegex.test(telefono)) {
            const errorDiv = document.getElementById('error-id_telefono');
            errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> El teléfono debe contener exactamente 10 dígitos.';
            errorDiv.classList.add('visible');
            hasErrors = true;
        }

        if (hasErrors) {
            event.preventDefault(); // Prevenir el envío del formulario
        }
    });
});
