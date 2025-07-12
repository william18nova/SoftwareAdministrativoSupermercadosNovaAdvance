/*  static/javascript/agregar_empleado.js
    — Patrón y naming idénticos a agregar_precios_proveedor.js
------------------------------------------------------------------------ */
(() => {
  "use strict";

  /* ───────── helpers ───────── */
  const $  = q => document.querySelector(q);
  const $$ = q => document.querySelectorAll(q);

  const csrftoken =
    (document.cookie.split(";").map(c => c.trim())
      .find(c => c.startsWith("csrftoken=")) || "")
      .split("=")[1] || "";

  const iconErr = txt => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const show    = (el, html) => { el.innerHTML = html; el.style.display = "block"; };
  const hide    = el  => { el.style.display = "none"; el.innerHTML = ""; };

  /* ───────── refs DOM ───────── */
  const form      = $("#empleadoForm");

  const errBox    = $("#error-message");     // ← sólo para errores “graves”
  const okBox     = $("#success-message");

  const usrInp    = $("#id_usuario_autocomplete");
  const usrHid    = $("#id_usuarioid");
  const usrBox    = $("#usuario-autocomplete-results");

  const sucInp    = $("#id_sucursal_autocomplete");
  const sucHid    = $("#id_sucursalid");
  const sucBox    = $("#sucursal-autocomplete-results");

  /* ───────── UI reset ───────── */
  function resetUI () {
    hide(errBox); hide(okBox);

    $$(".field-error").forEach(d => {
      d.classList.remove("visible");
      d.innerHTML = "";
      d.style.display = "none";
    });
    $$(".input-error").forEach(i => i.classList.remove("input-error"));
  }

  function fieldErr(name, msg){
    const div = $(`#error-id_${name}`);
    const inp = name === "usuarioid" ? usrInp
              : name === "sucursalid" ? sucInp
              : $(`#id_${name}`);

    if (div){
      div.innerHTML     = iconErr(msg);
      div.classList.add("visible");
      div.style.display = "block";
    }
    if (inp) inp.classList.add("input-error");
  }

  /* ───────── Autocomplete factory ───────── */
  const cacheUsr = Object.create(null);
  const cacheSuc = Object.create(null);

  function makeAuto({inp, hid, box, url, cache}){
    const st = {page:1, term:"", more:true, busy:false, tmr:null};

    const fetchData = (q, p=1) => {
      if (st.busy || !st.more) return;
      st.busy = true;

      const key = `${q}_${p}`;
      const prom = cache[key]
        ? Promise.resolve(cache[key])
        : fetch(`${url}?term=${encodeURIComponent(q)}&page=${p}`)
            .then(r => r.json()).then(j => (cache[key] = j, j));

      prom.then(data => {
        if (p === 1) box.innerHTML = "";
        if (data.results.length){
          data.results.forEach(r => {
            const d = document.createElement("div");
            d.className   = "autocomplete-option";
            d.dataset.id  = r.id;
            d.textContent = r.text;
            box.appendChild(d);
          });
          st.more = data.has_more;
        }else if (p === 1){
          box.innerHTML = '<div class="autocomplete-no-result">Sin resultados</div>';
          st.more = false;
        }
        box.classList.add("visible");
        box.style.display = "block";
      }).finally(() => st.busy = false);
    };

    const deb = () => {
      clearTimeout(st.tmr);
      st.tmr = setTimeout(() => {
        st.page = 1; st.more = true;
        fetchData(st.term, 1);
      }, 300);
    };

    inp.addEventListener("input", () => {
      hid.value  = "";
      st.term    = inp.value.trim();
      deb();
    });

    inp.addEventListener("focus", () => {
      st.term = inp.value.trim();
      st.page = 1; st.more = true;
      fetchData(st.term, 1);
    });

    box.addEventListener("scroll", () => {
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4)
        if (st.more && !st.busy){ st.page++; fetchData(st.term, st.page); }
    });

    box.addEventListener("click", e => {
      const opt = e.target.closest(".autocomplete-option");
      if (!opt) return;
      inp.value  = opt.textContent;
      hid.value  = opt.dataset.id;
      box.classList.remove("visible");
      box.style.display = "none";
      /* limpiar cache de usuarios cuando vinculamos uno nuevo */
      if (hid === usrHid) Object.keys(cacheUsr).forEach(k => delete cacheUsr[k]);
    });

    document.addEventListener("click", e => {
      if (!inp.contains(e.target) && !box.contains(e.target)){
        box.classList.remove("visible");
        box.style.display = "none";
      }
    });
  }

  makeAuto({inp: usrInp, hid: usrHid, box: usrBox, url: usuarioAutocompleteUrl,  cache: cacheUsr});
  makeAuto({inp: sucInp, hid: sucHid, box: sucBox, url: sucursalAutocompleteUrl, cache: cacheSuc});

  /* ───────── submit ───────── */
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    resetUI();

    let bad = false;
    if (!usrHid.value){ fieldErr("usuarioid",  "Debe seleccionar un usuario.");  bad = true; }
    if (!sucHid.value){ fieldErr("sucursalid", "Debe seleccionar una sucursal."); bad = true; }
    if (bad) return;                              // ← sin alert global

    try{
      const r = await fetch(form.action, {
        method : "POST",
        headers: {
          "X-CSRFToken"     : csrftoken,
          "X-Requested-With": "XMLHttpRequest",
          "Accept"          : "application/json"
        },
        body : new FormData(form)
      });

      const data = await r.json();

      if (data.success){
        show(okBox, `<i class="fas fa-check-circle"></i> Empleado agregado correctamente.`);
        form.reset();
        usrHid.value = ""; sucHid.value = "";
        Object.keys(cacheUsr).forEach(k => delete cacheUsr[k]);
      } else {
        const errs = typeof data.errors === "string"
          ? JSON.parse(data.errors)
          : data.errors;
        for (const [f, arr] of Object.entries(errs))
          arr.forEach(e => fieldErr(f, e.message));
      }
    }catch(err){
      console.error(err);
      show(errBox, iconErr("Ocurrió un error inesperado."));   // ← sólo aquí usamos el alert global
    }
  });
})();
