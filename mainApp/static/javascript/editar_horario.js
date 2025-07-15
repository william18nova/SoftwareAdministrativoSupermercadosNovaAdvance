/* static/javascript/editar_horario.js
   ─────────────────────────────────────────
   · Autocomplete sucursal
   · Selector de días
   · Tabla editable
   · Envío AJAX (JSON) y flashes
*/
(() => {
  "use strict";

  /* ══════════════ refs ══════════════ */
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const form  = $("#form-editar-horarios");
  const tabla = $("#tabla-horarios");

  const sucInp = $("#id_sucursal_autocomplete");
  const sucHid = $("#id_sucursalid");
  const box    = $("#sucursal-autocomplete-results");

  const dayBtns = $$(".day-button");
  const apInp   = $("#horaapertura");
  const ciInp   = $("#horacierre");

  const err = $("#error-message");
  const ok  = $("#success-message");
  const csrftoken = document.querySelector("[name=csrfmiddlewaretoken]").value;

  /* ══════════════ helpers ══════════════ */
  const iconErr = t => `<i class="fas fa-exclamation-circle"></i> ${t}`;
  const iconOk  = t => `<i class="fas fa-check-circle"></i> ${t}`;
  const show    = (el, html) => { el.innerHTML = html; el.style.display = "block"; };
  const hide    = el            => { el.style.display = "none"; el.innerHTML = ""; };

  function resetUI () {
    [err, ok].forEach(hide);
    $$(".field-error").forEach(hide);
  }
  function fieldErr (field, msg) {
    const div = $(`#error-id_${field}`);
    div ? show(div, iconErr(msg)) : show(err, iconErr(msg));
  }

  /* ══════════════ ordenar filas existentes (Lun → Dom) ══════════════ */
  const order = ["Lun","Mar","Mie","Jue","Vie","Sab","Dom"];
  [...tabla.querySelectorAll("tr[data-dia]")]
    .sort((a, b) => order.indexOf(a.dataset.dia) - order.indexOf(b.dataset.dia))
    .forEach(tr => tabla.appendChild(tr));

  /* ══════════════ AUTOCOMPLETE ══════════════ */
  let cache = Object.create(null);
  let state = { term:"", pg:1, more:true, loading:false };

  /* última selección confirmada (texto + id) */
  let currentSelection = {
    text : sucInp.value.trim(),
    id   : sucHid.value.trim()
  };

  async function fetchSuc (term, pg = 1) {
    if (state.loading || !state.more) return;
    state.loading = true;

    const key = `${term}_${pg}`;
    let data  = cache[key];

    if (!data) {
      const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${pg}`;
      const res = await fetch(url);
      data      = await res.json();
      cache[key]= data;
    }

    if (pg === 1) box.innerHTML = "";
    if (data.results.length) {
      data.results.forEach(r => {
        box.insertAdjacentHTML(
          "beforeend",
          `<div class="autocomplete-option" data-id="${r.id}">${r.text}</div>`
        );
      });
      state.more = data.has_more;
    } else if (pg === 1) {
      box.innerHTML = `<div class="autocomplete-no-result">Sin resultados</div>`;
      state.more = false;
    }
    box.style.display = "block";
    state.loading = false;
  }

  const debounce = (fn, ms = 300) => {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  };
  const debFetchSuc = debounce(fetchSuc, 300);

  sucInp.addEventListener("input", () => {
    /* Vacía hidden sólo si el texto ya no coincide con la última selección */
    if (sucInp.value.trim() !== currentSelection.text) {
      sucHid.value = "";
    }
    state = { term:sucInp.value.trim(), pg:1, more:true, loading:false };
    debFetchSuc(state.term, 1);
  });

  sucInp.addEventListener("focus", () => {
    state = { term:sucInp.value.trim(), pg:1, more:true, loading:false };
    fetchSuc(state.term, 1);
  });

  box.addEventListener("scroll", () => {
    if (
      box.scrollTop + box.clientHeight >= box.scrollHeight - 5 &&
      state.more && !state.loading
    ) {
      state.pg++;
      fetchSuc(state.term, state.pg);
    }
  });

  box.addEventListener("click", e => {
    const opt = e.target.closest(".autocomplete-option");
    if (!opt) return;
    sucInp.value      = opt.textContent;
    sucHid.value      = opt.dataset.id;
    currentSelection  = { text: sucInp.value.trim(), id: sucHid.value.trim() };
    box.innerHTML     = "";
    box.style.display = "none";
    state.more        = false;
  });

  document.addEventListener("click", e => {
    if (!sucInp.contains(e.target) && !box.contains(e.target)) {
      box.style.display = "none";
    }
  });

  /* ══════════════ selector de días ══════════════ */
  dayBtns.forEach(btn => {
    if (tabla.querySelector(`tr[data-dia="${btn.dataset.day}"]`)) {
      btn.disabled = true;
    }
    btn.addEventListener("click", () => btn.classList.toggle("active"));
  });

  /* ══════════════ agregar fila ══════════════ */
  $("#btn-agregar-horario").addEventListener("click", () => {
    resetUI();

    if (!sucHid.value.trim()) fieldErr("sucursalid", "Seleccione sucursal.");
    const dias = [...dayBtns]
      .filter(b => b.classList.contains("active"))
      .map(b => b.dataset.day);
    if (!dias.length)      fieldErr("dia_semana", "Seleccione al menos un día.");
    if (!apInp.value)      fieldErr("horaapertura", "Indique apertura.");
    if (!ciInp.value)      fieldErr("horacierre", "Indique cierre.");
    if (apInp.value && ciInp.value && apInp.value >= ciInp.value) {
      fieldErr("horacierre", "Cierre > apertura.");
      return;
    }
    if (!sucHid.value.trim() || !dias.length || !apInp.value || !ciInp.value) {
      return;
    }

    dias.forEach(d => {
      tabla.insertAdjacentHTML("beforeend", `
        <tr data-dia="${d}">
          <td data-label="Día">${d}</td>
          <td data-label="Apertura">
            <input type="time" value="${apInp.value}" readonly>
          </td>
          <td data-label="Cierre">
            <input type="time" value="${ciInp.value}" readonly>
          </td>
          <td data-label="Acciones">
            <button type="button" class="btn-eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>`);
      const b = dayBtns.find(x => x.dataset.day === d);
      if (b) {
        b.disabled = true;
        b.classList.remove("active");
      }
    });

    apInp.value = "";
    ciInp.value = "";
  });

  /* ══════════════ eliminar fila ══════════════ */
  tabla.addEventListener("click", e => {
    const btn = e.target.closest(".btn-eliminar");
    if (!btn) return;

    const tr  = btn.closest("tr");
    const dia = tr.dataset.dia;
    tr.remove();  // quitamos la fila

    // reactivar el botón solamente si ya no queda ninguna fila con ese día
    if (!tabla.querySelector(`tr[data-dia="${dia}"]`)) {
      const b = [...dayBtns].find(x => x.dataset.day === dia);
      if (b) {
        b.disabled = false;
        b.classList.remove("active");
      }
    }
  });

  /* ══════════════ submit ══════════════ */
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    resetUI();

    if (!sucHid.value.trim()) {
      fieldErr("sucursalid", "Seleccione una sucursal de la lista.");
      return;
    }
    const rows = [...tabla.querySelectorAll("tr[data-dia]")];
    if (!rows.length) {
      fieldErr("dia_semana", "No hay horarios en la tabla.");
      return;
    }

    const horarios = rows.map(r => ({
      dia         : r.dataset.dia,
      horaapertura: r.querySelectorAll("input")[0].value,
      horacierre  : r.querySelectorAll("input")[1].value
    }));

    try {
      const res = await fetch(form.action, {
        method     : "POST",
        credentials: "same-origin",
        headers    : {
          "Content-Type": "application/json",
          "X-CSRFToken" : csrftoken,
          "Accept"      : "application/json"
        },
        body: JSON.stringify({ sucursalid: sucHid.value, horarios })
      });

      if (!res.ok) {
        show(err, iconErr(`Error al guardar (HTTP ${res.status}).`));
        return;
      }

      const data = await res.json();
      if (data.success) {
        show(ok, iconOk("Horarios guardados."));
        setTimeout(() => location.href = "/visualizar_horarios/", 800);
      } else if (data.errors) {
        const errs = JSON.parse(data.errors);
        Object.entries(errs).forEach(([f, arr]) =>
          arr.forEach(e => fieldErr(f, e.message))
        );
      } else {
        show(err, iconErr(data.error || "Error desconocido."));
      }

    } catch (e) {
      console.error("fetch fail:", e);
      show(err, iconErr("Error de red o de parseo."));
    }
  });
})();
