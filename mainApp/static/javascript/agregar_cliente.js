// agregar_cliente.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-agregar-cliente');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
    
    /**
     * Limpia todos los mensajes de error y éxito previos
     */
    function clearMessages() {
        // Mensajes generales
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.innerHTML = '';
        successMessageDiv.style.display = 'none';
        successMessageDiv.innerHTML = '';
        
        // Errores de campos (oculta cada .field-error)
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.classList.remove('visible');
        });
    }

    /**
     * Muestra errores en los campos o mensajes generales
     */
    function displayErrors(errors) {
        clearMessages();
        
        // Errores generales
        if (errors.__all__) {
            const generalErrors = errors.__all__.map(e => e.message).join('<br>');
            errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${generalErrors}`;
            errorMessageDiv.style.display = 'block';
        }
        
        // Errores específicos de campo
        for (let fieldName in errors) {
            if (fieldName === '__all__') continue;
            const fieldErrors = errors[fieldName];
            // Buscamos el div con id="error-id_<campo>"
            const errorDiv = document.getElementById(`error-id_${fieldName}`);
            if (errorDiv) {
                // Creamos un HTML con el ícono de exclamación
                const messagesHTML = fieldErrors
                  .map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`)
                  .join('<br>');
                errorDiv.innerHTML = messagesHTML;
                // Mostramos el div con la clase .visible
                errorDiv.classList.add('visible');
            }
        }
    }

    /**
     * Maneja el envío del formulario vía fetch (AJAX)
     */
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Evita el envío estándar
        clearMessages();

        const formData = new FormData(form);

        fetch(form.action, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Accept': 'application/json'
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Mensaje de éxito
                successMessageDiv.innerHTML = '<i class="fas fa-check-circle"></i> Cliente agregado exitosamente.';
                successMessageDiv.style.display = 'block';
                
                // Limpiar formulario
                form.reset();
            } else {
                // Mostrar errores
                const errors = JSON.parse(data.errors);
                displayErrors(errors);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorMessageDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ocurrió un error inesperado.';
            errorMessageDiv.style.display = 'block';
        });
    });

    /**
     * Obtiene el valor de una cookie por nombre (para CSRF)
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
});
