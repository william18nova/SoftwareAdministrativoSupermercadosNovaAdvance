// static/javascript/agregar_sucursal.js
(() => {
  const form        = document.getElementById('sucursalForm');
  const errorDiv    = document.getElementById('error-message');
  const successDiv  = document.getElementById('success-message');
  const successText = document.getElementById('success-text');
  const fieldErrors = document.querySelectorAll('.field-error');

  /** Oculta ambos alertas */
  function hideAlerts() {
    errorDiv.style.display   = 'none';
    successDiv.style.display = 'none';
    // limpiamos contenido general
    errorDiv.innerHTML   = '';
    successText.textContent = '';
  }

  /** Oculta todos los errores de campo */
  function hideFieldErrors() {
    fieldErrors.forEach(div => {
      div.style.display = 'none';
      div.innerHTML     = '';
      div.classList.remove('visible');
    });
  }

  /** Limpia todo antes de cada envío */
  function clearAll() {
    hideAlerts();
    hideFieldErrors();
  }

  /**
   * Muestra un alert general
   * @param {HTMLElement} div  – contenedor .alert-error o .alert-success
   * @param {string} html      – contenido HTML del mensaje
   */
  function showAlert(div, html) {
    div.innerHTML = html;
    if (div === successDiv) {
      // alerta de éxito en flex
      div.style.display = 'flex';
    } else {
      // alerta de error en bloque
      div.style.display = 'block';
    }
  }

  /**
   * Muestra el error de un campo concreto
   * @param {string} field – nombre del campo (p.ej. 'nombre' o 'telefono')
   * @param {string} html  – HTML con sus mensajes
   */
  function showFieldError(field, html) {
    const div = document.getElementById(`error-${field}`);
    if (!div) return;
    div.innerHTML     = html;
    div.classList.add('visible');
    div.style.display = 'block';
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearAll();

    try {
      const resp = await fetch(form.action, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: new FormData(form),
      });
      const data = await resp.json();

      if (resp.ok && data.success) {
        // éxito
        const msg = `<i class="fas fa-check-circle success-icon"></i> ${data.message}`;
        showAlert(successDiv, msg);
        form.reset();
      } else {
        // validación fallida
        const errs = data.errors || {};
        if (errs.__all__) {
          showAlert(errorDiv, errs.__all__.map(e => e.message).join('<br>'));
        }
        Object.keys(errs).forEach(field => {
          if (field === '__all__') return;
          const msgs = errs[field]
            .map(e => `<i class="fas fa-exclamation-circle"></i> ${e.message}`)
            .join('<br>');
          showFieldError(field, msgs);
        });
      }
    } catch (err) {
      console.error(err);
      showAlert(errorDiv, 'Error de red. Inténtalo de nuevo.');
    }
  });
})();
