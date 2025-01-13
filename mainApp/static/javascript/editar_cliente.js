// static/javascript/editar_cliente.js

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-editar-cliente');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
  
    function clearMessages() {
      errorMessageDiv.style.display = 'none';
      errorMessageDiv.innerHTML = '';
      successMessageDiv.style.display = 'none';
      successMessageDiv.innerHTML = '';
  
      const errorFields = document.querySelectorAll('.field-error');
      errorFields.forEach(function(errorField) {
        errorField.innerHTML = '';
        errorField.classList.remove('visible');
      });
    }
  
    function displayErrors(errors) {
      clearMessages();
      
      // Errores generales
      if (errors.__all__) {
        const generalErrors = errors.__all__.map(e => e.message).join('<br>');
        errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${generalErrors}`;
        errorMessageDiv.style.display = 'block';
      }
  
      // Errores específicos de campo
      for (let fieldName in errors) {
        if (fieldName === '__all__') continue;
        const fieldErrors = errors[fieldName];
        const errorDiv = document.getElementById(`error-id_${fieldName}`);
        if (errorDiv) {
          const messagesHTML = fieldErrors
            .map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`)
            .join('<br>');
          errorDiv.innerHTML = messagesHTML;
          errorDiv.classList.add('visible');
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
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          // Redirigimos a visualizar_clientes
          window.location.href = data.redirect_url;
        } else {
          // Mostramos errores
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
  