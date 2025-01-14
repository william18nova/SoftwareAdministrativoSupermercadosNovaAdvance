// static/javascript/editar_horarios_cajas.js

document.addEventListener('DOMContentLoaded', () => {
    // ============================
    // 1. Referencias al DOM
    // ============================
    const form = document.getElementById('form-editar-horario');
    const tablaHorarios = document.getElementById('tabla-horarios');
    const successMessageDiv = document.getElementById('success-message');
    
    // Autocompletar: Sucursal
    const sucursalInput = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput = document.getElementById('id_sucursalid');
    const sucursalResults = document.getElementById('sucursal-autocomplete-results');
    
    // Autocompletar: Punto de Pago
    const puntopagoInput = document.getElementById('id_puntopago_autocomplete');
    const puntopagoIdInput = document.getElementById('id_puntopagoid');
    const puntopagoResults = document.getElementById('puntopago-autocomplete-results');
    
    // Botones de días y campos de horas
    const dayButtons = document.querySelectorAll('.day-button');
    const horaAperturaInput = document.getElementById('hora_apertura');
    const horaCierreInput = document.getElementById('hora_cierre');
    
    // Botón para agregar horario a la tabla
    const btnAgregarHorario = document.getElementById('btn-agregar-horario');
    
    // Token CSRF
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]') ?
      document.querySelector('[name=csrfmiddlewaretoken]').value : '';
    
    // ============================
    // 2. Funciones para Manejar Errores (mostrar debajo del input)
    // ============================
    function clearErrors() {
      const errorFields = document.querySelectorAll('.field-error');
      errorFields.forEach(field => {
        field.innerHTML = '';
        field.style.display = 'none';
      });
    }
    
    function showFieldError(field, message) {
      const errorDiv = document.getElementById(`error-id_${field}`);
      if (errorDiv) {
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorDiv.style.display = 'block';
      }
    }
    
    function showErrors(errors) {
      clearErrors();
      for (let field in errors) {
        const fieldErrors = errors[field];
        const errorDiv = document.getElementById(`error-id_${field}`);
        if (errorDiv) {
          errorDiv.innerHTML = fieldErrors
            .map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`)
            .join('<br>');
          errorDiv.style.display = 'block';
        }
      }
    }
    
    // ============================
    // 3. Funciones de Autocompletado (Sucursal y Punto de Pago)
    // ============================
    let currentPageSucursal = 1, currentTermSucursal = '';
    let isLoadingSucursal = false, hasMoreSucursal = true;
    let currentPagePuntopago = 1, currentTermPuntopago = '';
    let isLoadingPuntopago = false, hasMorePuntopago = true;
    
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
          if (page === 1) sucursalResults.innerHTML = '';
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
        .finally(() => { isLoadingSucursal = false; });
    }
    
    function fetchPuntosPago(term, page = 1) {
      if (isLoadingPuntopago || !hasMorePuntopago) return;
      isLoadingPuntopago = true;
      const sucursalId = sucursalIdInput.value.trim();
      if (!sucursalId) { isLoadingPuntopago = false; return; }
      const url = `${puntopagoAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}&sucursal_id=${sucursalId}`;
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (page === 1) puntopagoResults.innerHTML = '';
          if (data.results.length > 0) {
            data.results.forEach(item => {
              const opt = document.createElement('div');
              opt.classList.add('autocomplete-option');
              opt.textContent = item.text;
              opt.dataset.id = item.id;
              puntopagoResults.appendChild(opt);
            });
            hasMorePuntopago = data.has_more;
          } else if (page === 1) {
            const noRes = document.createElement('div');
            noRes.classList.add('autocomplete-no-result');
            noRes.textContent = 'No se encontraron resultados';
            puntopagoResults.appendChild(noRes);
            hasMorePuntopago = false;
          }
          puntopagoResults.style.display = 'block';
        })
        .catch(err => console.error('Error fetchPuntosPago:', err))
        .finally(() => { isLoadingPuntopago = false; });
    }
    
    let debounceTimeoutSucursal = null;
    let debounceTimeoutPuntopago = null;
    const DEBOUNCE_TIME = 300;
    
    function debounceFetchSucursales() {
      if (debounceTimeoutSucursal) clearTimeout(debounceTimeoutSucursal);
      debounceTimeoutSucursal = setTimeout(() => {
        fetchSucursales(currentTermSucursal, currentPageSucursal);
      }, DEBOUNCE_TIME);
    }
    
    function debounceFetchPuntopago() {
      if (debounceTimeoutPuntopago) clearTimeout(debounceTimeoutPuntopago);
      debounceTimeoutPuntopago = setTimeout(() => {
        fetchPuntosPago(currentTermPuntopago, currentPagePuntopago);
      }, DEBOUNCE_TIME);
    }
    
    // ===============================
    // 4. Eventos para Autocompletado
    // ===============================
    // Sucursal
    sucursalInput.addEventListener('input', () => {
      currentTermSucursal = sucursalInput.value.trim();
      // Si se borra el texto, mostramos un error
      if (currentTermSucursal === "") {
        showFieldError('sucursalid', 'Debes ingresar el nombre de una sucursal.');
      }
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
    
        // Reinicia autocompletado para Punto de Pago
        puntopagoInput.value = '';
        puntopagoIdInput.value = '';
        puntopagoResults.innerHTML = '';
        puntopagoResults.style.display = 'none';
        hasMorePuntopago = true;
        currentPagePuntopago = 1;
      }
    });
    document.addEventListener('click', e => {
      if (!sucursalInput.contains(e.target) && !sucursalResults.contains(e.target)) {
        sucursalResults.innerHTML = '';
        sucursalResults.style.display = 'none';
        hasMoreSucursal = false;
      }
    });
    
    // Punto de Pago
    puntopagoInput.addEventListener('input', () => {
      currentTermPuntopago = puntopagoInput.value.trim();
      if (currentTermPuntopago === "") {
        showFieldError('puntopagoid', 'Debes ingresar el nombre de un punto de pago.');
      }
      puntopagoIdInput.value = '';
      hasMorePuntopago = true;
      currentPagePuntopago = 1;
      debounceFetchPuntopago();
    });
    puntopagoInput.addEventListener('focus', () => {
      currentTermPuntopago = puntopagoInput.value.trim();
      hasMorePuntopago = true;
      currentPagePuntopago = 1;
      fetchPuntosPago(currentTermPuntopago, currentPagePuntopago);
    });
    puntopagoResults.addEventListener('scroll', () => {
      if (puntopagoResults.scrollTop + puntopagoResults.clientHeight >=
          puntopagoResults.scrollHeight - 5) {
        if (!isLoadingPuntopago && hasMorePuntopago) {
          currentPagePuntopago++;
          fetchPuntosPago(currentTermPuntopago, currentPagePuntopago);
        }
      }
    });
    puntopagoResults.addEventListener('click', e => {
      if (e.target.classList.contains('autocomplete-option')) {
        const text = e.target.textContent;
        const id = e.target.dataset.id;
        puntopagoInput.value = text;
        puntopagoIdInput.value = id;
        puntopagoResults.innerHTML = '';
        puntopagoResults.style.display = 'none';
        hasMorePuntopago = false;
      }
    });
    document.addEventListener('click', e => {
      if (!puntopagoInput.contains(e.target) && !puntopagoResults.contains(e.target)) {
        puntopagoResults.innerHTML = '';
        puntopagoResults.style.display = 'none';
        hasMorePuntopago = false;
      }
    });
    
    // ==============================
    // 5. Manejo de Días (botones)
    // ==============================
    dayButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
      });
    });
    
    // Al cargar la página, deshabilitar botones para los días ya listados
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
    // 6. Botón "Agregar Horario"
    // ==============================
    btnAgregarHorario.addEventListener('click', () => {
      clearErrors();
      // Recolectar días activos
      const selectedDays = [...document.querySelectorAll('.day-button.active')]
        .map(b => b.getAttribute('data-day'));
      const horaApertura = horaAperturaInput.value;
      const horaCierre = horaCierreInput.value;
      
      if (!selectedDays.length || !horaApertura || !horaCierre) {
        if (!selectedDays.length) {
          showFieldError('dia_semana', 'Debe seleccionar al menos un día.');
        }
        if (!horaApertura) {
          showFieldError('horaapertura', 'Debe seleccionar la hora de apertura.');
        }
        if (!horaCierre) {
          showFieldError('horacierre', 'Debe seleccionar la hora de cierre.');
        }
        return;
      }
      if (horaApertura >= horaCierre) {
        showFieldError('horacierre', 'La hora de cierre debe ser mayor que la hora de apertura.');
        return;
      }
      
      // Agregar una fila por cada día seleccionado
      selectedDays.forEach(dia => {
        const dayBtn = document.querySelector(`.day-button[data-day="${dia}"]`);
        if (dayBtn) {
          dayBtn.disabled = true;
          dayBtn.classList.remove('active');
        }
        const row = document.createElement('tr');
        row.dataset.dia = dia;
        row.innerHTML = `
          <td>${dia}</td>
          <td><input type="time" value="${horaApertura}"></td>
          <td><input type="time" value="${horaCierre}"></td>
          <td>
            <button type="button" class="btn-eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tablaHorarios.appendChild(row);
      });
      
      // Limpiar campos de horas
      horaAperturaInput.value = '';
      horaCierreInput.value = '';
    });
    
    // ===============================
    // 7. Eliminar fila de la tabla
    // ===============================
    tablaHorarios.addEventListener('click', e => {
      const btnEliminar = e.target.closest('.btn-eliminar');
      if (btnEliminar) {
        e.preventDefault();
        const row = btnEliminar.closest('tr');
        const dia = row.dataset.dia;
        row.remove();
        // Reactivar el botón del día eliminado
        const dayBtn = document.querySelector(`.day-button[data-day="${dia}"]`);
        if (dayBtn) {
          dayBtn.disabled = false;
          dayBtn.classList.remove('inactive');
        }
      }
    });
    
    // ===============================
    // 8. Enviar el formulario (Submit)
    // ===============================
    form.addEventListener('submit', e => {
      e.preventDefault();
      clearErrors();
      const sucursalId = sucursalIdInput.value.trim();
      const puntoPagoId = puntopagoIdInput.value.trim();
      if (!sucursalId) {
        showFieldError('sucursalid', 'Debes elegir una sucursal.');
        return;
      }
      if (!puntoPagoId) {
        showFieldError('puntopagoid', 'Debes elegir un punto de pago.');
        return;
      }
      
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
          dia,
          hora_apertura: horaApertura,
          hora_cierre: horaCierre,
        };
      });
      
      fetch(form.action, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          sucursalid: sucursalId,
          puntopagoid: puntoPagoId,
          horarios: horarios,
        }),
      })
        .then(resp => resp.json())
        .then(data => {
          if (data.success) {
            successMessageDiv.textContent = 'Horarios actualizados con éxito.';
            successMessageDiv.style.display = 'block';
            setTimeout(() => {
              window.location.href = "/visualizar_horarios_cajas/";
            }, 800);
          } else {
            if (data.errors) {
              showErrors(JSON.parse(data.errors));
            } else if (data.error) {
              showFieldError('puntopagoid', data.error);
            } else {
              showFieldError('puntopagoid', 'Error desconocido en la actualización.');
            }
          }
        })
        .catch(err => {
          console.error('Error al guardar:', err);
          showFieldError('puntopagoid', 'Ocurrió un error inesperado al guardar.');
        });
    });
    
    // ===============================
    // 9. Funciones auxiliares
    // ===============================
    function clearErrors() {
      const errorFields = document.querySelectorAll('.field-error');
      errorFields.forEach(field => {
        field.innerHTML = '';
        field.style.display = 'none';
      });
    }
    
    function showError(msg) {
      console.error(msg);
    }
    
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
