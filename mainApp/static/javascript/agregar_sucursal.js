// agregar_sucursal.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('sucursalForm');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');

    /**
     * Función para limpiar mensajes de error y éxito
     */
    function clearMessages() {
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.innerHTML = '';
        successMessageDiv.style.display = 'none';
        successMessageDiv.innerHTML = '';
        
        // Limpiar errores específicos de campos
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.classList.remove('visible');
        });
        
        // Remover clases de error de los inputs
        const inputs = form.querySelectorAll('input, textarea');
        inputs.forEach(function(input) {
            input.classList.remove('input-error');
        });
    }

    /**
     * Función para mostrar mensajes de error
     */
    function displayErrors(errors) {
        clearMessages();
        
        // Errores generales (si los hubiera)
        if (errors.__all__) {
            const generalErrors = errors.__all__.map(e => e.message).join('<br>');
            errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${generalErrors}`;
            errorMessageDiv.style.display = 'block';
        }
        
        // Errores específicos de campo
        for (let field in errors) {
            if (field === '__all__') continue;
            const fieldErrors = errors[field];
            const errorDiv = document.getElementById('error-id_' + field);
            const inputField = form.querySelector(`#id_${field}`);
            if (errorDiv) {
                errorDiv.innerHTML = fieldErrors.map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`).join('<br>');
                errorDiv.classList.add('visible');
            }
            if (inputField) {
                inputField.classList.add('input-error');
            }
        }
    }

    /**
     * Función para mostrar mensajes de éxito
     */
    function displaySuccess(message) {
        successMessageDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        successMessageDiv.style.display = 'block';
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
                displayErrors(data.errors);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Ocurrió un error inesperado. Por favor, intenta nuevamente.`;
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
});
