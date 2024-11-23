// agregar_categorias.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('categoriaForm');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');

    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevenir el envío predeterminado

        const formData = new FormData(form);

        fetch(form.action, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'), // Incluir el token CSRF
                'Accept': 'application/json',
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Limpiar mensajes anteriores
            clearMessages();

            if (data.success) {
                successMessageDiv.textContent = 'Categoría agregada exitosamente.';
                successMessageDiv.style.display = 'block';
                form.reset(); // Reiniciar el formulario
            } else {
                // Mostrar errores específicos
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

    function displayErrors(errors) {
        // Mostrar errores generales
        if (errors.__all__) {
            errorMessageDiv.textContent = errors.__all__.map(e => e.message).join(' ');
            errorMessageDiv.style.display = 'block';
        }

        // Mostrar errores específicos de campo
        for (let field in errors) {
            const fieldErrors = errors[field];
            const fieldElement = document.getElementById('id_' + field);
            if (fieldElement) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'field-error';
                errorDiv.textContent = fieldErrors.map(e => e.message).join(' ');
                fieldElement.parentElement.appendChild(errorDiv);
            }
        }
    }

    function clearMessages() {
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.textContent = '';
        successMessageDiv.style.display = 'none';
        successMessageDiv.textContent = '';

        // Remover mensajes de error de campos anteriores
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.remove();
        });
    }

    // Función para obtener el valor de una cookie por nombre
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
