/* static/javascript/agregar_horario.js */
(() => {
  "use strict";

  /* ────── Helpers y refs ────── */
  const $   = s => document.querySelector(s);
  const $$  = s => document.querySelectorAll(s);
  const form= $("#horarioForm");
  const err = $("#error-message");
  const ok  = $("#success-message");

  const sucInp = $("#id_sucursal_autocomplete");
  const sucHid = $("#id_sucursalid");
  const sucBox = $("#sucursal-autocomplete-results");

  const dayBtns  = $$(".day-button");
  const diaInput = $("#id_dia_semana");         // hidden
  const apInput  = $("#id_horaapertura");
  const ciInput  = $("#id_horacierre");

  const tabla    = $("#horariosTabla");
  const hidJson  = $("#id_horarios");

  let cache     = Object.create(null);
  let state     = { term:"", page:1, more:true, loading:false };
  let tempItems = [];  // [{ dia, horaapertura, horacierre }]

  const iconErr = txt => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const iconOk  = txt => `<i class="fas fa-check-circle"></i> ${txt}`;
  const csrftoken = document.cookie.split(";")
                          .find(c=>c.trim().startsWith("csrftoken="))
                          ?.split("=")[1] || "";

  const show = (el, html) => { el.innerHTML=html; el.style.display="block"; };
  const hide = el => { el.style.display="none"; el.innerHTML=""; };

  function resetUI(){
    [err,ok].forEach(hide);
    $$(".field-error").forEach(d=>{ d.innerHTML=""; d.style.display="none"; });
    $$(".input-error").forEach(i=>i.classList.remove("input-error"));
  }
  function fieldErr(f,msg){
    const d = $(`#error-id_${f}`);
    if(d){ d.innerHTML=iconErr(msg); d.style.display="block"; }
    const inp = {
      sucursalid: sucInp,
      dia_semana: diaInput,
      horaapertura: apInput,
      horacierre: ciInput
    }[f] || $(`#id_${f}`);
    inp?.classList.add("input-error");
  }

  /* ────── Autocomplete Sucursal ────── */
  async function fetchSuc(term,pg=1){
    if(state.loading||!state.more) return;
    state.loading=true;
    const key=`${term}_${pg}`;
    let data=cache[key];
    if(!data){
      const url = `${sucursalAutocompleteUrl}?term=${encodeURIComponent(term)}&page=${pg}`;
      const res = await fetch(url);
      data = await res.json();
      cache[key]=data;
    }
    if(pg===1) sucBox.innerHTML="";
    if(data.results.length){
      data.results.forEach(r=>{
        const div=document.createElement("div");
        div.className="autocomplete-option";
        div.dataset.id=r.id;
        div.textContent=r.text;
        sucBox.append(div);
      });
      state.more=data.has_more;
    } else if(pg===1){
      sucBox.innerHTML=`<div class="autocomplete-no-result">Sin resultados</div>`;
      state.more=false;
    }
    sucBox.style.display="block";
    state.loading=false;
  }

  let timer;
  function debounce(fn,ms=300){
    clearTimeout(timer);
    timer=setTimeout(fn,ms);
  }

  sucInp.addEventListener("input", () => {
    sucHid.value=""; state.term=sucInp.value.trim(); state.page=1; state.more=true;
    debounce(()=>fetchSuc(state.term,1));
  });
  sucInp.addEventListener("focus", () => {
    state.term=sucInp.value.trim(); state.page=1; state.more=true;
    fetchSuc(state.term,1);
  });
  sucBox.addEventListener("scroll",()=>{
    if(sucBox.scrollTop+sucBox.clientHeight>=sucBox.scrollHeight-5
       && state.more && !state.loading){
      state.page++; fetchSuc(state.term,state.page);
    }
  });
  sucBox.addEventListener("click", e=>{
    const opt=e.target.closest(".autocomplete-option");
    if(!opt) return;
    sucInp.value=opt.textContent;
    sucHid.value=opt.dataset.id;
    sucBox.innerHTML="";
    sucBox.style.display="none";
    state.more=false;
  });
  document.addEventListener("click", e=>{
    if(!sucInp.contains(e.target)&&!sucBox.contains(e.target)){
      sucBox.style.display="none"; sucBox.innerHTML="";
    }
  });

  /* ────── Días de la semana ────── */
  dayBtns.forEach(btn=>{
    btn.addEventListener("click",()=>{
      let dias = diaInput.value.split(",").filter(d=>d);
      const d = btn.dataset.day;
      if(dias.includes(d)){
        dias = dias.filter(x=>x!==d);
        btn.classList.remove("active");
      } else {
        dias.push(d);
        btn.classList.add("active");
      }
      diaInput.value = dias.join(",");
    });
  });

  /* ────── Agregar horario temporal ────── */
  $("#btn-add-horario").addEventListener("click", ()=>{
    resetUI();
    const d = diaInput.value, ap=apInput.value, ci=ciInput.value;
    let bad=false;
    if(!sucHid.value){ fieldErr("sucursalid","Seleccione sucursal."); bad=true; }
    if(!d){ fieldErr("dia_semana","Seleccione al menos un día."); bad=true; }
    if(!ap){ fieldErr("horaapertura","Indique apertura."); bad=true; }
    if(!ci){ fieldErr("horacierre","Indique cierre."); bad=true; }
    if(ap && ci && ap>=ci){ fieldErr("horacierre","Cierre > apertura."); bad=true; }
    if(bad) return;

    d.split(",").forEach(day=>{
      const exists = tempItems.some(x=>
        x.dia===day && x.horaapertura===ap && x.horacierre===ci
      );
      if(!exists){
        tempItems.push({ dia:day, horaapertura:ap, horacierre:ci });
        const row = document.createElement("tr");
        row.innerHTML=`
          <td data-label="Día">${day}</td>
          <td data-label="Apertura">
            <input type="time" value="${ap}" readonly>
          </td>
          <td data-label="Cierre">
            <input type="time" value="${ci}" readonly>
          </td>
          <td data-label="Acciones">
            <button type="button" class="btn-eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        tabla.append(row);
        // desactivar botón de ese día
        dayBtns.forEach(b=>{
          if(b.dataset.day===day){ b.disabled=true; b.classList.remove("active"); }
        });
      }
    });

    diaInput.value=""; apInput.value=""; ciInput.value="";
  });

  /* ────── Eliminar horario temporal ────── */
  tabla.addEventListener("click", e=>{
    if(!e.target.closest(".btn-eliminar")) return;
    const tr  = e.target.closest("tr");
    const [day,inpA,inpC] = tr.querySelectorAll("td");
    const ap = inpA.querySelector("input").value;
    const ci = inpC.querySelector("input").value;
    tempItems = tempItems.filter(x=>
      !(x.dia===day.textContent && x.horaapertura===ap && x.horacierre===ci)
    );
    tr.remove();
    dayBtns.forEach(b=>{
      if(b.dataset.day===day.textContent) b.disabled=false;
    });
  });

  /* ────── Submit final ────── */
  form.addEventListener("submit", async ev=>{
    ev.preventDefault();
    resetUI();
    if(!sucHid.value){
      fieldErr("sucursalid","Seleccione sucursal."); return;
    }
    if(!tempItems.length){
      fieldErr("dia_semana","Agregue al menos un horario."); return;
    }
    hidJson.value = JSON.stringify(tempItems);
    const resp = await fetch(form.action, {
      method:"POST",
      headers: {
        "X-CSRFToken": csrftoken,
        "Accept": "application/json"
      },
      body: new FormData(form)
    });
    const data = await resp.json();

    if(data.success){
      show(ok, iconOk("Horarios guardados."));
      form.reset();
      tempItems = [];
      tabla.innerHTML="";
      dayBtns.forEach(b=>{ b.disabled=false; b.classList.remove("active"); });
      sucHid.value="";
      sucInp.value="";

      // — Limpiamos caché y estado —
      cache = Object.create(null);
      state = { term:"", page:1, more:true, loading:false };

      // — Ocultamos y vaciamos cualquier dropdown previo —
      sucBox.innerHTML = "";
      sucBox.style.display = "none";

    } else {
      const errs = JSON.parse(data.errors||"{}");
      Object.entries(errs).forEach(([f,arr])=>{
        arr.forEach(e=> fieldErr(f,e.message));
      });
    }
  });
})();
