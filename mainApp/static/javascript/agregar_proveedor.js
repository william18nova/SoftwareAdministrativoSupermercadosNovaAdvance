// agregar_proveedor.js

document.addEventListener('DOMContentLoaded', function() {
    // Variables generales
    const form = document.getElementById('form-agregar-proveedor');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
    
    /**
     * Función para limpiar mensajes de error y éxito
     */
    function clearMessages() {
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.innerHTML = '';
        successMessageDiv.style.display = 'none';
        successMessageDiv.textContent = '';
        
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
        successMessageDiv.textContent = message;
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
});
