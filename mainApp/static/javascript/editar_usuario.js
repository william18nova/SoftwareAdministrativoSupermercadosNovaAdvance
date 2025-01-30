// static/javascript/editar_usuario.js

document.addEventListener('DOMContentLoaded', function() {
    /* ======================
       1. Variables Generales
    ====================== */
    const form = document.getElementById('usuarioForm');
  
    // --- Autocomplete de Rol ---
    const rolInput    = document.getElementById('id_rol_autocomplete');
    const rolIdInput  = document.getElementById('id_rolid');
    const rolResults  = document.getElementById('rol-autocomplete-results');
    let isLoadingRol  = false;
    let hasMoreRol    = true;
    let currentPageRol= 1;
    let currentTermRol= '';
    
    // variable global inyectada en el template
    // var rolAutocompleteUrl = "...";
  
    // --- Campos de Usuario ---
    const nombreusuarioInput = document.getElementById('id_nombreusuario');
    const passwordInput      = document.getElementById('id_contraseña');
    const confirmInput       = document.getElementById('id_confirmar_contraseña');
  
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
  
    /* ========================
       2. Funciones de Errores
    ======================== */
    function clearErrors() {
      // Limpia errores globales
      errorMessageDiv.style.display = 'none';
      errorMessageDiv.innerHTML = '';
      successMessageDiv.style.display = 'none';
      successMessageDiv.innerHTML = '';
  
      // Limpia errores de campo
      const errorFields = document.querySelectorAll('.field-error');
      errorFields.forEach(e => {
        e.innerHTML = '';
        e.style.display = 'none';
        e.classList.remove('visible');
      });
    }
  
    function showFieldError(field, message) {
      const errorDiv = document.getElementById(`error-id_${field}`);
      if (errorDiv) {
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorDiv.classList.add('visible');
        errorDiv.style.display = 'block';
      }
    }
  
    function showGlobalError(message) {
      errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
      errorMessageDiv.style.display = 'block';
    }
  
    function showSuccess(message) {
      successMessageDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
      successMessageDiv.style.display = 'block';
    }
  
    /* ==============================
       3. Autocomplete de Roles
    ============================== */
    let cacheRol = {};
  
    function fetchWithCache(url, cache, callback) {
      if (cache[url]) {
        callback(cache[url]);
        return;
      }
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          cache[url] = data;
          callback(data);
        })
        .catch(error => {
          console.error('fetchWithCache error:', error);
        });
    }
  
    function fetchRoles(term, page=1) {
      if (isLoadingRol || !hasMoreRol) return;
      isLoadingRol = true;
  
      const url = `${rolAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
      fetchWithCache(url, cacheRol, function(data) {
        if (page === 1) {
          rolResults.innerHTML = '';
        }
        if (data.results.length > 0) {
          data.results.forEach(item => {
            const opt = document.createElement('div');
            opt.classList.add('autocomplete-option');
            opt.textContent = item.text;
            opt.dataset.id = item.id;
            rolResults.appendChild(opt);
          });
          hasMoreRol = data.has_more;
        } else if (page === 1) {
          const noResult = document.createElement('div');
          noResult.classList.add('autocomplete-no-result');
          noResult.textContent = 'No se encontraron resultados';
          rolResults.appendChild(noResult);
          hasMoreRol = false;
        }
        rolResults.style.display = 'block';
        isLoadingRol = false;
      });
    }
  
    function debounce(fn, delay) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
      };
    }
    const DEBOUNCE_TIME = 300;
    const debouncedFetchRoles = debounce(() => {
      fetchRoles(currentTermRol, currentPageRol);
    }, DEBOUNCE_TIME);
  
    // Eventos de autocomplete
    rolInput.addEventListener('input', function() {
      rolIdInput.value = '';
      hasMoreRol = true;
      currentPageRol = 1;
      currentTermRol = rolInput.value.trim();
      debouncedFetchRoles();
    });
  
    rolInput.addEventListener('focus', function() {
      if (!rolInput.value.trim()) return;
      hasMoreRol = true;
      currentPageRol = 1;
      currentTermRol = rolInput.value.trim();
      debouncedFetchRoles();
    });
  
    rolResults.addEventListener('scroll', function() {
      if (rolResults.scrollTop + rolResults.clientHeight >= rolResults.scrollHeight - 5) {
        if (hasMoreRol && !isLoadingRol) {
          currentPageRol += 1;
          fetchRoles(currentTermRol, currentPageRol);
        }
      }
    });
  
    rolResults.addEventListener('click', function(e) {
      if (e.target && e.target.classList.contains('autocomplete-option')) {
        rolInput.value = e.target.textContent;
        rolIdInput.value = e.target.dataset.id;
        rolResults.innerHTML = '';
        rolResults.style.display = 'none';
        hasMoreRol = false;
      }
    });
  
    document.addEventListener('click', function(e) {
      if (!rolInput.contains(e.target) && !rolResults.contains(e.target)) {
        rolResults.innerHTML = '';
        rolResults.style.display = 'none';
        hasMoreRol = false;
      }
    });
  
    /* ============================
       4. Toggle Password
    ============================ */
    window.togglePassword = function(fieldId) {
      const input = document.getElementById(fieldId);
      if (!input) return;
      const icon = input.nextElementSibling; 
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    };
  
    /* =========================
       5. Submit del Formulario
    ========================= */
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      clearErrors();
  
      // Validaciones mínimas en front
      const rolVal  = rolIdInput.value.trim();
      const userVal = nombreusuarioInput.value.trim();
      const passVal = passwordInput.value.trim();
      const confVal = confirmInput.value.trim();
  
      let hasLocalErrors = false;
      if (!rolVal) {
        showFieldError('rolid', 'Debe seleccionar un Rol.');
        hasLocalErrors = true;
      }
      if (!userVal) {
        showFieldError('nombreusuario', 'El nombre de usuario es obligatorio.');
        hasLocalErrors = true;
      }
      // Contraseña no obligatoria si vacía, pero si se ingresa, confirm debe coincidir
      if ((passVal || confVal) && passVal !== confVal) {
        showFieldError('confirmar_contraseña', 'Las contraseñas no coinciden.');
        hasLocalErrors = true;
      }
  
      if (hasLocalErrors) return;
  
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
          throw new Error(`HTTP Error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          // Si recibimos redirect_url
          if (data.redirect_url) {
            window.location.href = data.redirect_url;
          } else {
            showSuccess('Usuario actualizado exitosamente.');
          }
        } else {
          // Manejar errores del backend
          const errors = JSON.parse(data.errors);
          for (let field in errors) {
            const fieldErrors = errors[field];
            fieldErrors.forEach(err => {
              showFieldError(field, err.message);
            });
          }
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showGlobalError('Ocurrió un error inesperado al guardar.');
      });
    });
  
    /* =====================
       6. Obtener CSRF token
    ===================== */
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
  