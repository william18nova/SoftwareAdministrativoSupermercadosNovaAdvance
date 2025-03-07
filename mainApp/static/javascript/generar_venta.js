$(document).ready(function() {
    var productos = [];
    var cantidades = [];
    var sucursalSeleccionada = localStorage.getItem('sucursalSeleccionada') || '{{ selected_sucursal }}';
    var puntoPagoSeleccionado = localStorage.getItem('puntoPagoSeleccionado') || '{{ selected_puntopago }}';

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
            data: {
                term: valor,
                sucursal_id: sucursalSeleccionada
            },
            success: function(data) {
                if (data.productos.length > 0) {
                    actualizarCampos(data.productos[0]);
                } else {
                    mostrarError("Producto no encontrado.");
                }
            }
        });
    }

    $("#sucursal_id").change(function() {
        sucursalSeleccionada = $(this).val();
        localStorage.setItem('sucursalSeleccionada', sucursalSeleccionada);
        if (sucursalSeleccionada) {
            $.ajax({
                url: "{% url 'obtener_puntos_pago' %}",
                method: "GET",
                data: {
                    'sucursal_id': sucursalSeleccionada
                },
                success: function(response) {
                    var $puntopago = $("#puntopago_id").empty();
                    $puntopago.append(new Option("Seleccione un punto de pago", ""));
                    response.puntos_pago.forEach(function(punto) {
                        $puntopago.append(new Option(punto.nombre, punto.puntopagoid));
                    });
                    habilitarCampos();
                    $("#puntopago_id").val(localStorage.getItem('puntoPagoSeleccionado')).change();
                }
            });
        } else {
            $("#puntopago_id").empty().append(new Option("Seleccione una sucursal primero", ""));
            deshabilitarCampos();
        }
    });

    function habilitarCampos() {
        $("#producto_busqueda_nombre, #producto_busqueda_codigo, #producto_busqueda_codigo_barras, #cantidad, #agregar-producto").prop("disabled", false);
    }

    function deshabilitarCampos() {
        $("#producto_busqueda_nombre, #producto_busqueda_codigo, #producto_busqueda_codigo_barras, #cantidad, #agregar-producto").prop("disabled", true);
    }

    $("#puntopago_id").change(function() {
        puntoPagoSeleccionado = $(this).val();
        localStorage.setItem('puntoPagoSeleccionado', puntoPagoSeleccionado);
    });

    function configurarAutocompletar(idCampo, campoBusqueda, labelBusqueda) {
        $(idCampo).autocomplete({
            delay: 0,
            source: function(request, response) {
                $.ajax({
                    url: buscarProductosUrl,
                    method: "GET",
                    data: {
                        term: request.term,
                        sucursal_id: sucursalSeleccionada
                    },
                    success: function(data) {
                        response(data.productos.map(function(producto) {
                            return {
                                label: producto[labelBusqueda],
                                value: producto[campoBusqueda],
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
            },
            open: function() {
                $(this).data('ui-autocomplete').menu.element.on('keydown', function(e) {
                    if (e.keyCode === 13) {
                        var firstItem = $(this).data('ui-autocomplete').menu.element.children().first().data('ui-autocomplete-item');
                        if (firstItem) {
                            actualizarCampos(firstItem);
                            $(this).autocomplete("close");
                        }
                    }
                });
            }
        }).on('keypress', function(e) {
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

    configurarAutocompletar("#producto_busqueda_nombre", 'nombre', 'nombre');
    configurarAutocompletar("#producto_busqueda_codigo", 'productoid', 'productoid');
    configurarAutocompletar("#producto_busqueda_codigo_barras", 'codigo_de_barras', 'codigo_de_barras');

    document.getElementById('btnEscanear').addEventListener('click', function() {
        document.getElementById('interactive').style.display = 'block';
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector('#interactive'),
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment"
                }
            },
            decoder: {
                readers: ["ean_reader"]
            },
            locate: true,
            locator: {
                patchSize: "medium",
                halfSample: true
            }
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
            document.getElementById('interactive').style.display = 'none';
        });
    });

    function buscarProductoPorCodigo(codigo_de_barras) {
        $.ajax({
            url: buscarProductoPorCodigoUrl,
            method: "GET",
            data: {
                'codigo_de_barras': codigo_de_barras,
                'sucursal_id': sucursalSeleccionada
            },
            success: function(response) {
                if (response.exists) {
                    actualizarCampos(response.producto);
                } else {
                    mostrarError("Producto no encontrado.");
                }
            }
        });
    }

    $("#agregar-producto").click(function(e) {
        e.preventDefault();
        var producto_id = $("#producto_id").val();
        var cantidad = $("#cantidad").val();
        productos.push(producto_id);
        cantidades.push(cantidad);
        $("#productos").val(JSON.stringify(productos));
        $("#cantidades").val(JSON.stringify(cantidades));

        $.ajax({
            url: "{% url 'verificar_producto' %}",
            method: "POST",
            data: {
                'producto_id': producto_id,
                'cantidad': cantidad,
                'sucursal_id': sucursalSeleccionada,
                'csrfmiddlewaretoken': '{{ csrf_token }}'
            },
            success: function(response) {
                if (response.exists) {
                    if (response.cantidad_disponible >= cantidad) {
                        var subtotal = response.precio_unitario * cantidad;
                        $("#detalle-productos tbody").prepend(
                            "<tr>" +
                            "<td data-id='" + producto_id + "'>" + $("#producto_busqueda_nombre").val() + "</td>" +
                            "<td>" + cantidad + "</td>" +
                            "<td>" + response.precio_unitario_formatted + "</td>" +
                            "<td>" + response.subtotal_formatted + "</td>" +
                            "<td class='text-center'><button class='btn btn-danger btn-sm eliminar-producto'><i class='fas fa-trash-alt'></i></button></td>" +
                            "</tr>"
                        );
                        actualizarTotal();
                        $("#producto_busqueda_nombre").val('');
                        $("#producto_busqueda_codigo").val('');
                        $("#producto_busqueda_codigo_barras").val('');
                        $("#producto_id").val('');
                        $("#cantidad").val(1);
                    } else {
                        mostrarError("Cantidad no disponible. Disponible: " + response.cantidad_disponible);
                    }
                } else {
                    mostrarError("Producto no encontrado.");
                }
            }
        });
    });

    $("#detalle-productos").on("click", ".eliminar-producto", function() {
        var row = $(this).closest("tr");
        var producto_id = row.find("td:eq(0)").data("id");
        var index = productos.indexOf(producto_id.toString());
        if (index > -1) {
            productos.splice(index, 1);
            cantidades.splice(index, 1);
        }
        $("#productos").val(JSON.stringify(productos));
        $("#cantidades").val(JSON.stringify(cantidades));
        row.remove();
        actualizarTotal();
    });

    function actualizarTotal() {
        var total = 0;
        $("#detalle-productos tbody tr").each(function() {
            var subtotal = parseFloat($(this).find("td").eq(3).text().replace(/[^\d.-]/g, ''));
            total += subtotal;
        });
        $("#total").text(new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP'
        }).format(total));
    }

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
        if (this.value === 'efectivo') {
            $("#efectivo-options").show();
        } else {
            $("#efectivo-options").hide();
            $("#monto-recibido").val('');
            $("#cambio").text('');
        }
    });

    $("#monto-recibido").on('input', function() {
        var montoRecibido = parseFloat($(this).val());
        var total = parseFloat($("#total").text().replace(/[^0-9,-]+/g, '').replace(',', '.'));
        var cambio = montoRecibido - total;
        if (!isNaN(cambio) && cambio >= 0) {
            $("#cambio").text("Cambio: " + new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP'
            }).format(cambio));
        } else {
            $("#cambio").text('');
        }
    });

    confirmarPagoBtn.onclick = function() {
        var selectedMethod = $("input[name='payment_method']:checked").val();
        $("#medio_pago").val(selectedMethod);

        if (selectedMethod === 'nequi') {
            var totalVenta = parseFloat($("#total").text().replace(/[^0-9,-]+/g, '').replace(',', '.'));

            $.ajax({
                url: "{% url 'verificar_pago_nequi' %}",
                method: "POST",
                data: {
                    'total': totalVenta,
                    'csrfmiddlewaretoken': '{{ csrf_token }}'
                },
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
        } else if (selectedMethod === 'efectivo') {
            var montoRecibido = parseFloat($("#monto-recibido").val());
            var totalVenta = parseFloat($("#total").text().replace(/[^0-9,-]+/g, '').replace(',', '.'));
            if (montoRecibido < totalVenta) {
                mostrarError("El monto recibido es menor al total de la venta.");
            } else {
                $("#venta-form").submit();
            }
        } else {
            $("#venta-form").submit();
        }
    };

    $("#venta-form").on('submit', function(e) {
        e.preventDefault();
        var form = $(this);
        $.ajax({
            url: form.attr('action'),
            method: form.attr('method'),
            data: form.serialize(),
            success: function(response) {
                if (response.success) {
                    alert('Venta generada exitosamente');
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
        source: function(request, response) {
            $.ajax({
                url: buscarClienteUrl,
                method: "GET",
                data: {
                    'term': request.term
                },
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
    });

    $("#buscar-detalles").on("keyup", function() {
        var value = $(this).val().toLowerCase();
        $("#detalle-productos tbody tr").filter(function() {
            $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
        });
    });

    if (sucursalSeleccionada) {
        $.ajax({
            url: "{% url 'obtener_puntos_pago' %}",
            method: "GET",
            data: {
                'sucursal_id': sucursalSeleccionada
            },
            success: function(response) {
                var $puntopago = $("#puntopago_id").empty();
                $puntopago.append(new Option("Seleccione un punto de pago", ""));
                response.puntos_pago.forEach(function(punto) {
                    var selected = puntoPagoSeleccionado == punto.puntopagoid ? 'selected' : '';
                    $puntopago.append(new Option(punto.nombre, punto.puntopagoid, false, selected));
                });
                habilitarCampos();
                $("#puntopago_id").val(puntoPagoSeleccionado);
            }
        });
    }

    $("#sucursal_id").val(sucursalSeleccionada).change();
    $("#puntopago_id").val(puntoPagoSeleccionado);
});
