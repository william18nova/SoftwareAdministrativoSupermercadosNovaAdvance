// agregar_empleado.js

document.addEventListener('DOMContentLoaded', function() {
    // Variables generales
    const form = document.getElementById('form-agregar-empleado');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
    
    // Campos de Autocompletado
    const usuarioInput = document.getElementById('id_usuario_autocomplete');
    const usuarioIdInput = document.getElementById('id_usuarioid');
    const usuarioAutocompleteResults = document.getElementById('usuario-autocomplete-results');
    
    const sucursalInput = document.getElementById('id_sucursal_autocomplete');
    const sucursalIdInput = document.getElementById('id_sucursalid');
    const sucursalAutocompleteResults = document.getElementById('sucursal-autocomplete-results');
    
    // Debounce variables
    let debounceTimeoutUsuario = null;
    let debounceTimeoutSucursal = null;
    
    // Variables para paginación
    let currentPageUsuario = 1;
    let isLoadingUsuario = false;
    let hasMoreUsuario = true;
    let currentTermUsuario = '';
    
    let currentPageSucursal = 1;
    let isLoadingSucursal = false;
    let hasMoreSucursal = true;
    let currentTermSucursal = '';
    
    /**
     * Función para limpiar mensajes de error y éxito
     */
    function clearMessages() {
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.innerHTML = '';
        successMessageDiv.style.display = 'none';
        successMessageDiv.textContent = '';
        
        // Limpiar errores específicos de campos
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.style.display = 'none';
        });
    }
    
    /**
     * Función para mostrar mensajes de error
     */
    function displayErrors(errors) {
        clearMessages();
        
        // Errores generales
        if (errors.__all__) {
            errorMessageDiv.innerHTML = errors.__all__.map(e => e.message).join('<br>');
            errorMessageDiv.style.display = 'block';
        }
        
        // Errores específicos de campo
        for (let field in errors) {
            if (field === '__all__') continue;
            const fieldErrors = errors[field];
            const errorDiv = document.getElementById('error-id_' + field);
            if (errorDiv) {
                errorDiv.innerHTML = fieldErrors.map(e => `<i class="fas fa-exclamation-circle"></i>${e.message}`).join('<br>');
                errorDiv.style.display = 'block';
            }
        }
    }
    
    /**
     * Función para manejar la selección de una opción de autocompletado
     */
    function handleSelection(inputElement, hiddenInput, resultsContainer, selectedText, selectedId) {
        inputElement.value = selectedText;
        hiddenInput.value = selectedId;
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        
        // Resetear paginación y flags si es necesario
        if (resultsContainer.id === 'usuario-autocomplete-results') {
            hasMoreUsuario = false;
        } else if (resultsContainer.id === 'sucursal-autocomplete-results') {
            hasMoreSucursal = false;
        }
    }
    
    /**
     * Función para fetch de Usuarios
     */
    function fetchUsuarios(term, page = 1) {
        if (isLoadingUsuario || !hasMoreUsuario) return;
        isLoadingUsuario = true;
        
        const url = `${usuarioAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error HTTP! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (page === 1) {
                    usuarioAutocompleteResults.innerHTML = '';
                }
                
                if (data.results.length > 0) {
                    data.results.forEach(item => {
                        const option = document.createElement('div');
                        option.classList.add('autocomplete-option');
                        option.textContent = item.text;
                        option.dataset.id = item.id;
                        usuarioAutocompleteResults.appendChild(option);
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
                isLoadingUsuario = false;
            })
            .catch(error => {
                console.error('Error al obtener usuarios:', error);
                isLoadingUsuario = false;
            });
    }
    
    /**
     * Función para fetch de Sucursales
     */
    function fetchSucursales(term, page = 1) {
        if (isLoadingSucursal || !hasMoreSucursal) return;
        isLoadingSucursal = true;
        
        const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error HTTP! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (page === 1) {
                    sucursalAutocompleteResults.innerHTML = '';
                }
                
                if (data.results.length > 0) {
                    data.results.forEach(item => {
                        const option = document.createElement('div');
                        option.classList.add('autocomplete-option');
                        option.textContent = item.text;
                        option.dataset.id = item.id;
                        sucursalAutocompleteResults.appendChild(option);
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
                isLoadingSucursal = false;
            })
            .catch(error => {
                console.error('Error al obtener sucursales:', error);
                isLoadingSucursal = false;
            });
    }
    
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
        }, 300); // Tiempo de debounce
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
    usuarioAutocompleteResults.addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('autocomplete-option')) {
            const selectedText = event.target.textContent;
            const selectedId = event.target.dataset.id;
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
        }, 300); // Tiempo de debounce
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
    sucursalAutocompleteResults.addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('autocomplete-option')) {
            const selectedText = event.target.textContent;
            const selectedId = event.target.dataset.id;
            handleSelection(sucursalInput, sucursalIdInput, sucursalAutocompleteResults, selectedText, selectedId);
        }
    });
    
    /**
     * Evento de clic fuera de los autocompletados para cerrarlos
     */
    document.addEventListener('click', function(event) {
        if (!usuarioInput.contains(event.target) && !usuarioAutocompleteResults.contains(event.target)) {
            usuarioAutocompleteResults.innerHTML = '';
            usuarioAutocompleteResults.style.display = 'none';
            hasMoreUsuario = false;
        }
        if (!sucursalInput.contains(event.target) && !sucursalAutocompleteResults.contains(event.target)) {
            sucursalAutocompleteResults.innerHTML = '';
            sucursalAutocompleteResults.style.display = 'none';
            hasMoreSucursal = false;
        }
    });
    
    /**
     * Evento de envío del formulario
     */
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevenir el envío predeterminado
        clearMessages();
        
        // Validaciones adicionales
        const usuarioId = usuarioIdInput.value;
        const sucursalId = sucursalIdInput.value;
        
        let hasLocalErrors = false;
        
        if (!usuarioId) {
            const errorDiv = document.getElementById('error-id_usuarioid');
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Este campo es obligatorio.`;
            errorDiv.style.display = 'block';
            hasLocalErrors = true;
        }
        
        if (!sucursalId) {
            const errorDiv = document.getElementById('error-id_sucursalid');
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Este campo es obligatorio.`;
            errorDiv.style.display = 'block';
            hasLocalErrors = true;
        }
        
        if (hasLocalErrors) {
            errorMessageDiv.textContent = 'Por favor, corrige los errores en el formulario.';
            errorMessageDiv.style.display = 'block';
            return;
        }
        
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
                successMessageDiv.textContent = 'Empleado agregado exitosamente.';
                successMessageDiv.style.display = 'block';
                form.reset();
                usuarioIdInput.value = '';
                sucursalIdInput.value = '';
                usuarioAutocompleteResults.innerHTML = '';
                usuarioAutocompleteResults.style.display = 'none';
                sucursalAutocompleteResults.innerHTML = '';
                sucursalAutocompleteResults.style.display = 'none';
                hasMoreUsuario = false;
                hasMoreSucursal = false;
            } else {
                const errors = JSON.parse(data.errors);
                displayErrors(errors);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorMessageDiv.textContent = 'Ocurrió un error inesperado.';
            errorMessageDiv.style.display = 'block';
        });
    });
    
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
});
