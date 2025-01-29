// static/javascript/editar_sucursal.js (o agregar_sucursal.js)

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('sucursalForm');
    const errorMessageDiv = document.getElementById('error-message');   // Div para errores globales
    const successMessageDiv = document.getElementById('success-message'); // Div para éxito global
  
    /**
     * Limpia mensajes y estados de error
     */
    function clearMessages() {
      // Ocultar mensajes de error y éxito global
      errorMessageDiv.style.display = 'none';
      errorMessageDiv.innerHTML = '';
      successMessageDiv.style.display = 'none';
      successMessageDiv.innerHTML = '';
  
      // Borrar mensajes de error específicos de campos
      const errorFields = document.querySelectorAll('.field-error');
      errorFields.forEach(errorField => {
        errorField.innerHTML = '';
        errorField.classList.remove('visible');
      });
  
      // Remover clase input-error de cada campo
      const inputs = form.querySelectorAll('input, textarea');
      inputs.forEach(input => {
        input.classList.remove('input-error');
      });
    }
  
    /**
     * Muestra TODOS los errores devueltos por Django
     */
    function displayErrors(errors) {
      // Primero limpia
      clearMessages();
  
      // 1) Errores globales en __all__
      if (errors.__all__) {
        const globalErrorsHtml = errors.__all__
          .map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`)
          .join('<br>');
        errorMessageDiv.innerHTML = globalErrorsHtml;
        errorMessageDiv.style.display = 'block';
      }
  
      // 2) Errores por campo
      for (let fieldName in errors) {
        // Ya manejamos __all__, así que lo omitimos aquí
        if (fieldName === '__all__') continue;
  
        // Array de errores para este campo
        const fieldErrors = errors[fieldName]; 
        const errorDiv = document.getElementById('error-id_' + fieldName); 
        // El input con id="id_nombre" si fieldName="nombre", etc.
        const inputField = document.getElementById('id_' + fieldName);
  
        if (errorDiv) {
          // Construimos el HTML con TODOS los errores
          // Ej: <i>mensaje1</i><br><i>mensaje2</i>...
          const fieldErrorsHtml = fieldErrors
            .map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`)
            .join('<br>');
  
          errorDiv.innerHTML = fieldErrorsHtml;
          errorDiv.classList.add('visible'); // Aparece el div
        }
  
        // Resaltar el input con borde rojo (o la clase que uses)
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
      // Si deseas, podrías resetear el form:
      // form.reset();
    }
  
    /**
     * Manejador del evento submit (AJAX)
     */
    form.addEventListener('submit', function(event) {
      event.preventDefault();
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
          // Si tu backend manda 'redirect_url', redirigimos
          if (data.redirect_url) {
            window.location.href = data.redirect_url;
          } else {
            // O bien mostramos un mensaje local
            displaySuccess(data.message);
          }
        } else {
          // data.errors es un objeto con todos los campos
          // Ej: { "nombre": [{message: "..."}], "telefono": [...] }
          displayErrors(data.errors);
        }
      })
      .catch(error => {
        console.error('Error:', error);
        errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Ocurrió un error inesperado.`;
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
     * Al cambiar un campo, quitamos el estado de error 
     * (si no quieres esto, puedes omitirlo)
     */
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        if (input.classList.contains('input-error')) {
          input.classList.remove('input-error');
          // Ocultamos el div de error específico
          const errorDiv = document.getElementById('error-id_' + input.id.split('id_')[1]);
          if (errorDiv) {
            errorDiv.innerHTML = '';
            errorDiv.classList.remove('visible');
          }
        }
      });
    });
  });
  