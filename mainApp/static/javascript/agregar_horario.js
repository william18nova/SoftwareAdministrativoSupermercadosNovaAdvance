// agregar_horario_caja.js

document.addEventListener('DOMContentLoaded', function() {
    // Variables generales
    const sucursalInput = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput = document.getElementById('id_sucursalid');
    const puntopagoInput = document.getElementById('id_puntopago_autocomplete');
    const puntopagoIdInput = document.getElementById('id_puntopagoid');
    const autocompleteSucursalResults = document.getElementById('sucursal-autocomplete-results');
    const autocompletePuntopagoResults = document.getElementById('puntopago-autocomplete-results');
    const diaSemanaInput = document.getElementById('id_dia_semana');
    const horariosTempBody = document.getElementById('horarios-temp-body');
    const alertBox = document.getElementById('error-message');
    const successBox = document.getElementById('success-message');
    const form = document.getElementById('horarioForm');
    const buttons = document.querySelectorAll('.day-button');
    let horariosTemp = [];
    let debounceTimeoutSucursal = null;
    let debounceTimeoutPuntopago = null;

    // Variables para la paginación de sucursales
    let currentPageSucursal = 1;
    let isLoadingSucursal = false;
    let hasMoreSucursal = true;
    let currentTermSucursal = '';

    // Variables para la paginación de puntos de pago
    let currentPagePuntopago = 1;
    let isLoadingPuntopago = false;
    let hasMorePuntopago = true;
    let currentTermPuntopago = '';

    /**
     * Función para mostrar sugerencias de sucursales.
     * @param {string} term - Término de búsqueda.
     * @param {number} page - Número de página para la paginación.
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
                // Si es la primera página, limpiar resultados anteriores
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
                // Si no hay resultados en la primera página
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
            console.error('Error en la solicitud de autocompletar sucursales:', error);
            isLoadingSucursal = false;
        });
    }

    /**
     * Función para mostrar sugerencias de puntos de pago.
     * @param {string} term - Término de búsqueda.
     * @param {number} page - Número de página para la paginación.
     */
    function fetchPuntosPago(term, page = 1) {
        if (isLoadingPuntopago || !hasMorePuntopago) return;
        isLoadingPuntopago = true;

        const sucursalId = sucursalIdInput.value;
        if (!sucursalId) {
            isLoadingPuntopago = false;
            // Mostrar un mensaje al usuario indicando que debe seleccionar una Sucursal primero
            alertBox.innerHTML = 'Por favor, seleccione una sucursal antes de buscar puntos de pago.';
            alertBox.style.display = 'block';
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
            console.log('Datos recibidos de puntopago_autocomplete:', data);  // Depuración
            if (page === 1) {
                // Si es la primera página, limpiar resultados anteriores
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
                // Si no hay resultados en la primera página
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
            console.error('Error en la solicitud de autocompletar puntos de pago:', error);
            isLoadingPuntopago = false;
        });
    }

    /**
     * Función para limpiar mensajes de error.
     */
    function clearErrors() {
        alertBox.style.display = 'none';
        alertBox.innerHTML = '';

        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.style.display = 'none';
        });
    }

    /**
     * Función para mostrar mensajes de error.
     * @param {object} errors - Objeto de errores devuelto por el servidor.
     */
    function showErrors(errors) {
        clearErrors();

        if (errors.__all__) {
            alertBox.innerHTML = errors.__all__.map(e => e.message).join('<br>');
            alertBox.style.display = 'block';
        }

        for (let field in errors) {
            if (field === '__all__') continue;
            const fieldErrors = errors[field];
            const errorDiv = document.getElementById('error-id_' + field);
            if (errorDiv) {
                errorDiv.innerHTML = fieldErrors.map(e => e.message).join('<br>');
                errorDiv.style.display = 'block';
            }
        }
    }

    /**
     * Evento 'input' en el campo de sucursal para filtrar resultados.
     */
    sucursalInput.addEventListener('input', function() {
        currentTermSucursal = sucursalInput.value.trim();
        sucursalIdInput.value = ''; // Limpiar el campo oculto
        hasMoreSucursal = true;
        currentPageSucursal = 1;

        if (debounceTimeoutSucursal) {
            clearTimeout(debounceTimeoutSucursal);
        }

        debounceTimeoutSucursal = setTimeout(function() {
            fetchSucursales(currentTermSucursal, currentPageSucursal);
        }, 300); // Retraso para debounce
    });

    /**
     * Evento 'focus' en el campo de sucursal para cargar todas las sucursales si está vacío.
     */
    sucursalInput.addEventListener('focus', function() {
        currentTermSucursal = sucursalInput.value.trim();
        hasMoreSucursal = true;
        currentPageSucursal = 1;
        fetchSucursales(currentTermSucursal, currentPageSucursal);
    });

    /**
     * Evento 'scroll' en el contenedor de resultados de sucursales para implementar scroll infinito.
     */
    autocompleteSucursalResults.addEventListener('scroll', function() {
        if (autocompleteSucursalResults.scrollTop + autocompleteSucursalResults.clientHeight >= autocompleteSucursalResults.scrollHeight - 5) {
            if (hasMoreSucursal && !isLoadingSucursal) {
                currentPageSucursal += 1;
                fetchSucursales(currentTermSucursal, currentPageSucursal);
            }
        }
    });

    /**
     * Evento 'click' en las opciones de autocompletar sucursales para seleccionar una sucursal.
     */
    autocompleteSucursalResults.addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('autocomplete-option')) {
            const selectedText = event.target.textContent;
            const selectedId = event.target.dataset.id;
            sucursalInput.value = selectedText;
            sucursalIdInput.value = selectedId;
            autocompleteSucursalResults.innerHTML = '';
            autocompleteSucursalResults.style.display = 'none';
            hasMoreSucursal = false;

            // Resetear el campo de punto de pago al cambiar la sucursal
            puntopagoInput.value = '';
            puntopagoIdInput.value = '';
            autocompletePuntopagoResults.innerHTML = '';
            autocompletePuntopagoResults.style.display = 'none';
            hasMorePuntopago = true;
            currentPagePuntopago = 1;
        }
    });

    /**
     * Evento 'input' en el campo de punto de pago para filtrar resultados.
     */
    puntopagoInput.addEventListener('input', function() {
        currentTermPuntopago = puntopagoInput.value.trim();
        puntopagoIdInput.value = ''; // Limpiar el campo oculto
        hasMorePuntopago = true;
        currentPagePuntopago = 1;

        if (debounceTimeoutPuntopago) {
            clearTimeout(debounceTimeoutPuntopago);
        }

        debounceTimeoutPuntopago = setTimeout(function() {
            fetchPuntosPago(currentTermPuntopago, currentPagePuntopago);
        }, 300); // Retraso para debounce
    });

    /**
     * Evento 'focus' en el campo de punto de pago para cargar todas las opciones si está vacío.
     */
    puntopagoInput.addEventListener('focus', function() {
        currentTermPuntopago = puntopagoInput.value.trim();
        hasMorePuntopago = true;
        currentPagePuntopago = 1;
        fetchPuntosPago(currentTermPuntopago, currentPagePuntopago);
    });

    /**
     * Evento 'scroll' en el contenedor de resultados de puntos de pago para implementar scroll infinito.
     */
    autocompletePuntopagoResults.addEventListener('scroll', function() {
        if (autocompletePuntopagoResults.scrollTop + autocompletePuntopagoResults.clientHeight >= autocompletePuntopagoResults.scrollHeight - 5) {
            if (hasMorePuntopago && !isLoadingPuntopago) {
                currentPagePuntopago += 1;
                fetchPuntosPago(currentTermPuntopago, currentPagePuntopago);
            }
        }
    });

    /**
     * Evento 'click' en las opciones de autocompletar puntos de pago para seleccionar un punto de pago.
     */
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

    /**
     * Evento 'click' en el documento para cerrar los autocompletados al hacer clic fuera.
     */
    document.addEventListener('click', function(event) {
        if (!sucursalInput.contains(event.target) && !autocompleteSucursalResults.contains(event.target)) {
            autocompleteSucursalResults.innerHTML = '';
            autocompleteSucursalResults.style.display = 'none';
            hasMoreSucursal = false;
        }
        if (!puntopagoInput.contains(event.target) && !autocompletePuntopagoResults.contains(event.target)) {
            autocompletePuntopagoResults.innerHTML = '';
            autocompletePuntopagoResults.style.display = 'none';
            hasMorePuntopago = false;
        }
    });

    /**
     * Manejo de selección de días de la semana.
     */
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

    /**
     * Agregar horario a la tabla temporal
     */
    document.querySelector('.btn-agregar-temporal').addEventListener('click', function() {
        clearErrors();

        const diaSemana = diaSemanaInput.value;
        const horaApertura = document.getElementById('id_horaapertura').value;
        const horaCierre = document.getElementById('id_horacierre').value;
        const puntopagoid = puntopagoIdInput.value;

        // Validaciones al agregar horario a la lista temporal
        if (!diaSemana || !horaApertura || !horaCierre || !puntopagoid) {
            alertBox.innerHTML = 'Por favor, complete todos los campos para agregar un horario.';
            alertBox.style.display = 'block';
            return;
        }

        if (horaApertura >= horaCierre) {
            alertBox.innerHTML = 'La hora de apertura debe ser menor que la hora de cierre.';
            alertBox.style.display = 'block';
            return;
        }

        diaSemana.split(',').forEach(day => {
            // Verificar si el horario ya existe en la tabla temporal
            const existe = horariosTemp.some(horario => horario.dia === day && horario.horaapertura === horaApertura && horario.horacierre === horaCierre);
            if (!existe) {
                horariosTemp.push({ dia: day, horaapertura: horaApertura, horacierre: horaCierre });
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${day}</td>
                    <td><input type="time" name="horaapertura" value="${horaApertura}" readonly></td>
                    <td><input type="time" name="horacierre" value="${horaCierre}" readonly></td>
                    <td><button type="button" class="btn-eliminar"><i class="fas fa-trash"></i></button></td>
                `;
                horariosTempBody.appendChild(row);

                // Deshabilitar el botón del día seleccionado
                buttons.forEach(button => {
                    if (button.getAttribute('data-day') === day) {
                        button.disabled = true;
                        button.classList.remove('active');
                    }
                });
            }
        });

        diaSemanaInput.value = '';
        document.getElementById('id_horaapertura').value = '';
        document.getElementById('id_horacierre').value = '';
    });

    /**
     * Eliminar horario de la tabla temporal
     */
    horariosTempBody.addEventListener('click', function(event) {
        if (event.target.closest('.btn-eliminar')) {
            const row = event.target.closest('tr');
            const day = row.cells[0].textContent;

            // Eliminar el horario del array temporal
            horariosTemp = horariosTemp.filter(horario => horario.dia !== day);
            row.remove();

            // Habilitar nuevamente el botón del día
            buttons.forEach(button => {
                if (button.getAttribute('data-day') === day) {
                    button.disabled = false;
                    button.classList.remove('active');
                }
            });
        }
    });

    /**
     * Enviar el formulario
     */
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        clearErrors();

        const sucursalid = sucursalIdInput.value;
        const puntopagoid = puntopagoIdInput.value;

        if (!sucursalid || !puntopagoid) {
            alertBox.innerHTML = 'Por favor, seleccione una sucursal y un punto de pago.';
            alertBox.style.display = 'block';
            return;
        }

        if (horariosTemp.length === 0) {
            alertBox.innerHTML = 'Debe agregar al menos un horario antes de guardar.';
            alertBox.style.display = 'block';
            return;
        }

        const horariosInput = document.createElement('input');
        horariosInput.type = 'hidden';
        horariosInput.name = 'horarios';
        horariosInput.value = JSON.stringify(horariosTemp);
        form.appendChild(horariosInput);

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
                successBox.textContent = 'Horario de caja agregado exitosamente.';
                successBox.style.display = 'block';
                form.reset();
                horariosTemp = [];
                horariosTempBody.innerHTML = '';
                buttons.forEach(button => {
                    button.disabled = false;
                    button.classList.remove('active');
                });
                sucursalIdInput.value = '';
                puntopagoIdInput.value = '';
                autocompleteSucursalResults.innerHTML = '';
                autocompleteSucursalResults.style.display = 'none';
                autocompletePuntopagoResults.innerHTML = '';
                autocompletePuntopagoResults.style.display = 'none';
                hasMoreSucursal = false;
                hasMorePuntopago = false;
            } else {
                const errors = JSON.parse(data.errors);
                showErrors(errors);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alertBox.innerHTML = 'Ocurrió un error inesperado.';
            alertBox.style.display = 'block';
        });
    });

    /**
     * Función para obtener el valor de una cookie por nombre.
     * @param {string} name - Nombre de la cookie.
     * @returns {string|null} - Valor de la cookie o null si no se encuentra.
     */
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                // Verificar si la cookie empieza con el nombre buscado
                if (cookie.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});
