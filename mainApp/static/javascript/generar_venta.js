// static/javascript/generar_venta.js
$(function () {
  "use strict";
  const $ = window.jQuery;

  console.log("⚡ generar_venta.js — instant add + live pricing bg + AC ultra + snapshot L1 + ID search + anti-zero + burst last-only (60ms) + anti-scanner + atajos + modal + POS Agent");

  /* ================== URLs inyectadas ================== */
  const SUCURSAL_URL   = window.sucursalAutocompleteUrl;
  const PUNTOPAGO_URL  = window.puntopagoAutocompleteUrl;
  const CLIENTE_URL    = window.clienteAutocompleteUrl;
  const PRODUCTO_URL   = window.productoAutocompleteUrl;
  const AC_CODIGO_URL  = window.productoAutocompleteCodigoUrl || PRODUCTO_URL;
  const AC_BARRAS_URL  = window.productoAutocompleteBarrasUrl || PRODUCTO_URL;
  const VERIFICAR_URL  = window.verificarProductoUrl;
  const POR_COD_URL    = window.buscarProductoPorCodigoUrl;
  const SNAPSHOT_URL   = window.productoSnapshotUrl || "/api/productos/snapshot/";

  /* ================== Agente local ================== */
  const POS_AGENT_URL   = (window.POS_AGENT_URL || "http://127.0.0.1:8787").replace(/\/+$/,'');
  const POS_AGENT_TOKEN = (window.POS_AGENT_TOKEN || "").trim();

  /* ================== Selectores ================== */
  const $inpCliente = $("#cliente_busqueda");
  const $inpNombre  = $("#producto_busqueda_nombre");
  const $inpCode    = $("#codigo_o_barras");
  const $pid        = $("#producto_id");
  const $cantidad   = $("#cantidad");
  const $agregar    = $("#agregar-producto");
  const $tbody      = $("#detalle-productos tbody");
  const $totalEl    = $("#total");
  const $buscarCart = $("#buscar-detalles");
  const $btnVaciar  = $("#vaciar-carrito");

  /* ================== CSRF / Ajax ================== */
  $.ajaxSetup({
    beforeSend: (xhr, settings) => {
      if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type)) {
        const m = document.cookie.match(/csrftoken=([^;]+)/);
        if (m) xhr.setRequestHeader("X-CSRFToken", m[1]);
      }
    },
    cache: true,
  });

  /* ================== Utils ================== */
  const money = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" })
    .format(Number(n) || 0);
  const onlyDigits = (s) => String(s||"").replace(/\D+/g, "");
  const norm = (s)=> (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  const onlyName = (s) => {
    s = String(s || "").trim();
    s = s.replace(/^[\s•·\-\u2013\u2014:|.,;]+/, "");
    let m;
    const rx = /^\s*(?:\[\s*)?([A-Za-z0-9._-]{3,}|\d{6,})(?:\s*\])?\s*(?:-|–|—|:|\|)\s*(.*)$/;
    while ((m = s.match(rx))) s = (m[2] || "").trim();
    const m2 = s.match(/^\s*\d{6,}\s+(.+)$/);
    if (m2) s = m2[1].trim();
    s = s.replace(/^[\s•·\-\u2013\u2014:|.,;]+/, "");
    return s;
  };
  const clampQty = (x) => {
    const n = parseInt(String(x).replace(/\D+/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };
  const now = () => Date.now();

  /* ================== Estado persistido ================== */
  let sucursalID = (localStorage.getItem("sucursalID") || "").toString().match(/\d+/)?.[0] || "";
  const savedPunto = {
    id:  localStorage.getItem("puntopagoID") || "",
    name:localStorage.getItem("puntopagoName") || "",
    suc: localStorage.getItem("puntopagoSucursalID") || ""
  };
  const hasSucursal = () => /^\d+$/.test(String(sucursalID || ""));

  /* ================== Estado venta ================== */
  const productos  = []; // array de strings (pid)
  const cantidades = []; // array de números
  let runningTotal = 0;
  let lastAddedPid = null;

  // Defer pesados (serialize) al idle
  const defer = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 150 }) : setTimeout(fn, 0));

  function syncHiddenFields() {
    defer(() => {
      $("#productos").val(JSON.stringify(productos));
      $("#cantidades").val(JSON.stringify(cantidades));
    });
  }

  function setTotal(v) {
    const safe = Math.max(0, Number(v) || 0);
    runningTotal = safe;
    $totalEl.text(money(safe));
    syncHiddenFields();
  }
  function addToTotal(delta) {
    setTotal((Number(runningTotal) || 0) + (Number(delta) || 0));
  }

  /* ================== Cache producto ================== */
  const FRESH_MS = 120000;
  const productCache = new Map(); // pid -> {nombre, barcode, price, stock, ts}
  const barcodeIndex = new Map(); // barcode -> pid
  const nameIndex    = new Map(); // name(lc) -> pid
  function updateCache(pid, data = {}) {
    const key = String(pid);
    const prev = productCache.get(key) || {};
    const normalizePrice = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const rec = {
      nombre: onlyName(data.nombre ?? prev.nombre ?? ""),
      barcode: data.codigo_de_barras ?? data.barcode ?? prev.barcode ?? "",
      price: normalizePrice(data.precio_unitario ?? data.price ?? prev.price),
      stock: data.cantidad_disponible ?? data.stock ?? prev.stock,
      ts: data.ts || now(),
    };
    productCache.set(key, rec);
    if (rec.barcode) barcodeIndex.set(rec.barcode, key);
    if (rec.nombre) nameIndex.set(rec.nombre.toLowerCase(), key);
    return rec;
  }

  /* ================== Catálogo Snapshot L1 ================== */
  const catalogBySucursal = new Map();
  const catalogTS = new Map();
  const CATALOG_TTL_MS = 5 * 60 * 1000;

  function hydrateFromCatalog(items){
    for (const p of items) {
      updateCache(p.id, { nombre:p.name, barcode:p.barcode, precio_unitario:p.price, cantidad_disponible:p.stock });
    }
  }
  function buildPreIndexFor(sid, items){
    const idx = { names: [], codes: [], map:new Map() };
    for (const p of items) {
      const id = p.id;
      const nname = norm(p.name || "");
      const nbarcode = p.barcode ? onlyDigits(p.barcode) : "";
      idx.names.push({ id, nname, label:p.name||"", price:p.price, stock:p.stock, barcode:p.barcode||"" });
      idx.codes.push({ id, nbarcode, label: p.barcode || p.name || "", price:p.price, stock:p.stock });
      idx.map.set(String(id), { id, name:p.name||"", barcode:p.barcode||"", price:p.price, stock:p.stock });
    }
    preIndex.set(sid, idx);
  }
  function loadCatalogFromLocalStorage(sid) {
    try {
      const raw = localStorage.getItem(`catalog_${sid}`);
      const ts  = Number(localStorage.getItem(`catalog_${sid}_ts`)||0);
      if (!raw) return false;
      if (now()-ts > CATALOG_TTL_MS) return false;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return false;
      catalogBySucursal.set(sid, arr);
      catalogTS.set(sid, ts);
      hydrateFromCatalog(arr);
      buildPreIndexFor(sid, arr);
      return true;
    } catch { return false; }
  }
  async function fetchCatalogSnapshot(sid) {
    const url = SNAPSHOT_URL + "?" + new URLSearchParams({ sucursal_id: sid });
    const r = await fetch(url);
    if (!r.ok) throw new Error("snapshot HTTP " + r.status);
    const d = await r.json();
    const items = Array.isArray(d.results) ? d.results : [];
    catalogBySucursal.set(sid, items);
    catalogTS.set(sid, now());
    try {
      localStorage.setItem(`catalog_%${sid}`.replace("%",""), JSON.stringify(items)); // robusto ante %
      localStorage.setItem(`catalog_${sid}_ts`, String(now()));
    } catch {}
    hydrateFromCatalog(items);
    buildPreIndexFor(sid, items);
    return items;
  }
  async function ensureCatalog(sid, {force=false}={}) {
    if (!sid) return [];
    if (!force && catalogBySucursal.has(sid)) return catalogBySucursal.get(sid) || [];
    if (!force && loadCatalogFromLocalStorage(sid)) return catalogBySucursal.get(sid) || [];
    try { return await fetchCatalogSnapshot(sid); }
    catch { return catalogBySucursal.get(sid) || []; }
  }

  /* ================== Índices de búsqueda local ================== */
  const preIndex = new Map(); // sid -> {names:[...], codes:[...], map: Map(id->ref)}

  /* ================== Precio en vivo (ignora caché) ================== */
  function ensureLivePrice(pid) {
    // No bloquear: devolver promesa pero sin await en flujos críticos
    return $.post(VERIFICAR_URL, { producto_id: pid, cantidad: 1, sucursal_id: sucursalID, _ts: Date.now() })
      .then((r) => {
        if (!r || !r.exists) return null;
        const rec = updateCache(pid, r);
        const price = Number(rec.price ?? r.precio_unitario ?? r.precio);
        if (!Number.isFinite(price) || price <= 0) return null;
        return price;
      })
      .catch(() => null);
  }
  function refreshRowPriceIfNeeded($row) {
    const pid = String($row.data("pid") || "");
    return ensureLivePrice(pid).then((live) => {
      if (!Number.isFinite(live) || live <= 0) return false;
      const old = Number($row.data("price")) || 0;
      const qty = Number($row.attr("data-qty")) || Number($row.find(".qty-input").val()) || 1;
      $row.attr("data-price", live).data("price", live).removeClass("pending-price");
      $row.find(".price-cell").text(money(live));
      $row.find(".subtotal-cell").text(money(live * qty));
      if (!$row.data("counted")) {
        addToTotal(live * qty);
        $row.data("counted", true);
      } else if (old && old !== live) {
        addToTotal((live - old) * qty);
      }
      return true;
    });
  }

  /* ================== Inserción instantánea + “pending price” ================== */
  function buildRowHTML(pid, qty, name, cachedPrice) {
    const hasPrice = Number.isFinite(cachedPrice) && cachedPrice > 0;
    const subtotalTxt = hasPrice ? money(cachedPrice * qty) : "…";
    const priceTxt    = hasPrice ? money(cachedPrice) : "—";
    const pendingCls  = hasPrice ? "" : "pending-price";
    return (
      `<tr data-pid="${pid}" data-price="${hasPrice ? cachedPrice : 0}" data-qty="${qty}" class="${pendingCls}">
         <td>${onlyName(name)}</td>
         <td><input type="number" class="qty-input" min="1" inputmode="numeric" pattern="\\d*" value="${qty}" /></td>
         <td class="price-cell">${priceTxt}</td>
         <td class="subtotal-cell">${subtotalTxt}</td>
         <td class="text-center">
           <button class="btn btn-chip-danger eliminar-producto" title="Eliminar">
             <i class="fas fa-trash-alt"></i><span>Eliminar</span>
           </button>
         </td>
       </tr>`
    );
  }

  function insertOrUpdateRowInstant(pid, qty, name, cachedPrice) {
    const key = String(pid);
    const idx = productos.indexOf(key);
    const hasPrice = Number.isFinite(cachedPrice) && cachedPrice > 0;

    if (idx > -1) {
      // actualizar existente rápido y sin relayouts excesivos
      cantidades[idx] += qty;
      const $r = $tbody.find(`tr[data-pid='${pid}']`);
      const newQty = cantidades[idx];
      $r.attr("data-qty", newQty);
      const $qin = $r.find(".qty-input");
      if ($qin.length) $qin[0].value = newQty;
      const price = Number($r.data("price")) || 0;
      if (price > 0) {
        $r.find(".subtotal-cell").text(money(price * newQty));
        addToTotal(price * qty);
      }
    } else {
      productos.push(key);
      cantidades.push(qty);
      // Insertar con DOM nativo (más rápido que prepend jQuery)
      const html = buildRowHTML(pid, qty, name, cachedPrice);
      const tmpl = document.createElement("tbody");
      tmpl.innerHTML = html.trim();
      const row = tmpl.firstChild;
      $tbody[0].insertBefore(row, $tbody[0].firstChild || null);

      if (hasPrice) {
        addToTotal(cachedPrice * qty);
        $(row).data("counted", true);
      } else {
        $(row).data("counted", false);
      }
    }
  }

  /* ================== Agregado con “burst last-only” ================== */
  const lastAddGuard = { pid: null, ts: 0 };
  function addToCartGuarded(pid, qty = 1) {
    const ts = now();
    if (String(lastAddGuard.pid) === String(pid) && (ts - lastAddGuard.ts) < 250) return;
    lastAddGuard.pid = String(pid);
    lastAddGuard.ts  = ts;
    addToCart(pid, qty);
  }

  const burstAdd = { timer: null, last: null, windowMs: 60 }; // 60ms: súper reactivo
  function addToCartLastOnly(pid, qty = 1) {
    if (!pid || !qty || qty < 1) return;
    burstAdd.last = { pid: String(pid), qty: Number(qty) || 1 };
    if (burstAdd.timer) clearTimeout(burstAdd.timer);
    burstAdd.timer = setTimeout(() => {
      burstAdd.timer = null;
      const { pid: p, qty: q } = burstAdd.last || {};
      addToCartGuarded(p, q);
    }, burstAdd.windowMs);
  }

  function addToCart(pid, qty = 1) {
    if (!pid || qty < 1) return;
    const key    = String(pid);
    const cached = productCache.get(key) || {};
    const name   = cached.nombre || `Producto ${pid}`;
    const cPrice = Number(cached.price) || 0;

    // 1) Inserción instantánea (sin bloquear)
    insertOrUpdateRowInstant(pid, qty, name, cPrice);

    // 2) Precio en vivo en segundo plano + ajuste total
    queueMicrotask(() => {
      refreshRowPriceIfNeeded($tbody.find(`tr[data-pid='${pid}']`));
    });

    // Limpieza UX no bloqueante
    lastAddedPid = key;
    $inpNombre.val("");
    $inpCode.val("");
    $pid.val("");
    $cantidad.val(1);
    queueMicrotask(() => { if ($inpCode.is(":visible")) { $inpCode.focus(); $inpCode[0]?.select?.(); } });
  }

  /* ================== Resolutores rápidos ================== */
  function resolveByProductId(pid) {
    if (!pid) return Promise.resolve(null);
    return $.post(VERIFICAR_URL, { producto_id: pid, cantidad: 1, sucursal_id: sucursalID, _ts: Date.now() })
      .then((r) => {
        if (!r || !r.exists) return null;
        const rec = updateCache(pid, r);
        setProductFields({ nombre: rec.nombre, pid, barcode: rec.barcode });
        return pid;
      })
      .catch(() => null);
  }
  function resolveByBarcode(code) {
    if (!code) return Promise.resolve(null);
    const cachedPid = barcodeIndex.get(code);
    if (cachedPid) {
      setProductFields({ nombre: productCache.get(String(cachedPid))?.nombre, pid: cachedPid, barcode: code });
      return Promise.resolve(cachedPid);
    }
    const params = { codigo_de_barras: code, sucursal_id: sucursalID, _ts: Date.now() };
    return $.getJSON(POR_COD_URL, params)
      .then((r) => {
        if (!r || !r.exists) return null;
        const p = r.producto || {};
        updateCache(p.id, { nombre:p.nombre, barcode:p.codigo_de_barras, precio_unitario:p.precio, cantidad_disponible:p.stock });
        setProductFields({ nombre: p.nombre, pid: p.id, barcode: p.codigo_de_barras });
        return p.id;
      })
      .catch(() => null);
  }
  function setProductFields({ nombre, pid, barcode }) {
    if (nombre != null)  $inpNombre.val(onlyName(nombre));
    if (pid != null)     $pid.val(pid);
    if (barcode != null) $inpCode.val(barcode);
    if ($pid.val()) {
      $cantidad.prop("disabled", false);
      $agregar.prop("disabled", false);
      queueMicrotask(()=>{ if ($cantidad.is(":visible")) { $cantidad.focus().select(); } });
    }
  }

  /* ================== Infra autocomplete ================== */
  class LRU {
    constructor(max=200){ this.max=max; this.map=new Map(); }
    get(k){ if(!this.map.has(k)) return null; const v=this.map.get(k); this.map.delete(k); this.map.set(k,v); return v; }
    set(k,v){ if(this.map.has(k)) this.map.delete(k); this.map.set(k,v); if(this.map.size>this.max){ const f=this.map.keys().next().value; this.map.delete(f);} }
  }
  const termCacheName = new LRU(200);
  const termCacheCode = new LRU(200);

  function attachAltEnterBypass(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("keydown", function(e){
      if (e.key === "Enter" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        $(inputEl).data("skipAcSelectOnce", true);
        try { $(inputEl).autocomplete("close"); } catch (_){}
      }
    }, true);
  }
  function blockNavOpenWhenEmpty($inp, minChars) {
    $inp.on("keydown", function(e){
      const navKeys = ["ArrowDown","ArrowUp","PageDown","PageUp","Home","End"];
      if (!navKeys.includes(e.key)) return;
      const v = this.value || "";
      if (v.length < minChars) {
        try { $inp.autocomplete("close"); } catch {}
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      }
    });
  }
  function throttle(fn, ms=45){ // 45ms: más ágil
    let t=0, lastArgs=null, lastThis=null, timer=null;
    return function(...args){
      const ts=Date.now(); lastArgs=args; lastThis=this;
      const run=()=>{ timer=null; t=ts; fn.apply(lastThis,lastArgs); };
      if (!t || ts-t>=ms){ run(); } else { if (!timer) timer=setTimeout(run, ms-(ts-t)); }
    };
  }
  function createAC({ $inp, sourceFn, onSelect, openIfEmpty=false, enableInstantSearch=true, minChars=1 }) {
    attachAltEnterBypass($inp[0]);
    $inp.autocomplete({
      minLength: minChars, delay: 0, autoFocus: true, appendTo: "body",
      position:{ my:"left top+6", at:"left bottom", collision:"flipfit" },
      source: sourceFn,
      open(){ $inp.autocomplete("widget").css("z-index", 3000); },
      select(_e, ui){
        if ($inp.data("skipAcSelectOnce")) { $inp.data("skipAcSelectOnce", false); return false; }
        if (!ui || !ui.item) return false;
        onSelect?.(ui.item);
        return false;
      }
    });
    $inp.on("focus", function(){
      const v = this.value || "";
      if (v.length < minChars && !openIfEmpty) { try { $inp.autocomplete("close"); } catch {} return; }
      $inp.autocomplete("search", v);
    });
    if (enableInstantSearch) {
      let raf = null;
      $inp.on("input", function(){
        const v = this.value || "";
        if (v.length < minChars && !openIfEmpty) { try { $inp.autocomplete("close"); } catch {} return; }
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(()=> $inp.autocomplete("search", v));
      });
    }
    blockNavOpenWhenEmpty($inp, openIfEmpty ? 0 : minChars);
  }

  /* === Render con precio en opciones === */
  function applyPriceTemplate($inp, {mode="name"} = {}) {
    const inst = $inp.autocomplete("instance");
    if (!inst) return;
    inst._renderItem = function(ul, item) {
      const name = (item.name || item.label || item.value || "").toString();
      const left = (mode === "code" && item.barcode)
        ? `<span class="ac-code">${item.label}</span><span class="ac-sep"> — </span><span class="ac-name">${name}</span>`
        : `<span class="ac-name">${name}</span>`;
      const priceNum = Number(item.price);
      const right = (Number.isFinite(priceNum) && priceNum > 0) ? `<span class="ac-price">${money(priceNum)}</span>` : "";
      const $li = $("<li>");
      const $content = $( `<div class="ac-row"><div class="ac-left">${left}</div><div class="ac-right">${right}</div></div>` );
      return $li.append($content).appendTo(ul);
    };
  }
  (function injectACStyles(){
    const css =
`.ui-autocomplete .ac-row{display:flex;align-items:center;justify-content:space-between;gap:.75rem;max-width:72ch}
.ui-autocomplete .ac-left{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ui-autocomplete .ac-code{opacity:.8}
.ui-autocomplete .ac-name{font-weight:500}
.ui-autocomplete .ac-price{opacity:.85}
.pending-price .price-cell{opacity:.6}
.pending-price .subtotal-cell{opacity:.6}`;
    const id = "ac-price-style";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id; tag.textContent = css; document.head.appendChild(tag);
    }
  })();

  /* ============ Búsquedas ultra-rápidas (red) ============ */
  const netSearchName = throttle(async (term, signal) => {
    const url = PRODUCTO_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID, limit: 40 });
    const r = await fetch(url, { signal }).catch(()=>null);
    if (!r || !r.ok) return [];
    const d = await r.json().catch(()=>({results:[]}));
    return (d.results||[]).map(p => ({ id:p.id, name:p.text, label:p.text, value:p.text, price:p.precio, stock:p.stock }));
  }, 45);

  const netSearchCode = throttle(async (term, signal) => {
    const [dCod, dBar] = await Promise.all([
      fetch(AC_CODIGO_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID, limit: 25 }), { signal }).then(r=> r && r.ok ? r.json() : {results:[]}).catch(()=>({results:[]})),
      fetch(AC_BARRAS_URL + "?" + new URLSearchParams({ term, sucursal_id: sucursalID, limit: 25 }), { signal }).then(r=> r && r.ok ? r.json() : {results:[]}).catch(()=>({results:[]})),
    ]);
    const net = [];
    const seen = new Set();
    const push = (p, preferBarcode=false) => {
      const lbl = preferBarcode ? (p.barcode||p.codigo_de_barras||p.text||String(p.id)) : (p.text||String(p.id));
      const k = String(p.id)+"::"+(p.barcode||p.codigo_de_barras||"");
      if (seen.has(k)) return;
      seen.add(k);
      net.push({ id:p.id, name:p.text||"", label:lbl, value:lbl, barcode:(p.barcode||p.codigo_de_barras||""), price:p.precio, stock:p.stock });
    };
    (dBar.results||[]).forEach(p=> push(p, true));
    (dCod.results||[]).forEach(p=> push(p, false));
    return net;
  }, 45);

  let inflightNameAC = null;
  let inflightCodeAC = null;
  let autoPickGuardTS = 0;

  function maybeAutoPickBarcode(term, items){
    const qdigits = onlyDigits(term);
    const isBarcodeQuery = /^\d{6,}$/.test(qdigits);
    if (!isBarcodeQuery || !hasSucursal() || !Array.isArray(items) || items.length !== 1) return;
    const ts = Date.now();
    if (ts - autoPickGuardTS < 250) return;
    autoPickGuardTS = ts;
    const item = items[0];
    updateCache(item.id, { nombre:item.name||item.value, barcode:item.barcode, precio_unitario:item.price, cantidad_disponible:item.stock });
    setProductFields({ nombre:item.name||item.value, pid:item.id, barcode:item.barcode||item.label });
    try { $inpCode.autocomplete("close"); } catch {}
    addToCartLastOnly(item.id, 1);
  }

  /* ================== Fuentes de AC (local + red) ================== */
  function sourceUltraFastName(req, resp){
    (async ()=>{
      const term = (req.term||"").trim();
      const q = norm(term);
      if (q.length < 1 || !hasSucursal()) { resp([]); return; }

      const cacheKey = `${sucursalID}|name|${q}`;
      const cached = termCacheName.get(cacheKey);
      if (cached) { resp(cached); return; }

      const idx = preIndex.get(sucursalID);
      let locals = [];

      // por ID directo
      if (/^\d+$/.test(term)) {
        let idItem = null;
        if (idx) {
          const ref = idx.map.get(String(term));
          if (ref) idItem = { id:ref.id, name:ref.name, label:`[ID ${ref.id}] ${ref.name}`, value:ref.name, price:ref.price, stock:ref.stock };
        }
        if (!idItem) {
          try {
            const r = await $.post(VERIFICAR_URL, { producto_id: term, cantidad: 1, sucursal_id: sucursalID, _ts: Date.now() });
            if (r && r.exists) {
              updateCache(r.id, r);
              idItem = { id:r.id, name:r.nombre, label:`[ID ${r.id}] ${r.nombre}`, value:r.nombre, price:r.precio_unitario ?? r.precio, stock:r.cantidad_disponible ?? r.stock };
            }
          } catch {}
        }
        if (idItem) {
          locals.push(idItem);
          updateCache(idItem.id, { nombre:idItem.name, precio_unitario:idItem.price, cantidad_disponible:idItem.stock });
        }
      }

      if (idx) {
        const pref = idx.names.filter(x=> x.nname.startsWith(q)).slice(0, 40);
        const sub  = idx.names.filter(x=> !x.nname.startsWith(q) && x.nname.includes(q)).slice(0, 40);
        const mapped = pref.concat(sub).map(x=>({ id:x.id, name:x.label, label:x.label, value:x.label, price:x.price, stock:x.stock })).slice(0, 40);
        const seen = new Set(locals.map(x=>String(x.id)));
        for (const it of mapped) { if (!seen.has(String(it.id))) locals.push(it); if (locals.length>=40) break; }
      }

      resp(locals);
      termCacheName.set(cacheKey, locals);

      // Red (no bloquea)
      try {
        inflightNameAC?.abort?.();
        inflightNameAC = new AbortController();
        const net = await netSearchName(term, inflightNameAC.signal);
        if (!Array.isArray(net) || !net.length) return;
        net.forEach(p => updateCache(p.id, { nombre:p.name, precio_unitario:p.price, cantidad_disponible:p.stock }));
        const seen = new Set(locals.map(x=>String(x.id)));
        const merged = locals.slice();
        for (const r of net) { if (!seen.has(String(r.id))) merged.push(r); if (merged.length>=40) break; }
        termCacheName.set(cacheKey, merged);
        if (norm(String($("#producto_busqueda_nombre").val()||"")) === q) resp(merged);
      } catch {}
    })();
  }

  function sourceUltraFastCode(req, resp){
    (async ()=>{
      const term = (req.term||"").trim();
      const qname = norm(term);
      const qdigits = onlyDigits(term);
      if (qname.length < 1 || !hasSucursal()) { resp([]); return; }

      const cacheKey = `${sucursalID}|code|${qname}|${qdigits}`;
      const cached = termCacheCode.get(cacheKey);
      if (cached) { resp(cached); maybeAutoPickBarcode(term, cached); return; }

      const idx = preIndex.get(sucursalID);
      let locals = [];
      if (idx) {
        if (/^\d+$/.test(qdigits)) {
          const pref = idx.codes.filter(x=> x.nbarcode && x.nbarcode.startsWith(qdigits)).slice(0, 40);
          const sub  = idx.codes.filter(x=> x.nbarcode && !x.nbarcode.startsWith(qdigits) && x.nbarcode.includes(qdigits)).slice(0, 40);
          locals = pref.concat(sub).map(x=>{
            const ref = idx.map.get(String(x.id));
            return ({ id:x.id, name: ref?.name || "", label:(ref?.barcode || x.label || String(x.id)), value:(ref?.barcode || x.label || String(x.id)), barcode:(ref?.barcode || ""), price:x.price, stock:x.stock });
          }).slice(0, 40);
        } else {
          const pref = idx.names.filter(x=> x.nname.startsWith(qname)).slice(0, 40);
          const sub  = idx.names.filter(x=> !x.nname.startsWith(qname) && x.nname.includes(qname)).slice(0, 40);
          locals = pref.concat(sub).map(x=>({ id:x.id, name:x.label, label:x.label, value:x.label, price:x.price, stock:x.stock })).slice(0, 40);
        }
      }

      resp(locals);
      termCacheCode.set(cacheKey, locals);
      maybeAutoPickBarcode(term, locals);

      // Red (no bloquea)
      try {
        inflightCodeAC?.abort?.();
        inflightCodeAC = new AbortController();
        const net = await netSearchCode(term, inflightCodeAC.signal);
        if (!Array.isArray(net) || !net.length) return;
        net.forEach(p => updateCache(p.id, { nombre:p.name||p.value, barcode:p.barcode, precio_unitario:p.price, cantidad_disponible:p.stock }));
        const seenKV = new Set(locals.map(x=> String(x.id)+"::"+(x.barcode||"")));
        const merged = locals.slice();
        for (const r of net) {
          const k = String(r.id)+"::"+(r.barcode||"");
          if (!seenKV.has(k)) merged.push(r);
          if (merged.length>=40) break;
        }
        termCacheCode.set(cacheKey, merged);
        if (norm(String($("#codigo_o_barras").val()||"")) === qname) {
          resp(merged);
          maybeAutoPickBarcode(term, merged);
        }
      } catch {}
    })();
  }

  /* ================== Crear AC (Productos) ================== */
  createAC({
    $inp: $inpNombre, minChars: 1, openIfEmpty: false,
    sourceFn: sourceUltraFastName,
    onSelect: (item) => {
      updateCache(item.id, { nombre:item.name, precio_unitario:item.price, cantidad_disponible:item.stock });
      setProductFields({ nombre:item.name, pid:item.id, barcode:item.barcode });
      addToCartLastOnly(item.id, 1);
    }
  });
  applyPriceTemplate($inpNombre, { mode: "name" });

  createAC({
    $inp: $inpCode, minChars: 1, openIfEmpty: false,
    sourceFn: sourceUltraFastCode,
    onSelect: (item) => {
      updateCache(item.id, { nombre:item.name||item.value, barcode:item.barcode, precio_unitario:item.price, cantidad_disponible:item.stock });
      setProductFields({ nombre:item.name||item.value, pid:item.id, barcode:item.barcode||item.label });
      addToCartLastOnly(item.id, 1);
    }
  });
  applyPriceTemplate($inpCode, { mode: "code" });

  /* ================== Prefill sucursal/punto ================== */
  if (sucursalID) {
    $("#sucursal_autocomplete").val(localStorage.getItem("sucursalName") || "");
    $("#sucursal_id").val(sucursalID);
    ensureCatalog(sucursalID);
  }
  if (savedPunto.id && savedPunto.suc && savedPunto.suc.toString() === sucursalID) {
    $("#puntopago_autocomplete").val(savedPunto.name || "");
    $("#puntopago_id").val(savedPunto.id);
  }

  /* ================== AC Sucursal / Punto (con fallback) ================== */
  async function fetchJSON(url){ try{ const r=await fetch(url); if(!r.ok) return null; return await r.json(); } catch { return null; } }
  async function fetchAny(baseUrl, paramsList) {
    for (const p of paramsList) {
      const qs = new URLSearchParams(p);
      const data = await fetchJSON(baseUrl + "?" + qs.toString());
      const arr = (data && data.results) || [];
      if (Array.isArray(arr) && arr.length) return arr;
    }
    return [];
  }
  const LS_SUC = "ac_sucursales_cache";
  const LS_PP  = (sid)=>`ac_puntos_cache_${sid||"none"}`;

  createAC({
    $inp: $("#sucursal_autocomplete"), minChars: 0, openIfEmpty: true,
    sourceFn: async (term, resp) => {
      const results = await fetchAny(SUCURSAL_URL, [
        { term: term || "", limit: 50 },
        { limit: 50 },
        { term: " ", limit: 50 }
      ]);
      let items = results.map(r=>({ id:r.id, label:r.text, value:r.text, name:r.text }));
      if (!items.length) {
        try { items = JSON.parse(localStorage.getItem(LS_SUC) || "[]"); } catch { items = []; }
      } else {
        try { localStorage.setItem(LS_SUC, JSON.stringify(items)); } catch {}
      }
      resp(items);
    },
    onSelect: async ({ id, label }) => {
      sucursalID = String(id).match(/\d+/)?.[0] || "";
      $("#sucursal_id").val(sucursalID);
      $("#sucursal_autocomplete").val(label);
      localStorage.setItem("sucursalID", sucursalID);
      localStorage.setItem("sucursalName", label);

      const ppSuc = localStorage.getItem("puntopagoSucursalID");
      if (ppSuc && ppSuc !== String(sucursalID)) {
        $("#puntopago_autocomplete").val(""); $("#puntopago_id").val("");
        localStorage.removeItem("puntopagoID");
        localStorage.removeItem("puntopagoName");
        localStorage.removeItem("puntopagoSucursalID");
      }
      $cantidad.prop("disabled", true);
      $agregar.prop("disabled", true);

      await ensureCatalog(sucursalID, { force:true });
      termCacheName.set(`${sucursalID}|name|__warm__`, []);
      termCacheCode.set(`${sucursalID}|code|__warm__`, []);
    }
  });

  createAC({
    $inp: $("#puntopago_autocomplete"), minChars: 0, openIfEmpty: true,
    sourceFn: async (term, resp) => {
      if (!hasSucursal()) { resp([]); return; }
      const results = await fetchAny(PUNTOPAGO_URL, [
        { term: term || "", sucursal_id: sucursalID, limit: 50 },
        { sucursal_id: sucursalID, limit: 50 },
        { term: " ", sucursal_id: sucursalID, limit: 50 }
      ]);
      let items = results.map(r=>({ id:r.id, label:r.text, value:r.text, name:r.text }));
      const key = LS_PP(sucursalID);
      if (!items.length) {
        try { items = JSON.parse(localStorage.getItem(key) || "[]"); } catch { items = []; }
      } else {
        try { localStorage.setItem(key, JSON.stringify(items)); } catch {}
      }
      resp(items);
    },
    onSelect: ({ id, label }) => {
      $("#puntopago_autocomplete").val(label);
      $("#puntopago_id").val(id);
      localStorage.setItem("puntopagoID", id);
      localStorage.setItem("puntopagoName", label);
      localStorage.setItem("puntopagoSucursalID", sucursalID || "");
    }
  });

  /* ================== Cliente ================== */
  createAC({
    $inp: $inpCliente,
    sourceFn: async (term) => {
      const d = await fetch(CLIENTE_URL + "?" + new URLSearchParams({ term }))
        .then(r=> r.ok ? r.json() : {results:[]})
        .catch(()=>({results:[]}));
      return (d.results||[]).map(c=>({ id:c.id, label:c.text, value:c.text, name:c.text }));
    },
    onSelect: ({ id, label }) => { $inpCliente.val(label); $("#cliente_id").val(id); }
  });

  /* ================== UX: inputs vinculados ================== */
  $inpNombre.on("input", function(){
    const nm=$.trim(this.value);
    if (nm) {
      if(/^\d+$/.test(nm)) { /* por ID lo resuelve el AC */ }
      const recPid = nameIndex.get(onlyName(nm).toLowerCase());
      if (recPid) setProductFields({ nombre:nm, pid:recPid });
    } else { try { $inpNombre.autocomplete("close"); } catch {} }
  });

  $inpCode.on("input", function(){
    const v=$.trim(this.value);
    if (v) {
      if (/^\d{6,}$/.test(v)) {
        const pid = barcodeIndex.get(v);
        if (pid) setProductFields({ nombre:productCache.get(String(pid))?.nombre, pid, barcode:v });
      } else {
        const rec = productCache.get(String(v));
        if (rec) setProductFields({ nombre:rec.nombre, pid:v, barcode:rec.barcode });
      }
    } else { try { $inpCode.autocomplete("close"); } catch {} }
  });

  /* ================== Cantidad: sanitizar y anti-scanner en CANTIDAD ================== */
  $cantidad.on("keydown", function(e){
    const ok = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End"].includes(e.key);
    if (ok) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }).on("input blur", function(){
    const digits = (this.value||"").replace(/\D+/g,"");
    this.value = clampQty(digits);
  });

  (function guardScannerOnQty(){
    const MIN_CHARS = 8, GAP_MS = 35;
    let buf="", first=0, last=0, timer=null;
    function reset(){ buf=""; first=0; last=0; if(timer){clearTimeout(timer); timer=null;} }
    $cantidad.on("keydown", function(e){
      if (e.ctrlKey || e.altKey || e.metaKey) { reset(); return; }
      if (e.key === "Enter") { reset(); return; }
      if (e.key && e.key.length === 1) {
        const t = Date.now();
        if (buf && (t-last) > GAP_MS) { buf = ""; first = t; }
        if (!buf) first = t;
        buf += e.key; last = t;
        if (timer) clearTimeout(timer);
        timer = setTimeout(reset, GAP_MS*5);
        if (buf.length >= MIN_CHARS) {
          e.preventDefault(); e.stopImmediatePropagation();
          const code = buf; reset();
          $inpCode.val(code); try { $inpCode.autocomplete("close"); } catch (_){}
          if (!hasSucursal()) return;
          resolveByBarcode(code).then(pid => { if (pid) addToCartLastOnly(pid, 1); });
        }
      }
    });
  })();

  /* ================== Botones/agregado ================== */
  $agregar.off("click").on("click", () => {
    const pid = $pid.val();
    const qty = clampQty($cantidad.val());
    if (!pid || !qty || qty < 1) return;
    addToCartLastOnly(pid, qty);
  });

  $cantidad.off("keydown.confirm").on("keydown.confirm", function (e) {
    if (e.key === "Enter" && !$agregar.prop("disabled")) {
      e.preventDefault();
      const pid = $pid.val();
      const qty = clampQty($cantidad.val());
      if (!pid || !qty || qty < 1) return;
      addToCartLastOnly(pid, qty);
      this.blur();
      queueMicrotask(() => {
        if ($inpNombre.is(":visible")) { $inpNombre.focus(); $inpNombre[0]?.select?.(); }
        const v = $inpNombre.val() || "";
        if (v.length >= 1) { try { $inpNombre.autocomplete("search", v); } catch {} }
      });
    }
  });

  $tbody.on("input change", ".qty-input", function () {
    const $row = $(this).closest("tr");
    let newQty = clampQty($(this).val());
    this.value = newQty;

    refreshRowPriceIfNeeded($row).then((okPrice) => {
      if (!okPrice) return; // queda pendiente sin bloquear
      const price = Number($row.data("price")) || 0;
      const oldQty = Number($row.attr("data-qty")) || 0;
      if (newQty === oldQty) return;
      $row.attr("data-qty", newQty);
      const pid = $row.data("pid").toString();
      const i = productos.indexOf(pid);
      if (i > -1) cantidades[i] = newQty;
      $row.find(".subtotal-cell").text(money(price * newQty));
      addToTotal(price * (newQty - oldQty));
    });
  });

  $tbody.on("keydown", ".qty-input", function (e) {
    const ok = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End","Enter"].includes(e.key);
    if (!ok && !/^\d$/.test(e.key)) e.preventDefault();
    if (e.key === "Enter") {
      e.preventDefault(); this.blur();
      queueMicrotask(() => {
        if ($inpNombre.is(":visible")) { $inpNombre.focus(); $inpNombre[0]?.select?.(); }
        const v = $inpNombre.val() || "";
        if (v.length >= 1) { try { $inpNombre.autocomplete("search", v); } catch {} }
      });
    }
  });

  $tbody.on("click", ".eliminar-producto", function () {
    const $row = $(this).closest("tr");
    const pid = $row.data("pid").toString();
    const idx = productos.indexOf(pid);
    const price = Number($row.data("price")) || 0;
    const qty = clampQty($row.attr("data-qty") || $row.find(".qty-input").val());
    if ($row.data("counted")) addToTotal(-(price * qty));
    if (idx > -1) { productos.splice(idx, 1); cantidades.splice(idx, 1); }
    $row.remove();
  });

  $btnVaciar.on("click", function(){
    if (!productos.length) return;
    if (!confirm("¿Vaciar todo el carrito?")) return;
    productos.length = 0; cantidades.length = 0;
    $tbody.empty(); setTotal(0);
  });

  $buscarCart.on("keyup", function () {
    const t = $(this).val().toLowerCase();
    // minimizar recálculos: medir una vez
    const rows = $tbody.find("tr");
    for (let i=0;i<rows.length;i++){
      const el = rows[i];
      const show = el.textContent.toLowerCase().includes(t);
      el.style.display = show ? "" : "none";
    }
  });

  /* ================== Revalorar TODO al abrir modal ================== */
  function repriceAllRowsAndRecalcTotal() {
    const $rows = $tbody.find("tr");
    if (!$rows.length) return Promise.resolve(true);
    let newTotal = 0;
    const tasks = [];
    $rows.each(function(){
      const $row = $(this);
      tasks.push(
        refreshRowPriceIfNeeded($row).then((ok) => {
          if (!ok) return;
          const price = Number($row.data("price")) || 0;
          const qty   = Number($row.attr("data-qty")) || Number($row.find(".qty-input").val()) || 1;
          if ($row.data("counted")) newTotal += price * qty;
        })
      );
    });
    return Promise.allSettled(tasks).then(() => { setTotal(newTotal); return true; });
  }

  /* ================== Modal de pago ================== */
  const $modal     = $("#myModal");
  const $efOptions = $("#efectivo-options");
  const $amountIn  = $("#monto-recibido");
  const $changeOut = $("#cambio");

  function setCashPlaceholderToTotal() { $amountIn.attr("placeholder", money(runningTotal)); }

  $("#generar-venta").off("click").on("click", () => {
    if (!productos.length) { alert("Agregue productos."); return; }
    if (!hasSucursal() || !$("#puntopago_id").val()) { alert("Seleccione sucursal y punto de pago."); return; }

    repriceAllRowsAndRecalcTotal().then(() => {
      $amountIn.val(""); $changeOut.text("");
      $("#modal-total").text(money(runningTotal));
      $("input[name='payment_method']").prop("checked", false);
      $("#efectivo").prop("checked", true).trigger("change");
      $modal.show();
      queueMicrotask(() => { if ($amountIn.is(":visible")) { $amountIn.focus().select(); } });
    });
  });

  $(".close").click(() => $modal.hide());
  $(window).on("click", (e) => { if (e.target === $modal[0]) $modal.hide(); });

  $(document).on("keydown", function (e) {
    if (!$modal.is(":visible")) return;
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      $modal.hide();
    }
  });

  $(document).on("change", "input[name='payment_method']", function () {
    const isCash = this.value === "efectivo";
    $efOptions.toggle(isCash);
    $amountIn.val(""); $changeOut.text("");
    if (isCash) { setCashPlaceholderToTotal(); queueMicrotask(() => { if ($amountIn.is(":visible")) { $amountIn.focus().select(); } }); }
    else { $amountIn.attr("placeholder", ""); }
  });

  $(document).on("click", ".radio-wrap", function (e) {
    if (e.target.tagName !== "INPUT") { $(this).find("input[type=radio]").prop("checked", true).trigger("change"); }
    $(this).closest(".modal-content").attr("tabindex","-1").focus();
  });

  $amountIn.on("input", function () {
    const val = (this.value || "").trim();
    const totalNum = (runningTotal || 0);
    const received = val === "" ? totalNum : (parseFloat(val) || 0);
    const change = received - totalNum;
    $changeOut.text(change >= 0 ? `Cambio: ${money(change)}` : "");
  });

  $amountIn.on("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("#confirmar-pago").trigger("click"); } });

  // Atajos Alt+1/2/3 SOLO para el MODAL
  $(document).on("keydown", function (e) {
    const modalVisible = $modal.length && $modal.is(":visible");
    if (!modalVisible) return;
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (e.key === "1") { $("#nequi").prop("checked", true).trigger("change"); }
      if (e.key === "2") { $("#daviplata").prop("checked", true).trigger("change"); }
      if (e.key === "3") { $("#efectivo").prop("checked", true).trigger("change"); queueMicrotask(()=>{ if ($amountIn.is(":visible")) { $amountIn.focus().select(); } }); }
    }
  });

  $amountIn.on("keydown", function (e) {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (e.key === "1") { $("#nequi").prop("checked", true).trigger("change"); }
      if (e.key === "2") { $("#daviplata").prop("checked", true).trigger("change"); }
      if (e.key === "3") { $("#efectivo").prop("checked", true).trigger("change"); queueMicrotask(()=>{ if ($amountIn.is(":visible")) { $amountIn.focus().select(); } }); }
    }
  });

  // Alt+Espacio y Alt+Enter
  $(document).on("keydown", function (e) {
    const isAltSpace = e.altKey && !e.ctrlKey && !e.metaKey && (e.code === "Space" || e.key === " ");
    if (isAltSpace) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if ($("#myModal").is(":visible")) $("#confirmar-pago").trigger("click");
      else $("#generar-venta").trigger("click");
      return;
    }
    const isAltEnter = e.key === "Enter" && e.altKey && !e.ctrlKey && !e.metaKey;
    if (isAltEnter) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      $("#generar-venta").trigger("click");
    }
  });

  /* ================== Submit (único) ================== */
  $("#venta-form").off("submit").on("submit", function (e) {
    e.preventDefault();

    // Refresco silencioso si quedan pendientes sin bloquear
    const $bad = $tbody.find("tr").filter((_, tr) => {
      const p = Number($(tr).data("price"));
      const counted = $(tr).data("counted");
      return !counted || !Number.isFinite(p) || p <= 0;
    });
    if ($bad.length) {
      for (const tr of $bad.toArray()) { refreshRowPriceIfNeeded($(tr)); }
    }

    $.post($(this).attr("action"), $(this).serialize())
      .done((r) => {
        if (!r || !r.success) { alert((r && r.error) || "Error"); return; }

        const metodo = ($("#medio_pago").val() || "").toLowerCase();
        const efectivo = metodo === "efectivo";
        const totalNum = (runningTotal || 0);
        const raw = ($("#monto-recibido").val() || "").trim();
        const recibido = efectivo ? (raw === "" ? totalNum : (parseFloat(raw) || 0)) : 0;
        const cambio = efectivo ? Math.max(0, recibido - totalNum) : 0;

        const omitirImpresion = confirm(
          ["✅ Venta generada.",
           `Total: ${money(totalNum)}`,
           efectivo ? `Cambio a entregar: ${money(cambio)}` : "",
           "", "¿Desea OMITIR la impresión de la factura?",
           "— Aceptar: NO imprimir (solo abrir gaveta).",
           "— Cancelar: Imprimir (y abrir gaveta)."
          ].filter(Boolean).join("\n")
        );

        // Acciones del POS Agent no bloqueantes
        (async () => {
          try {
            if (omitirImpresion) {
              await fetch(POS_AGENT_URL + "/kick", { method: "POST", headers: { "X-Pos-Agent-Token": POS_AGENT_TOKEN } });
            } else {
              await fetch(POS_AGENT_URL + "/print", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Pos-Agent-Token": POS_AGENT_TOKEN },
                body: JSON.stringify({ text: r.receipt_text || "Factura\n\n" })
              });
              await new Promise(res => setTimeout(res, 150));
              await fetch(POS_AGENT_URL + "/kick", { method: "POST", headers: { "X-Pos-Agent-Token": POS_AGENT_TOKEN } });
            }
          } catch {}
          location.reload();
        })();
      })
      .fail(() => alert("Error de red"));
  });

  /* ================== Atajos Ctrl + 0..4 ================== */
  $(document).on("keydown", function (e) {
    if ($("#myModal").is(":visible")) return;
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    const focusAndSelect = ($el) => { if ($el && $el.length) { $el.focus(); $el[0]?.select?.(); } };
    switch (e.key) {
      case "0": e.preventDefault(); focusAndSelect($inpCliente); break;
      case "1": e.preventDefault(); focusAndSelect($inpNombre); break;
      case "2": e.preventDefault(); focusAndSelect($inpCode); break;
      case "3": e.preventDefault(); focusAndSelect($buscarCart); break;
      case "4":
        e.preventDefault();
        if (lastAddedPid) {
          const $row = $tbody.find(`tr[data-pid='${lastAddedPid}']`);
          const $q = $row.find(".qty-input");
          if ($q.length) { focusAndSelect($q); break; }
        }
        focusAndSelect($cantidad);
        break;
      default: break;
    }
  });

  /* ================== Atajos Alt + 0..4 (página) ================== */
  (function setupAltShortcuts(){
    const focusAndSelect = ($el) => { if ($el && $el.length) { $el.focus(); $el[0]?.select?.(); } };
    $(document).on("keydown", function (e) {
      if ($("#myModal").is(":visible")) return;
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key; if (!/^[0-4]$/.test(k)) return;
      e.preventDefault(); e.stopPropagation();
      switch (k) {
        case "0": focusAndSelect($inpCliente); break;
        case "1": focusAndSelect($inpNombre); break;
        case "2": focusAndSelect($inpCode); break;
        case "3": focusAndSelect($buscarCart); break;
        case "4":
          if (lastAddedPid) {
            const $row = $tbody.find(`tr[data-pid='${lastAddedPid}']`);
            const $q = $row.find(".qty-input");
            if ($q.length) { focusAndSelect($q); break; }
          }
          focusAndSelect($cantidad);
          break;
        default: break;
      }
    });
  })();

  /* ================== ESC: eliminar primer item visible ================== */
  $(document).on("keydown", function (e) {
    if ($("#myModal").is(":visible")) return;
    if (e.key !== "Escape") return;
    const $first = $tbody.find("tr:visible").first();
    if (!$first.length) return;
    e.preventDefault(); e.stopPropagation();
    const pid = String($first.data("pid") || "");
    const price = Number($first.data("price")) || 0;
    const qty = clampQty($first.attr("data-qty") || $first.find(".qty-input").val());
    if ($first.data("counted")) addToTotal(-(price * qty));
    const idx = productos.indexOf(pid);
    if (idx > -1) { productos.splice(idx, 1); cantidades.splice(idx, 1); }
    $first.remove();
  });

  /* ================== Detector global de pistola (escáner) ================== */
  (function globalScannerDetector() {
    const MIN_CHARS = 8, GAP_MS = 35;
    let buf="", first=0, last=0, idleTimer=null;
    function reset(){ buf=""; first=0; last=0; if(idleTimer){clearTimeout(idleTimer); idleTimer=null;} }
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.altKey || e.metaKey) { reset(); return; }
      const t = Date.now();
      if (e.key === "Enter" || e.key === "Tab") {
        const fastEnough = buf && (t-first) < buf.length * (GAP_MS+5) && (t-last) < GAP_MS*3;
        if (fastEnough && buf.length >= MIN_CHARS) {
          e.preventDefault(); e.stopImmediatePropagation();
          const code = buf; reset();
          $inpCode.val(code); try { $inpCode.autocomplete("close"); } catch (_){}
          if (!hasSucursal()) return;
          resolveByBarcode(code).then(pid => { if (pid) addToCartLastOnly(pid, 1); });
          return;
        }
        reset(); return;
      }
      if (e.key && e.key.length === 1) {
        if (buf && (t-last) > GAP_MS) { buf = ""; first = t; }
        if (!buf) first = t; buf += e.key; last = t;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(reset, GAP_MS*5);
      } else { if (e.key !== "Shift") reset(); }
    }, true);
  })();

  /* ================== Init ================== */
  $cantidad.prop("disabled", true);
  $agregar.prop("disabled", true);
  if (!POS_AGENT_TOKEN) console.warn("[POS_AGENT] Token vacío: el agente podría rechazar (401).");
});
