/*  static/javascript/editar_empleado.js
    — mismo patrón que editar_usuario.js                              */
(() => {
  "use strict";

  /* ───────── helpers ───────── */
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const csrftoken =
    document.cookie.split(";").map(c => c.trim())
      .find(c => c.startsWith("csrftoken="))?.split("=")[1] || "";

  const iconErr = (txt) => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const iconOk  = (txt) => `<i class="fas fa-check-circle"></i> ${txt}`;

  const show = (el, html) => { el.innerHTML = html; el.style.display = "block"; };
  const hide = (el) => { el.style.display = "none"; el.innerHTML = ""; };

  /* ───────── refs ───────── */
  const form   = $("#empleadoForm");
  const okBox  = $("#success-message");
  const errBox = $("#error-message");          // ⟵ se usará solo en catch()

  const usrInp = $("#id_usuario_autocomplete");
  const usrHid = $("#id_usuarioid");
  const usrBox = $("#usuario-autocomplete-results");

  const sucInp = $("#id_sucursal_autocomplete");
  const sucHid = $("#id_sucursalid");
  const sucBox = $("#sucursal-autocomplete-results");

  /* ───────── UI reset ───────── */
  const resetUI = () => {
    hide(errBox); hide(okBox);
    $$(".field-error").forEach(d => { d.innerHTML=""; d.classList.remove("visible"); });
    $$(".input-error").forEach(i => i.classList.remove("input-error"));
  };

  const fieldErr = (name, msg) => {
    const div = $(`#error-id_${name}`);
    const inp = name === "usuarioid" ? usrInp
              : name === "sucursalid" ? sucInp
              : $(`#id_${name}`);
    if (div){ div.innerHTML = iconErr(msg); div.classList.add("visible"); }
    if (inp){ inp.classList.add("input-error"); }
  };

  /* ───────── autocomplete factory ───────── */
  function makeAuto({inp,hid,box,url,joinWith}){
    const state = {page:1, term:"", more:true, busy:false, timer:null, cache:Object.create(null)};

    const fetchData = (q,p=1) => {
      if (state.busy || !state.more) return;
      state.busy = true;
      const key  = `${q}_${p}`;
      const fetcher = state.cache[key]
        ? Promise.resolve(state.cache[key])
        : fetch(`${url}${joinWith}${encodeURIComponent(q)}&page=${p}`)
            .then(r=>r.json()).then(j=>(state.cache[key]=j,j));

      fetcher.then(data=>{
        if (p===1) box.innerHTML="";
        if (data.results.length){
          data.results.forEach(r=>{
            const d=document.createElement("div");
            d.className="autocomplete-option";
            d.dataset.id=r.id; d.textContent=r.text;
            box.appendChild(d);
          });
          state.more = data.has_more;
        }else if (p===1){
          box.innerHTML='<div class="autocomplete-no-result">Sin resultados</div>';
          state.more=false;
        }
        box.classList.add("visible");
      }).catch(console.error)
        .finally(()=>state.busy=false);
    };

    const debounced = () => {
      clearTimeout(state.timer);
      state.timer = setTimeout(()=>{ state.page=1; state.more=true; fetchData(state.term,1); },300);
    };

    inp.addEventListener("input", ()=>{ hid.value=""; state.term=inp.value.trim(); debounced(); });
    inp.addEventListener("focus", ()=>{ state.term=inp.value.trim(); state.page=1; state.more=true; fetchData(state.term,1); });
    box.addEventListener("scroll", ()=>{
      if (box.scrollTop+box.clientHeight>=box.scrollHeight-4 && state.more && !state.busy){
        state.page++; fetchData(state.term,state.page);
      }
    });
    box.addEventListener("click", e=>{
      const opt=e.target.closest(".autocomplete-option"); if(!opt) return;
      inp.value = opt.textContent; hid.value = opt.dataset.id;
      box.classList.remove("visible"); box.innerHTML=""; state.more=false;
    });
    document.addEventListener("click", e=>{
      if(!inp.contains(e.target) && !box.contains(e.target)){ box.classList.remove("visible"); box.innerHTML=""; }
    });
  }

  makeAuto({
    inp:usrInp, hid:usrHid, box:usrBox,
    url:usuarioAutocompleteUrl,
    joinWith: usuarioAutocompleteUrl.includes("?") ? "&term=" : "?term="
  });
  makeAuto({
    inp:sucInp, hid:sucHid, box:sucBox,
    url:sucursalAutocompleteUrl,
    joinWith:"?term="
  });

  /* ───────── submit ───────── */
  form.addEventListener("submit", async ev=>{
    ev.preventDefault();
    resetUI();

    /* validación rápida front-end */
    let bad=false;
    if(!usrHid.value){ fieldErr("usuarioid","Debe seleccionar un usuario.");  bad=true; }
    if(!sucHid.value){ fieldErr("sucursalid","Debe seleccionar una sucursal.");bad=true; }
    if(bad) return;                        // ⟵ NO se muestra errBox global

    try{
      const r = await fetch(form.action,{
        method:"POST",
        headers:{
          "X-CSRFToken":csrftoken,
          "X-Requested-With":"XMLHttpRequest",
          "Accept":"application/json"
        },
        body:new FormData(form)
      });
      const data = await r.json();

      if(data.success){
        sessionStorage.setItem(
          "flash-empleado",
          iconOk(`Empleado «${data.nombre}» actualizado correctamente.`)
        );
        location.href = data.redirect_url;
        return;
      }

      /* errores de validación Django */
      const errs = typeof data.errors === "string"
                   ? JSON.parse(data.errors)
                   : data.errors;
      for(const [f,arr] of Object.entries(errs))
        arr.forEach(e => fieldErr(f,e.message));
      /* SIN banner global */

    }catch(err){
      console.error(err);
      show(errBox, iconErr("Ocurrió un error inesperado."));   // sólo casos imprevistos
    }
  });
})();
