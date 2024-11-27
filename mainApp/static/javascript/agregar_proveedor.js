// agregar_proveedor.js

document.addEventListener('DOMContentLoaded', function() {
    // Variables generales
    const form = document.getElementById('proveedorForm');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
    
    /**
     * Función para limpiar mensajes de error y éxito
     */
    function clearMessages() {
        if (errorMessageDiv) {
            errorMessageDiv.style.display = 'none';
            errorMessageDiv.innerHTML = '';
        }
        if (successMessageDiv) {
            successMessageDiv.style.display = 'none';
            successMessageDiv.innerHTML = '';
        }
        
        // Limpiar errores específicos de campos
        const inputErrors = form.querySelectorAll('.input-error');
        inputErrors.forEach(function(input) {
            input.classList.remove('input-error');
        });
    }
    
    /**
     * Función para mostrar mensajes de error
     */
    function displayErrors(messages) {
        if (errorMessageDiv) {
            errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${messages}`;
            errorMessageDiv.style.display = 'block';
        }
    }
    
    /**
     * Función para mostrar mensajes de éxito
     */
    function displaySuccess(message) {
        if (successMessageDiv) {
            successMessageDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
            successMessageDiv.style.display = 'block';
        }
    }
    
    /**
     * Función para validar el formato de correo electrónico
     */
    function isValidEmail(email) {
        // Expresión regular simple para validar emails
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    /**
     * Función para validar el campo teléfono
     */
    function isValidTelefono(telefono) {
        const re = /^\d{7,15}$/; // Permite entre 7 y 15 dígitos
        return re.test(telefono);
    }
    
    /**
     * Función para validar el campo nombre
     */
    function isValidNombre(nombre) {
        const re = /^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$/; // Solo letras y espacios
        return re.test(nombre);
    }
    
    /**
     * Evento de envío del formulario
     */
    form.addEventListener('submit', function(event) {
        clearMessages();
        let valid = true;
        const errorMessages = [];
        
        // Obtener valores de los campos
        const nombre = form.querySelector('#nombre').value.trim();
        const empresa = form.querySelector('#empresa').value.trim();
        const telefono = form.querySelector('#telefono').value.trim();
        const email = form.querySelector('#email').value.trim();
        const direccion = form.querySelector('#direccion').value.trim(); // Opcional
        
        // Validar campo nombre
        if (nombre === '') {
            valid = false;
            errorMessages.push('El campo Nombre es obligatorio.');
            form.querySelector('#nombre').classList.add('input-error');
        } else if (!isValidNombre(nombre)) {
            valid = false;
            errorMessages.push('El Nombre solo debe contener letras y espacios.');
            form.querySelector('#nombre').classList.add('input-error');
        }
        
        // Validar campo empresa
        if (empresa === '') {
            valid = false;
            errorMessages.push('El campo Empresa es obligatorio.');
            form.querySelector('#empresa').classList.add('input-error');
        }
        
        // Validar campo telefono
        if (telefono === '') {
            valid = false;
            errorMessages.push('El campo Teléfono es obligatorio.');
            form.querySelector('#telefono').classList.add('input-error');
        } else if (!isValidTelefono(telefono)) {
            valid = false;
            errorMessages.push('El Teléfono debe contener solo dígitos y tener entre 7 y 15 caracteres.');
            form.querySelector('#telefono').classList.add('input-error');
        }
        
        // Validar campo email si está lleno
        if (email !== '' && !isValidEmail(email)) {
            valid = false;
            errorMessages.push('El Email proporcionado no tiene un formato válido.');
            form.querySelector('#email').classList.add('input-error');
        }
        
        // Puedes agregar más validaciones aquí si lo deseas
        
        if (!valid) {
            event.preventDefault(); // Prevenir el envío del formulario
            displayErrors(errorMessages.join('<br>'));
            return;
        }
        
        // Si todas las validaciones pasan, el formulario se enviará normalmente
    });
});
