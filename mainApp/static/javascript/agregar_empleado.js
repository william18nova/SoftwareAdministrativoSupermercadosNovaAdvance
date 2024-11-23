// agregar_empleado.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-agregar-empleado');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');

    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevenir el envío predeterminado

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
            // Limpiar mensajes anteriores
            clearMessages();

            if (data.success) {
                successMessageDiv.textContent = 'Empleado agregado exitosamente.';
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
        // Mostrar errores generales si existen
        if (errors.__all__) {
            errorMessageDiv.innerHTML = errors.__all__.map(e => e.message).join('<br>');
            errorMessageDiv.style.display = 'block';
        }

        // Mostrar errores específicos de campo
        for (let field in errors) {
            if (field === '__all__') continue; // Ya manejamos los errores generales
            const fieldErrors = errors[field];
            const fieldElement = document.getElementById('id_' + field);
            const errorDiv = document.getElementById('error-id_' + field);
            if (errorDiv) {
                errorDiv.innerHTML = fieldErrors.map(e => e.message).join('<br>');
                errorDiv.style.display = 'block';
            }
        }
    }

    function clearMessages() {
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.innerHTML = '';
        successMessageDiv.style.display = 'none';
        successMessageDiv.textContent = '';

        // Remover mensajes de error de campos anteriores
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.style.display = 'none';
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
