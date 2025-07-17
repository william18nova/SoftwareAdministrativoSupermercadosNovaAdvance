/* static/javascript/agregar_horario_caja.js */
(() => {
  "use strict";

  const $    = s => document.querySelector(s);
  const $$   = s => document.querySelectorAll(s);

  const form     = $("#form-agregar-horario");
  const err      = $("#error-message");
  const ok       = $("#success-message");

  const sucInp   = $("#id_sucursal_autocomplete");
  const sucHid   = $("#id_sucursalid");
  const sucBox   = $("#sucursal-autocomplete-results");

  const ppInp    = $("#id_puntopago_autocomplete");
  const ppHid    = $("#id_puntopagoid");
  const ppBox    = $("#puntopago-autocomplete-results");

  const dayBtns  = $$(".day-button");
  const diaInp   = $("#id_dia_semana");
  const apInp    = $("#id_horaapertura");
  const ciInp    = $("#id_horacierre");

  const tempBody = $("#horarios-temp-body");
  let tempItems  = [];

  const csrftoken = document.querySelector("[name=csrfmiddlewaretoken]").value;
  const iconErr   = t => `<i class="fas fa-exclamation-circle"></i> ${t}`;
  const iconOk    = t => `<i class="fas fa-check-circle"></i> ${t}`;
  const show      = (el,html) => { el.innerHTML=html; el.style.display="block"; };
  const hide      = el          => { el.innerHTML=""; el.style.display="none"; };

  function resetUI(){
    [err, ok].forEach(hide);
    $$(".field-error").forEach(hide);
  }
  function fieldErr(f,m){
    const d = $(`#error-id_${f}`);
    d ? show(d, iconErr(m)) : show(err, iconErr(m));
  }

  /* ───── Generador genérico de autocomplete ───── */
  function makeAutocomplete(inp, hid, box, url, extraParams){
    let cache={}, state={term:"", pg:1, more:true, loading:false};

    async function fetcher(term, pg=1){
      if(state.loading||!state.more) return;
      state.loading = true;
      const key    = `${term}_${pg}`,
            params = new URLSearchParams({term, page: pg});
      if(extraParams)
        Object.entries(extraParams()).forEach(([k,v])=> params.append(k,v));

      const res  = await fetch(`${url}?${params}`),
            data = await res.json();

      if(pg===1) box.innerHTML="";
      if(data.results.length){
        data.results.forEach(r=>{
          box.insertAdjacentHTML("beforeend",
            `<div class="autocomplete-option" data-id="${r.id}">${r.text}</div>`);
        });
        state.more = data.has_more;
      } else if(pg===1){
        box.innerHTML = `<div class="autocomplete-no-result">Sin resultados</div>`;
        state.more   = false;
      }
      box.style.display = "block";
      state.loading     = false;
    }

    const debounce = (fn, ms=300) => {
      let t;
      return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
    };
    const debFetch = debounce(fetcher, 300);

    inp.addEventListener("input",()=>{
      hid.value = "";
      state     = {term:inp.value.trim(), pg:1, more:true, loading:false};
      debFetch(state.term, 1);
    });
    inp.addEventListener("focus", ()=> fetcher(inp.value.trim(), 1));
    box.addEventListener("scroll", ()=>{
      if(box.scrollTop + box.clientHeight >= box.scrollHeight - 5 &&
         state.more && !state.loading){
        state.pg++; fetcher(state.term, state.pg);
      }
    });
    box.addEventListener("click", e=>{
      const opt = e.target.closest(".autocomplete-option");
      if(!opt) return;
      inp.value = opt.textContent;
      hid.value = opt.dataset.id;
      box.innerHTML = "";
      box.style.display = "none";
      state.more = false;
    });
    document.addEventListener("click", e=>{
      if(!inp.contains(e.target) && !box.contains(e.target)){
        box.style.display = "none";
      }
    });
  }

  // 1) Sucursal (solo sucursales con puntos sin horario)
  makeAutocomplete(
    sucInp, sucHid, sucBox, sucursalAutocompleteUrl,
    null
  );

  // 2) Punto de Pago (filtrado por sucursal elegida)
  makeAutocomplete(
    ppInp, ppHid, ppBox, puntopagoAutocompleteUrl,
    () => ({ sucursal_id: sucHid.value })
  );

  /* ───── Selector de días ───── */
  dayBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const d    = btn.dataset.day;
      let dias   = diaInp.value ? diaInp.value.split(",") : [];
      if(dias.includes(d)){
        dias = dias.filter(x=>x!==d);
        btn.classList.remove("active");
      } else {
        dias.push(d);
        btn.classList.add("active");
      }
      diaInp.value = dias.join(",");
    });
  });

  /* ───── Agregar fila temporal ───── */
  $("#btn-agregar-temporal").addEventListener("click", ()=>{
    resetUI();
    if(!sucHid.value){ fieldErr("sucursalid","Seleccione sucursal."); return; }
    if(!ppHid.value) { fieldErr("puntopagoid","Seleccione punto de pago."); return; }

    const dias = diaInp.value.split(",").filter(d=>d);
    if(!dias.length){ fieldErr("dia_semana","Seleccione al menos un día."); return; }
    if(!apInp.value){ fieldErr("horaapertura","Indique hora de apertura."); return; }
    if(!ciInp.value){ fieldErr("horacierre","Indique hora de cierre.");    return; }
    if(apInp.value >= ciInp.value){
      fieldErr("horacierre","La hora de cierre debe ser mayor."); return;
    }

    dias.forEach(d=>{
      if(!tempItems.some(x=>
            x.dia===d &&
            x.horaapertura===apInp.value &&
            x.horacierre===ciInp.value
      )){
        tempItems.push({
          dia: d,
          horaapertura: apInp.value,
          horacierre:   ciInp.value
        });
        tempBody.insertAdjacentHTML("beforeend", `
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
        [...dayBtns].find(b=>b.dataset.day===d).disabled = true;
      }
    });

    diaInp.value = "";
    apInp.value  = "";
    ciInp.value  = "";
  });

  /* ───── Eliminar fila temporal ───── */
  tempBody.addEventListener("click", e=>{
    if(!e.target.closest(".btn-eliminar")) return;
    const tr = e.target.closest("tr");
    const d  = tr.dataset.dia;
    tempItems = tempItems.filter(x=> x.dia!==d);
    tr.remove();
    [...dayBtns].find(b=>b.dataset.day===d).disabled = false;
  });

  /* ───── Envío final ───── */
  form.addEventListener("submit", async ev=>{
    ev.preventDefault();
    resetUI();

    if(!sucHid.value){ fieldErr("sucursalid","Seleccione sucursal."); return; }
    if(!ppHid.value) { fieldErr("puntopagoid","Seleccione punto de pago."); return; }
    if(!tempItems.length){ fieldErr("dia_semana","Agregue al menos un horario."); return; }

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken":  csrftoken,
          "Accept":       "application/json"
        },
        body: new URLSearchParams({
          // **MUY IMPORTANTE** enviamos también el campo de texto requerido
          sucursal_autocomplete:  sucInp.value,
          sucursalid:            sucHid.value,
          puntopago_autocomplete: ppInp.value,
          puntopagoid:           ppHid.value,
          horarios:              JSON.stringify(tempItems)
        })
      });

      if (!res.ok) {
        show(err, iconErr(`Error HTTP ${res.status}`));
        return;
      }
      const data = await res.json();
      if (data.success) {
        show(ok, iconOk("Horario(s) guardado(s)."));
        setTimeout(()=> location.reload(), 800);
      } else {
        const errs = JSON.parse(data.errors || "{}");
        Object.entries(errs).forEach(([f,arr])=>
          arr.forEach(e=> fieldErr(f, e.message))
        );
      }
    } catch {
      show(err, iconErr("Error de red."));
    }
  });

})();
