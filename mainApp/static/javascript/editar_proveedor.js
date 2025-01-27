// static/javascript/editar_proveedor.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-editar-proveedor');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
    const successTextSpan = document.getElementById('success-text');
  
    function clearMessages() {
      errorMessageDiv.style.display = 'none';
      errorMessageDiv.innerHTML = '';
      successMessageDiv.style.display = 'none';
      successTextSpan.textContent = '';
  
      const errorFields = document.querySelectorAll('.field-error');
      errorFields.forEach(errorField => {
        errorField.innerHTML = '';
        errorField.classList.remove('visible');
      });
    }
  
    function displayErrors(errors) {
      clearMessages();
      // Errores generales
      if (errors.__all__) {
        errorMessageDiv.innerHTML = errors.__all__.map(e => e.message).join('<br>');
        errorMessageDiv.style.display = 'block';
      }
      // Errores por campo
      for (let field in errors) {
        if (field === '__all__') continue;
        const fieldErrors = errors[field];
        const errorDiv = document.getElementById('error-id_' + field);
        if (errorDiv) {
          errorDiv.innerHTML = fieldErrors
            .map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`)
            .join('<br>');
          errorDiv.classList.add('visible');
          errorDiv.style.display = 'block';
        }
      }
    }
  
    form.addEventListener('submit', function(event) {
      event.preventDefault();
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
          // Redirige a la página de visualizar_proveedores con window.location
          window.location.href = data.redirect_url;
        } else {
          // Mostrar errores
          const errors = JSON.parse(data.errors);
          displayErrors(errors);
        }
      })
      .catch(error => {
        console.error('Error al actualizar proveedor:', error);
        errorMessageDiv.textContent = 'Ocurrió un error inesperado.';
        errorMessageDiv.style.display = 'block';
      });
    });
  
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
  