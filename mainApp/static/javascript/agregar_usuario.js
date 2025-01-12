// static/javascript/agregar_usuario.js

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
  
    // --- Campos de Usuario ---
    const nombreusuarioInput = document.getElementById('id_nombreusuario');
    const passwordInput      = document.getElementById('id_contraseña');
    const confirmInput       = document.getElementById('id_confirmar_contraseña');
  
    /* =============================
       2. Variables de Debounce/Cache
    ============================= */
    const DEBOUNCE_TIME = 300;
    let debounceTimeoutRol = null;
    const cacheRol = {};
  
    /* ========================
       3. Manejo de Errores/Alertas
    ======================== */
    function clearErrors() {
      const errorFields = document.querySelectorAll('.field-error');
      errorFields.forEach(e => {
        e.innerHTML = '';
        e.style.display = 'none';
        e.classList.remove('visible');
      });
      const globalError = document.getElementById('error-message');
      if (globalError) {
        globalError.style.display = 'none';
        globalError.innerHTML = '';
      }
      const successMessage = document.getElementById('success-message');
      if (successMessage) {
        successMessage.style.display = 'none';
        successMessage.innerHTML = '';
      }
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
      const errorDiv = document.getElementById('error-message');
      if (errorDiv) {
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorDiv.style.display = 'block';
      }
    }
  
    function showSuccess(message) {
      const successDiv = document.getElementById('success-message');
      if (successDiv) {
        successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        successDiv.style.display = 'block';
      }
    }
  
    /* ==============================
       4. Funciones de Autocompletado
    ============================== */
    function fetchWithCache(url, cache, term, page, callback) {
      const cacheKey = `${term}_${page}`;
      if (cache[cacheKey]) {
        callback(cache[cacheKey]);
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
          cache[cacheKey] = data;
          callback(data);
        })
        .catch(error => {
          console.error('fetchWithCache error:', error);
        });
    }
  
    function fetchRoles(term, page = 1) {
      if (isLoadingRol || !hasMoreRol) return;
      isLoadingRol = true;
  
      const url = `${rolAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
      fetchWithCache(url, cacheRol, term, page, function(data) {
        if (page === 1) {
          rolResults.innerHTML = '';
        }
        if (data.results.length > 0) {
          data.results.forEach(item => {
            const opt = document.createElement('div');
            opt.classList.add('autocomplete-option');
            opt.textContent = item.text;
            opt.dataset.id  = item.id;
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
  
    // Debounce
    function debounce(fn, delay) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
      };
    }
  
    const debouncedFetchRoles = debounce(function() {
      fetchRoles(currentTermRol, currentPageRol);
    }, DEBOUNCE_TIME);
  
    // --- Eventos de autocomplete (Rol) ---
    rolInput.addEventListener('input', function() {
      rolIdInput.value = '';
      hasMoreRol = true;
      currentPageRol = 1;
      currentTermRol = rolInput.value.trim();
      if (!currentTermRol) {
        rolResults.innerHTML = '';
        rolResults.style.display = 'none';
        return;
      }
      debouncedFetchRoles();
    });
  
    rolInput.addEventListener('focus', function() {
      currentTermRol = rolInput.value.trim();
      hasMoreRol = true;
      currentPageRol = 1;
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
        rolInput.value   = e.target.textContent;
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
  
    /* ==============================
       5. Toggle Password Visibility
    ============================== */
    window.togglePassword = function(id) {
      const input = document.getElementById(id);
      if (!input) return;
      const icon = input.nextElementSibling; // El <i> contiguo
  
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
       6. Evento Submit Form
    ========================= */
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      clearErrors();
  
      // Validaciones mínimas en el frontend
      const rolIdVal  = rolIdInput.value.trim();
      const userVal   = nombreusuarioInput.value.trim();
      const passVal   = passwordInput.value.trim();
      const confVal   = confirmInput.value.trim();
  
      let hasLocalErrors = false;
  
      if (!rolIdVal) {
        showFieldError('rolid', 'Debe seleccionar un Rol.');
        hasLocalErrors = true;
      }
      if (!userVal) {
        showFieldError('nombreusuario', 'El nombre de usuario es obligatorio.');
        hasLocalErrors = true;
      }
      if (!passVal) {
        showFieldError('contraseña', 'La contraseña es obligatoria.');
        hasLocalErrors = true;
      }
      if (!confVal) {
        showFieldError('confirmar_contraseña', 'Debe confirmar la contraseña.');
        hasLocalErrors = true;
      }
      if (passVal && confVal && passVal !== confVal) {
        showFieldError('confirmar_contraseña', 'Las contraseñas no coinciden.');
        hasLocalErrors = true;
      }
  
      if (hasLocalErrors) return;
  
      // Enviar vía AJAX
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
          // Éxito
          showSuccess('Usuario creado exitosamente.');
          form.reset();
          rolResults.innerHTML = '';
          rolResults.style.display = 'none';
        } else {
          // Errores devueltos por el backend
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
  
    /* ========================
       7. Obtener Cookie
    ======================== */
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
  