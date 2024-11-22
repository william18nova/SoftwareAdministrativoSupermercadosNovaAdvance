// agregar_empleado.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-agregar-empleado');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');

    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevenir el envío predeterminado

        // Limpiar mensajes previos
        errorMessageDiv.style.display = 'none';
        successMessageDiv.style.display = 'none';
        errorMessageDiv.textContent = '';
        successMessageDiv.textContent = '';

        // Obtener los valores de los campos
        const numerodocumento = document.getElementById('numerodocumento').value.trim();
        const nombre = document.getElementById('nombre').value.trim();
        const apellido = document.getElementById('apellido').value.trim();
        const telefono = document.getElementById('telefono').value.trim();
        const email = document.getElementById('email').value.trim();
        const direccion = document.getElementById('direccion').value.trim();
        const puesto = document.getElementById('puesto').value.trim();
        const usuario = document.getElementById('usuario').value;
        const sucursal = document.getElementById('sucursal').value;

        // Validaciones básicas
        let errores = [];

        // Número de Documento: 6 a 10 dígitos
        const numeroDocumentoPattern = /^\d{6,10}$/;
        if (!numeroDocumentoPattern.test(numerodocumento)) {
            errores.push('El número de documento debe tener entre 6 y 10 dígitos.');
        }

        // Nombre: solo letras y espacios, 2 a 50 caracteres
        const nombrePattern = /^[A-Za-z\s]{2,50}$/;
        if (!nombrePattern.test(nombre)) {
            errores.push('El nombre solo debe contener letras y espacios, y tener entre 2 y 50 caracteres.');
        }

        // Apellido: solo letras y espacios, 2 a 50 caracteres
        const apellidoPattern = /^[A-Za-z\s]{2,50}$/;
        if (!apellidoPattern.test(apellido)) {
            errores.push('El apellido solo debe contener letras y espacios, y tener entre 2 y 50 caracteres.');
        }

        // Teléfono: exactamente 10 dígitos
        const telefonoPattern = /^\d{10}$/;
        if (!telefonoPattern.test(telefono)) {
            errores.push('El teléfono debe tener exactamente 10 dígitos.');
        }

        // Correo Electrónico: validación básica de email
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            errores.push('Ingrese un correo electrónico válido.');
        }

        // Dirección: si está ingresada, mínimo 5 caracteres
        if (direccion && direccion.length < 5) {
            errores.push('La dirección debe tener al menos 5 caracteres.');
        }

        // Puesto: si está ingresado, solo letras y espacios, 2 a 50 caracteres
        const puestoPattern = /^[A-Za-z\s]{2,50}$/;
        if (puesto && !puestoPattern.test(puesto)) {
            errores.push('El puesto solo debe contener letras y espacios, y tener entre 2 y 50 caracteres.');
        }

        // Mostrar errores si los hay
        if (errores.length > 0) {
            errorMessageDiv.innerHTML = errores.join('<br>');
            errorMessageDiv.style.display = 'block';
            return;
        }

        // Si las validaciones pasan, enviar el formulario
        const formData = new FormData(form);

        fetch(form.action, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken') // Incluir el token CSRF
            },
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                // Si la respuesta no es 2xx, lanza un error
                return response.json().then(data => {
                    throw new Error(data.error || 'Error desconocido');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                successMessageDiv.textContent = 'Empleado agregado exitosamente.';
                successMessageDiv.style.display = 'block';
                form.reset(); // Reiniciar el formulario
            } else {
                errorMessageDiv.textContent = data.error || 'Ocurrió un error al agregar el empleado.';
                errorMessageDiv.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorMessageDiv.textContent = error.message || 'Ocurrió un error inesperado.';
            errorMessageDiv.style.display = 'block';
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
