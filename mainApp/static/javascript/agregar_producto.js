// agregar_producto.js

document.addEventListener('DOMContentLoaded', function() {
    // Variables generales
    const form = document.getElementById('productoForm');
    const errorMessageDiv = document.getElementById('error-message');
    const successMessageDiv = document.getElementById('success-message');
    
    // Campo de Autocompletado para Categoría
    const categoriaInput = document.getElementById('id_categoria_autocomplete');
    const categoriaIdInput = document.getElementById('id_categoria');
    const categoriaAutocompleteResults = document.getElementById('categoria-autocomplete-results');
    
    // Debounce variables
    let debounceTimeoutCategoria = null;
    
    // Variables para paginación
    let currentPageCategoria = 1;
    let isLoadingCategoria = false;
    let hasMoreCategoria = true;
    let currentTermCategoria = '';
    
    /**
     * Función para limpiar mensajes de error y éxito
     */
    function clearMessages() {
        errorMessageDiv.style.display = 'none';
        errorMessageDiv.innerHTML = '';
        successMessageDiv.style.display = 'none';
        successMessageDiv.innerHTML = '';
        
        // Limpiar errores específicos de campos
        const errorFields = document.querySelectorAll('.field-error');
        errorFields.forEach(function(errorField) {
            errorField.innerHTML = '';
            errorField.classList.remove('visible');
        });
    }
    
    /**
     * Función para mostrar mensajes de error
     */
    function displayErrors(errors) {
        clearMessages();
        
        // Errores generales
        if (errors.__all__) {
            errorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errors.__all__.map(e => e.message).join('<br>')}`;
            errorMessageDiv.style.display = 'block';
        }
        
        // Errores específicos de campo
        for (let field in errors) {
            if (field === '__all__') continue;
            const fieldErrors = errors[field];
            const errorDiv = document.getElementById('error-id_' + field);
            if (errorDiv) {
                errorDiv.innerHTML = fieldErrors.map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`).join('<br>');
                errorDiv.classList.add('visible');
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
        resultsContainer.classList.remove('visible');
        
        // Resetear paginación y flags si es necesario
        hasMoreCategoria = false;
    }
    
    /**
     * Función para fetch de Categorías
     */
    function fetchCategorias(term, page = 1) {
        if (isLoadingCategoria || !hasMoreCategoria) return;
        isLoadingCategoria = true;
        
        const url = `${categoriaAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${page}`;
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error HTTP! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (page === 1) {
                    categoriaAutocompleteResults.innerHTML = '';
                }
                
                if (data.results.length > 0) {
                    data.results.forEach(item => {
                        const option = document.createElement('div');
                        option.classList.add('autocomplete-option');
                        option.textContent = item.text;
                        option.dataset.id = item.id;
                        categoriaAutocompleteResults.appendChild(option);
                    });
                    hasMoreCategoria = data.has_more;
                } else if (page === 1) {
                    const noResult = document.createElement('div');
                    noResult.classList.add('autocomplete-no-result');
                    noResult.textContent = 'No se encontraron resultados';
                    categoriaAutocompleteResults.appendChild(noResult);
                    hasMoreCategoria = false;
                }
                
                categoriaAutocompleteResults.classList.add('visible');
                isLoadingCategoria = false;
            })
            .catch(error => {
                console.error('Error al obtener categorías:', error);
                isLoadingCategoria = false;
            });
    }
    
    /**
     * Evento de entrada para Categoría Autocompletar
     */
    categoriaInput.addEventListener('input', function() {
        currentTermCategoria = categoriaInput.value.trim();
        categoriaIdInput.value = ''; // Limpiar el campo oculto
        hasMoreCategoria = true;
        currentPageCategoria = 1;
        
        if (debounceTimeoutCategoria) {
            clearTimeout(debounceTimeoutCategoria);
        }
        
        debounceTimeoutCategoria = setTimeout(function() {
            if (currentTermCategoria.length === 0) {
                fetchCategorias('', 1);
            } else {
                fetchCategorias(currentTermCategoria, 1);
            }
        }, 300); // Tiempo de debounce
    });
    
    /**
     * Evento de enfoque para Categoría Autocompletar
     */
    categoriaInput.addEventListener('focus', function() {
        currentTermCategoria = categoriaInput.value.trim();
        hasMoreCategoria = true;
        currentPageCategoria = 1;
        fetchCategorias(currentTermCategoria, currentPageCategoria);
    });
    
    /**
     * Evento de scroll para Categoría Autocompletar (scroll infinito)
     */
    categoriaAutocompleteResults.addEventListener('scroll', function() {
        if (categoriaAutocompleteResults.scrollTop + categoriaAutocompleteResults.clientHeight >= categoriaAutocompleteResults.scrollHeight - 5) {
            if (hasMoreCategoria && !isLoadingCategoria) {
                currentPageCategoria += 1;
                fetchCategorias(currentTermCategoria, currentPageCategoria);
            }
        }
    });
    
    /**
     * Evento de clic en opciones de Categoría Autocompletar
     */
    categoriaAutocompleteResults.addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('autocomplete-option')) {
            const selectedText = event.target.textContent;
            const selectedId = event.target.dataset.id;
            handleSelection(categoriaInput, categoriaIdInput, categoriaAutocompleteResults, selectedText, selectedId);
        }
    });
    
    /**
     * Evento de clic fuera de los autocompletados para cerrarlos
     */
    document.addEventListener('click', function(event) {
        if (!categoriaInput.contains(event.target) && !categoriaAutocompleteResults.contains(event.target)) {
            categoriaAutocompleteResults.innerHTML = '';
            categoriaAutocompleteResults.classList.remove('visible');
            hasMoreCategoria = false;
        }
    });
    
    /**
     * Evento de envío del formulario
     */
    form.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevenir el envío predeterminado
        clearMessages();
        
        // Validaciones adicionales
        const categoriaId = categoriaIdInput.value;
        
        let hasLocalErrors = false;
        
        if (!categoriaId) {
            const errorDiv = document.getElementById('error-id_categoria');
            errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Este campo es obligatorio.';
            errorDiv.classList.add('visible');
            hasLocalErrors = true;
        }
        
        if (hasLocalErrors) {
            errorMessageDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Por favor, corrige los errores en el formulario.';
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
                // Mostrar mensaje de éxito en el cuadro verde
                successMessageDiv.innerHTML = '<i class="fas fa-check-circle"></i> Producto agregado exitosamente.';
                successMessageDiv.style.display = 'block';
                
                // Resetear el formulario
                form.reset();
                categoriaIdInput.value = '';
                categoriaAutocompleteResults.innerHTML = '';
                categoriaAutocompleteResults.classList.remove('visible');
                hasMoreCategoria = false;
            } else {
                const errors = JSON.parse(data.errors);
                displayErrors(errors);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (errorMessageDiv) {
                errorMessageDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ocurrió un error inesperado. Por favor, intenta nuevamente.';
                errorMessageDiv.style.display = 'block';
            }
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
