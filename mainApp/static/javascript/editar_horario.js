// static/javascript/editar_horario.js

document.addEventListener('DOMContentLoaded', () => {
    // ============================
    // 1. Referencias al DOM
    // ============================
    const form = document.getElementById('form-editar-horarios');
    const tablaHorarios = document.getElementById('tabla-horarios');
    const successMessageDiv = document.getElementById('success-message');
    const errorMessageDiv = document.getElementById('error-message');

    // Campos de sucursal (autocomplete)
    const sucursalInput = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput = document.getElementById('id_sucursalid');
    const sucursalResults = document.getElementById('sucursal-autocomplete-results');

    // Botones de días y campos de hora
    const dayButtons = document.querySelectorAll('.day-button');
    const horaAperturaInput = document.getElementById('horaapertura');
    const horaCierreInput = document.getElementById('horacierre');

    // Botón para agregar horario a la tabla
    const btnAgregarHorario = document.getElementById('btn-agregar-horario');

    // Token CSRF (solo si tu vista lo requiere)
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]') 
                    ? document.querySelector('[name=csrfmiddlewaretoken]').value 
                    : '';


    // ============================
    // 2. Manejo de Errores
    // ============================
    function clearErrors() {
      const errorFields = document.querySelectorAll('.field-error');
      errorFields.forEach(field => {
        field.innerHTML = '';
        field.style.display = 'none';
      });
      errorMessageDiv.style.display = 'none';
    }

    function showFieldError(field, message) {
      const errorDiv = document.getElementById(`error-id_${field}`);
      if (errorDiv) {
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorDiv.style.display = 'block';
      }
    }

    function showGlobalError(message) {
      errorMessageDiv.textContent = message;
      errorMessageDiv.style.display = 'block';
    }

    function showSuccess(message) {
      successMessageDiv.textContent = message;
      successMessageDiv.style.display = 'block';
    }


    // ============================
    // 3. Autocomplete Sucursal (Opcional)
    // ============================
    let currentPageSucursal = 1, currentTermSucursal = '';
    let isLoadingSucursal = false, hasMoreSucursal = true;
    let debounceTimeoutSucursal = null;
    const DEBOUNCE_TIME = 300;

    function fetchSucursales(term, page = 1) {
      if (isLoadingSucursal || !hasMoreSucursal) return;
      isLoadingSucursal = true;
      const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
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
              opt.dataset.id = item.id;
              sucursalResults.appendChild(opt);
            });
            hasMoreSucursal = data.has_more;
          } else if (page === 1) {
            const noRes = document.createElement('div');
            noRes.classList.add('autocomplete-no-result');
            noRes.textContent = 'No se encontraron resultados';
            sucursalResults.appendChild(noRes);
            hasMoreSucursal = false;
          }
          sucursalResults.style.display = 'block';
        })
        .catch(err => console.error('Error fetchSucursales:', err))
        .finally(() => { 
          isLoadingSucursal = false; 
        });
    }

    function debounceFetchSucursales() {
      if (debounceTimeoutSucursal) clearTimeout(debounceTimeoutSucursal);
      debounceTimeoutSucursal = setTimeout(() => {
        fetchSucursales(currentTermSucursal, currentPageSucursal);
      }, DEBOUNCE_TIME);
    }

    // Eventos de Autocomplete
    if (sucursalInput) {
      sucursalInput.addEventListener('input', () => {
        currentTermSucursal = sucursalInput.value.trim();
        sucursalIdInput.value = '';
        hasMoreSucursal = true;
        currentPageSucursal = 1;
        debounceFetchSucursales();
      });

      sucursalInput.addEventListener('focus', () => {
        currentTermSucursal = sucursalInput.value.trim();
        hasMoreSucursal = true;
        currentPageSucursal = 1;
        fetchSucursales(currentTermSucursal, currentPageSucursal);
      });

      sucursalResults.addEventListener('scroll', () => {
        if (sucursalResults.scrollTop + sucursalResults.clientHeight >= 
            sucursalResults.scrollHeight - 5) {
          if (!isLoadingSucursal && hasMoreSucursal) {
            currentPageSucursal++;
            fetchSucursales(currentTermSucursal, currentPageSucursal);
          }
        }
      });

      sucursalResults.addEventListener('click', e => {
        if (e.target.classList.contains('autocomplete-option')) {
          const text = e.target.textContent;
          const id = e.target.dataset.id;
          sucursalInput.value = text;
          sucursalIdInput.value = id;
          sucursalResults.innerHTML = '';
          sucursalResults.style.display = 'none';
          hasMoreSucursal = false;
        }
      });

      document.addEventListener('click', e => {
        if (!sucursalInput.contains(e.target) && !sucursalResults.contains(e.target)) {
          sucursalResults.innerHTML = '';
          sucursalResults.style.display = 'none';
          hasMoreSucursal = false;
        }
      });
    }

    // ==============================
    // 4. Manejo de Días (botones)
    // ==============================
    dayButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggle visual
        btn.classList.toggle('active');
      });
    });

    // Al cargar la página, deshabilitamos botones para días ya en la tabla
    const existingRows = tablaHorarios.querySelectorAll('tr[data-dia]');
    existingRows.forEach(row => {
      const day = row.getAttribute('data-dia');
      const dayBtn = document.querySelector(`.day-button[data-day="${day}"]`);
      if (dayBtn) {
        dayBtn.disabled = true;
        dayBtn.classList.remove('active');
      }
    });


    // ==============================
    // 5. Agregar Horario a la Tabla
    // ==============================
    btnAgregarHorario.addEventListener('click', () => {
      clearErrors();

      // 1) Verificar si la sucursal está vacía
      if (!sucursalIdInput.value.trim()) {
        showFieldError('sucursalid', 'Debe seleccionar una sucursal.');
      }

      // 2) Recolectar días activos
      const selectedDays = [...document.querySelectorAll('.day-button.active')]
        .map(b => b.dataset.day);

      const horaApertura = horaAperturaInput.value;
      const horaCierre = horaCierreInput.value;

      // Validaciones mínimas
      if (!selectedDays.length) {
        showFieldError('dia_semana', 'Debe seleccionar al menos un día.');
      }
      if (!horaApertura) {
        showFieldError('horaapertura', 'Debe ingresar una hora de apertura.');
      }
      if (!horaCierre) {
        showFieldError('horacierre', 'Debe ingresar una hora de cierre.');
      }
      if (!selectedDays.length || !horaApertura || !horaCierre) {
        return;
      }
      if (horaApertura >= horaCierre) {
        showFieldError('horacierre', 'La hora de cierre debe ser mayor que la de apertura.');
        return;
      }

      // Agregar fila por cada día seleccionado
      selectedDays.forEach(dia => {
        // Desactiva botón para que no se repita el mismo día
        const btn = document.querySelector(`.day-button[data-day="${dia}"]`);
        btn.disabled = true;
        btn.classList.remove('active');

        // Crea la fila
        const row = document.createElement('tr');
        row.dataset.dia = dia;
        row.innerHTML = `
          <td>${dia}</td>
          <td><input type="time" value="${horaApertura}"></td>
          <td><input type="time" value="${horaCierre}"></td>
          <td>
            <!-- Ajusta la clase si tu CSS usa .btn-eliminar o .btn-eliminar-horario -->
            <button type="button" class="btn-eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tablaHorarios.appendChild(row);
      });

      // Limpia campos
      horaAperturaInput.value = '';
      horaCierreInput.value = '';
    });


    // ==============================
    // 6. Eliminar fila de la tabla
    // ==============================
    tablaHorarios.addEventListener('click', e => {
      if (e.target.closest('.btn-eliminar')) {
        const row = e.target.closest('tr');
        const dia = row.dataset.dia;

        // Eliminar visualmente
        row.remove();

        // Reactivar el botón de ese día
        const dayBtn = document.querySelector(`.day-button[data-day="${dia}"]`);
        if (dayBtn) {
          dayBtn.disabled = false;
        }
      }
    });


    // ===============================
    // 7. Enviar el formulario (Submit)
    // ===============================
    form.addEventListener('submit', e => {
      e.preventDefault();
      clearErrors();

      // Validar si hay sucursal (si la permites cambiar)
      const sucursalId = sucursalIdInput ? sucursalIdInput.value.trim() : '';
      if (!sucursalId) {
        showFieldError('sucursalid', 'Debe seleccionar una sucursal.');
        return;
      }

      // Recolectar horarios de la tabla
      const rows = tablaHorarios.querySelectorAll('tr[data-dia]');
      if (!rows.length) {
        showFieldError('dia_semana', 'No hay horarios en la tabla.');
        return;
      }

      const horarios = [...rows].map(row => {
        const dia = row.dataset.dia;
        const horaApertura = row.cells[1].querySelector('input').value;
        const horaCierre = row.cells[2].querySelector('input').value;
        return {
          dia: dia,
          horaapertura: horaApertura,
          horacierre: horaCierre
        };
      });

      // Enviar al servidor via fetch (AJAX)
      fetch(form.action, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,  // solo si tu vista lo requiere
        },
        body: JSON.stringify({
          sucursalid: sucursalId,
          horarios: horarios
        })
      })
      .then(resp => resp.json())
      .then(data => {
        if (data.success) {
          showSuccess('Horarios actualizados con éxito.');
          // Redirigir o recargar según tu preferencia
          setTimeout(() => {
            window.location.href = "/visualizar_horarios/";
          }, 800);
        } else {
          // Manejo de errores
          if (data.errors) {
            // Errores de form
            const errs = JSON.parse(data.errors);
            for (let field in errs) {
              const fieldErrors = errs[field];
              fieldErrors.forEach(e => {
                showFieldError(field, e.message);
              });
            }
          } else if (data.error) {
            // Error general
            showGlobalError(data.error);
          } else {
            showGlobalError('Error desconocido al actualizar.');
          }
        }
      })
      .catch(err => {
        console.error('Error al enviar:', err);
        showGlobalError('Ocurrió un error inesperado al guardar.');
      });
    });
});
