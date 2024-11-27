// agregar_rol.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('rolForm');
    const errorMessageDiv = document.querySelector('.messages .alert-error');
    const successMessageDiv = document.querySelector('.messages .alert-success');

    function clearMessages() {
        if (errorMessageDiv) {
            errorMessageDiv.style.display = 'none';
            errorMessageDiv.innerHTML = '';
        }
        if (successMessageDiv) {
            successMessageDiv.style.display = 'none';
            successMessageDiv.innerHTML = '';
        }
    }

    function displayErrors(messages) {
        if (errorMessageDiv) {
            errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${messages}`;
            errorMessageDiv.style.display = 'block';
        }
    }

    function displaySuccess(message) {
        if (successMessageDiv) {
            successMessageDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
            successMessageDiv.style.display = 'block';
        }
    }

    form.addEventListener('submit', function(event) {
        clearMessages();
        let valid = true;
        let errorMessages = [];

        const nombre = form.querySelector('#nombre').value.trim();

        // Validar que el nombre no esté vacío y solo contenga letras y espacios
        if (nombre === '') {
            valid = false;
            errorMessages.push('El nombre del rol es obligatorio.');
            form.querySelector('#nombre').classList.add('input-error');
        } else if (!/^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre)) {
            valid = false;
            errorMessages.push('El nombre del rol solo debe contener letras y espacios.');
            form.querySelector('#nombre').classList.add('input-error');
        }

        // Puedes añadir más validaciones aquí si lo deseas

        if (!valid) {
            event.preventDefault();
            displayErrors(errorMessages.join('<br>'));
        }
    });

    // Opcional: Remover el resaltado de errores al modificar el campo
    const nombreInput = form.querySelector('#nombre');
    nombreInput.addEventListener('input', function() {
        if (nombreInput.classList.contains('input-error')) {
            nombreInput.classList.remove('input-error');
            clearMessages();
        }
    });
});
