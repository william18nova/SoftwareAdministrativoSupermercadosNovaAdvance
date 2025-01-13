// editar_empleado.js

document.addEventListener('DOMContentLoaded', function() {
    /* ======================
       1. Variables Generales
    ====================== */
    const form = document.getElementById('form-editar-empleado');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');

    // Campos de Autocompletado
    const usuarioInput = document.getElementById('id_usuario_autocomplete');
    const usuarioIdInput = document.getElementById('id_usuarioid');
    const usuarioAutocompleteResults = document.getElementById('usuario-autocomplete-results');

    const sucursalInput = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput = document.getElementById('id_sucursalid');
    const sucursalAutocompleteResults = document.getElementById('sucursal-autocomplete-results');

    // Rutas definidas en el HTML
    //   usuarioAutocompleteUrl ya tiene ?empleadoid=xx
    //   sucursalAutocompleteUrl no lo necesita
    // Ejemplo:
    // let usuarioAutocompleteUrl = "/ruta/usuario_autocomplete?empleadoid=7";
    // let sucursalAutocompleteUrl = "/ruta/sucursal_autocomplete";

    /* ======================
       2. Variables de Debounce y Caching
    ====================== */
    const DEBOUNCE_TIME = 300; 
    let debounceTimeoutUsuario = null;
    let debounceTimeoutSucursal = null;

    // Caches
    const cacheUsuario = {};
    const cacheSucursal = {};

    // Control de paginación
    let currentPageUsuario = 1;
    let isLoadingUsuario = false;
    let hasMoreUsuario = true;
    let currentTermUsuario = '';

    let currentPageSucursal = 1;
    let isLoadingSucursal = false;
    let hasMoreSucursal = true;
    let currentTermSucursal = '';

    /* ======================
       3. Funciones de Utilidad
    ====================== */
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

    function clearMessages() {
      errorMessageDiv.style.display = 'none';
      errorMessageDiv.innerHTML = '';
      successMessageDiv.style.display = 'none';
      successMessageDiv.innerHTML = '';

      const errorFields = document.querySelectorAll('.field-error');
      errorFields.forEach(errField => {
        errField.innerHTML = '';
        errField.classList.remove('visible');
        errField.style.display = 'none';
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

    // Genérica para fetch con cache
    function fetchWithCache(url, cache, term, page, callback) {
      const cacheKey = `${term}_${page}`;
      if (cache[cacheKey]) {
        callback(cache[cacheKey]);
        return;
      }
      fetch(url)
        .then(resp => {
          if (!resp.ok) {
            throw new Error(`HTTP Error: ${resp.status}`);
          }
          return resp.json();
        })
        .then(data => {
          cache[cacheKey] = data;
          callback(data);
        })
        .catch(error => {
          console.error('fetchWithCache error:', error);
        });
    }

    // Manejar la selección de una opción
    function handleSelection(inputElem, hiddenInput, resultsContainer, text, id) {
      inputElem.value = text;
      hiddenInput.value = id;
      resultsContainer.innerHTML = '';
      resultsContainer.classList.remove('visible');
      resultsContainer.style.display = 'none';
    }

    /* ======================
       4. Autocomplete de Usuario
    ====================== */
    function fetchUsuarios(term, page=1) {
      if (isLoadingUsuario || !hasMoreUsuario) return;
      isLoadingUsuario = true;

      // Importante: Como usuarioAutocompleteUrl ya TIENE "?" (para empleadoid=XX),
      // al concatenar 'term' y 'page' debemos usar "&"
      const url = `${usuarioAutocompleteUrl}&term=${encodeURIComponent(term)}&page=${page}`;

      fetchWithCache(url, cacheUsuario, term, page, function(data) {
        if (page === 1) {
          usuarioAutocompleteResults.innerHTML = '';
        }
        if (data.results.length > 0) {
          data.results.forEach(item => {
            const div = document.createElement('div');
            div.classList.add('autocomplete-option');
            div.textContent = item.text;
            div.dataset.id = item.id;
            usuarioAutocompleteResults.appendChild(div);
          });
          hasMoreUsuario = data.has_more;
        } else if (page === 1) {
          const noRes = document.createElement('div');
          noRes.classList.add('autocomplete-no-result');
          noRes.textContent = 'No se encontraron resultados';
          usuarioAutocompleteResults.appendChild(noRes);
          hasMoreUsuario = false;
        }
        usuarioAutocompleteResults.style.display = 'block';
        usuarioAutocompleteResults.classList.add('visible');
        isLoadingUsuario = false;
      });
    }

    usuarioInput.addEventListener('input', function() {
      usuarioIdInput.value = '';
      hasMoreUsuario = true;
      currentPageUsuario = 1;
      currentTermUsuario = usuarioInput.value.trim();

      if (debounceTimeoutUsuario) clearTimeout(debounceTimeoutUsuario);
      debounceTimeoutUsuario = setTimeout(function() {
        if (!currentTermUsuario) {
          fetchUsuarios('', 1);
        } else {
          fetchUsuarios(currentTermUsuario, 1);
        }
      }, DEBOUNCE_TIME);
    });

    usuarioInput.addEventListener('focus', function() {
      hasMoreUsuario = true;
      currentPageUsuario = 1;
      currentTermUsuario = usuarioInput.value.trim();
      if (!currentTermUsuario) {
        fetchUsuarios('', 1);
      } else {
        fetchUsuarios(currentTermUsuario, 1);
      }
    });

    usuarioAutocompleteResults.addEventListener('scroll', function() {
      if (usuarioAutocompleteResults.scrollTop + usuarioAutocompleteResults.clientHeight >= usuarioAutocompleteResults.scrollHeight - 5) {
        if (hasMoreUsuario && !isLoadingUsuario) {
          currentPageUsuario += 1;
          fetchUsuarios(currentTermUsuario, currentPageUsuario);
        }
      }
    });

    usuarioAutocompleteResults.addEventListener('click', function(e) {
      if (e.target && e.target.classList.contains('autocomplete-option')) {
        const selText = e.target.textContent;
        const selId = e.target.dataset.id;
        handleSelection(usuarioInput, usuarioIdInput, usuarioAutocompleteResults, selText, selId);
      }
    });

    document.addEventListener('click', function(e) {
      if (!usuarioInput.contains(e.target) && !usuarioAutocompleteResults.contains(e.target)) {
        usuarioAutocompleteResults.innerHTML = '';
        usuarioAutocompleteResults.classList.remove('visible');
        usuarioAutocompleteResults.style.display = 'none';
        hasMoreUsuario = false;
      }
    });

    /* ======================
       5. Autocomplete de Sucursal
    ====================== */
    function fetchSucursales(term, page=1) {
      if (isLoadingSucursal || !hasMoreSucursal) return;
      isLoadingSucursal = true;

      // Aquí sí, sucursalAutocompleteUrl NO tiene '?', así que agregamos '?term='
      // O podrías hacerlo al revés, pero es esencial que la query final quede bien.
      const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;

      fetchWithCache(url, cacheSucursal, term, page, function(data) {
        if (page === 1) {
          sucursalAutocompleteResults.innerHTML = '';
        }
        if (data.results.length > 0) {
          data.results.forEach(item => {
            const div = document.createElement('div');
            div.classList.add('autocomplete-option');
            div.textContent = item.text;
            div.dataset.id = item.id;
            sucursalAutocompleteResults.appendChild(div);
          });
          hasMoreSucursal = data.has_more;
        } else if (page === 1) {
          const noRes = document.createElement('div');
          noRes.classList.add('autocomplete-no-result');
          noRes.textContent = 'No se encontraron resultados';
          sucursalAutocompleteResults.appendChild(noRes);
          hasMoreSucursal = false;
        }
        sucursalAutocompleteResults.style.display = 'block';
        sucursalAutocompleteResults.classList.add('visible');
        isLoadingSucursal = false;
      });
    }

    sucursalInput.addEventListener('input', function() {
      sucursalIdInput.value = '';
      hasMoreSucursal = true;
      currentPageSucursal = 1;
      currentTermSucursal = sucursalInput.value.trim();

      if (debounceTimeoutSucursal) clearTimeout(debounceTimeoutSucursal);
      debounceTimeoutSucursal = setTimeout(function() {
        if (!currentTermSucursal) {
          fetchSucursales('', 1);
        } else {
          fetchSucursales(currentTermSucursal, 1);
        }
      }, DEBOUNCE_TIME);
    });

    sucursalInput.addEventListener('focus', function() {
      hasMoreSucursal = true;
      currentPageSucursal = 1;
      currentTermSucursal = sucursalInput.value.trim();
      if (!currentTermSucursal) {
        fetchSucursales('', 1);
      } else {
        fetchSucursales(currentTermSucursal, 1);
      }
    });

    sucursalAutocompleteResults.addEventListener('scroll', function() {
      if (sucursalAutocompleteResults.scrollTop + sucursalAutocompleteResults.clientHeight >= sucursalAutocompleteResults.scrollHeight - 5) {
        if (hasMoreSucursal && !isLoadingSucursal) {
          currentPageSucursal += 1;
          fetchSucursales(currentTermSucursal, currentPageSucursal);
        }
      }
    });

    sucursalAutocompleteResults.addEventListener('click', function(e) {
      if (e.target && e.target.classList.contains('autocomplete-option')) {
        const selText = e.target.textContent;
        const selId = e.target.dataset.id;
        handleSelection(sucursalInput, sucursalIdInput, sucursalAutocompleteResults, selText, selId);
      }
    });

    document.addEventListener('click', function(e) {
      if (!sucursalInput.contains(e.target) && !sucursalAutocompleteResults.contains(e.target)) {
        sucursalAutocompleteResults.innerHTML = '';
        sucursalAutocompleteResults.classList.remove('visible');
        sucursalAutocompleteResults.style.display = 'none';
        hasMoreSucursal = false;
      }
    });

    /* ======================
       6. Submit del Form
    ====================== */
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      clearMessages();

      let hasLocalErrors = false;
      // Validar que haya usuario y sucursal
      if (!usuarioIdInput.value.trim()) {
        showFieldError('usuarioid', 'Debe seleccionar un usuario.');
        hasLocalErrors = true;
      }
      if (!sucursalIdInput.value.trim()) {
        showFieldError('sucursalid', 'Debe seleccionar una sucursal.');
        hasLocalErrors = true;
      }

      if (hasLocalErrors) {
        showGlobalError('Por favor, corrige los errores en el formulario.');
        return;
      }

      // Enviar con AJAX
      const formData = new FormData(form);
      fetch(form.action, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
          'Accept': 'application/json'
        },
        body: formData
      })
      .then(resp => {
        if (!resp.ok) throw new Error(`HTTP Error: ${resp.status}`);
        return resp.json();
      })
      .then(data => {
        if (data.success) {
          // Redireccionar a la lista o mostrar éxito
          window.location.href = data.redirect_url;
        } else {
          const errs = JSON.parse(data.errors);
          for (let f in errs) {
            const fieldErrors = errs[f];
            fieldErrors.forEach(err => {
              showFieldError(f, err.message);
            });
          }
          if (Object.keys(errs).length > 0) {
            showGlobalError('Por favor, corrige los errores en el formulario.');
          }
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showGlobalError('Ocurrió un error inesperado al guardar.');
      });
    });
});
