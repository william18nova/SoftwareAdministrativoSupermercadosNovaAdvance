// static/javascript/editar_rol.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('rolForm');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');

    /**
     * Limpia mensajes de error y éxito
     */
    function clearMessages() {
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.innerHTML = '';
        successMessageDiv.style.display = 'none';
        successMessageDiv.innerHTML = '';
        
        // Limpiar errores específicos de campo
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
     * Muestra errores en campos y global
     */
    function displayErrors(errors) {
        clearMessages();
        
        // Errores generales (si existieran en __all__)
        if (errors.__all__) {
            errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errors.__all__.map(e => e.message).join('<br>')}`;
            errorMessageDiv.style.display = 'block';
        }
        
        // Errores específicos por campo
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
     * Muestra mensaje de éxito
     */
    function displaySuccess(message) {
        successMessageDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        successMessageDiv.style.display = 'block';
        // No reseteamos el form si no deseas limpiar los datos
        // form.reset();
    }

    /**
     * Manejar el submit del form
     */
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Evitar submit normal
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
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Si el servidor envía redirect_url, redirigimos
                if (data.redirect_url) {
                    window.location.href = data.redirect_url;
                } else {
                    // Fallback: mostrar mensaje en la misma página
                    displaySuccess(data.message);
                }
            } else {
                // Mostrar errores
                const errors = JSON.parse(data.errors);
                displayErrors(errors);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Ocurrió un error inesperado. Intenta de nuevo.`;
            errorMessageDiv.style.display = 'block';
        });
    });

    /**
     * Obtener la cookie CSRF
     */
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    /**
     * Remover error visual al modificar un campo
     */
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(function(input) {
        input.addEventListener('input', function() {
            if (input.classList.contains('input-error')) {
                input.classList.remove('input-error');
                const errorDiv = document.getElementById('error-id_' + input.id.split('id_')[1]);
                if (errorDiv) {
                    errorDiv.innerHTML = '';
                    errorDiv.classList.remove('visible');
                }
                clearMessages();
            }
        });
    });
});
