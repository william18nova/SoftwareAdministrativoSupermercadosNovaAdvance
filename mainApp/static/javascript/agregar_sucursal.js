// agregar_sucursal.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('sucursalForm');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
    const successTextSpan = document.getElementById('success-text'); // Nuevo elemento

    /**
     * Función para limpiar mensajes de error y éxito
     */
    function clearMessages() {
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.innerHTML = '';
        successMessageDiv.style.display = 'none';
        successTextSpan.textContent = ''; // Limpiar texto
        // Limpiar errores específicos de campos
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.classList.remove('visible');
        });
    }

    /**
     * Función para mostrar mensajes de error
     */
    function displayErrors(errors) {
        clearMessages();

        // Errores generales (si los hubiera)
        if (errors.__all__) {
            errorMessageDiv.innerHTML = errors.__all__.map(e => e.message).join('<br>');
            errorMessageDiv.style.display = 'block';
        }

        // Errores específicos de campo
        for (let field in errors) {
            if (field === '__all__') continue;
            const fieldErrors = errors[field];
            const errorDiv = document.getElementById('error-id_' + field);
            if (errorDiv) {
                errorDiv.innerHTML = fieldErrors.map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`).join('<br>');
                errorDiv.classList.add('visible');
            }
        }
    }

    /**
     * Función para mostrar mensajes de éxito
     */
    function displaySuccess(message) {
        successTextSpan.textContent = message;
        successMessageDiv.style.display = 'flex'; // Cambiar a flex para mostrar el ícono y el texto
        form.reset();
    }

    /**
     * Evento de envío del formulario
     */
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevenir el envío predeterminado
        clearMessages();

        const formData = new FormData(form);

        fetch(form.action, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Accept': 'application/json',
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displaySuccess(data.message);
            } else {
                const errors = JSON.parse(data.errors);
                displayErrors(errors);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorMessageDiv.textContent = 'Ocurrió un error inesperado.';
            errorMessageDiv.style.display = 'block';
        });
    });

    /**
     * Función para obtener el valor de una cookie por nombre
     */
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                // Verificar si la cookie empieza con el nombre buscado
                if (cookie.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    /**
     * Remover el resaltado de errores al modificar el campo
     */
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(function(input) {
        input.addEventListener('input', function() {
            if (input.classList.contains('input-error')) {
                input.classList.remove('input-error');
                const errorDiv = document.getElementById('error-id_' + input.id);
                if (errorDiv) {
                    errorDiv.innerHTML = '';
                    errorDiv.classList.remove('visible');
                }
                clearMessages();
            }
        });
    });

    /**
     * (Opcional) Añadir placeholders dinámicamente si faltan
     */
    function addMissingPlaceholders() {
        inputs.forEach(function(input) {
            if (!input.hasAttribute('placeholder')) {
                // Puedes definir un mapeo de IDs a placeholders
                const placeholders = {
                    'id_nombre': 'Ingresa el nombre de la sucursal',
                    'id_direccion': 'Ingresa la dirección',
                    'id_telefono': 'Ingresa el teléfono'
                    // Añade más campos según sea necesario
                };
                if (placeholders[input.id]) {
                    input.setAttribute('placeholder', placeholders[input.id]);
                }
            }
        });
    }

    // Ejecutar la función al cargar el DOM
    addMissingPlaceholders();
});
