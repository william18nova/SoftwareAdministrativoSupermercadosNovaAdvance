/*  editar_horario_caja.js
    ────────────────────────────────────────────────────────────────
    · Autocomplete de Sucursal y Punto de Pago
    · Selector de días (los botones quedan “bloqueados” cuando el día ya está en la tabla)
    · Tabla editable (añadir / quitar filas)
    · Envío AJAX (JSON) + flashes de éxito / error
    · Misma estructura & helpers que agregar_horario_caja.js
*/
(() => {
  "use strict";

  /* ══════════════ refs rápidas ══════════════ */
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const form  = $("#form-editar-horarios");
  const tabla = $("#tabla-horarios");

  /* → Autocomplete */
  const sucInp = $("#id_sucursal_autocomplete"),
        sucHid = $("#id_sucursalid"),
        sucBox = $("#sucursal-autocomplete-results");

  const ppInp  = $("#id_puntopago_autocomplete"),
        ppHid  = $("#id_puntopagoid"),
        ppBox  = $("#puntopago-autocomplete-results");

  /* valores “comprometidos” (lo que YA está vinculado al horario)  */
  let currentSucId = sucHid.value;   // ID de sucursal “actual”
  let currentPpId  = ppHid.value;    // ID de punto de pago “actual”

  /* → horario nuevo */
  const dayBtns = $$(".day-button"),
        apInp   = $("#horaapertura"),
        ciInp   = $("#horacierre");

  /* → flashes / errores */
  const err = $("#error-message"),
        ok  = $("#success-message");

  const csrftoken = document.querySelector("[name=csrfmiddlewaretoken]").value;
  const iconErr   = t => `<i class="fas fa-exclamation-circle"></i> ${t}`;
  const iconOk    = t => `<i class="fas fa-check-circle"></i> ${t}`;
  const show      = (el,html)=>{ el.innerHTML = html; el.style.display = "block"; };
  const hide      = el        =>{ el.style.display = "none"; el.innerHTML = ""; };

  const fieldErr = (f,m) => {
    const div = $(`#error-id_${f}`);
    div ? show(div, iconErr(m)) : show(err, iconErr(m));
  };
  const resetUI = () => {
    [err, ok].forEach(hide);
    $$(".field-error").forEach(hide);
  };

  /* ══════════════ helper → congela / libera los botones de día ══════════════ */
  const order = ["Lun","Mar","Mie","Jue","Vie","Sab","Dom"];
  function syncDayButtons () {
    dayBtns.forEach(b => {
      const d = b.dataset.day;
      const exists = !!tabla.querySelector(`tr[data-dia="${d}"]`);
      b.disabled = exists;
      b.classList.remove("active");
    });
    [...tabla.querySelectorAll("tr[data-dia]")]
      .sort((a,b)=> order.indexOf(a.dataset.dia) - order.indexOf(b.dataset.dia))
      .forEach(tr => tabla.appendChild(tr));
  }
  syncDayButtons();               // primera sincronización

  /* ══════════════ GENERADOR genérico de autocomplete ══════════════ */
  function makeAutocomplete (inp, hid, box, url, extraParams, onSelect) {
    let cache={}, state={term:"", pg:1, more:true, loading:false};
    const deb=(fn,ms=300)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);}};

    async function fetcher (term, pg=1) {
      if(state.loading||!state.more) return;
      state.loading=true;

      const key = `${term}_${pg}_${JSON.stringify(extraParams&&extraParams())}`;
      let data  = cache[key];
      if(!data){
        const qs  = new URLSearchParams({term,page:pg});
        if(extraParams) Object.entries(extraParams()).forEach(([k,v])=>qs.append(k,v));
        data = await fetch(`${url}?${qs}`).then(r=>r.json());
        cache[key]=data;
      }

      if(pg===1) box.innerHTML="";
      if(data.results.length){
        data.results.forEach(r=>{
          box.insertAdjacentHTML("beforeend",
            `<div class="autocomplete-option" data-id="${r.id}">${r.text}</div>`);
        });
        state.more=data.has_more;
      }else if(pg===1){
        box.innerHTML=`<div class="autocomplete-no-result">Sin resultados</div>`;
        state.more=false;
      }
      box.style.display="block";
      state.loading=false;
    }
    const debFetch=deb(fetcher,300);

    inp.addEventListener("input",()=>{
      hid.value="";
      state={term:inp.value.trim(), pg:1, more:true, loading:false};
      debFetch(state.term,1);
    });
    inp.addEventListener("focus",()=>{
      state={term:inp.value.trim(), pg:1, more:true, loading:false};
      fetcher(state.term,1);
    });
    box.addEventListener("scroll",()=>{
      if(box.scrollTop+box.clientHeight>=box.scrollHeight-5 && state.more && !state.loading){
        state.pg++; fetcher(state.term,state.pg);
      }
    });
    box.addEventListener("click",e=>{
      const opt=e.target.closest(".autocomplete-option");
      if(!opt) return;
      inp.value=opt.textContent;
      hid.value=opt.dataset.id;
      box.innerHTML=""; box.style.display="none"; state.more=false;

      onSelect && onSelect(opt.dataset.id);   // callback al seleccionar
    });
    document.addEventListener("click",e=>{
      if(!inp.contains(e.target)&&!box.contains(e.target)) box.style.display="none";
    });
  }

  /* → Sucursal */
  makeAutocomplete(
    sucInp, sucHid, sucBox,
    sucursalAutocompleteUrl,
    () => ({ actual_id: currentSucId }),
    newId => {
      currentSucId = newId;
      ppInp.value=""; ppHid.value=""; currentPpId=""; ppBox.innerHTML="";
    }
  );

  /* → Punto de Pago */
  makeAutocomplete(
    ppInp, ppHid, ppBox,
    puntopagoAutocompleteUrl,
    () => ({
      sucursal_id: currentSucId,
      actual_id  : currentPpId
    }),
    newId => { currentPpId = newId; }
  );

  /* ══════════════ selector de días ══════════════ */
  dayBtns.forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(btn.disabled) return;
      btn.classList.toggle("active");
    });
  });

  /* ══════════════ Agregar fila ══════════════ */
  $("#btn-agregar-horario").addEventListener("click",()=>{
    resetUI();

    if(!sucHid.value.trim()) fieldErr("sucursalid","Seleccione sucursal.");
    if(!ppHid.value.trim())  fieldErr("puntopagoid","Seleccione punto de pago.");

    const dias = [...dayBtns].filter(b=>b.classList.contains("active")).map(b=>b.dataset.day);
    if(!dias.length) fieldErr("dia_semana","Seleccione al menos un día.");
    if(!apInp.value) fieldErr("horaapertura","Indique apertura.");
    if(!ciInp.value) fieldErr("horacierre","Indique cierre.");
    if(apInp.value && ciInp.value && apInp.value>=ciInp.value){
      fieldErr("horacierre","Cierre debe ser mayor.");
      return;
    }
    if(!sucHid.value.trim()||!ppHid.value.trim()||!dias.length||!apInp.value||!ciInp.value) return;

    dias.forEach(d=>{
      if(tabla.querySelector(`tr[data-dia="${d}"]`)) return;
      tabla.insertAdjacentHTML("beforeend",`
        <tr data-dia="${d}">
          <td data-label="Día">${d}</td>
          <td data-label="Apertura"><input type="time" value="${apInp.value}" readonly></td>
          <td data-label="Cierre"><input type="time"  value="${ciInp.value}" readonly></td>
          <td data-label="Acciones">
            <button type="button" class="btn-eliminar"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`);
    });
    apInp.value=""; ciInp.value="";
    syncDayButtons();
  });

  /* ══════════════ eliminar fila ══════════════ */
  tabla.addEventListener("click",e=>{
    const del=e.target.closest(".btn-eliminar");
    if(!del) return;
    del.closest("tr").remove();
    syncDayButtons();
  });

  /* ══════════════ submit AJAX JSON ══════════════ */
  form.addEventListener("submit",async ev=>{
    ev.preventDefault(); resetUI();

    if(!sucHid.value.trim()){ fieldErr("sucursalid","Seleccione sucursal."); return; }
    if(!ppHid.value.trim()){  fieldErr("puntopagoid","Seleccione punto de pago."); return; }

    const rows=[...tabla.querySelectorAll("tr[data-dia]")];
    if(!rows.length){ fieldErr("dia_semana","No hay horarios listados."); return; }

    /* ←––– CLAVES SIN GUION BAJO –––→ */
    const horarios=rows.map(r=>({
      dia         : r.dataset.dia,
      horaapertura: r.querySelectorAll("input")[0].value,
      horacierre  : r.querySelectorAll("input")[1].value
    }));

    try{
      const res=await fetch(form.action,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "X-CSRFToken":csrftoken,
          "Accept":"application/json"
        },
        body:JSON.stringify({
          sucursalid : sucHid.value.trim(),
          puntopagoid: ppHid.value.trim(),
          horarios
        })
      });
      if(!res.ok){ show(err,iconErr(`HTTP ${res.status}`)); return; }

      const data=await res.json();
      if(data.success){
        show(ok,iconOk("Horarios actualizados."));
        setTimeout(()=>location.href="/visualizar_horarios_cajas/",800);
      }else if(data.errors){
        const errs=JSON.parse(data.errors);
        Object.entries(errs).forEach(([f,arr])=>arr.forEach(e=>fieldErr(f,e.message)));
      }else{
        show(err,iconErr(data.error||"Error desconocido."));
      }
    }catch(ex){
      console.error(ex);
      show(err,iconErr("Error de red."));
    }
  });

})();
