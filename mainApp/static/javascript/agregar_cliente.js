// agregar_cliente.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-agregar-cliente');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');

    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevenir el envío predeterminado

        const formData = new FormData(form);

        fetch(form.action, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken') // Incluir el token CSRF
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                successMessageDiv.textContent = 'Cliente agregado exitosamente.';
                successMessageDiv.style.display = 'block';
                errorMessageDiv.style.display = 'none';
                form.reset(); // Reiniciar el formulario
            } else {
                errorMessageDiv.textContent = data.error || 'Ocurrió un error al agregar el cliente.';
                errorMessageDiv.style.display = 'block';
                successMessageDiv.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorMessageDiv.textContent = 'Ocurrió un error inesperado.';
            errorMessageDiv.style.display = 'block';
            successMessageDiv.style.display = 'none';
        });
    });

    // Función para obtener el valor de una cookie por nombre
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Verifica si esta cookie comienza con el nombre buscado
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});
