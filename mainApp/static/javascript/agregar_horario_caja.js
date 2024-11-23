// agregar_horario_caja.js

document.addEventListener('DOMContentLoaded', function() {
    const sucursalSelect = document.getElementById('id_sucursal');
    const puntoPagoSelect = document.getElementById('id_puntopagoid');
    const buttons = document.querySelectorAll('.day-button');
    const diaSemanaInput = document.getElementById('id_dia_semana');
    const horariosTempBody = document.getElementById('horarios-temp-body');
    const alertBox = document.getElementById('error-message');
    const successBox = document.getElementById('success-message');
    const form = document.getElementById('horarioForm');
    let horariosTemp = [];

    // Función para mostrar errores
    function showErrors(errors) {
        // Limpiar errores previos
        clearErrors();

        // Mostrar errores generales
        if (errors.__all__) {
            alertBox.innerHTML = errors.__all__.map(e => e.message).join('<br>');
            alertBox.style.display = 'block';
        }

        // Mostrar errores específicos de campo
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

    // Función para limpiar errores
    function clearErrors() {
        alertBox.style.display = 'none';
        alertBox.innerHTML = '';

        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.style.display = 'none';
        });
    }

    // Obtener puntos de pago al seleccionar sucursal
    sucursalSelect.addEventListener('change', function() {
        const sucursalId = this.value;
        puntoPagoSelect.innerHTML = '<option value="">Seleccionar punto de pago</option>';
        if (sucursalId) {
            fetch(`/obtener_puntos_pago/?sucursal_id=${sucursalId}`)
                .then(response => response.json())
                .then(data => {
                    data.forEach(opcion => {
                        puntoPagoSelect.innerHTML += opcion;
                    });
                });
        }
    });

    // Manejo de selección de días
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

    // Agregar horario a la tabla temporal
    document.querySelector('.btn-agregar-temporal').addEventListener('click', function() {
        clearErrors();

        const diaSemana = diaSemanaInput.value;
        const horaApertura = document.getElementById('id_horaapertura').value;
        const horaCierre = document.getElementById('id_horacierre').value;

        if (!diaSemana || !horaApertura || !horaCierre) {
            alertBox.innerHTML = 'Por favor, complete todos los campos.';
            alertBox.style.display = 'block';
            return;
        }

        if (horaApertura >= horaCierre) {
            alertBox.innerHTML = 'La hora de apertura debe ser menor que la hora de cierre.';
            alertBox.style.display = 'block';
            return;
        }

        diaSemana.split(',').forEach(day => {
            horariosTemp.push({ dia: day, horaapertura: horaApertura, horacierre: horaCierre });
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${day}</td>
                <td><input type="time" name="horaapertura" value="${horaApertura}"></td>
                <td><input type="time" name="horacierre" value="${horaCierre}"></td>
                <td><button type="button" class="btn-eliminar"><i class="fas fa-trash"></i></button></td>
            `;
            horariosTempBody.appendChild(row);

            buttons.forEach(button => {
                if (button.getAttribute('data-day') === day) {
                    button.disabled = true;
                    button.classList.remove('active');
                }
            });
        });

        diaSemanaInput.value = '';
        document.getElementById('id_horaapertura').value = '';
        document.getElementById('id_horacierre').value = '';
    });

    // Eliminar horario de la tabla temporal
    horariosTempBody.addEventListener('click', function(event) {
        if (event.target.closest('.btn-eliminar')) {
            const row = event.target.closest('tr');
            const day = row.cells[0].textContent;

            horariosTemp = horariosTemp.filter(horario => horario.dia !== day);
            row.remove();

            buttons.forEach(button => {
                if (button.getAttribute('data-day') === day) {
                    button.disabled = false;
                }
            });
        }
    });

    // Enviar el formulario
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        clearErrors();

        const sucursal = document.getElementById('id_sucursal').value;
        const puntopagoid = document.getElementById('id_puntopagoid').value;

        if (!sucursal || !puntopagoid || horariosTemp.length === 0) {
            alertBox.innerHTML = 'Por favor, complete todos los campos.';
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

    // Función para obtener el valor de una cookie por nombre
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
