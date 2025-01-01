// agregar_horario_caja.js

document.addEventListener('DOMContentLoaded', function() {
    // =====================
    // 1. Variables Generales
    // =====================
    const sucursalInput = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput = document.getElementById('id_sucursalid');
    const autocompleteSucursalResults = document.getElementById('sucursal-autocomplete-results');

    const puntopagoInput = document.getElementById('id_puntopago_autocomplete');
    const puntopagoIdInput = document.getElementById('id_puntopagoid');
    const autocompletePuntopagoResults = document.getElementById('puntopago-autocomplete-results');

    const diaSemanaInput = document.getElementById('id_dia_semana');
    const horaAperturaInput = document.getElementById('id_horaapertura');
    const horaCierreInput = document.getElementById('id_horacierre');

    const horariosTempBody = document.getElementById('horarios-temp-body');
    const successMessageDiv = document.getElementById('success-message');
    const errorMessageDiv = document.getElementById('error-message');
    const form = document.getElementById('form-agregar-horario');
    const buttons = document.querySelectorAll('.day-button');

    // Lista temporal de horarios
    let horariosTemp = [];

    // Variables para paginación/autocompletado
    let debounceTimeoutSucursal = null;
    let debounceTimeoutPuntopago = null;

    let currentPageSucursal = 1;
    let isLoadingSucursal = false;
    let hasMoreSucursal = true;
    let currentTermSucursal = '';

    let currentPagePuntopago = 1;
    let isLoadingPuntopago = false;
    let hasMorePuntopago = true;
    let currentTermPuntopago = '';

    // =========================
    // 2. Funciones de Autocompletado
    // =========================
    /**
     * Autocompletado de Sucursales
     */
    function fetchSucursales(term, page = 1) {
        if (isLoadingSucursal || !hasMoreSucursal) return;
        isLoadingSucursal = true;

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
                    autocompleteSucursalResults.innerHTML = '';
                }
                if (data.results.length > 0) {
                    data.results.forEach(item => {
                        const option = document.createElement('div');
                        option.classList.add('autocomplete-option');
                        option.textContent = item.text;
                        option.dataset.id = item.id;
                        autocompleteSucursalResults.appendChild(option);
                    });
                    hasMoreSucursal = data.has_more;
                } else if (page === 1) {
                    // Sin resultados en primera página
                    const noResult = document.createElement('div');
                    noResult.classList.add('autocomplete-no-result');
                    noResult.textContent = 'No se encontraron resultados';
                    autocompleteSucursalResults.appendChild(noResult);
                    hasMoreSucursal = false;
                }
                autocompleteSucursalResults.style.display = 'block';
                isLoadingSucursal = false;
            })
            .catch(error => {
                console.error('Error en autocompletar sucursales:', error);
                isLoadingSucursal = false;
            });
    }

    /**
     * Autocompletado de Puntos de Pago
     */
    function fetchPuntosPago(term, page = 1) {
        if (isLoadingPuntopago || !hasMorePuntopago) return;
        isLoadingPuntopago = true;

        // Necesitamos la sucursal elegida
        const sucursalId = sucursalIdInput.value;
        if (!sucursalId) {
            isLoadingPuntopago = false;
            return;
        }

        const url = `${puntopagoAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}&sucursal_id=${sucursalId}`;
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (page === 1) {
                    autocompletePuntopagoResults.innerHTML = '';
                }
                if (data.results.length > 0) {
                    data.results.forEach(item => {
                        const option = document.createElement('div');
                        option.classList.add('autocomplete-option');
                        option.textContent = item.text;
                        option.dataset.id = item.id;
                        autocompletePuntopagoResults.appendChild(option);
                    });
                    hasMorePuntopago = data.has_more;
                } else if (page === 1) {
                    const noResult = document.createElement('div');
                    noResult.classList.add('autocomplete-no-result');
                    noResult.textContent = 'No se encontraron resultados';
                    autocompletePuntopagoResults.appendChild(noResult);
                    hasMorePuntopago = false;
                }
                autocompletePuntopagoResults.style.display = 'block';
                isLoadingPuntopago = false;
            })
            .catch(error => {
                console.error('Error en autocompletar puntos de pago:', error);
                isLoadingPuntopago = false;
            });
    }

    // ========================
    // 3. Manejo de Mensajes
    // ========================
    function clearErrors() {
        // Limpia todos los errores de campos
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(field => {
            field.innerHTML = '';
            field.style.display = 'none';
        });

        // Limpia mensajería general
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.innerHTML = '';
        successMessageDiv.style.display = 'none';
        successMessageDiv.innerHTML = '';
    }

    function showFieldError(field, message) {
        // Muestra error debajo de un campo con id="error-id_<field>"
        const errorDiv = document.getElementById(`error-id_${field}`);
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
            errorDiv.style.display = 'block';
        }
    }

    function showErrors(errors) {
        // Limpia primero
        clearErrors();

        // 'errors' es un objeto con {field: [{message: "..."}], ...}
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
    // -- Sucursal --
    sucursalInput.addEventListener('input', function() {
        currentTermSucursal = sucursalInput.value.trim();
        sucursalIdInput.value = '';
        hasMoreSucursal = true;
        currentPageSucursal = 1;

        if (debounceTimeoutSucursal) {
            clearTimeout(debounceTimeoutSucursal);
        }
        debounceTimeoutSucursal = setTimeout(function() {
            fetchSucursales(currentTermSucursal, currentPageSucursal);
        }, 300);
    });

    sucursalInput.addEventListener('focus', function() {
        currentTermSucursal = sucursalInput.value.trim();
        hasMoreSucursal = true;
        currentPageSucursal = 1;
        fetchSucursales(currentTermSucursal, currentPageSucursal);
    });

    autocompleteSucursalResults.addEventListener('scroll', function() {
        if (autocompleteSucursalResults.scrollTop + autocompleteSucursalResults.clientHeight >= autocompleteSucursalResults.scrollHeight - 5) {
            if (hasMoreSucursal && !isLoadingSucursal) {
                currentPageSucursal += 1;
                fetchSucursales(currentTermSucursal, currentPageSucursal);
            }
        }
    });

    autocompleteSucursalResults.addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('autocomplete-option')) {
            const selectedText = event.target.textContent;
            const selectedId = event.target.dataset.id;
            sucursalInput.value = selectedText;
            sucursalIdInput.value = selectedId;
            autocompleteSucursalResults.innerHTML = '';
            autocompleteSucursalResults.style.display = 'none';
            hasMoreSucursal = false;

            // Al cambiar la sucursal, resetea Puntos de Pago
            puntopagoInput.value = '';
            puntopagoIdInput.value = '';
            autocompletePuntopagoResults.innerHTML = '';
            autocompletePuntopagoResults.style.display = 'none';
            hasMorePuntopago = true;
            currentPagePuntopago = 1;
        }
    });

    document.addEventListener('click', function(event) {
        if (!sucursalInput.contains(event.target) && !autocompleteSucursalResults.contains(event.target)) {
            autocompleteSucursalResults.innerHTML = '';
            autocompleteSucursalResults.style.display = 'none';
            hasMoreSucursal = false;
        }
    });

    // -- Punto de Pago --
    puntopagoInput.addEventListener('input', function() {
        currentTermPuntopago = puntopagoInput.value.trim();
        puntopagoIdInput.value = '';
        hasMorePuntopago = true;
        currentPagePuntopago = 1;

        if (debounceTimeoutPuntopago) {
            clearTimeout(debounceTimeoutPuntopago);
        }
        debounceTimeoutPuntopago = setTimeout(function() {
            fetchPuntosPago(currentTermPuntopago, currentPagePuntopago);
        }, 300);
    });

    puntopagoInput.addEventListener('focus', function() {
        currentTermPuntopago = puntopagoInput.value.trim();
        hasMorePuntopago = true;
        currentPagePuntopago = 1;
        fetchPuntosPago(currentTermPuntopago, currentPagePuntopago);
    });

    autocompletePuntopagoResults.addEventListener('scroll', function() {
        if (autocompletePuntopagoResults.scrollTop + autocompletePuntopagoResults.clientHeight >= autocompletePuntopagoResults.scrollHeight - 5) {
            if (hasMorePuntopago && !isLoadingPuntopago) {
                currentPagePuntopago += 1;
                fetchPuntosPago(currentTermPuntopago, currentPagePuntopago);
            }
        }
    });

    autocompletePuntopagoResults.addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('autocomplete-option')) {
            const selectedText = event.target.textContent;
            const selectedId = event.target.dataset.id;
            puntopagoInput.value = selectedText;
            puntopagoIdInput.value = selectedId;
            autocompletePuntopagoResults.innerHTML = '';
            autocompletePuntopagoResults.style.display = 'none';
            hasMorePuntopago = false;
        }
    });

    document.addEventListener('click', function(event) {
        if (!puntopagoInput.contains(event.target) && !autocompletePuntopagoResults.contains(event.target)) {
            autocompletePuntopagoResults.innerHTML = '';
            autocompletePuntopagoResults.style.display = 'none';
            hasMorePuntopago = false;
        }
    });

    // ======================
    // 5. Selección de Días
    // ======================
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            const day = this.getAttribute('data-day');
            let dias = diaSemanaInput.value.split(',').filter(d => d);

            if (dias.includes(day)) {
                dias = dias.filter(d => d !== day);
                this.classList.remove('active');
            } else {
                dias.push(day);
                this.classList.add('active');
            }
            diaSemanaInput.value = dias.join(',');
        });
    });

    // ========================================
    // 6. Agregar Horarios a la Lista Temporal
    // ========================================
    const btnAgregarTemporal = document.querySelector('.btn-agregar-temporal');
    btnAgregarTemporal.addEventListener('click', function() {
        clearErrors();

        // Capturar valores
        const sucursalid = sucursalIdInput.value;
        const puntopagoid = puntopagoIdInput.value;
        const diasSeleccionados = diaSemanaInput.value;
        const horaApertura = horaAperturaInput.value;
        const horaCierre = horaCierreInput.value;

        // Validaciones campo a campo
        let hasLocalErrors = false;

        if (!sucursalid) {
            showFieldError('sucursalid', 'Por favor, seleccione la sucursal.');
            hasLocalErrors = true;
        }
        if (!puntopagoid) {
            showFieldError('puntopagoid', 'Por favor, seleccione el punto de pago.');
            hasLocalErrors = true;
        }
        if (!diasSeleccionados) {
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

        if (hasLocalErrors) {
            return;
        }

        // Agregar al listado
        diasSeleccionados.split(',').forEach(day => {
            const existe = horariosTemp.some(
                horario => horario.dia === day && horario.horaapertura === horaApertura && horario.horacierre === horaCierre
            );
            if (!existe) {
                horariosTemp.push({ dia: day, horaapertura: horaApertura, horacierre: horaCierre });
                // Crear fila en la tabla
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${day}</td>
                    <td><input type="time" name="horaapertura" value="${horaApertura}" readonly></td>
                    <td><input type="time" name="horacierre" value="${horaCierre}" readonly></td>
                    <td><button type="button" class="btn-eliminar"><i class="fas fa-trash"></i></button></td>
                `;
                horariosTempBody.appendChild(row);

                // Deshabilitar el botón del día seleccionado
                buttons.forEach(btn => {
                    if (btn.getAttribute('data-day') === day) {
                        btn.disabled = true;
                        btn.classList.remove('active');
                    }
                });
            }
        });

        // Limpiar campos
        diaSemanaInput.value = '';
        horaAperturaInput.value = '';
        horaCierreInput.value = '';
    });

    // ================================
    // 7. Eliminar Horarios de la Lista
    // ================================
    horariosTempBody.addEventListener('click', function(event) {
        if (event.target.closest('.btn-eliminar')) {
            const row = event.target.closest('tr');
            const day = row.cells[0].textContent;
            const horaApertura = row.cells[1].querySelector('input').value;
            const horaCierre = row.cells[2].querySelector('input').value;

            // Remover del array temporal
            horariosTemp = horariosTemp.filter(
                h => !(h.dia === day && h.horaapertura === horaApertura && h.horacierre === horaCierre)
            );
            row.remove();

            // Habilitar nuevamente el botón del día
            buttons.forEach(btn => {
                if (btn.getAttribute('data-day') === day) {
                    btn.disabled = false;
                }
            });
        }
    });

    // ===============================
    // 8. Enviar el Formulario
    // ===============================
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        clearErrors();

        const sucursalid = sucursalIdInput.value;
        const puntopagoid = puntopagoIdInput.value;

        // Verificar si hay algo en la tabla
        if (!sucursalid) {
            showFieldError('sucursalid', 'Por favor, seleccione la sucursal.');
            return;
        }
        if (!puntopagoid) {
            showFieldError('puntopagoid', 'Por favor, seleccione el punto de pago.');
            return;
        }
        if (horariosTemp.length === 0) {
            showFieldError('dia_semana', 'Debe agregar al menos un horario antes de guardar.');
            return;
        }

        // Enviar la lista de horarios en un campo oculto
        const horariosInput = document.createElement('input');
        horariosInput.type = 'hidden';
        horariosInput.name = 'horarios';
        horariosInput.value = JSON.stringify(horariosTemp);
        form.appendChild(horariosInput);

        // Enviar la data
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
                // Éxito
                successMessageDiv.innerHTML = `<i class="fas fa-check-circle"></i> Horario de caja agregado exitosamente.`;
                successMessageDiv.style.display = 'block';
                form.reset();
                horariosTemp = [];
                horariosTempBody.innerHTML = '';

                // Re-habilitar botones de días
                buttons.forEach(btn => {
                    btn.disabled = false;
                    btn.classList.remove('active');
                });

                // Limpiar sucursal/puntopago
                sucursalIdInput.value = '';
                puntopagoIdInput.value = '';
                autocompleteSucursalResults.innerHTML = '';
                autocompleteSucursalResults.style.display = 'none';
                autocompletePuntopagoResults.innerHTML = '';
                autocompletePuntopagoResults.style.display = 'none';
                hasMoreSucursal = false;
                hasMorePuntopago = false;
            } else {
                // Errores devueltos por el backend
                const errors = JSON.parse(data.errors);
                showErrors(errors);
            }
        })
        .catch(error => {
            console.error('Error al guardar:', error);
            errorMessageDiv.textContent = 'Ocurrió un error inesperado.';
            errorMessageDiv.style.display = 'block';
        });
    });

    // ============================
    // 9. Obtener valor de la Cookie
    // ============================
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
