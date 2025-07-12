/*  static/javascript/editar_usuario.js
    — misma estructura que editar_producto.js (sin jQuery) */
(() => {
  "use strict";

  /* ---------- helpers ---------- */
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const csrftoken =
    document.cookie.split(";").map(c => c.trim())
      .find(c => c.startsWith("csrftoken="))?.split("=")[1] || "";

  const iconErr = (txt) => `<i class="fas fa-exclamation-circle"></i> ${txt}`;
  const iconOk  = (txt) => `<i class="fas fa-check-circle"></i> ${txt}`;

  const show  = (el, html, flex = false) => { el.innerHTML = html; el.style.display = flex ? "flex" : "block"; };
  const hide  = (el) => { el.style.display = "none"; el.innerHTML = ""; };

  /* ---------- elementos ---------- */
  const form   = $("#usuarioForm");
  const okBox  = $("#success-message");
  const errBox = $("#error-message");

  const rolInput   = $("#id_rol_autocomplete");
  const rolHidden  = $("#id_rolid");
  const rolResult  = $("#rol-autocomplete-results");

  const userInput   = $("#id_nombreusuario");
  const passInput   = $("#id_contraseña");
  const confInput   = $("#id_confirmar_contraseña");

  /* ──────────── 1.  LIMPIAR UI ──────────── */
  const resetUI = () => {
    hide(errBox); hide(okBox);
    $$(".field-error").forEach(d => { d.innerHTML = ""; d.classList.remove("visible"); d.style.display = "none"; });
    $$(".input-error").forEach(i => i.classList.remove("input-error"));
  };

  const renderErrors = (errs = {}) => {
    if (errs.__all__)
      show(errBox, errs.__all__.map(e => iconErr(e.message)).join("<br>"));

    for (const [field,msgs] of Object.entries(errs)) {
      if (field === "__all__") continue;
      const div   = $(`#error-id_${field}`);
      const input = $(`#id_${field}`);
      if (div){
        div.innerHTML = msgs.map(e => iconErr(e.message)).join("<br>");
        div.classList.add("visible"); div.style.display = "block";
      }
      if (input) input.classList.add("input-error");
    }
  };

  /* ──────────── 2.  AUTOCOMPLETE ROL ──────────── */
  let page=1, term="", loading=false, more=true, timer;
  const fetchRoles = (q, p=1) => {
    if (loading || !more) return;
    loading = true;

    fetch(`${rolAutocompleteUrl}?term=${encodeURIComponent(q)}&page=${p}`)
      .then(r => r.json())
      .then(data => {
        if (p === 1) rolResult.innerHTML = "";

        if (data.results.length){
          data.results.forEach(r => {
            const div = document.createElement("div");
            div.className = "autocomplete-option";
            div.textContent = r.text;
            div.dataset.id = r.id;
            rolResult.appendChild(div);
          });
          more = data.has_more;
        } else if (p === 1){
          rolResult.innerHTML = '<div class="autocomplete-no-result">No se encontraron resultados</div>';
          more = false;
        }
        rolResult.classList.add("visible");
      })
      .catch(console.error)
      .finally(() => loading = false);
  };

  rolInput.addEventListener("input", () => {
    term = rolInput.value.trim();
    rolHidden.value = "";
    page = 1; more = true;
    clearTimeout(timer);
    timer = setTimeout(() => fetchRoles(term,1), 300);
  });

  rolInput.addEventListener("focus", () => {
    term = rolInput.value.trim();
    if (!term) return;
    page = 1; more = true;
    fetchRoles(term,1);
  });

  rolResult.addEventListener("scroll", () => {
    if (rolResult.scrollTop + rolResult.clientHeight >= rolResult.scrollHeight - 5){
      if (more && !loading){ page += 1; fetchRoles(term, page); }
    }
  });

  rolResult.addEventListener("click", e => {
    if (e.target.classList.contains("autocomplete-option")){
      rolInput.value  = e.target.textContent;
      rolHidden.value = e.target.dataset.id;
      rolResult.classList.remove("visible"); rolResult.innerHTML = "";
      more = false;
    }
  });

  document.addEventListener("click", e => {
    if (!rolInput.contains(e.target) && !rolResult.contains(e.target)){
      rolResult.classList.remove("visible");
      rolResult.innerHTML = "";
    }
  });

  /* ──────────── 3.  TOGGLE PASSWORD ──────────── */
  window.togglePassword = (id) => {
    const inp  = document.getElementById(id);
    if (!inp) return;
    const icon = inp.nextElementSibling;
    const isPw = inp.type === "password";
    inp.type   = isPw ? "text" : "password";
    icon.classList.toggle("fa-eye"       , !isPw);
    icon.classList.toggle("fa-eye-slash" ,  isPw);
  };

  /* ──────────── 4.  SUBMIT AJAX ──────────── */
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    resetUI();

    /* validación mínima (front) */
    let frontErr = false;
    if (!rolHidden.value){
      renderErrors({rolid:[{message:"Debe seleccionar un rol."}]});
      frontErr = true;
    }
    if (!userInput.value.trim()){
      renderErrors({nombreusuario:[{message:"El nombre de usuario es obligatorio."}]});
      frontErr = true;
    }
    if ((passInput.value || confInput.value) && passInput.value !== confInput.value){
      renderErrors({confirmar_contraseña:[{message:"Las contraseñas no coinciden."}]});
      frontErr = true;
    }
    if (frontErr) return;

    try{
      const resp = await fetch(form.action, {
        method:"POST",
        headers:{
          "X-CSRFToken"      : csrftoken,
          "X-Requested-With" : "XMLHttpRequest",
          "Accept"           : "application/json",
        },
        body: new FormData(form),
      });
      const data = await resp.json();

      if (data.success){
        /* flash-message en la lista */
        sessionStorage.setItem(
          "flash-usuario",
          iconOk(`Usuario «${data.nombre}» actualizado correctamente.`)
        );
        window.location.href = data.redirect_url;
        return;
      }
      /* errores de validación desde el servidor */
      renderErrors(typeof data.errors === "string" ? JSON.parse(data.errors) : data.errors);

    }catch(err){
      console.error(err);
      show(errBox, iconErr("Ocurrió un error inesperado."));
    }
  });
})();
