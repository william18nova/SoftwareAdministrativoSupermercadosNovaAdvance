// agregar_horario.js

document.addEventListener('DOMContentLoaded', function() {
    // Variables generales
    const sucursalInput = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput = document.getElementById('id_sucursalid');
    const autocompleteResults = document.getElementById('sucursal-autocomplete-results');
    const diaSemanaInput = document.getElementById('id_dia_semana');
    const horariosTempBody = document.getElementById('horarios-temp-body');
    const alertBox = document.getElementById('error-message');
    const successBox = document.getElementById('success-message');
    const form = document.getElementById('horario-form');
    const buttons = document.querySelectorAll('.day-button');
    let horariosTemp = [];
    let debounceTimeout = null;

    // Variables para la paginación
    let currentPage = 1;
    let isLoading = false;
    let hasMore = true;
    let currentTerm = '';

    /**
     * Función para mostrar sugerencias de sucursales.
     * @param {string} term - Término de búsqueda.
     * @param {number} page - Número de página para la paginación.
     */
    function fetchSucursales(term, page = 1) {
        if (isLoading || !hasMore) return;
        isLoading = true;

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
                // Si no hay resultados en la primera página
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
        currentTerm = sucursalInput.value.trim();
        sucursalIdInput.value = ''; // Limpiar el campo oculto
        hasMore = true;
        currentPage = 1;

        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }

        debounceTimeout = setTimeout(function() {
            fetchSucursales(currentTerm, currentPage);
        }, 300); // Retraso para debounce
    });

    /**
     * Evento 'focus' en el campo de sucursal para cargar todas las sucursales si está vacío.
     */
    sucursalInput.addEventListener('focus', function() {
        currentTerm = sucursalInput.value.trim();
        hasMore = true;
        currentPage = 1;
        fetchSucursales(currentTerm, currentPage);
    });

    /**
     * Evento 'scroll' en el contenedor de resultados para implementar scroll infinito.
     */
    autocompleteResults.addEventListener('scroll', function() {
        if (autocompleteResults.scrollTop + autocompleteResults.clientHeight >= autocompleteResults.scrollHeight - 5) {
            if (hasMore && !isLoading) {
                currentPage += 1;
                fetchSucursales(currentTerm, currentPage);
            }
        }
    });

    /**
     * Evento 'click' en las opciones de autocompletar para seleccionar una sucursal.
     */
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

    /**
     * Evento 'click' en el documento para cerrar el autocompletar al hacer clic fuera.
     */
    document.addEventListener('click', function(event) {
        if (!sucursalInput.contains(event.target) && !autocompleteResults.contains(event.target)) {
            autocompleteResults.innerHTML = '';
            autocompleteResults.style.display = 'none';
            hasMore = false;
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
     * Evento 'click' en el botón para agregar horarios a la tabla temporal.
     */
    document.querySelector('.btn-agregar-temporal').addEventListener('click', function() {
        clearErrors();

        const diaSemana = diaSemanaInput.value;
        const horaApertura = document.getElementById('id_horaapertura').value;
        const horaCierre = document.getElementById('id_horacierre').value;

        // Validaciones al agregar horario a la lista temporal
        if (!diaSemana || !horaApertura || !horaCierre) {
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
            // Verificar si el día ya está agregado
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
     * Evento 'click' en la tabla de horarios temporales para eliminar un horario.
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
                }
            });
        }
    });

    /**
     * Evento 'submit' en el formulario para enviar los horarios.
     */
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        clearErrors();

        const sucursalid = sucursalIdInput.value;

        if (!sucursalid) {
            alertBox.innerHTML = 'Por favor, seleccione una sucursal.';
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
                successBox.textContent = 'Horarios agregados exitosamente.';
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
