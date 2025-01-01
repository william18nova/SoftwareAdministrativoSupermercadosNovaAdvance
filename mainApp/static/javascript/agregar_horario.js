// agregar_horario.js

document.addEventListener('DOMContentLoaded', function() {
    // =====================
    // 1. Variables Generales
    // =====================
    const sucursalInput = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput = document.getElementById('id_sucursalid');
    const autocompleteResults = document.getElementById('sucursal-autocomplete-results');

    const diaSemanaInput = document.getElementById('id_dia_semana');
    const horaAperturaInput = document.getElementById('id_horaapertura');
    const horaCierreInput = document.getElementById('id_horacierre');
    const horariosTempBody = document.getElementById('horarios-temp-body');

    const successBox = document.getElementById('success-message');
    const form = document.getElementById('horario-form');
    const buttons = document.querySelectorAll('.day-button');

    let horariosTemp = [];
    let debounceTimeout = null;

    // Variables para la paginación del autocompletado
    let currentPage = 1;
    let isLoading = false;
    let hasMore = true;
    let currentTerm = '';

    // =============================
    // 2. Funciones de Autocompletado
    // =============================
    function fetchSucursales(term, page = 1) {
        if (isLoading || !hasMore) return;
        isLoading = true;
      
        // Enviar `term` y `page` como parámetros GET.
        const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            if (page === 1) {
              // Limpiar resultados anteriores
              autocompleteResults.innerHTML = '';
            }
            if (data.results.length > 0) {
              data.results.forEach(item => {
                const option = document.createElement('div');
                option.classList.add('autocomplete-option');
                option.textContent = item.text;
                option.dataset.id = item.id;
                autocompleteResults.appendChild(option);
              });
              hasMore = data.has_more;
            } else if (page === 1) {
              // No hay resultados
              const noResult = document.createElement('div');
              noResult.classList.add('autocomplete-no-result');
              noResult.textContent = 'No se encontraron resultados';
              autocompleteResults.appendChild(noResult);
              hasMore = false;
            }
            autocompleteResults.style.display = 'block';
            isLoading = false;
          })
          .catch(error => {
            console.error('Error en la solicitud de autocompletar:', error);
            isLoading = false;
        });
    }

    // =========================
    // 3. Manejo de Errores en JS
    // =========================
    function clearErrors() {
        // Limpia todos los errores mostrados debajo de cada campo
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.style.display = 'none';
        });
    }

    function showFieldError(field, message) {
        // Muestra el error debajo del campo con ID: "error-id_<field>"
        const errorDiv = document.getElementById(`error-id_${field}`);
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
            errorDiv.style.display = 'block';
        }
    }

    function showErrors(errors) {
        // Limpia primero los errores anteriores
        clearErrors();

        // 'errors' es un objeto con claves = nombre_del_campo
        // y valores = array de mensajes [{"message":"..."}]
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

    // ===============================
    // 4. Eventos de Autocompletado
    // ===============================
    sucursalInput.addEventListener('input', function() {
        currentTerm = sucursalInput.value.trim();
        sucursalIdInput.value = ''; // Limpiar el campo oculto
        hasMore = true;
        currentPage = 1;

        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(function() {
            fetchSucursales(currentTerm, currentPage);
        }, 300);
    });

    sucursalInput.addEventListener('focus', function() {
        currentTerm = sucursalInput.value.trim();
        hasMore = true;
        currentPage = 1;
        fetchSucursales(currentTerm, currentPage);
    });

    autocompleteResults.addEventListener('scroll', function() {
        if (autocompleteResults.scrollTop + autocompleteResults.clientHeight >= autocompleteResults.scrollHeight - 5) {
            if (hasMore && !isLoading) {
                currentPage += 1;
                fetchSucursales(currentTerm, currentPage);
            }
        }
    });

    autocompleteResults.addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('autocomplete-option')) {
            const selectedText = event.target.textContent;
            const selectedId = event.target.dataset.id;
            sucursalInput.value = selectedText;
            sucursalIdInput.value = selectedId;
            autocompleteResults.innerHTML = '';
            autocompleteResults.style.display = 'none';
            hasMore = false;
        }
    });

    document.addEventListener('click', function(event) {
        if (!sucursalInput.contains(event.target) && !autocompleteResults.contains(event.target)) {
            autocompleteResults.innerHTML = '';
            autocompleteResults.style.display = 'none';
            hasMore = false;
        }
    });

    // ==========================
    // 5. Manejo de Días (Botones)
    // ==========================
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            const day = this.getAttribute('data-day');
            let diasSeleccionados = diaSemanaInput.value.split(',').filter(d => d);

            if (diasSeleccionados.includes(day)) {
                diasSeleccionados = diasSeleccionados.filter(d => d !== day);
                this.classList.remove('active');
            } else {
                diasSeleccionados.push(day);
                this.classList.add('active');
            }
            diaSemanaInput.value = diasSeleccionados.join(',');
        });
    });

    // ========================================
    // 6. Agregar Horarios a la Tabla Temporal
    // ========================================
    const btnAgregarTemporal = document.querySelector('.btn-agregar-temporal');
    btnAgregarTemporal.addEventListener('click', function() {
        // Limpia cualquier error previo
        clearErrors();

        // Tomar los valores
        const diaSemana = diaSemanaInput.value;
        const horaApertura = horaAperturaInput.value;
        const horaCierre = horaCierreInput.value;

        // Validaciones individualizadas
        let hasLocalErrors = false;

        if (!sucursalIdInput.value) {
            showFieldError('sucursalid', 'Por favor, seleccione una sucursal.');
            hasLocalErrors = true;
        }
        if (!diaSemana) {
            showFieldError('dia_semana', 'Debe seleccionar al menos un día de la semana.');
            hasLocalErrors = true;
        }
        if (!horaApertura) {
            showFieldError('horaapertura', 'Debe seleccionar la hora de apertura.');
            hasLocalErrors = true;
        }
        if (!horaCierre) {
            showFieldError('horacierre', 'Debe seleccionar la hora de cierre.');
            hasLocalErrors = true;
        }

        if (horaApertura && horaCierre && horaApertura >= horaCierre) {
            showFieldError('horacierre', 'La hora de cierre debe ser mayor que la hora de apertura.');
            hasLocalErrors = true;
        }

        // Si hay errores, no agregamos horario
        if (hasLocalErrors) {
            return;
        }

        // Agregar el/los días seleccionados a la tabla
        diaSemana.split(',').forEach(day => {
            // Verificar si el día y la combinación de horas ya existe
            const existe = horariosTemp.some(
                horario =>
                    horario.dia === day &&
                    horario.horaapertura === horaApertura &&
                    horario.horacierre === horaCierre
            );

            if (!existe) {
                horariosTemp.push({
                    dia: day,
                    horaapertura: horaApertura,
                    horacierre: horaCierre
                });

                // Crear la fila en la tabla
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${day}</td>
                    <td><input type="time" name="horaapertura" value="${horaApertura}" readonly></td>
                    <td><input type="time" name="horacierre" value="${horaCierre}" readonly></td>
                    <td><button type="button" class="btn-eliminar"><i class="fas fa-trash"></i></button></td>
                `;
                horariosTempBody.appendChild(row);

                // Deshabilitar el botón del día para no agregarlo dos veces
                buttons.forEach(button => {
                    if (button.getAttribute('data-day') === day) {
                        button.disabled = true;
                        button.classList.remove('active');
                    }
                });
            }
        });

        // Limpiar los campos de entrada
        diaSemanaInput.value = '';
        horaAperturaInput.value = '';
        horaCierreInput.value = '';
    });

    // ===============================
    // 7. Eliminar Horarios de la Tabla
    // ===============================
    horariosTempBody.addEventListener('click', function(event) {
        if (event.target.closest('.btn-eliminar')) {
            const row = event.target.closest('tr');
            const day = row.cells[0].textContent;
            const horaApertura = row.cells[1].querySelector('input').value;
            const horaCierre = row.cells[2].querySelector('input').value;

            // Eliminarlo del array temporal
            horariosTemp = horariosTemp.filter(
                horario =>
                    !(horario.dia === day &&
                      horario.horaapertura === horaApertura &&
                      horario.horacierre === horaCierre)
            );
            row.remove();

            // Habilitar nuevamente el botón del día
            buttons.forEach(button => {
                if (button.getAttribute('data-day') === day) {
                    button.disabled = false;
                }
            });
        }
    });

    // ===============================
    // 8. Evento de Envío del Formulario
    // ===============================
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        clearErrors();

        // Envio final: si no hay horarios listados, o no hay sucursal, mostramos errores
        let hasLocalErrors = false;

        if (!sucursalIdInput.value) {
            showFieldError('sucursalid', 'Por favor, seleccione una sucursal.');
            hasLocalErrors = true;
        }

        if (horariosTemp.length === 0) {
            // Forzamos al usuario a usar "Listar Horario" si no hay nada en la tabla
            showFieldError('dia_semana', 'Debe agregar al menos un horario antes de guardar.');
            hasLocalErrors = true;
        }

        if (hasLocalErrors) {
            return;
        }

        // Convertir horariosTemp a JSON y ponerlo en el campo oculto
        const horariosInput = document.getElementById('id_horarios');
        horariosInput.value = JSON.stringify(horariosTemp);

        // Enviar al servidor
        const formData = new FormData(form);
        fetch(form.action, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Accept': 'application/json',
            },
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Éxito: mostrar mensaje, resetear formulario y tabla
                    successBox.style.display = 'block';
                    form.reset();
                    horariosTemp = [];
                    horariosTempBody.innerHTML = '';
                    buttons.forEach(button => {
                        button.disabled = false;
                        button.classList.remove('active');
                    });
                    sucursalIdInput.value = '';
                    autocompleteResults.innerHTML = '';
                    autocompleteResults.style.display = 'none';
                    hasMore = false;
                } else {
                    // Mostrar errores devueltos por el backend
                    const errors = JSON.parse(data.errors);
                    showErrors(errors);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showFieldError('dia_semana', 'Ocurrió un error inesperado al guardar.');
            });
    });

    // ================================
    // 9. Función para Obtener la Cookie
    // ================================
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
