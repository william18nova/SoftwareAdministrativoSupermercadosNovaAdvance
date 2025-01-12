document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('categoriaEditForm');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
  
    function clearMessages() {
      errorMessageDiv.style.display = 'none';
      errorMessageDiv.textContent = '';
      successMessageDiv.style.display = 'none';
      successMessageDiv.textContent = '';
  
      const errorFields = document.querySelectorAll('.field-error');
      errorFields.forEach(field => {
        field.innerHTML = '';
        field.classList.remove('visible');
      });
    }
  
    function displayErrors(errors) {
      clearMessages();
      if (errors.__all__) {
        const generalErrors = errors.__all__.map(e => e.message).join('<br>');
        errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${generalErrors}`;
        errorMessageDiv.style.display = 'block';
      }
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
  
    form.addEventListener('submit', function(e) {
      e.preventDefault();
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
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.success) {
          // Si el servidor devolvió 'success = True',
          // redirigimos a visualizar_categorias
          window.location.href = data.redirect_url;
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
  