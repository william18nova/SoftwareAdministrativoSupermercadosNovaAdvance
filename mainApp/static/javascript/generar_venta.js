$(document).ready(function() {
    "use strict";
    
    // ---------------------------
    // CSRF Token & Ajax Setup
    // ---------------------------
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + "=")) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    const csrftoken = getCookie("csrftoken");
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!(/^GET|HEAD|OPTIONS|TRACE$/.test(settings.type)) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }
        }
    });

    // ---------------------------
    // Caché para Autocompletes
    // ---------------------------
    var cacheSucursales = {};
    var cachePuntosPago = {};

    function fetchData(url, params, cache, callback) {
        var key = url + JSON.stringify(params);
        if (cache[key]) {
            callback(cache[key]);
            return;
        }
        $.ajax({
            url: url,
            method: "GET",
            data: params,
            success: function(data) {
                cache[key] = data;
                callback(data);
            }
        });
    }

    // ---------------------------
    // Variables Globales
    // ---------------------------
    var productos = [];    // Array de IDs de producto (string)
    var cantidades = [];   // Array de cantidades (números)
    // Usamos localStorage para guardar el ID y el nombre (label) de sucursal y punto de pago
    var sucursalSeleccionadaId = localStorage.getItem("sucursalSeleccionadaId") || "";
    var sucursalSeleccionadaName = localStorage.getItem("sucursalSeleccionadaName") || "";
    var puntoPagoSeleccionadoId = localStorage.getItem("puntoPagoSeleccionadoId") || "";
    var puntoPagoSeleccionadoName = localStorage.getItem("puntoPagoSeleccionadoName") || "";

    // Asignar valores guardados a los inputs (si existen)
    if (sucursalSeleccionadaId && sucursalSeleccionadaName) {
        $("#sucursal_autocomplete").val(sucursalSeleccionadaName);
        $("#sucursal_id").val(sucursalSeleccionadaId);
    }
    if (puntoPagoSeleccionadoId && puntoPagoSeleccionadoName) {
        $("#puntopago_autocomplete").val(puntoPagoSeleccionadoName);
        $("#puntopago_id").val(puntoPagoSeleccionadoId);
    }

    // ---------------------------
    // Autocomplete para Sucursal
    // ---------------------------
    $("#sucursal_autocomplete").autocomplete({
        delay: 100,
        minLength: 0,
        source: function(request, response) {
            // Si no se escribe nada, enviamos cadena vacía para mostrar todas las opciones
            fetchData(sucursalAutocompleteUrl, { term: request.term }, cacheSucursales, function(data) {
                response(data.results.map(function(item) {
                    return { label: item.text, value: item.text, id: item.id };
                }));
            });
        },
        select: function(event, ui) {
            this.value = ui.item.label;
            $("#sucursal_id").val(ui.item.id);
            localStorage.setItem("sucursalSeleccionadaId", ui.item.id);
            localStorage.setItem("sucursalSeleccionadaName", ui.item.label);
            sucursalSeleccionadaId = ui.item.id;
            // Al cambiar la sucursal, reiniciamos el punto de pago
            $("#puntopago_autocomplete").val("");
            $("#puntopago_id").val("");
            localStorage.removeItem("puntoPagoSeleccionadoId");
            localStorage.removeItem("puntoPagoSeleccionadoName");
            return false;
        }
    }).on("focus", function() {
        $(this).autocomplete("search", "");
    });

    // ---------------------------
    // Autocomplete para Punto de Pago
    // ---------------------------
    $("#puntopago_autocomplete").autocomplete({
        delay: 100,
        minLength: 0,
        source: function(request, response) {
            $.ajax({
                url: puntopagoAutocompleteUrl,
                method: "GET",
                data: { term: request.term, sucursal_id: sucursalSeleccionadaId },
                success: function(data) {
                    response(data.results.map(function(item) {
                        return { label: item.text, value: item.text, id: item.id };
                    }));
                }
            });
        },
        select: function(event, ui) {
            $("#puntopago_autocomplete").val(ui.item.label);
            $("#puntopago_id").val(ui.item.id);
            localStorage.setItem("puntoPagoSeleccionadoId", ui.item.id);
            localStorage.setItem("puntoPagoSeleccionadoName", ui.item.label);
            return false;
        }
    }).on("focus", function() {
        $(this).autocomplete("search", "");
    });

    // ---------------------------
    // Funciones para Producto
    // ---------------------------
    function actualizarCampos(producto) {
        $("#producto_busqueda_nombre").val(producto.nombre);
        $("#producto_busqueda_codigo").val(producto.productoid);
        $("#producto_busqueda_codigo_barras").val(producto.codigo_de_barras);
        $("#producto_id").val(producto.productoid);
    }

    function mostrarError(mensaje) {
        alert(mensaje);
    }

    function buscarProductoPorCampo(campo, valor) {
        $.ajax({
            url: buscarProductosUrl,
            method: "GET",
            data: { term: valor, sucursal_id: sucursalSeleccionadaId },
            success: function(data) {
                if (data.productos.length > 0) {
                    actualizarCampos(data.productos[0]);
                    habilitarCampos();
                } else {
                    mostrarError("Producto no encontrado.");
                }
            }
        });
    }

    $("#sucursal_id").change(function() {
        sucursalSeleccionadaId = $(this).val();
        localStorage.setItem("sucursalSeleccionadaId", sucursalSeleccionadaId);
        if (sucursalSeleccionadaId) {
            $.ajax({
                url: obtenerPuntosPagoUrl,
                method: "GET",
                data: { sucursal_id: sucursalSeleccionadaId },
                success: function(response) {
                    // Reiniciamos los campos de punto de pago al cambiar de sucursal
                    $("#puntopago_autocomplete").val("");
                    $("#puntopago_id").val("");
                    localStorage.removeItem("puntoPagoSeleccionadoId");
                    localStorage.removeItem("puntoPagoSeleccionadoName");
                }
            });
        }
    });

    function habilitarCampos() {
        $("#producto_busqueda_nombre, #producto_busqueda_codigo, #producto_busqueda_codigo_barras, #cantidad, #agregar-producto").prop("disabled", false);
    }
    function deshabilitarCampos() {
        $("#producto_busqueda_nombre, #producto_busqueda_codigo, #producto_busqueda_codigo_barras, #cantidad, #agregar-producto").prop("disabled", true);
    }

    $("#puntopago_id").change(function() {
        puntoPagoSeleccionadoId = $(this).val();
        localStorage.setItem("puntoPagoSeleccionadoId", puntoPagoSeleccionadoId);
    });

    // ---------------------------
    // Autocomplete para Producto (Reutilizable)
    // ---------------------------
    function configurarAutocompletar(idCampo, campoBusqueda, labelBusqueda) {
        $(idCampo).autocomplete({
            delay: 100,
            minLength: 0,
            source: function(request, response) {
                $.ajax({
                    url: buscarProductosUrl,
                    method: "GET",
                    data: { term: request.term, sucursal_id: sucursalSeleccionadaId },
                    success: function(data) {
                        response(data.productos.map(function(producto) {
                            return {
                                label: producto[labelBusqueda],
                                value: producto[labelBusqueda],
                                id: producto.productoid,
                                nombre: producto.nombre,
                                codigo_de_barras: producto.codigo_de_barras,
                                productoid: producto.productoid
                            };
                        }));
                    }
                });
            },
            select: function(event, ui) {
                actualizarCampos(ui.item);
                habilitarCampos();
                return false;
            },
            open: function() {
                $(this).data("ui-autocomplete").menu.element.on("keydown", function(e) {
                    if (e.keyCode === 13) {
                        var firstItem = $(this).data("ui-autocomplete").menu.element.children().first().data("ui-autocomplete-item");
                        if (firstItem) {
                            actualizarCampos(firstItem);
                            habilitarCampos();
                            $(this).autocomplete("close");
                        }
                    }
                });
            }
        }).on("focus", function() {
            $(this).autocomplete("search", $(this).val());
        }).on("keypress", function(e) {
            if (e.which === 13) {
                e.preventDefault();
                var autoComplete = $(this).autocomplete("instance");
                if (autoComplete && autoComplete.menu.active) {
                    autoComplete.menu.element.children().first().trigger("click");
                } else {
                    var valor = $(this).val();
                    var campo = idCampo.substring(1);
                    buscarProductoPorCampo(campo, valor);
                }
            }
        });
    }

    configurarAutocompletar("#producto_busqueda_nombre", "nombre", "nombre");
    configurarAutocompletar("#producto_busqueda_codigo", "productoid", "productoid");
    configurarAutocompletar("#producto_busqueda_codigo_barras", "codigo_de_barras", "codigo_de_barras");

    // ---------------------------
    // Escanear Código de Barras con Quagga
    // ---------------------------
    $("#btnEscanear").on("click", function() {
        $("#interactive").show();
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector("#interactive"),
                constraints: { width: 640, height: 480, facingMode: "environment" }
            },
            decoder: { readers: ["ean_reader"] },
            locate: true,
            locator: { patchSize: "medium", halfSample: true }
        }, function(err) {
            if (err) {
                console.log(err);
                return;
            }
            Quagga.start();
        });
        Quagga.onDetected(function(data) {
            var codigo = data.codeResult.code;
            buscarProductoPorCodigo(codigo);
            Quagga.stop();
            $("#interactive").hide();
        });
    });

    function buscarProductoPorCodigo(codigo_de_barras) {
        $.ajax({
            url: buscarProductoPorCodigoUrl,
            method: "GET",
            data: { codigo_de_barras: codigo_de_barras, sucursal_id: sucursalSeleccionadaId },
            success: function(response) {
                if (response.exists) {
                    actualizarCampos(response.producto);
                    habilitarCampos();
                } else {
                    mostrarError("Producto no encontrado.");
                }
            }
        });
    }

    // ---------------------------
    // Agregar Producto a la Tabla de Detalle
    // ---------------------------
    $("#agregar-producto").click(function(e) {
        e.preventDefault();
        var producto_id = $("#producto_id").val();
        if (!producto_id) {
            mostrarError("Debe seleccionar un producto antes de agregarlo.");
            return;
        }
        var cantidadNueva = parseInt($("#cantidad").val());
        if (isNaN(cantidadNueva) || cantidadNueva < 1) {
            mostrarError("Ingrese una cantidad válida.");
            return;
        }
        
        // Verificar si el producto ya está en la lista
        var indice = productos.indexOf(producto_id);
        if (indice !== -1) {
            // Si ya existe, sumar cantidad y actualizar fila
            var cantidadAnterior = parseInt(cantidades[indice]);
            var cantidadTotal = cantidadAnterior + cantidadNueva;
            $.ajax({
                url: verificarProductoUrl,
                method: "POST",
                data: {
                    producto_id: producto_id,
                    cantidad: cantidadTotal,
                    sucursal_id: sucursalSeleccionadaId
                },
                success: function(response) {
                    if (response.exists) {
                        if (response.cantidad_disponible >= cantidadTotal) {
                            cantidades[indice] = cantidadTotal;
                            var $row = $("#detalle-productos tbody tr").filter(function() {
                                return $(this).find("td:first").data("id") == producto_id;
                            });
                            $row.find("td").eq(1).text(cantidadTotal);
                            var nuevoSubtotal = response.precio_unitario * cantidadTotal;
                            $row.find("td").eq(3).text(response.precio_unitario_formatted.replace(/\d+(\.\d+)?/, nuevoSubtotal.toFixed(2)));
                            $row.prependTo("#detalle-productos tbody");
                            actualizarTotal();
                            // Limpiar campos
                            $("#producto_busqueda_nombre").val("");
                            $("#producto_busqueda_codigo").val("");
                            $("#producto_busqueda_codigo_barras").val("");
                            $("#producto_id").val("");
                            $("#cantidad").val(1);
                            habilitarCampos();
                        } else {
                            mostrarError("Cantidad no disponible. Disponible: " + response.cantidad_disponible);
                        }
                    } else {
                        mostrarError("Producto no encontrado.");
                    }
                }
            });
        } else {
            // Si no existe, agregar producto nuevo
            $.ajax({
                url: verificarProductoUrl,
                method: "POST",
                data: {
                    producto_id: producto_id,
                    cantidad: cantidadNueva,
                    sucursal_id: sucursalSeleccionadaId
                },
                success: function(response) {
                    if (response.exists) {
                        if (response.cantidad_disponible >= cantidadNueva) {
                            productos.push(producto_id);
                            cantidades.push(cantidadNueva);
                            $("#productos").val(JSON.stringify(productos));
                            $("#cantidades").val(JSON.stringify(cantidades));
                            
                            var subtotal = response.precio_unitario * cantidadNueva;
                            $("#detalle-productos tbody").prepend(
                                "<tr>" +
                                    "<td data-id='" + producto_id + "'>" + $("#producto_busqueda_nombre").val() + "</td>" +
                                    "<td>" + cantidadNueva + "</td>" +
                                    "<td>" + response.precio_unitario_formatted + "</td>" +
                                    "<td>" + response.subtotal_formatted + "</td>" +
                                    "<td class='text-center'><button class='btn btn-danger btn-sm eliminar-producto'><i class='fas fa-trash-alt'></i></button></td>" +
                                "</tr>"
                            );
                            actualizarTotal();
                            // Limpiar campos
                            $("#producto_busqueda_nombre").val("");
                            $("#producto_busqueda_codigo").val("");
                            $("#producto_busqueda_codigo_barras").val("");
                            $("#producto_id").val("");
                            $("#cantidad").val(1);
                            habilitarCampos();
                        } else {
                            mostrarError("Cantidad no disponible. Disponible: " + response.cantidad_disponible);
                        }
                    } else {
                        mostrarError("Producto no encontrado.");
                    }
                }
            });
        }
    });

    $("#detalle-productos").on("click", ".eliminar-producto", function() {
        var $row = $(this).closest("tr");
        var producto_id = $row.find("td:first").data("id");
        var indice = productos.indexOf(producto_id.toString());
        if (indice > -1) {
            productos.splice(indice, 1);
            cantidades.splice(indice, 1);
        }
        $("#productos").val(JSON.stringify(productos));
        $("#cantidades").val(JSON.stringify(cantidades));
        $row.remove();
        actualizarTotal();
    });

    function actualizarTotal() {
        var total = 0;
        $("#detalle-productos tbody tr").each(function() {
            var subtotal = parseFloat($(this).find("td").eq(3).text().replace(/[^\d.-]/g, ""));
            total += subtotal;
        });
        $("#total").text(new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP"
        }).format(total));
    }

    // ---------------------------
    // Modal y Medios de Pago
    // ---------------------------
    var modal = document.getElementById("myModal");
    var btnGenerarVenta = document.getElementById("generar-venta");
    var span = document.getElementsByClassName("close")[0];
    var confirmarPagoBtn = document.getElementById("confirmar-pago");

    btnGenerarVenta.onclick = function() {
        if (productos.length > 0) {
            modal.style.display = "block";
        } else {
            mostrarError("Debe agregar al menos un producto para generar una venta.");
        }
    };

    span.onclick = function() {
        modal.style.display = "none";
    };

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };

    $("input[name='payment_method']").change(function() {
        if (this.value === "efectivo") {
            $("#efectivo-options").show();
        } else {
            $("#efectivo-options").hide();
            $("#monto-recibido").val("");
            $("#cambio").text("");
        }
    });

    $("#monto-recibido").on("input", function() {
        var montoRecibido = parseFloat($(this).val());
        var totalVenta = parseFloat($("#total").text().replace(/[^0-9,-]+/g, "").replace(",", "."));
        var cambio = montoRecibido - totalVenta;
        if (!isNaN(cambio) && cambio >= 0) {
            $("#cambio").text("Cambio: " + new Intl.NumberFormat("es-CO", {
                style: "currency",
                currency: "COP"
            }).format(cambio));
        } else {
            $("#cambio").text("");
        }
    });

    confirmarPagoBtn.onclick = function() {
        var selectedMethod = $("input[name='payment_method']:checked").val();
        $("#medio_pago").val(selectedMethod);
        if (selectedMethod === "nequi") {
            var totalVenta = parseFloat($("#total").text().replace(/[^0-9,-]+/g, "").replace(",", "."));
            $.ajax({
                url: verificarPagoNequiUrl,
                method: "POST",
                data: { total: totalVenta },
                success: function(response) {
                    if (response.success) {
                        $("#venta-form").append('<input type="hidden" name="confirmar_nequi" value="true">');
                        $("#venta-form").submit();
                    } else {
                        mostrarError("El pago no fue confirmado.");
                    }
                },
                error: function() {
                    mostrarError("Error en la conexión de WebSocket");
                }
            });
        } else if (selectedMethod === "efectivo") {
            var montoRecibido = parseFloat($("#monto-recibido").val());
            var totalVenta = parseFloat($("#total").text().replace(/[^0-9,-]+/g, "").replace(",", "."));
            if (montoRecibido < totalVenta) {
                mostrarError("El monto recibido es menor al total de la venta.");
            } else {
                $("#venta-form").submit();
            }
        } else {
            $("#venta-form").submit();
        }
    };

    $("#venta-form").on("submit", function(e) {
        e.preventDefault();
        var form = $(this);
        $.ajax({
            url: form.attr("action"),
            method: form.attr("method"),
            data: form.serialize(),
            success: function(response) {
                if (response.success) {
                    alert("Venta generada exitosamente");
                    location.reload();
                } else {
                    mostrarError(response.error);
                }
            },
            error: function() {
                mostrarError("Error al generar la venta");
            }
        });
    });

    $("#cliente_busqueda").autocomplete({
        minLength: 0,
        source: function(request, response) {
            $.ajax({
                url: buscarClienteUrl,
                method: "GET",
                data: { term: request.term },
                success: function(data) {
                    response(data.clientes.map(function(cliente) {
                        return {
                            label: cliente.nombre + " " + cliente.apellido,
                            value: cliente.nombre + " " + cliente.apellido,
                            id: cliente.clienteid
                        };
                    }));
                }
            });
        },
        select: function(event, ui) {
            $("#cliente_id").val(ui.item.id);
        }
    }).on("focus", function() {
        $(this).autocomplete("search", "");
    });

    $("#buscar-detalles").on("keyup", function() {
        var value = $(this).val().toLowerCase();
        $("#detalle-productos tbody tr").filter(function() {
            $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
        });
    });

    // Al cargar la página, si hay una sucursal seleccionada, forzamos la carga de puntos de pago
    if (sucursalSeleccionadaId) {
        $.ajax({
            url: obtenerPuntosPagoUrl,
            method: "GET",
            data: { sucursal_id: sucursalSeleccionadaId },
            success: function(response) {
                if (response.puntos_pago && response.puntos_pago.length > 0) {
                    var primerPunto = response.puntos_pago[0];
                    $("#puntopago_id").val(primerPunto.puntopagoid);
                    $("#puntopago_autocomplete").val(primerPunto.nombre);
                } else {
                    $("#puntopago_autocomplete").val("");
                    $("#puntopago_id").val("");
                }
            }
        });
    }
});