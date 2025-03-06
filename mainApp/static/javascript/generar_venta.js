$(document).ready(function() {
    // VARIABLES GLOBALES DEL CARRITO
    let productos = [];
    let cantidades = [];
    let sucursalSeleccionada = $("#sucursal_id").val();
    let puntoPagoSeleccionado = $("#puntopago_id").val();

    // Función para actualizar los campos del producto
    function actualizarCampos(producto) {
        $("#producto_busqueda_nombre").val(producto.nombre);
        $("#producto_busqueda_codigo").val(producto.productoid);
        $("#producto_busqueda_codigo_barras").val(producto.codigo_de_barras);
        $("#producto_id").val(producto.productoid);
    }

    // Función para mostrar errores
    function mostrarError(mensaje) {
        alert(mensaje);
    }

    // Buscar producto por algún campo (nombre, código o código de barras)
    function buscarProductoPorCampo(campo, valor) {
        $.ajax({
            url: "{% url 'buscar_productos' %}",
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

    // Actualizar sucursal y cargar puntos de pago
    $("#sucursal_id").change(function() {
        sucursalSeleccionada = $(this).val();
        localStorage.setItem('sucursalSeleccionada', sucursalSeleccionada);
        if (sucursalSeleccionada) {
            $.ajax({
                url: "{% url 'obtener_puntos_pago' %}",
                method: "GET",
                data: { 'sucursal_id': sucursalSeleccionada },
                success: function(response) {
                    let $puntopago = $("#puntopago_id").empty();
                    $puntopago.append(new Option("Seleccione un punto de pago", ""));
                    response.puntos_pago.forEach(function(punto) {
                        $puntopago.append(new Option(punto.nombre, punto.puntopagoid));
                    });
                }
            });
        } else {
            $("#puntopago_id").empty().append(new Option("Seleccione una sucursal primero", ""));
        }
    });

    $("#puntopago_id").change(function() {
        puntoPagoSeleccionado = $(this).val();
        localStorage.setItem('puntoPagoSeleccionado', puntoPagoSeleccionado);
    });

    // Configurar autocompletado para búsqueda de producto
    function configurarAutocompletar(idCampo) {
        $(idCampo).autocomplete({
            delay: 300,
            source: function(request, response) {
                $.ajax({
                    url: "{% url 'buscar_productos' %}",
                    method: "GET",
                    data: {
                        term: request.term,
                        sucursal_id: sucursalSeleccionada
                    },
                    success: function(data) {
                        response(data.productos.map(function(producto) {
                            return {
                                label: producto.nombre,
                                value: producto.nombre,
                                id: producto.productoid,
                                codigo_de_barras: producto.codigo_de_barras
                            };
                        }));
                    }
                });
            },
            select: function(event, ui) {
                actualizarCampos(ui.item);
            }
        });
    }

    configurarAutocompletar("#producto_busqueda_nombre");
    configurarAutocompletar("#producto_busqueda_codigo");
    configurarAutocompletar("#producto_busqueda_codigo_barras");

    // Configurar Quagga para escanear código de barras
    $("#btnEscanear").click(function() {
        $("#interactive").show();
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: $("#interactive")[0],
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment"
                }
            },
            decoder: {
                readers: ["ean_reader"]
            },
            locate: true
        }, function(err) {
            if (err) {
                console.error(err);
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
            url: "{% url 'buscar_producto_por_codigo' %}",
            method: "GET",
            data: {
                codigo_de_barras: codigo_de_barras,
                sucursal_id: sucursalSeleccionada
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

    // Agregar producto al carrito
    $("#agregar-producto").click(function(e) {
        e.preventDefault();
        let producto_id = $("#producto_id").val();
        let cantidad = $("#cantidad").val();
        productos.push(producto_id);
        cantidades.push(cantidad);
        $("#productos").val(JSON.stringify(productos));
        $("#cantidades").val(JSON.stringify(cantidades));

        $.ajax({
            url: "{% url 'verificar_producto' %}",
            method: "POST",
            data: {
                producto_id: producto_id,
                cantidad: cantidad,
                sucursal_id: sucursalSeleccionada,
                csrfmiddlewaretoken: '{{ csrf_token }}'
            },
            success: function(response) {
                if (response.exists) {
                    if (response.cantidad_disponible >= cantidad) {
                        $("#detalle-productos tbody").prepend(
                            `<tr>
                                <td data-id="${producto_id}">${$("#producto_busqueda_nombre").val()}</td>
                                <td>${cantidad}</td>
                                <td>${response.precio_unitario_formatted}</td>
                                <td>${response.subtotal_formatted}</td>
                                <td class="text-center"><button class="btn btn-danger btn-sm eliminar-producto"><i class="fas fa-trash-alt"></i></button></td>
                            </tr>`
                        );
                        actualizarTotal();
                        $("#producto_busqueda_nombre, #producto_busqueda_codigo, #producto_busqueda_codigo_barras, #producto_id").val('');
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

    // Eliminar producto del carrito
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
        let total = 0;
        $("#detalle-productos tbody tr").each(function() {
            let subtotal = parseFloat($(this).find("td").eq(3).text().replace(/[^\d.-]/g, ''));
            total += subtotal;
        });
        $("#total").text(new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(total));
    }

    // Modal de pago
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
        let montoRecibido = parseFloat($(this).val());
        let total = parseFloat($("#total").text().replace(/[^0-9,-]+/g, '').replace(',', '.'));
        let cambio = montoRecibido - total;
        if (!isNaN(cambio) && cambio >= 0) {
            $("#cambio").text("Cambio: " + new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(cambio));
        } else {
            $("#cambio").text('');
        }
    });

    confirmarPagoBtn.onclick = function() {
        let selectedMethod = $("input[name='payment_method']:checked").val();
        $("#medio_pago").val(selectedMethod);

        if (selectedMethod === 'nequi') {
            let totalVenta = parseFloat($("#total").text().replace(/[^0-9,-]+/g, '').replace(',', '.'));
            $.ajax({
                url: "{% url 'verificar_pago_nequi' %}",
                method: "POST",
                data: {
                    total: totalVenta,
                    csrfmiddlewaretoken: '{{ csrf_token }}'
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
            let montoRecibido = parseFloat($("#monto-recibido").val());
            let totalVenta = parseFloat($("#total").text().replace(/[^0-9,-]+/g, '').replace(',', '.'));
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

    // Autocomplete para Cliente
    $("#cliente_busqueda").autocomplete({
        source: function(request, response) {
            $.ajax({
                url: "{% url 'buscar_cliente' %}",
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
    });

    // Filtrar detalles del carrito
    $("#buscar-detalles").on("keyup", function() {
        var value = $(this).val().toLowerCase();
        $("#detalle-productos tbody tr").filter(function() {
            $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
        });
    });

    // Habilitar campos cuando haya sucursal seleccionada
    if (sucursalSeleccionada) {
        $("#producto_busqueda_nombre, #producto_busqueda_codigo, #producto_busqueda_codigo_barras, #cantidad, #agregar-producto").prop("disabled", false);
    }
});
