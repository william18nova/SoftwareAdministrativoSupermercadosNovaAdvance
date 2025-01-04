from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import Usuario, Sucursal, Categoria, Producto, Inventario, Proveedor, PreciosProveedor, PuntosPago, Rol, Empleado, HorariosNegocio, HorarioCaja, Cliente, Venta, DetalleVenta
from django.db.models import Count, Sum, Exists, OuterRef, Q
from django.http import JsonResponse
from django.contrib.auth import authenticate, login as auth_login
import json
from datetime import datetime
from django.utils import timezone
from django.contrib.auth import authenticate, login
import logging
from django.db import transaction
import subprocess
import os
from .nequi_websocket import verificacionPago
from django.views.decorators.csrf import csrf_exempt
from .forms import (
    CategoriaForm,
    ClienteForm,
    EmpleadoForm,
    HorarioCajaForm,
    HorariosNegocioForm,
    SucursalForm,
    ProductoForm,
    ProveedorForm,
    RolForm, 
    PreciosProveedorForm
)
from dal import autocomplete
from decimal import Decimal

logger = logging.getLogger(__name__)


def login(request):
    if request.method == 'POST':
        nombreusuario = request.POST.get('nombreusuario')
        contraseña = request.POST.get('contraseña')

        usuario = authenticate(request, username=nombreusuario, password=contraseña)
        
        if usuario is not None:
            auth_login(request, usuario)
            return redirect('home')  # Asegúrate de que 'home' está definido en tus URLs
        else:
            messages.error(request, 'Nombre de usuario o contraseña incorrectos')

    return render(request, 'login.html')


@login_required
def homePage_view(request):
    return render(request, 'homePage.html')


@login_required
def agregar_sucursal_view(request):
    if request.method == 'POST':
        form = SucursalForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True, 'message': 'Sucursal agregada exitosamente.'})
        else:
            errors = form.errors.get_json_data()  # Obtener errores como dict
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = SucursalForm()
    return render(request, 'agregar_sucursal.html', {'form': form})


@login_required
def visualizar_sucursales_view(request):
    sucursales = Sucursal.objects.all()
    return render(request, 'visualizar_sucursales.html', {'sucursales': sucursales})


@login_required
def eliminar_sucursal(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, sucursalid=sucursal_id)
    if request.method == 'POST':
        sucursal.delete()
        messages.success(request, 'La sucursal ha sido eliminada exitosamente.')
        return redirect('visualizar_sucursales')
    return render(request, 'visualizar_sucursales.html', {'sucursales': Sucursal.objects.all()})


@login_required
def editar_sucursal_view(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, sucursalid=sucursal_id)
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        direccion = request.POST.get('direccion')
        telefono = request.POST.get('telefono')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(request, 'editar_sucursal.html', {'sucursal': sucursal})

        if Sucursal.objects.filter(nombre=nombre).exclude(sucursalid=sucursal_id).exists():
            messages.error(request, 'El Nombre de la sucursal ya está registrado.')
            return render(request, 'editar_sucursal.html', {'sucursal': sucursal})

        sucursal.nombre = nombre
        sucursal.direccion = direccion
        sucursal.telefono = telefono
        sucursal.save()
        messages.success(
            request,
            f'Sucursal actualizada exitosamente: Nombre={nombre}, Dirección={direccion}, Teléfono={telefono}'
        )
        return redirect('visualizar_sucursales')

    return render(request, 'editar_sucursal.html', {'sucursal': sucursal})


@login_required
def agregar_categoria_view(request):
    """
    Vista para agregar una categoría usando AJAX.
    Retorna un JSON con success=True o success=False y la lista de errores en caso de no ser válido.
    """
    if request.method == 'POST':
        form = CategoriaForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = CategoriaForm()
    
    return render(request, 'agregar_categoria.html', {'form': form})


@login_required
def visualizar_categorias_view(request):
    categorias = Categoria.objects.all()
    return render(request, 'visualizar_categorias.html', {'categorias': categorias})


@login_required
def eliminar_categoria(request, categoria_id):
    categoria = get_object_or_404(Categoria, categoriaid=categoria_id)
    nombre_categoria = categoria.nombre
    if request.method == 'POST':
        productos_asociados = Producto.objects.filter(categoria=categoria)
        productos_asociados.update(categoria=None)

        categoria.delete()
        messages.success(request, f'La categoría "{nombre_categoria}" ha sido eliminada exitosamente.')
        return redirect('visualizar_categorias')
    return render(request, 'visualizar_categorias.html', {'categorias': Categoria.objects.all()})


@login_required
def editar_categoria_view(request, categoria_id):
    categoria = get_object_or_404(Categoria, categoriaid=categoria_id)
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(request, 'editar_categoria.html', {'categoria': categoria})

        if Categoria.objects.filter(nombre=nombre).exclude(categoriaid=categoria_id).exists():
            messages.error(request, 'El Nombre de la categoría ya está registrado.')
            return render(request, 'editar_categoria.html', {'categoria': categoria})

        categoria.nombre = nombre
        categoria.descripcion = descripcion
        categoria.save()
        messages.success(request, f'Categoría actualizada exitosamente a "{nombre}".')
        return redirect('visualizar_categorias')

    return render(request, 'editar_categoria.html', {'categoria': categoria})


@login_required
def agregar_producto_view(request):
    if request.method == 'POST':
        form = ProductoForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True, 'message': 'Producto agregado exitosamente.'})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = ProductoForm()
    categorias = Categoria.objects.all()
    return render(request, 'agregar_producto.html', {'form': form, 'categorias': categorias})

@login_required
def categoria_autocomplete(request):
    """
    Autocomplete para Categoría.
    """
    term = request.GET.get('term', '').strip()
    page = request.GET.get('page', '1').strip()
    per_page = 10  # Número de resultados por página

    try:
        page = int(page)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    categorias = Categoria.objects.filter(
        Q(nombre__icontains=term)
    ).order_by('nombre')

    total_results = categorias.count()
    categorias = categorias[start:end]

    results = []
    for categoria in categorias:
        results.append({
            'id': categoria.categoriaid,
            'text': categoria.nombre,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })


@login_required
def visualizar_productos_view(request):
    productos = Producto.objects.all()
    return render(request, 'visualizar_productos.html', {'productos': productos})


@login_required
def eliminar_producto(request, producto_id):
    producto = get_object_or_404(Producto, productoid=producto_id)
    if request.method == 'POST':
        nombre_producto = producto.nombre
        producto.delete()
        messages.success(request, f'El producto "{nombre_producto}" ha sido eliminado exitosamente.')
        return redirect('visualizar_productos')
    return render(request, 'visualizar_productos.html', {'productos': Producto.objects.all()})


@login_required
def editar_producto_view(request, producto_id):
    producto = get_object_or_404(Producto, productoid=producto_id)
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion')
        precio = request.POST.get('precio')
        categoria_id = request.POST.get('categoria')
        codigo_de_barras = request.POST.get('codigo_de_barras')
        iva = request.POST.get('iva')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(
                request,
                'editar_producto.html',
                {'producto': producto, 'categorias': Categoria.objects.all()}
            )

        if Producto.objects.filter(nombre=nombre).exclude(productoid=producto_id).exists():
            messages.error(request, 'El Nombre del producto ya está registrado.')
            return render(
                request,
                'editar_producto.html',
                {'producto': producto, 'categorias': Categoria.objects.all()}
            )

        producto.nombre = nombre
        producto.descripcion = descripcion
        producto.precio = precio
        producto.categoria_id = categoria_id if categoria_id else None
        producto.codigo_de_barras = codigo_de_barras
        producto.iva = iva
        producto.save()
        messages.success(
            request,
            f'Producto actualizado exitosamente: '
            f'Nombre={nombre}, Descripción={descripcion}, Precio={precio}, '
            f'Categoría={producto.categoria.nombre if producto.categoria else "Sin categoría"}'
        )
        return redirect('visualizar_productos')

    return render(
        request,
        'editar_producto.html',
        {'producto': producto, 'categorias': Categoria.objects.all()}
    )


@login_required
def agregar_inventario_view(request):
    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        sucursal = get_object_or_404(Sucursal, pk=sucursal_id)

        productos = request.POST.getlist('producto[]')
        cantidades = request.POST.getlist('cantidad[]')

        for producto_id, cantidad in zip(productos, cantidades):
            producto = get_object_or_404(Producto, pk=producto_id)
            Inventario.objects.create(
                productoid=producto,
                sucursalid=sucursal,
                cantidad=int(cantidad)
            )

        messages.success(request, 'Inventario creado exitosamente')
        return redirect('agregar_inventario')

    sucursales_sin_inventario = Sucursal.objects.annotate(inventarios_count=Count('inventario')) \
                                                .filter(inventarios_count=0)
    productos = Producto.objects.all()

    if not sucursales_sin_inventario.exists():
        messages.error(
            request,
            'Todas las sucursales ya tienen inventario. '
            'Debe ir a visualizar inventario para modificarlas o ir a agregar sucursales para añadir nuevas.'
        )

    if not productos.exists():
        messages.error(
            request,
            'No hay productos en el sistema. Debe ir a agregar productos para añadir productos al sistema.'
        )

    return render(request, 'agregar_inventario.html', {
        'sucursales': sucursales_sin_inventario,
        'productos': productos
    })

@login_required
def sucursal_inventario_autocomplete(request):
    """
    Lista únicamente las sucursales que no tengan inventario
    (o la lógica que tú prefieras).
    Incluye scroll infinito con 'term' y 'page'.
    """
    print("DEBUG: ¡Entré a la vista de autocompletado de sucursales!")  # <-- Comprobación
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page = 10  # Ajusta el número de resultados por página

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    # Filtrar sucursales sin inventario
    qs = (Sucursal.objects.annotate(inventarios_count=Count('inventario'))
                        .filter(inventarios_count=0)
                        .order_by('nombre'))

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for sucursal in qs:
        results.append({
            'id': sucursal.sucursalid,
            'text': sucursal.nombre,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })

@login_required
def producto_inventario_autocomplete(request):
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    excluded_str = request.GET.get('excluded', '').strip()  # <-- AQUÍ
    per_page = 10

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    qs = Producto.objects.all().order_by('nombre')

    # Excluir IDs listados
    excluded_ids = []
    if excluded_str:
        try:
            excluded_ids = [int(x) for x in excluded_str.split(',') if x.isdigit()]
        except:
            pass

    if excluded_ids:
        qs = qs.exclude(productoid__in=excluded_ids)

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for prod in qs:
        results.append({
            'id': prod.productoid,
            'text': prod.nombre,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })

@login_required
def visualizar_inventarios_view(request):
    sucursales_con_inventario = Sucursal.objects.filter(inventario__isnull=False).distinct()
    sucursal_id = request.POST.get('sucursal')
    inventario_global = False
    inventarios = []
    inventario_global_data = []

    if sucursal_id and sucursal_id != "global":
        sucursal_seleccionada = get_object_or_404(Sucursal, pk=int(sucursal_id))
        inventarios = Inventario.objects.filter(sucursalid=sucursal_seleccionada)
    elif sucursal_id == "global":
        inventario_global = True
        inventario_global_data = Inventario.objects.values('productoid__nombre').annotate(
            total_cantidad=Sum('cantidad')
        )

    context = {
        'sucursales': sucursales_con_inventario,
        'inventarios': inventarios,
        'inventario_global': inventario_global,
        'inventario_global_data': inventario_global_data,
        'sucursal_seleccionada': (
            sucursal_seleccionada if (sucursal_id and sucursal_id != "global") else None
        ),
    }
    return render(request, 'visualizar_inventarios.html', context)


@login_required
def editar_inventario_view(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, pk=sucursal_id)
    inventarios = Inventario.objects.filter(sucursalid=sucursal)
    productos = Producto.objects.exclude(inventario__sucursalid=sucursal)

    if request.method == 'POST':
        for inventario in inventarios:
            cantidad = request.POST.get(f'cantidad_{inventario.inventarioid}')
            if cantidad:
                inventario.cantidad = cantidad
                inventario.save()

        nuevos_productos = request.POST.getlist('nuevo_producto[]')
        nuevas_cantidades = request.POST.getlist('nueva_cantidad[]')
        for producto_id, cantidad in zip(nuevos_productos, nuevas_cantidades):
            producto = get_object_or_404(Producto, pk=producto_id)
            Inventario.objects.create(
                productoid=producto,
                sucursalid=sucursal,
                cantidad=cantidad
            )

        messages.success(
            request,
            f'Inventario de la sucursal {sucursal.nombre} actualizado exitosamente.'
        )
        return redirect('visualizar_inventarios')

    return render(request, 'editar_inventario.html', {
        'sucursal': sucursal,
        'inventarios': inventarios,
        'productos': productos,
    })


@login_required
def eliminar_producto_inventario_view(request, inventario_id):
    if request.method == 'POST':
        inventario = get_object_or_404(Inventario, pk=inventario_id)
        producto_nombre = inventario.productoid.nombre
        inventario.delete()
        return JsonResponse({
            'success': True,
            'message': f'Producto "{producto_nombre}" eliminado exitosamente.',
            'producto_nombre': producto_nombre
        })
    return JsonResponse({'success': False, 'message': 'Método no permitido.'}, status=405)


@login_required
def agregar_proveedor_view(request):
    if request.method == 'POST':
        form = ProveedorForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True, 'message': 'Proveedor agregado exitosamente.'})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = ProveedorForm()
    return render(request, 'agregar_proveedor.html', {'form': form})


@login_required
def visualizar_proveedores_view(request):
    proveedores = Proveedor.objects.all()
    return render(request, 'visualizar_proveedores.html', {'proveedores': proveedores})


@login_required
def eliminar_proveedor(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, proveedorid=proveedor_id)
    if request.method == 'POST':
        proveedor.delete()
        messages.success(request, 'El proveedor ha sido eliminado exitosamente.')
        return redirect('visualizar_proveedores')
    return render(request, 'visualizar_proveedores.html', {'proveedores': Proveedor.objects.all()})


@login_required
def editar_proveedor_view(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, pk=proveedor_id)
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        empresa = request.POST.get('empresa')
        telefono = request.POST.get('telefono')
        email = request.POST.get('email')
        direccion = request.POST.get('direccion')

        if not nombre or not empresa or not telefono or not email or not direccion:
            messages.error(request, 'Todos los campos son obligatorios.')
        elif Proveedor.objects.exclude(pk=proveedor_id).filter(nombre=nombre).exists():
            messages.error(request, 'Ya existe un proveedor con ese nombre.')
        else:
            proveedor.nombre = nombre
            proveedor.empresa = empresa
            proveedor.telefono = telefono
            proveedor.email = email
            proveedor.direccion = direccion
            proveedor.save()
            messages.success(request, 'El proveedor ha sido actualizado exitosamente.')
            return redirect('visualizar_proveedores')

    return render(request, 'editar_proveedor.html', {'proveedor': proveedor})


@login_required
def agregar_productos_precios_proveedor_view(request):
    """
    Vista para agregar productos con sus precios a un Proveedor.
    Maneja tanto GET como POST.
    - En GET, muestra el formulario con autocompletados.
    - En POST, valida el formulario y procesa los productos y precios temporales.
      Responde con JSON para manejar las respuestas en el frontend.
    """
    if request.method == 'POST':
        form = PreciosProveedorForm(request.POST)
        if form.is_valid():
            precios_temp = request.POST.get('precios_temp')
            if precios_temp:
                precios = json.loads(precios_temp)
                proveedor = form.cleaned_data['proveedor']
                for precio in precios:
                    producto = get_object_or_404(Producto, pk=precio['productId'])
                    # Evitar duplicados
                    if PreciosProveedor.objects.filter(productoid=producto, proveedorid=proveedor).exists():
                        continue  # Puedes optar por manejar esto de otra manera si es necesario
                    PreciosProveedor.objects.create(
                        productoid=producto,
                        proveedorid=proveedor,
                        precio=Decimal(precio['price'])
                    )
                return JsonResponse({'success': True})
            else:
                errors = {
                    'precios_temp': [{'message': 'Debe agregar al menos un producto antes de guardar.'}]
                }
                return JsonResponse({'success': False, 'errors': json.dumps(errors)})
        else:
            # Convertir errores del formulario a JSON
            errors = form.errors.get_json_data()
            # Procesar errores para el formato esperado por el frontend
            processed_errors = {}
            for field, field_errors in errors.items():
                processed_errors[field] = [{'message': error['message']} for error in field_errors]
            return JsonResponse({'success': False, 'errors': json.dumps(processed_errors)})
    else:
        form = PreciosProveedorForm()

    return render(request, 'agregar_productos_precios_proveedor.html', {'form': form})
    
@login_required
def proveedor_precios_autocomplete(request):
    """
    Autocomplete de Proveedores, excluyendo aquellos que ya
    tienen registros en PreciosProveedor.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page = 10  # Cantidad de resultados por página

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    # Excluir Proveedores que ya tengan algo en PreciosProveedor
    # => Los que tengan precios_count=0
    qs = (
        Proveedor.objects.annotate(precios_count=Count('preciosproveedor'))
                         .filter(precios_count=0)
    )

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    # Paginamos
    qs = qs.order_by('nombre')[start:end]

    results = []
    for prov in qs:
        results.append({
            'id': prov.proveedorid,
            'text': prov.nombre,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })


@login_required
def producto_precios_autocomplete(request):
    """
    Autocomplete para Producto, excluyendo IDs pasados via 'excluded'.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    excluded_str = request.GET.get('excluded', '').strip()
    per_page = 10

    try:
        page = int(page_str)
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    start = (page - 1) * per_page
    end = start + per_page

    qs = Producto.objects.all().order_by('nombre')

    # Excluir IDs
    excluded_ids = []
    if excluded_str:
        try:
            excluded_ids = [int(x) for x in excluded_str.split(',') if x.isdigit()]
        except:
            pass

    if excluded_ids:
        qs = qs.exclude(productoid__in=excluded_ids)

    if term:
        qs = qs.filter(nombre__icontains=term)

    total_results = qs.count()
    qs = qs[start:end]

    results = []
    for prod in qs:
        results.append({
            'id': prod.productoid,
            'text': prod.nombre,
        })

    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })


@login_required
def visualizar_productos_precios_proveedores_view(request):
    proveedores = Proveedor.objects.annotate(product_count=Count('preciosproveedor')).filter(product_count__gt=0)
    productos_precios = None
    proveedor_seleccionado = None

    if request.method == 'POST':
        proveedor_id = request.POST.get('proveedor')
        if proveedor_id:
            proveedor_seleccionado = get_object_or_404(Proveedor, pk=proveedor_id)
            productos_precios = PreciosProveedor.objects.filter(proveedorid=proveedor_seleccionado)

    return render(request, 'visualizar_productos_precios_proveedores.html', {
        'proveedores': proveedores,
        'productos_precios': productos_precios,
        'proveedor_seleccionado': proveedor_seleccionado,
    })


@login_required
def eliminar_precio_proveedor_view(request, id):
    if request.method == 'POST':
        precio_proveedor = get_object_or_404(PreciosProveedor, pk=id)
        nombre_producto = precio_proveedor.productoid.nombre
        precio_proveedor.delete()
        return JsonResponse({'success': True, 'message': f'Producto "{nombre_producto}" eliminado correctamente.'})
    return JsonResponse({'success': False, 'message': 'Error al eliminar el producto.'})


@login_required
def editar_productos_precios_proveedor_view(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, pk=proveedor_id)
    productos_precios = PreciosProveedor.objects.filter(proveedorid=proveedor)
    productos_existentes = list(productos_precios.values_list('productoid', flat=True))
    productos = Producto.objects.all()

    if request.method == 'POST':
        nuevos_productos_ids = request.POST.getlist('producto[]')
        nuevos_precios = request.POST.getlist('precio[]')

        nuevos_productos_ids = [pid for pid in nuevos_productos_ids if pid]
        nuevos_precios = [precio for precio in nuevos_precios if precio]

        # Eliminar productos que no estén en la nueva lista
        PreciosProveedor.objects.filter(proveedorid=proveedor).exclude(productoid__in=nuevos_productos_ids).delete()

        # Actualizar o crear registros
        for producto_id, precio in zip(nuevos_productos_ids, nuevos_precios):
            if producto_id and precio:
                producto = get_object_or_404(Producto, pk=producto_id)
                PreciosProveedor.objects.update_or_create(
                    productoid=producto,
                    proveedorid=proveedor,
                    defaults={'precio': precio}
                )

        messages.success(request, 'Productos y precios actualizados exitosamente para el proveedor.')
        return redirect('visualizar_productos_precios_proveedores')

    return render(request, 'editar_productos_precios_proveedor.html', {
        'proveedor': proveedor,
        'productos_precios': productos_precios,
        'productos': productos,
        'productos_existentes': productos_existentes,
    })


@login_required
def agregar_punto_pago_view(request):
    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        nombres = request.POST.getlist('nombre[]')
        descripciones = request.POST.getlist('descripcion[]')
        dinero_caja_list = request.POST.getlist('dinerocaja[]')

        if not sucursal_id:
            messages.error(request, 'La sucursal es obligatoria.')
            return redirect('agregar_punto_pago')

        if not nombres:
            messages.error(request, 'Debe agregar al menos un punto de pago.')
            return redirect('agregar_punto_pago')

        sucursal = Sucursal.objects.get(sucursalid=sucursal_id)

        for nombre, descripcion, dinero_caja in zip(nombres, descripciones, dinero_caja_list):
            if nombre:
                if PuntosPago.objects.filter(sucursalid=sucursal, nombre=nombre).exists():
                    messages.error(
                        request,
                        f'La sucursal ya tiene un punto de pago con el nombre {nombre}.'
                    )
                    return redirect('agregar_punto_pago')
                
                punto_pago = PuntosPago(
                    sucursalid=sucursal,
                    nombre=nombre,
                    descripcion=descripcion or "",
                    dineroCaja=dinero_caja or 0.00
                )
                punto_pago.save()

        messages.success(request, 'Puntos de pago agregados exitosamente.')
        return redirect('agregar_punto_pago')

    sucursales_sin_punto_pago = Sucursal.objects.exclude(puntospago__isnull=False)
    return render(request, 'agregar_punto_pago.html', {'sucursales': sucursales_sin_punto_pago})


@login_required
def visualizar_puntos_pago_view(request):
    sucursales = Sucursal.objects.annotate(punto_count=Count('puntospago')).filter(punto_count__gt=0)
    puntos_pago = None
    sucursal_seleccionada = None

    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        if sucursal_id:
            sucursal_seleccionada = get_object_or_404(Sucursal, pk=sucursal_id)
            puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_seleccionada)

    return render(request, 'visualizar_puntos_pago.html', {
        'sucursales': sucursales,
        'puntos_pago': puntos_pago,
        'sucursal_seleccionada': sucursal_seleccionada,
    })


@login_required
def eliminar_punto_pago_view(request, puntopagoid):
    if request.method == 'POST':
        try:
            punto_pago = get_object_or_404(PuntosPago, pk=puntopagoid)
            nombre_punto = punto_pago.nombre
            punto_pago.delete()
            return JsonResponse({'success': True, 'message': f'Punto de pago "{nombre_punto}" eliminado correctamente.'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': f'Error al eliminar el punto de pago: {str(e)}'})
    return JsonResponse({'success': False, 'message': 'Método no permitido.'})


@login_required
def editar_puntos_pago_view(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, pk=sucursal_id)
    puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_id)

    if request.method == 'POST':
        nuevos_nombres = request.POST.getlist('nombre[]')
        nuevas_descripciones = request.POST.getlist('descripcion[]')

        nuevos_nombres = [nombre for nombre in nuevos_nombres if nombre]
        nuevas_descripciones = [descripcion for descripcion in nuevas_descripciones]

        # Eliminar puntos de pago que ya no están en la nueva lista
        PuntosPago.objects.filter(sucursalid=sucursal_id).exclude(nombre__in=nuevos_nombres).delete()

        # Crear o actualizar puntos de pago
        for nombre, descripcion in zip(nuevos_nombres, nuevas_descripciones):
            if nombre:
                PuntosPago.objects.update_or_create(
                    nombre=nombre,
                    sucursalid=sucursal,
                    defaults={'descripcion': descripcion}
                )

        messages.success(
            request,
            f'Puntos de pago de la sucursal {sucursal.nombre} actualizados exitosamente.'
        )
        return redirect('visualizar_puntos_pago')

    return render(request, 'editar_puntos_pago.html', {
        'sucursal': sucursal,
        'puntos_pago': puntos_pago,
    })


@login_required
def agregar_rol_view(request):
    if request.method == 'POST':
        form = RolForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True, 'message': 'Rol agregado exitosamente.'})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = RolForm()
    return render(request, 'agregar_rol.html', {'form': form})


@login_required
def visualizar_roles_view(request):
    roles = Rol.objects.all()
    return render(request, 'visualizar_roles.html', {'roles': roles})


@login_required
def editar_rol_view(request, rol_id):
    rol = get_object_or_404(Rol, pk=rol_id)
    
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion')
        
        if nombre and nombre != rol.nombre:
            if Rol.objects.filter(nombre=nombre).exclude(pk=rol_id).exists():
                messages.error(request, 'Ya existe un rol con ese nombre.')
                return redirect('editar_rol', rol_id=rol_id)
        
        rol.nombre = nombre
        rol.descripcion = descripcion
        rol.save()
        
        messages.success(request, f'Rol "{rol.nombre}" actualizado correctamente.')
        return redirect('visualizar_roles')
    
    return render(request, 'editar_rol.html', {'rol': rol})


@login_required
def eliminar_rol_view(request, rol_id):
    if request.method == 'POST':
        rol = get_object_or_404(Rol, pk=rol_id)
        nombre_rol = rol.nombre
        rol.delete()
        messages.success(request, f'Se eliminó el rol "{nombre_rol}" correctamente.')
        return redirect('visualizar_roles')
    return JsonResponse({'success': False, 'message': 'Error al eliminar el rol.'})


@login_required
def agregar_usuario_view(request):
    roles = Rol.objects.all()

    if request.method == 'POST':
        nombreusuario = request.POST['nombreusuario']
        contraseña = request.POST['contraseña']
        confirmar_contraseña = request.POST['confirmar_contraseña']
        rol_id = request.POST['rolid']

        if contraseña != confirmar_contraseña:
            messages.error(request, 'Las contraseñas no coinciden.')
        elif Usuario.objects.filter(nombreusuario=nombreusuario).exists():
            messages.error(request, f'El nombre de usuario "{nombreusuario}" ya existe.')
        else:
            nuevo_usuario = Usuario(nombreusuario=nombreusuario, rolid=rol_id)
            nuevo_usuario.set_password(contraseña)  # Encripta la contraseña antes de guardar
            nuevo_usuario.save()
            messages.success(request, f'Usuario "{nombreusuario}" creado exitosamente.')

    return render(request, 'agregar_usuario.html', {'roles': roles})


@login_required
def visualizar_usuarios_view(request):
    usuarios = Usuario.objects.all()
    return render(request, 'visualizar_usuarios.html', {'usuarios': usuarios})


@login_required
def editar_usuario_view(request, usuarioid):
    usuario = get_object_or_404(Usuario, pk=usuarioid)
    roles = Rol.objects.all()

    if request.method == 'POST':
        usuario.nombreusuario = request.POST['nombreusuario']
        contraseña = request.POST['contraseña']
        confirmar_contraseña = request.POST['confirmar_contraseña']
        usuario.rolid = Rol.objects.get(pk=request.POST['rolid'])

        if contraseña:
            if contraseña == confirmar_contraseña:
                usuario.contraseña = contraseña
            else:
                messages.error(request, 'Las contraseñas no coinciden.')
                return redirect('editar_usuario', usuarioid=usuarioid)

        usuario.save()
        messages.success(request, 'Usuario actualizado exitosamente.')
        return redirect('visualizar_usuarios')

    return render(request, 'editar_usuario.html', {'usuario': usuario, 'roles': roles})


@login_required
def eliminar_usuario_view(request, usuarioid):
    usuario = get_object_or_404(Usuario, pk=usuarioid)
    nombre_usuario = usuario.nombreusuario
    usuario.delete()
    messages.success(request, f'Usuario "{nombre_usuario}" eliminado exitosamente.')
    return redirect('visualizar_usuarios')


@login_required
def agregar_empleado_view(request):
    if request.method == 'POST':
        form = EmpleadoForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True, 'message': 'Empleado agregado exitosamente.'})
        else:
            errors = form.errors.get_json_data()  # Obtener errores como dict
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = EmpleadoForm()
    return render(request, 'agregar_empleado.html', {'form': form})


@login_required
def usuario_autocomplete(request):
    term = request.GET.get('term', '').strip()
    page = request.GET.get('page', '1').strip()
    per_page = 10  # Número de resultados por página
    
    try:
        page = int(page)
        if page < 1:
            page = 1
    except ValueError:
        logger.warning(f"Valor de 'page' no válido: {page}. Estableciendo a 1.")
        page = 1
    
    start = (page - 1) * per_page
    end = start + per_page
    
    # Filtrar Usuarios que no están asignados a ningún Empleado y coinciden con el término
    usuarios = Usuario.objects.filter(
        Q(nombreusuario__icontains=term),
        empleado__isnull=True
    ).order_by('nombreusuario')
    
    total_results = usuarios.count()
    usuarios = usuarios[start:end]
    
    results = []
    for usuario in usuarios:
        results.append({
            'id': usuario.pk,
            'text': usuario.nombreusuario,
        })
    
    return JsonResponse({
        'results': results,
        'has_more': end < total_results,
    })


# === UNIFICAMOS LA FUNCIÓN SUCURSAL_AUTOCOMPLETE (antes aparecía dos veces) === #
@login_required
def sucursal_autocomplete(request):
    """
    Autocomplete para Sucursal que excluye las que ya tengan
    un horario establecido en la tabla HorariosNegocio.
    """
    term = request.GET.get('term', '').strip()
    page_str = request.GET.get('page', '1').strip()
    per_page_str = request.GET.get('per_page', '50').strip()

    # Validar y convertir 'page' a entero
    try:
        page = int(page_str)
    except ValueError:
        page = 1
    if page < 1:
        page = 1

    # Validar y convertir 'per_page' a entero
    try:
        per_page = int(per_page_str)
    except ValueError:
        per_page = 50
    if per_page < 1:
        per_page = 50

    start = (page - 1) * per_page
    end = start + per_page

    # --- 1) Obtener únicamente las sucursales SIN horarios establecidos ---
    sucursales = Sucursal.objects.exclude(horariosnegocio__isnull=False)

    # --- 2) Filtro por nombre con 'term' ---
    if term:
        sucursales = sucursales.filter(nombre__icontains=term)

    # --- 3) Ordenar y paginar ---
    sucursales = sucursales.order_by('nombre')
    total_results = sucursales.count()
    sucursales = sucursales[start:end]

    # Crear la lista de resultados
    results = []
    for sucursal in sucursales:
        results.append({
            'id': sucursal.sucursalid,
            'text': sucursal.nombre,
        })

    # Saber si hay más resultados
    has_more = end < total_results

    # Retornar la respuesta en formato JSON
    return JsonResponse({
        'results': results,
        'has_more': has_more,
    })


@login_required
def sucursal_autocomplete_eliminar(request):
    """
    Nota: si alguna vista estaba usando otra función distinta de sucursal_autocomplete,
    puedes redirigirla o eliminarla. Aquí dejamos una referencia vacía a modo de ejemplo,
    pero lo ideal es eliminar la función duplicada totalmente del código.
    """
    return JsonResponse({'error': 'Función no utilizada.'}, status=404)


@login_required
def visualizar_empleados_view(request):
    empleados = Empleado.objects.all()
    return render(request, 'visualizar_empleados.html', {'empleados': empleados})


@login_required
def editar_empleado_view(request, empleadoid):
    empleado = get_object_or_404(Empleado, pk=empleadoid)
    usuarios = Usuario.objects.exclude(usuarioid__in=Empleado.objects.values('usuarioid')) \
        .union(Usuario.objects.filter(pk=empleado.usuarioid_id))
    sucursales = Sucursal.objects.all()

    if request.method == 'POST':
        nombre = request.POST['nombre']
        apellido = request.POST['apellido']
        telefono = request.POST['telefono']
        email = request.POST['email']
        direccion = request.POST['direccion']
        puesto = request.POST['puesto']
        numerodocumento = request.POST['numerodocumento']
        sucursal_id = request.POST['sucursal']

        if Empleado.objects.filter(telefono=telefono).exclude(pk=empleadoid).exists():
            messages.error(request, 'El teléfono ya está en uso.')
        elif Empleado.objects.filter(email=email).exclude(pk=empleadoid).exists():
            messages.error(request, 'El correo ya está en uso.')
        elif numerodocumento and Empleado.objects.filter(numerodocumento=numerodocumento) \
                                                 .exclude(pk=empleadoid).exists():
            messages.error(request, 'El número de documento ya está en uso.')
        else:
            if numerodocumento:
                empleado.numerodocumento = numerodocumento
            empleado.nombre = nombre
            empleado.apellido = apellido
            empleado.telefono = telefono
            empleado.email = email
            empleado.direccion = direccion
            empleado.puesto = puesto
            empleado.sucursalid_id = sucursal_id
            empleado.save()
            messages.success(request, f'Empleado "{nombre} {apellido}" editado exitosamente.')
            return redirect('visualizar_empleados')

    return render(request, 'editar_empleado.html', {
        'empleado': empleado,
        'usuarios': usuarios,
        'sucursales': sucursales
    })


@login_required
def eliminar_empleado_view(request, empleado_id):
    empleado = get_object_or_404(Empleado, pk=empleado_id)
    nombre_completo = f"{empleado.nombre} {empleado.apellido}"
    empleado.delete()
    messages.success(request, f'Empleado "{nombre_completo}" ha sido eliminado exitosamente.')
    return redirect('visualizar_empleados')


@login_required
def agregar_horario_view(request):
    """
    Vista para agregar horarios a una sucursal.
    Maneja tanto GET como POST requests.
    En POST, valida el formulario y procesa los horarios temporales.
    Responde con JSON para manejar las respuestas en el frontend.
    """
    if request.method == 'POST':
        form = HorariosNegocioForm(request.POST)
        if form.is_valid():
            horarios_temp = request.POST.get('horarios')
            if horarios_temp:
                horarios = json.loads(horarios_temp)
                sucursal = form.cleaned_data['sucursalid']
                for horario in horarios:
                    HorariosNegocio.objects.create(
                        sucursalid=sucursal,
                        dia_semana=horario['dia'],
                        horaapertura=horario['horaapertura'],
                        horacierre=horario['horacierre']
                    )
                return JsonResponse({'success': True})
            else:
                errors = {
                    'horarios': [{'message': 'Debe agregar al menos un horario antes de guardar.'}]
                }
                return JsonResponse({'success': False, 'errors': json.dumps(errors)})
        else:
            # Convertir errores del formulario a JSON
            errors = form.errors.get_json_data()
            # Procesar errores para el formato esperado por el frontend
            processed_errors = {}
            for field, field_errors in errors.items():
                processed_errors[field] = [{'message': error['message']} for error in field_errors]
            return JsonResponse({'success': False, 'errors': json.dumps(processed_errors)})
    else:
        form = HorariosNegocioForm()

    return render(request, 'agregar_horario.html', {'form': form})


@login_required
def visualizar_horarios_view(request):
    sucursales = Sucursal.objects.filter(horariosnegocio__isnull=False).distinct()
    sucursal_seleccionada = None
    horarios = []

    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        if sucursal_id:
            sucursal_seleccionada = get_object_or_404(Sucursal, pk=sucursal_id)
            horarios = HorariosNegocio.objects.filter(sucursalid=sucursal_seleccionada)

    return render(request, 'visualizar_horarios.html', {
        'sucursales': sucursales,
        'sucursal_seleccionada': sucursal_seleccionada,
        'horarios': horarios,
    })


@login_required
def editar_horarios_view(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, pk=sucursal_id)
    horarios = HorariosNegocio.objects.filter(sucursalid=sucursal)

    if request.method == 'POST':
        dia_semana = request.POST.get('dia_semana')
        horaapertura = request.POST.get('horaapertura')
        horacierre = request.POST.get('horacierre')
        horarios_json = request.POST.get('horarios')

        if horarios_json:
            horarios_data = json.loads(horarios_json)
            for horario_data in horarios_data:
                HorariosNegocio.objects.update_or_create(
                    horarioid=horario_data.get('id'),
                    defaults={
                        'dia_semana': horario_data['dia'],
                        'horaapertura': horario_data['horaapertura'],
                        'horacierre': horario_data['horacierre'],
                        'sucursalid': sucursal,
                    }
                )

        deleted_horarios_list = request.POST.getlist('deleted_horarios')
        if deleted_horarios_list:
            valid_deleted_ids = [int(id) for id in deleted_horarios_list if id.isdigit()]
            if valid_deleted_ids:
                HorariosNegocio.objects.filter(horarioid__in=valid_deleted_ids).delete()

        messages.success(request, f'Horarios de la sucursal {sucursal.nombre} actualizados correctamente.')
        return redirect('visualizar_horarios')

    return render(request, 'editar_horario.html', {'sucursal': sucursal, 'horarios': horarios})


@login_required
def eliminar_horario_view(request, horario_id):
    if request.method == 'POST':
        horario = get_object_or_404(HorariosNegocio, pk=horario_id)
        horario.delete()
        return JsonResponse({'success': True, 'message': 'Horario eliminado exitosamente.'})
    return JsonResponse({'success': False, 'message': 'Método no permitido.'})


@login_required
def agregar_horario_caja_view(request):
    puntos_con_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef('pk'))

    sucursales = Sucursal.objects.annotate(
        tiene_puntos_sin_horario=Exists(
            PuntosPago.objects.filter(
                sucursalid=OuterRef('pk')
            ).exclude(
                Exists(puntos_con_horario)
            )
        )
    ).filter(tiene_puntos_sin_horario=True).distinct()

    if request.method == 'POST':
        horarios_temp = request.POST.get('horarios')
        horarios_present = bool(horarios_temp and json.loads(horarios_temp))
        form = HorarioCajaForm(request.POST, horarios_present=horarios_present)
        if form.is_valid():
            if horarios_present:
                horarios = json.loads(horarios_temp)
                puntopago = form.cleaned_data['puntopagoid']
                for horario in horarios:
                    HorarioCaja.objects.create(
                        puntopagoid=puntopago,
                        dia_semana=horario['dia'],
                        horaapertura=horario['horaapertura'],
                        horacierre=horario['horacierre']
                    )
                return JsonResponse({'success': True})
            else:
                dia_semana = form.cleaned_data['dia_semana']
                horaapertura = form.cleaned_data['horaapertura']
                horacierre = form.cleaned_data['horacierre']
                puntopago = form.cleaned_data['puntopagoid']

                dias = dia_semana.split(',')
                for dia in dias:
                    HorarioCaja.objects.create(
                        puntopagoid=puntopago,
                        dia_semana=dia,
                        horaapertura=horaapertura,
                        horacierre=horacierre
                    )
                return JsonResponse({'success': True})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = HorarioCajaForm()

    return render(request, 'agregar_horario_caja.html', {
        'form': form,
        'sucursales': sucursales,
    })


@login_required
def puntopago_autocomplete(request):
    try:
        term = request.GET.get('term', '').strip()
        page = request.GET.get('page', '1').strip()
        per_page = 50  # Número de resultados por página

        try:
            page = int(page)
            if page < 1:
                page = 1
        except ValueError:
            logger.warning(f"Valor de 'page' no válido: {page}. Estableciendo a 1.")
            page = 1

        start = (page - 1) * per_page
        end = start + per_page

        sucursal_id = request.GET.get('sucursal_id', None)
        logger.debug(f"Received sucursal_id: {sucursal_id}")

        if not sucursal_id:
            logger.warning("No se proporcionó un ID de sucursal.")
            return JsonResponse({
                'results': [],
                'has_more': False,
                'error': 'No se proporcionó un ID de sucursal.'
            })

        try:
            sucursal_id = int(sucursal_id)
        except ValueError:
            logger.error(f"sucursal_id no es un entero válido: {sucursal_id}")
            return JsonResponse({
                'results': [],
                'has_more': False,
                'error': 'ID de sucursal inválido.'
            })

        try:
            sucursal = Sucursal.objects.get(pk=sucursal_id)
        except Sucursal.DoesNotExist:
            logger.error(f"Sucursal con ID {sucursal_id} no existe.")
            return JsonResponse({
                'results': [],
                'has_more': False,
                'error': 'Sucursal no encontrada.'
            })

        puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal).annotate(
            tiene_horario=Exists(
                HorarioCaja.objects.filter(puntopagoid=OuterRef('pk'))
            )
        ).exclude(tiene_horario=True)

        if term:
            puntos_pago = puntos_pago.filter(nombre__icontains=term)

        total_results = puntos_pago.count()
        puntos_pago = puntos_pago[start:end]

        results = []
        for punto in puntos_pago:
            results.append({
                'id': punto.pk,
                'text': punto.nombre,
            })

        return JsonResponse({
            'results': results,
            'has_more': end < total_results,
        })

    except Exception as e:
        logger.exception("Error inesperado en puntopago_autocomplete")
        return JsonResponse({
            'results': [],
            'has_more': False,
            'error': 'Ocurrió un error interno del servidor.'
        }, status=500)


@login_required
def visualizar_horarios_cajas_view(request):
    puntos_con_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef('pk')).values('puntopagoid')
    sucursales = Sucursal.objects.filter(
        Exists(
            PuntosPago.objects.filter(
                sucursalid=OuterRef('pk')
            ).filter(Exists(puntos_con_horario))
        )
    ).distinct()

    sucursal_seleccionada = None
    punto_pago_seleccionado = None
    puntos_pago = []
    horarios = []

    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        punto_pago_id = request.POST.get('punto_pago')
        if sucursal_id:
            sucursal_seleccionada = get_object_or_404(Sucursal, pk=sucursal_id)
            puntos_pago = PuntosPago.objects.filter(
                sucursalid=sucursal_seleccionada
            ).filter(Exists(puntos_con_horario))
        if punto_pago_id:
            punto_pago_seleccionado = get_object_or_404(PuntosPago, pk=punto_pago_id)
            horarios = HorarioCaja.objects.filter(puntopagoid=punto_pago_seleccionado.puntopagoid)

    return render(request, 'visualizar_horarios_cajas.html', {
        'sucursales': sucursales,
        'sucursal_seleccionada': sucursal_seleccionada,
        'puntos_pago': puntos_pago,
        'punto_pago_seleccionado': punto_pago_seleccionado,
        'horarios': horarios
    })


@login_required
def eliminar_horario_caja_view(request, horario_id):
    try:
        horario = get_object_or_404(HorarioCaja, pk=horario_id)
        horario.delete()
        return JsonResponse({'success': True, 'message': 'Horario eliminado exitosamente.'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': 'Ocurrió un error al eliminar el horario.'})


@login_required
def obtener_puntos_pago_con_horarios(request):
    sucursal_id = request.GET.get('sucursal_id')
    puntos_con_horario = HorarioCaja.objects.filter(puntopagoid=OuterRef('pk')).values('puntopagoid')
    puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_id).filter(Exists(puntos_con_horario))
    opciones = ['<option value="">Seleccionar punto de pago</option>']
    for punto_pago in puntos_pago:
        opciones.append(f'<option value="{punto_pago.puntopagoid}">{punto_pago.nombre}</option>')
    return JsonResponse(opciones, safe=False)


@login_required
def editar_horarios_cajas_view(request, puntopagoid):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            horarios = data.get('horarios', [])

            punto_pago = get_object_or_404(PuntosPago, pk=puntopagoid)
            HorarioCaja.objects.filter(puntopagoid=puntopagoid).delete()
            for horario in horarios:
                dia = horario['dia']
                hora_apertura = horario['hora_apertura']
                hora_cierre = horario['hora_cierre']
                HorarioCaja.objects.create(
                    puntopagoid=puntopagoid,
                    dia_semana=dia,
                    horaapertura=hora_apertura,
                    horacierre=hora_cierre
                )

            messages.success(
                request,
                f'Se ha editado correctamente la caja del punto de pago {punto_pago.nombre} '
                f'de la sucursal {punto_pago.sucursalid.nombre}'
            )
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    else:
        punto_pago = get_object_or_404(PuntosPago, pk=puntopagoid)
        sucursal = punto_pago.sucursalid
        horarios = HorarioCaja.objects.filter(puntopagoid=puntopagoid)

        return render(request, 'editar_horarios_cajas.html', {
            'punto_pago': punto_pago,
            'horarios': horarios,
            'sucursal': sucursal
        })


def agregar_cliente(request):
    """
    Vista para agregar un cliente usando AJAX. La validación (número de documento,
    teléfono, nombre, apellido, correo único) se maneja en ClienteForm.
    Devuelve un JSON con success=True o success=False y la lista de errores.
    """
    if request.method == 'POST':
        form = ClienteForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse({'success': True})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'errors': errors})
    else:
        form = ClienteForm()
    
    return render(request, 'agregar_cliente.html', {'form': form})


@login_required
def visualizar_clientes(request):
    clientes = Cliente.objects.all()
    return render(request, 'visualizar_clientes.html', {'clientes': clientes})


@login_required
def eliminar_cliente(request, clienteid):
    cliente = get_object_or_404(Cliente, clienteid=clienteid)
    cliente.delete()
    messages.success(request, 'Cliente eliminado exitosamente.')
    return redirect('visualizar_clientes')


@login_required
def editar_cliente(request, clienteid):
    cliente = get_object_or_404(Cliente, clienteid=clienteid)
    if request.method == 'POST':
        cliente.numerodocumento = request.POST.get('numerodocumento')
        cliente.nombre = request.POST.get('nombre')
        cliente.apellido = request.POST.get('apellido')
        cliente.telefono = request.POST.get('telefono')
        cliente.email = request.POST.get('email')
        
        try:
            cliente.save()
            messages.success(
                request,
                f'Cliente con número de documento {cliente.numerodocumento} editado exitosamente.'
            )
            return redirect('visualizar_clientes')
        except Exception as e:
            messages.error(request, f'Ocurrió un error al guardar los cambios: {str(e)}')

    return render(request, 'editar_cliente.html', {'cliente': cliente})


@login_required
def generar_venta(request):
    if request.method == 'POST':
        cliente_id = request.POST.get('cliente_id')
        sucursal_id = request.POST.get('sucursal_id')
        puntopago_id = request.POST.get('puntopago_id')
        productos = json.loads(request.POST.get('productos', '[]'))
        cantidades = json.loads(request.POST.get('cantidades', '[]'))
        medio_pago = request.POST.get('medio_pago')

        total = 0
        detalles = []

        try:
            productos_obj = Producto.objects.filter(productoid__in=productos)
            inventarios = Inventario.objects.filter(productoid__in=productos_obj, sucursalid=sucursal_id)

            for i, producto in enumerate(productos_obj):
                inventario = inventarios.get(productoid=producto)
                cantidad = int(cantidades[i])
                if cantidad > inventario.cantidad:
                    return JsonResponse({
                        'success': False,
                        'error': f'No hay suficiente stock de {producto.nombre} en la sucursal seleccionada.'
                    })

                subtotal = producto.precio * cantidad
                total += subtotal
                detalles.append({
                    'producto': producto.nombre,
                    'cantidad': cantidad,
                    'precio_unitario': producto.precio,
                    'subtotal': subtotal,
                    'productoid': producto.productoid
                })

        except Exception as e:
            return JsonResponse({'success': False, 'error': 'Error al procesar los productos.'})

        if medio_pago == 'nequi' and not request.POST.get('confirmar_nequi'):
            try:
                script_path = os.path.join(os.path.dirname(__file__), 'nequi_websocket.py')
                result = subprocess.run(['python', script_path], capture_output=True, text=True, timeout=60)
                if 'se pago' not in result.stdout:
                    return JsonResponse({'success': False, 'error': 'El pago no fue confirmado.'})
            except subprocess.TimeoutExpired:
                return JsonResponse({'success': False, 'error': 'El tiempo de espera para la confirmación del pago ha expirado.'})
            except Exception as e:
                return JsonResponse({'success': False, 'error': f'Error en la conexión de WebSocket: {str(e)}'})

        return procesar_venta(request, cliente_id, sucursal_id, puntopago_id, productos, cantidades, medio_pago, detalles, total)

    sucursal_id = request.GET.get('sucursal_id')
    puntopago_id = request.GET.get('puntopago_id')
    return render(request, 'generar_venta.html', obtener_contexto(sucursal_id, puntopago_id))


def procesar_venta(request, cliente_id, sucursal_id, puntopago_id, productos, cantidades, medio_pago, detalles, total):
    try:
        with transaction.atomic():
            empleado = getattr(request.user, 'empleado', None)
            if empleado is None:
                messages.error(request, 'El usuario autenticado no tiene un empleado asociado.')
                return JsonResponse({'success': False, 'message': 'El usuario autenticado no tiene un empleado asociado.'})

            cliente = Cliente.objects.get(pk=cliente_id) if cliente_id else None
            sucursal = Sucursal.objects.get(pk=sucursal_id)
            puntopago = PuntosPago.objects.get(pk=puntopago_id)

            venta = Venta.objects.create(
                fecha=timezone.now().date(),
                hora=timezone.now().time(),
                clienteid=cliente,
                empleadoid=empleado,
                sucursalid=sucursal,
                puntopagoid=puntopago,
                total=total,
                mediopago=medio_pago
            )

            for detalle in detalles:
                DetalleVenta.objects.create(
                    ventaid=venta,
                    productoid_id=detalle['productoid'],
                    cantidad=detalle['cantidad'],
                    preciounitario=detalle['precio_unitario']
                )
                inventario = Inventario.objects.get(
                    productoid_id=detalle['productoid'],
                    sucursalid=sucursal_id
                )
                inventario.cantidad -= detalle['cantidad']
                inventario.save()

        return JsonResponse({'success': True, 'sucursal_id': sucursal_id, 'puntopago_id': puntopago_id})

    except Exception as e:
        return JsonResponse({'success': False, 'message': 'Error al crear la venta.'})


def obtener_contexto(sucursal_id=None, puntopago_id=None, detalles=[], total=0):
    return {
        'clientes': Cliente.objects.all(),
        'sucursales': Sucursal.objects.all(),
        'puntos_pago': (
            PuntosPago.objects.filter(sucursalid=sucursal_id)
            if sucursal_id else PuntosPago.objects.none()
        ),
        'productos': Producto.objects.all(),
        'detalles': detalles,
        'total': total,
        'selected_sucursal': sucursal_id,
        'selected_puntopago': puntopago_id
    }


@login_required
def verificar_producto(request):
    if request.method == 'POST':
        producto_id = request.POST.get('producto_id')
        cantidad = int(request.POST.get('cantidad'))
        sucursal_id = request.POST.get('sucursal_id')

        try:
            producto = Producto.objects.get(productoid=producto_id)
            inventario = Inventario.objects.get(productoid=producto, sucursalid=sucursal_id)

            if inventario.cantidad >= cantidad:
                precio_unitario = producto.precio
                subtotal = precio_unitario * cantidad
                return JsonResponse({
                    'exists': True,
                    'precio_unitario': precio_unitario,
                    'subtotal': subtotal,
                    'precio_unitario_formatted': "${:,.2f}".format(precio_unitario),
                    'subtotal_formatted': "${:,.2f}".format(subtotal),
                    'cantidad_disponible': inventario.cantidad,
                    'nombre': producto.nombre,
                    'codigo_de_barras': producto.codigo_de_barras
                })
            else:
                return JsonResponse({'exists': True, 'cantidad_disponible': inventario.cantidad})
        except Producto.DoesNotExist:
            return JsonResponse({'exists': False})
    return JsonResponse({'exists': False})


@login_required
def obtener_puntos_pago(request):
    sucursal_id = request.GET.get('sucursal_id')
    puntos_pago = PuntosPago.objects.filter(sucursalid=sucursal_id).values('puntopagoid', 'nombre')
    return JsonResponse({'puntos_pago': list(puntos_pago)})


@login_required
def buscar_productos(request):
    term = request.GET.get('term', '')
    sucursal_id = request.GET.get('sucursal_id')
    try:
        term_as_int = int(term)
        productos = Producto.objects.filter(
            Q(productoid=term_as_int) | Q(nombre__icontains=term) | Q(codigo_de_barras__icontains=term),
            inventario__sucursalid=sucursal_id
        ).values('productoid', 'nombre', 'codigo_de_barras').distinct()
    except ValueError:
        productos = Producto.objects.filter(
            Q(nombre__icontains=term) | Q(codigo_de_barras__icontains=term),
            inventario__sucursalid=sucursal_id
        ).values('productoid', 'nombre', 'codigo_de_barras').distinct()
    
    return JsonResponse({'productos': list(productos)})


@login_required
def buscar_cliente(request):
    term = request.GET.get('term', '')
    clientes = Cliente.objects.filter(
        Q(nombre__icontains=term) | Q(apellido__icontains=term) | Q(numerodocumento__icontains=term)
    )
    clientes_list = list(clientes.values('clienteid', 'nombre', 'apellido'))
    return JsonResponse({'clientes': clientes_list})


@login_required
def buscar_producto_por_codigo(request):
    codigo_de_barras = request.GET.get('codigo_de_barras')
    sucursal_id = request.GET.get('sucursal_id')
    producto = Producto.objects.filter(codigo_de_barras=codigo_de_barras, inventario__sucursalid=sucursal_id).first()
    if (producto):
        return JsonResponse({
            'exists': True,
            'producto': {
                'id': producto.productoid,
                'nombre': producto.nombre,
                'codigo_de_barras': producto.codigo_de_barras
            }
        })
    return JsonResponse({'exists': False})


@csrf_exempt
@login_required
def verificar_pago_nequi(request):
    if request.method == 'POST':
        total = float(request.POST.get('total'))
        flag = verificacionPago(total)  # Ajustar verificacionPago para que tome el total
        if flag:
            return JsonResponse({'success': True})
        else:
            return JsonResponse({'success': False})
    return JsonResponse({'success': False})
