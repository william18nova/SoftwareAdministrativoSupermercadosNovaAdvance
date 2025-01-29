// static/javascript/editar_punto_pago.js

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
  
    // Inputs del formulario
    const nombreInput      = document.getElementById('id_nombre');
    const descripcionInput = document.getElementById('id_descripcion');
    const dinerocajaInput  = document.getElementById('id_dinerocaja');
  
    // Autocomplete de sucursal
    const sucursalInput    = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput  = document.getElementById('id_sucursal');
    const sucursalResults  = document.getElementById('sucursal-autocomplete-results');
    
    // var sucursalAutocompleteUrl = "...";
  
    // Array temporal donde se almacenarán los puntos
    let puntosTemp = [];
  
    /* ==========================
       3. Funciones de ayuda
    ========================== */
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
  
    // Obtener la cookie CSRF
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
  
    /* ================================
       4. Cargar puntos existentes
    ================================ */
    function loadExistingPoints() {
      existingPuntos.forEach(function(punto) {
        const idVal = punto.puntopagoid;
        const nombreVal = punto.nombre;
        const descVal = punto.descripcion || '';
        const dinerocajaVal = punto.dinerocaja != null ? punto.dinerocaja : '0.00';
  
        puntosTemp.push({
          id: idVal,
          nombre: nombreVal,
          descripcion: descVal,
          dinerocaja: dinerocajaVal
        });
  
        dataTable.row.add([
          // Col 1: Nombre (solo texto)
          nombreVal,
          // Col 2: Input para descripción
          `<input type="text" class="edit-descripcion" data-nombre="${nombreVal}" value="${descVal}" />`,
          // Col 3: Input para dinero en caja
          `<input type="number" min="0" step="0.01" class="edit-dinerocaja" data-nombre="${nombreVal}" value="${dinerocajaVal}" />`,
          // Col 4: Botón eliminar
          `<button type="button" class="btn-eliminar" data-id="${idVal}" data-nombre="${nombreVal}">
             <i class="fas fa-trash-alt"></i>
           </button>`
        ]).draw(false);
      });
    }
    loadExistingPoints();
  
    /* =========================
       5. Autocomplete Sucursal
       (para cambiar la sucursal)
    ========================= */
    let isLoadingSucursal  = false;
    let hasMoreSucursal    = true;
    let currentPageSucursal= 1;
    let currentTermSucursal= '';
  
    function fetchSucursales(term, page = 1) {
      if (isLoadingSucursal || !hasMoreSucursal) return;
      isLoadingSucursal = true;
  
      const url = `${sucursalAutocompleteUrl}&term=${encodeURIComponent(term)}&page=${page}`;
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
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
        })
        .catch(error => {
          console.error('fetchSucursales error:', error);
          isLoadingSucursal = false;
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
    const debouncedFetchSucursales = debounce(function() {
      fetchSucursales(currentTermSucursal, currentPageSucursal);
    }, DEBOUNCE_TIME);
  
    sucursalInput.addEventListener('input', function() {
      sucursalIdInput.value = '';
      hasMoreSucursal = true;
      currentPageSucursal = 1;
      currentTermSucursal = sucursalInput.value.trim();
  
      // Llamamos siempre, aunque esté vacío
      debouncedFetchSucursales();
    });
  
    sucursalInput.addEventListener('focus', function() {
      hasMoreSucursal = true;
      currentPageSucursal = 1;
      currentTermSucursal = sucursalInput.value.trim();
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
  
    /* =========================
       6. Agregar/actualizar punto
    ========================= */
    const btnAgregarPP = document.getElementById('agregarPuntoPagoBtn');
    btnAgregarPP.addEventListener('click', function() {
      clearErrors();
      const nombreVal = nombreInput.value.trim();
      const descVal   = descripcionInput.value.trim();
      const dineroVal = dinerocajaInput.value.trim() || '0.00';
  
      if (!nombreVal) {
        showFieldError('nombre', 'El nombre del Punto de Pago es obligatorio.');
        return;
      }
  
      let existingIndex = -1;
      for (let i = 0; i < puntosTemp.length; i++) {
        if (puntosTemp[i].nombre.toLowerCase() === nombreVal.toLowerCase()) {
          existingIndex = i;
          break;
        }
      }
  
      if (existingIndex !== -1) {
        // Remover de dataTable
        const rows = dataTable.rows().indexes().filter((idx) => {
          const rowData = dataTable.row(idx).data();
          return rowData[0].toLowerCase() === nombreVal.toLowerCase();
        });
        dataTable.rows(rows).remove().draw(false);
  
        const oldId = puntosTemp[existingIndex].id;
        puntosTemp.splice(existingIndex, 1);
  
        puntosTemp.push({
          id: oldId || null,
          nombre: nombreVal,
          descripcion: descVal,
          dinerocaja: dineroVal
        });
      } else {
        puntosTemp.push({
          id: null,
          nombre: nombreVal,
          descripcion: descVal,
          dinerocaja: dineroVal
        });
      }
  
      dataTable.row.add([
        nombreVal,
        `<input type="text" class="edit-descripcion" data-nombre="${nombreVal}" value="${descVal}" />`,
        `<input type="number" min="0" step="0.01" class="edit-dinerocaja" data-nombre="${nombreVal}" value="${dineroVal}" />`,
        `<button type="button" class="btn-eliminar" data-id="" data-nombre="${nombreVal}">
           <i class="fas fa-trash-alt"></i>
         </button>`
      ]).draw(false);
  
      nombreInput.value = '';
      descripcionInput.value = '';
      dinerocajaInput.value = '';
    });
  
    /* ==========================
       7. Eliminar de la tabla
    ========================== */
    document.getElementById('puntos-pago-body').addEventListener('click', function(e) {
      if (e.target.closest('.btn-eliminar')) {
        const button = e.target.closest('.btn-eliminar');
        const nombreVal = button.getAttribute('data-nombre');
        const row = button.closest('tr');
        dataTable.row(row).remove().draw(false);
        // Remover del array
        puntosTemp = puntosTemp.filter(p => p.nombre.toLowerCase() !== nombreVal.toLowerCase());
      }
    });
  
    /* ================================================
       8. Editar descripción/dinero en la tabla
    ================================================ */
    document.getElementById('puntos-pago-body').addEventListener('input', function(e) {
      const target = e.target;
      if (target.classList.contains('edit-descripcion')) {
        const nombre = target.getAttribute('data-nombre');
        const newDesc = target.value;
        const index = puntosTemp.findIndex(x => x.nombre.toLowerCase() === nombre.toLowerCase());
        if (index !== -1) {
          puntosTemp[index].descripcion = newDesc;
        }
      }
      if (target.classList.contains('edit-dinerocaja')) {
        const nombre = target.getAttribute('data-nombre');
        const newDinero = target.value;
        const index = puntosTemp.findIndex(x => x.nombre.toLowerCase() === nombre.toLowerCase());
        if (index !== -1) {
          puntosTemp[index].dinerocaja = newDinero;
        }
      }
    });
  
    /* =========================
       9. Submit del Formulario
    ========================= */
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      clearErrors();
  
      // Validar que se haya elegido una sucursal
      if (!sucursalIdInput.value.trim()) {
        showFieldError('sucursal', 'Debe seleccionar una sucursal.');
        return;
      }
  
      if (puntosTemp.length === 0) {
        showGlobalError('Debe agregar al menos un Punto de Pago antes de guardar.');
        return;
      }
  
      // Creamos JSON con los puntos
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
          // Redirigir a la URL que viene en 'redirect_url'
          if (data.redirect_url) {
            window.location.href = data.redirect_url;
          } else {
            // Fallback: mostrar éxito local
            showSuccess('Puntos de pago actualizados exitosamente.');
          }
        } else {
          // Manejo de errores
          const errors = JSON.parse(data.errors);
          for (let field in errors) {
            const fieldErrors = errors[field];
            fieldErrors.forEach(error => {
              if (field === 'puntos_temp') {
                showGlobalError(error.message);
              } else {
                showFieldError(field, error.message);
              }
            });
          }
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showGlobalError('Ocurrió un error inesperado al guardar.');
      });
    });
  });  