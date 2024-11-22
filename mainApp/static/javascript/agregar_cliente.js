// mainApp/static/javascript/agregar_cliente.js

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('form-agregar-cliente');

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        const formData = new FormData(form);

        fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
            },
        })
        .then(response => response.json())
        .then(data => {
            // Ocultar todas las alertas antes de mostrar la nueva
            document.getElementById('error-message').style.display = 'none';
            document.getElementById('success-message').style.display = 'none';

            if (data.success) {
                const successMessage = document.getElementById('success-message');
                successMessage.textContent = 'El cliente fue agregado exitosamente.';
                successMessage.style.display = 'block';

                // Limpiar los campos de entrada
                form.reset();
            } else {
                const errorMessage = document.getElementById('error-message');
                errorMessage.textContent = 'Ocurrió un error al guardar los cambios: ' + data.error;
                errorMessage.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            const errorMessage = document.getElementById('error-message');
            errorMessage.textContent = 'Ocurrió un error al guardar los cambios: ' + error;
            errorMessage.style.display = 'block';
        });
    });

    // Función para obtener la cookie CSRF
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Verifica si esta cookie comienza con el nombre que buscamos
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});
