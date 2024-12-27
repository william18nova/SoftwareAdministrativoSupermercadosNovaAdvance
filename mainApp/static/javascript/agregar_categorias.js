// agregar_categorias.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('categoriaForm');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');

    /**
     * Limpia mensajes globales y de campo
     */
    function clearMessages() {
        // Ocultar y limpiar mensajes globales
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.textContent = '';
        successMessageDiv.style.display = 'none';
        successMessageDiv.textContent = '';

        // Ocultar errores de campos
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.classList.remove('visible');
        });
    }

    /**
     * Muestra los errores devueltos por el servidor
     */
    function displayErrors(errors) {
        clearMessages();

        // Errores generales (no asociados a un campo específico)
        if (errors.__all__) {
            const generalErrors = errors.__all__.map(e => e.message).join('<br>');
            // Usa backticks para inyectar HTML con el ícono
            errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${generalErrors}`;
            errorMessageDiv.style.display = 'block';
        }

        // Errores específicos de cada campo
        for (let fieldName in errors) {
            if (fieldName === '__all__') continue; // saltar errores globales
            const fieldErrors = errors[fieldName];
            
            // Asegúrate de usar backticks o concatenar bien el id
            const errorDiv = document.getElementById(`error-id_${fieldName}`);
            if (errorDiv) {
                // Construimos el HTML para cada error con su ícono
                const messagesHTML = fieldErrors
                    .map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`)
                    .join('<br>');

                errorDiv.innerHTML = messagesHTML;
                // Mostramos con la clase .visible para la animación CSS
                errorDiv.classList.add('visible');
            }
        }
    }

    /**
     * Maneja el envío del formulario
     */
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevenir envío completo
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
                successMessageDiv.innerHTML = '<i class="fas fa-check-circle"></i> Categoría agregada exitosamente.';
                successMessageDiv.style.display = 'block';
                form.reset(); // Limpiar el formulario
            } else {
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
     * Función para obtener el valor de la cookie (CSRF)
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
