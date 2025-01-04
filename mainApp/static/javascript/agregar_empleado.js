// agregar_empleado.js

document.addEventListener('DOMContentLoaded', function() {
    /* ======================
       1. Variables Generales
    ====================== */
    const form = document.getElementById('form-agregar-empleado');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
    const successTextSpan = document.getElementById('success-text');
    
    // Campos de Autocompletado
    const usuarioInput = document.getElementById('id_usuario_autocomplete');
    const usuarioIdInput = document.getElementById('id_usuarioid'); // Cambiado a 'id_usuarioid'
    const usuarioAutocompleteResults = document.getElementById('usuario-autocomplete-results');
    
    const sucursalInput = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput = document.getElementById('id_sucursalid'); // Cambiado a 'id_sucursalid'
    const sucursalAutocompleteResults = document.getElementById('sucursal-autocomplete-results');
    
    /* ==========================
       2. Variables de Debounce y Caching
    ========================== */
    const DEBOUNCE_TIME = 300; // 300 ms
    let debounceTimeoutUsuario = null;
    let debounceTimeoutSucursal = null;
    
    // Caches para almacenar respuestas anteriores
    const cacheUsuario = {};
    const cacheSucursal = {};
    
    // Variables para paginación
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
    
    /**
     * Función genérica para fetch con caching
     */
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
                cache[cacheKey] = data; // Guardar en caché
                callback(data);
            })
            .catch(error => {
                console.error('fetchWithCache error:', error);
            });
    }
    
    /**
     * Función para mostrar errores específicos de campo
     */
    function showFieldError(field, message) {
        const errorDiv = document.getElementById(`error-id_${field}`);
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
            errorDiv.classList.add('visible');
            errorDiv.style.display = 'block';
        }
    }
    
    /**
     * Función para mostrar mensajes de error generales
     */
    function showGlobalError(message) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
            errorDiv.style.display = 'block';
        }
    }
    
    /**
     * Función para mostrar mensajes de éxito
     */
    function showSuccess(message) {
        const successDiv = document.getElementById('success-message');
        if (successDiv) {
            successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
            successDiv.style.display = 'flex';
        }
    }
    
    /**
     * Función para limpiar mensajes de error y éxito
     */
    function clearMessages() {
        // Limpiar errores específicos de campos
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.classList.remove('visible');
            errorField.style.display = 'none';
        });
        
        // Ocultar mensajes generales
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.innerHTML = '';
        }
        
        const successDiv = document.getElementById('success-message');
        if (successDiv) {
            successDiv.style.display = 'none';
            successDiv.innerHTML = '';
        }
        
        // Remover clases de error de los inputs
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(function(input) {
            input.classList.remove('input-error');
        });
    }
    
    /**
     * Función para manejar la selección de una opción de autocompletado
     */
    function handleSelection(inputElement, hiddenInput, resultsContainer, selectedText, selectedId) {
        inputElement.value = selectedText;
        hiddenInput.value = selectedId;
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('visible');
        resultsContainer.style.display = 'none';
        
        // Resetear paginación y flags si es necesario
        if (resultsContainer.id === 'usuario-autocomplete-results') {
            hasMoreUsuario = false;
        } else if (resultsContainer.id === 'sucursal-autocomplete-results') {
            hasMoreSucursal = false;
        }
    }
    
    /**
     * Función para obtener el valor de una cookie por nombre
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
    
    /* ======================
       4. Funciones de Autocompletado Mejoradas
    ====================== */
    
    /**
     * Función para fetch de Usuarios con caching y paginación
     */
    function fetchUsuarios(term, page = 1) {
        if (isLoadingUsuario || !hasMoreUsuario) return;
        isLoadingUsuario = true;
        console.log(`Fetching usuarios: term='${term}', page=${page}`);
    
        const url = `${usuarioAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
        
        fetchWithCache(url, cacheUsuario, term, page, function(data) {
            if (page === 1) {
                usuarioAutocompleteResults.innerHTML = '';
            }
            if (data.results.length > 0) {
                data.results.forEach(item => {
                    const opt = document.createElement('div');
                    opt.classList.add('autocomplete-option');
                    opt.textContent = item.text;
                    opt.dataset.id = item.id;
                    usuarioAutocompleteResults.appendChild(opt);
                });
                hasMoreUsuario = data.has_more;
            } else if (page === 1) {
                const noResult = document.createElement('div');
                noResult.classList.add('autocomplete-no-result');
                noResult.textContent = 'No se encontraron resultados';
                usuarioAutocompleteResults.appendChild(noResult);
                hasMoreUsuario = false;
            }
            usuarioAutocompleteResults.style.display = 'block';
            usuarioAutocompleteResults.classList.add('visible');
            isLoadingUsuario = false;
            console.log('Usuarios fetch completado:', data);
        });
    }
    
    /**
     * Función para fetch de Sucursales con caching y paginación
     */
    function fetchSucursales(term, page = 1) {
        if (isLoadingSucursal || !hasMoreSucursal) return;
        isLoadingSucursal = true;
        console.log(`Fetching sucursales: term='${term}', page=${page}`);
    
        const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
        
        fetchWithCache(url, cacheSucursal, term, page, function(data) {
            if (page === 1) {
                sucursalAutocompleteResults.innerHTML = '';
            }
            if (data.results.length > 0) {
                data.results.forEach(item => {
                    const opt = document.createElement('div');
                    opt.classList.add('autocomplete-option');
                    opt.textContent = item.text;
                    opt.dataset.id = item.id;
                    sucursalAutocompleteResults.appendChild(opt);
                });
                hasMoreSucursal = data.has_more;
            } else if (page === 1) {
                const noResult = document.createElement('div');
                noResult.classList.add('autocomplete-no-result');
                noResult.textContent = 'No se encontraron resultados';
                sucursalAutocompleteResults.appendChild(noResult);
                hasMoreSucursal = false;
            }
            sucursalAutocompleteResults.style.display = 'block';
            sucursalAutocompleteResults.classList.add('visible');
            isLoadingSucursal = false;
            console.log('Sucursales fetch completado:', data);
        });
    }
    
    /* ======================
       5. Eventos de Autocompletado Mejorados
    ====================== */
    
    /**
     * Evento de entrada para Usuario Autocompletar
     */
    usuarioInput.addEventListener('input', function() {
        currentTermUsuario = usuarioInput.value.trim();
        usuarioIdInput.value = ''; // Limpiar el campo oculto
        hasMoreUsuario = true;
        currentPageUsuario = 1;
    
        if (debounceTimeoutUsuario) {
            clearTimeout(debounceTimeoutUsuario);
        }
    
        debounceTimeoutUsuario = setTimeout(function() {
            if (currentTermUsuario.length === 0) {
                fetchUsuarios('', 1);
            } else {
                fetchUsuarios(currentTermUsuario, 1);
            }
        }, DEBOUNCE_TIME);
    });
    
    /**
     * Evento de enfoque para Usuario Autocompletar
     */
    usuarioInput.addEventListener('focus', function() {
        currentTermUsuario = usuarioInput.value.trim();
        hasMoreUsuario = true;
        currentPageUsuario = 1;
        fetchUsuarios(currentTermUsuario, currentPageUsuario);
    });
    
    /**
     * Evento de scroll para Usuario Autocompletar (scroll infinito)
     */
    usuarioAutocompleteResults.addEventListener('scroll', function() {
        if (usuarioAutocompleteResults.scrollTop + usuarioAutocompleteResults.clientHeight >= usuarioAutocompleteResults.scrollHeight - 5) {
            if (hasMoreUsuario && !isLoadingUsuario) {
                currentPageUsuario += 1;
                fetchUsuarios(currentTermUsuario, currentPageUsuario);
            }
        }
    });
    
    /**
     * Evento de clic en opciones de Usuario Autocompletar
     */
    usuarioAutocompleteResults.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('autocomplete-option')) {
            const selectedText = e.target.textContent;
            const selectedId = e.target.dataset.id;
            handleSelection(usuarioInput, usuarioIdInput, usuarioAutocompleteResults, selectedText, selectedId);
        }
    });
    
    /**
     * Evento de entrada para Sucursal Autocompletar
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
            if (currentTermSucursal.length === 0) {
                fetchSucursales('', 1);
            } else {
                fetchSucursales(currentTermSucursal, 1);
            }
        }, DEBOUNCE_TIME);
    });
    
    /**
     * Evento de enfoque para Sucursal Autocompletar
     */
    sucursalInput.addEventListener('focus', function() {
        currentTermSucursal = sucursalInput.value.trim();
        hasMoreSucursal = true;
        currentPageSucursal = 1;
        fetchSucursales(currentTermSucursal, currentPageSucursal);
    });
    
    /**
     * Evento de scroll para Sucursal Autocompletar (scroll infinito)
     */
    sucursalAutocompleteResults.addEventListener('scroll', function() {
        if (sucursalAutocompleteResults.scrollTop + sucursalAutocompleteResults.clientHeight >= sucursalAutocompleteResults.scrollHeight - 5) {
            if (hasMoreSucursal && !isLoadingSucursal) {
                currentPageSucursal += 1;
                fetchSucursales(currentTermSucursal, currentPageSucursal);
            }
        }
    });
    
    /**
     * Evento de clic en opciones de Sucursal Autocompletar
     */
    sucursalAutocompleteResults.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('autocomplete-option')) {
            const selectedText = e.target.textContent;
            const selectedId = e.target.dataset.id;
            handleSelection(sucursalInput, sucursalIdInput, sucursalAutocompleteResults, selectedText, selectedId);
        }
    });
    
    /**
     * Evento de clic fuera de los autocompletados para cerrarlos
     */
    document.addEventListener('click', function(e) {
        if (!usuarioInput.contains(e.target) && !usuarioAutocompleteResults.contains(e.target)) {
            usuarioAutocompleteResults.innerHTML = '';
            usuarioAutocompleteResults.classList.remove('visible');
            usuarioAutocompleteResults.style.display = 'none';
            hasMoreUsuario = false;
        }
        if (!sucursalInput.contains(e.target) && !sucursalAutocompleteResults.contains(e.target)) {
            sucursalAutocompleteResults.innerHTML = '';
            sucursalAutocompleteResults.classList.remove('visible');
            sucursalAutocompleteResults.style.display = 'none';
            hasMoreSucursal = false;
        }
    });
    
    /* ======================
       6. Evento de Envío del Formulario
    ====================== */
    
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevenir el envío predeterminado
        clearMessages();
        
        // Validaciones adicionales
        const usuarioId = usuarioIdInput.value.trim();
        const sucursalId = sucursalIdInput.value.trim();
        
        let hasLocalErrors = false;
        
        if (!usuarioId) {
            showFieldError('usuarioid', 'Debe seleccionar un usuario.'); // Cambiado a 'usuarioid'
            hasLocalErrors = true;
        }
        
        if (!sucursalId) {
            showFieldError('sucursalid', 'Debe seleccionar una sucursal.'); // Cambiado a 'sucursalid'
            hasLocalErrors = true;
        }
        
        if (hasLocalErrors) {
            showGlobalError('Por favor, corrige los errores en el formulario.');
            return;
        }
        
        // Preparar los datos del formulario
        const formData = new FormData(form);
        
        // Enviar el formulario vía AJAX
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
                // Mostrar mensaje de éxito
                showSuccess('Empleado agregado exitosamente.');
                // Resetear el formulario
                form.reset();
                usuarioIdInput.value = '';
                sucursalIdInput.value = '';
                usuarioAutocompleteResults.innerHTML = '';
                usuarioAutocompleteResults.classList.remove('visible');
                sucursalAutocompleteResults.innerHTML = '';
                sucursalAutocompleteResults.classList.remove('visible');
                hasMoreUsuario = false;
                hasMoreSucursal = false;
            } else {
                // Mostrar errores devueltos por el backend
                const errors = data.errors; // Ya es un objeto JSON
                for (let field in errors) {
                    const fieldErrors = errors[field];
                    fieldErrors.forEach(error => {
                        showFieldError(field, error.message);
                    });
                }
                // Mostrar mensaje de error general si existen errores
                if (Object.keys(errors).length > 0) {
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
