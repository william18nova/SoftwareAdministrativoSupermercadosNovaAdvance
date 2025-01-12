// static/javascript/agregar_punto_pago.js

document.addEventListener('DOMContentLoaded', function() {
  /* =======================
     1. Inicializar DataTable
  ======================= */
  const dataTable = $('#puntos-pago-list').DataTable({
    paging: false,
    searching: true,
    info: false,
    responsive: true,
    language: {
      search: "Buscar:",
      zeroRecords: "No se encontraron resultados",
      emptyTable: "No hay puntos de pago para mostrar",
    },
  });

  /* ======================
     2. Variables Generales
  ====================== */
  const form = document.getElementById('puntoPagoForm');

  // Autocomplete de Sucursal
  const sucursalInput    = document.getElementById('id_sucursal_autocomplete');
  const sucursalIdInput  = document.getElementById('id_sucursal');
  const sucursalResults  = document.getElementById('sucursal-autocomplete-results');
  let isLoadingSucursal  = false;
  let hasMoreSucursal    = true;
  let currentPageSucursal= 1;
  let currentTermSucursal= '';

  // Campos para “punto de pago”
  const nombreInput       = document.getElementById('id_nombre');
  const descripcionInput  = document.getElementById('id_descripcion');
  const dinerocajaInput   = document.getElementById('id_dinerocaja');
  const btnAgregarPP      = document.getElementById('agregarPuntoPagoBtn');

  // Lista temporal: { nombre, descripcion, dinerocaja }
  let puntosTemp = [];

  /* ==========================
     3. Debounce y Caching
  ========================== */
  const DEBOUNCE_TIME = 300;
  let debounceTimeoutSucursal = null;
  const cacheSucursal = {};

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

  function fetchSucursales(term, page = 1) {
    if (isLoadingSucursal || !hasMoreSucursal) return;
    isLoadingSucursal = true;

    const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
    fetchWithCache(url, cacheSucursal, term, page, function(data) {
      if (page === 1) {
        sucursalResults.innerHTML = '';
      }
      if (data.results.length > 0) {
        data.results.forEach(item => {
          const opt = document.createElement('div');
          opt.classList.add('autocomplete-option');
          opt.textContent = item.text;
          opt.dataset.id  = item.id;
          sucursalResults.appendChild(opt);
        });
        hasMoreSucursal = data.has_more;
      } else if (page === 1) {
        const noResult = document.createElement('div');
        noResult.classList.add('autocomplete-no-result');
        noResult.textContent = 'No se encontraron resultados';
        sucursalResults.appendChild(noResult);
        hasMoreSucursal = false;
      }
      sucursalResults.style.display = 'block';
      isLoadingSucursal = false;
    });
  }

  /* ======================
     5. Manejo de Errores
  ====================== */
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
      errorDiv.style.display = 'block';
      errorDiv.classList.add('visible');
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

  /* ==========================
     6. Eventos de Autocomplete
  ========================== */
  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  const debouncedFetchSucursales = debounce(function() {
    fetchSucursales(currentTermSucursal, currentPageSucursal);
  }, DEBOUNCE_TIME);

  sucursalInput.addEventListener('input', function() {
    sucursalIdInput.value = '';
    hasMoreSucursal = true;
    currentPageSucursal = 1;
    currentTermSucursal = sucursalInput.value.trim();
    if (!currentTermSucursal) {
      sucursalResults.innerHTML = '';
      sucursalResults.style.display = 'none';
      return;
    }
    debouncedFetchSucursales();
  });

  sucursalInput.addEventListener('focus', function() {
    currentTermSucursal = sucursalInput.value.trim();
    hasMoreSucursal = true;
    currentPageSucursal = 1;
    debouncedFetchSucursales();
  });

  sucursalResults.addEventListener('scroll', function() {
    if (sucursalResults.scrollTop + sucursalResults.clientHeight >= sucursalResults.scrollHeight - 5) {
      if (hasMoreSucursal && !isLoadingSucursal) {
        currentPageSucursal += 1;
        fetchSucursales(currentTermSucursal, currentPageSucursal);
      }
    }
  });

  sucursalResults.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('autocomplete-option')) {
      sucursalInput.value   = e.target.textContent;
      sucursalIdInput.value = e.target.dataset.id;
      sucursalResults.innerHTML = '';
      sucursalResults.style.display = 'none';
      hasMoreSucursal = false;
    }
  });

  document.addEventListener('click', function(e) {
    if (!sucursalInput.contains(e.target) && !sucursalResults.contains(e.target)) {
      sucursalResults.innerHTML = '';
      sucursalResults.style.display = 'none';
      hasMoreSucursal = false;
    }
  });

  /* ================================================
     7. Agregar Punto de Pago a la Tabla Temporal
  ================================================ */
  btnAgregarPP.addEventListener('click', function() {
    clearErrors();

    const sucursalId = sucursalIdInput.value.trim();
    const nombreVal  = nombreInput.value.trim();
    const descVal    = descripcionInput.value.trim();
    const dineroVal  = dinerocajaInput.value.trim() || '0.00';

    let hasLocalErrors = false;
    // Validaciones
    if (!sucursalId) {
      showFieldError('sucursal', 'Debe seleccionar una sucursal.');
      hasLocalErrors = true;
    }
    if (!nombreVal) {
      showFieldError('nombre', 'El nombre del Punto de Pago es obligatorio.');
      hasLocalErrors = true;
    }

    if (hasLocalErrors) return;

    // Revisar si ya existe un punto con ese mismo nombre en la tabla
    const existe = puntosTemp.some(p => p.nombre.toLowerCase() === nombreVal.toLowerCase());
    if (existe) {
      showFieldError('nombre', `Ya existe un punto de pago con el nombre "${nombreVal}" en la lista.`);
      return;
    }

    // Agregar al array
    puntosTemp.push({
      nombre: nombreVal,
      descripcion: descVal,
      dinerocaja: dineroVal
    });

    // Insertar fila en DataTable
    dataTable.row.add([
      nombreVal,
      descVal,
      dineroVal,
      `<button type="button" class="btn-eliminar" data-nombre="${nombreVal}">
         <i class="fas fa-trash-alt"></i>
       </button>`
    ]).draw(false);

    // Limpiar campos
    nombreInput.value       = '';
    descripcionInput.value  = '';
    dinerocajaInput.value   = '';
  });

  /* ======================
     8. Eliminar de la Tabla
  ====================== */
  document.getElementById('puntos-pago-body').addEventListener('click', function(e) {
    if (e.target.closest('.btn-eliminar')) {
      const button = e.target.closest('.btn-eliminar');
      const nombreVal = button.getAttribute('data-nombre');
      const row = button.closest('tr');
      dataTable.row(row).remove().draw(false);
      puntosTemp = puntosTemp.filter(p => p.nombre.toLowerCase() !== nombreVal.toLowerCase());
    }
  });

  /* =========================
     9. Submit del Formulario
  ========================= */
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    clearErrors();

    // Validar que haya al menos un punto de pago
    if (puntosTemp.length === 0) {
      showGlobalError('Debe agregar al menos un Punto de Pago antes de guardar.');
      return;
    }

    // Crear input hidden con JSON
    const puntosTempInput = document.getElementById('id_puntos_temp');
    puntosTempInput.value = JSON.stringify(puntosTemp);

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
        showSuccess('Puntos de pago agregados exitosamente.');
        // Resetear
        form.reset();
        dataTable.clear().draw();
        puntosTemp = [];
        sucursalResults.innerHTML = '';
        sucursalResults.style.display = 'none';
      } else {
        const errors = JSON.parse(data.errors);
        for (let field in errors) {
          const fieldErrors = errors[field];
          fieldErrors.forEach(error => {
            showFieldError(field, error.message);
          });
        }
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showGlobalError('Ocurrió un error inesperado al guardar.');
    });
  });

  /* ================================
     10. Función para Obtener la Cookie
  ================================= */
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
