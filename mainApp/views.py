# views.py
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from .models import Usuario, Sucursal, Categoria, Producto, Inventario, Proveedor, PreciosProveedor
from django.db.models import Count, Sum, Exists, OuterRef, Subquery, Exists, OuterRef
from django.http import JsonResponse
from collections import defaultdict

def login(request):
    if request.method == 'POST':
        nombreusuario = request.POST['nombreusuario']
        contraseña = request.POST['contraseña']
        try:
            usuario = Usuario.objects.get(nombreusuario=nombreusuario)
            if usuario.contraseña == contraseña:
                return redirect('home')
            else:
                messages.error(request, 'Contraseña incorrecta')
        except Usuario.DoesNotExist:
            messages.error(request, 'El usuario no existe')
    return render(request, 'login.html')

def homePage_view(request):
    return render(request, 'homePage.html')

def agregar_sucursal_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        direccion = request.POST.get('direccion')
        telefono = request.POST.get('telefono')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(request, 'agregar_sucursal.html')

        if Sucursal.objects.filter(nombre=nombre).exists():
            messages.error(request, 'El Nombre de la sucursal ya está registrado.')
            return render(request, 'agregar_sucursal.html')

        sucursal = Sucursal(nombre=nombre, direccion=direccion, telefono=telefono)
        sucursal.save()
        messages.success(request, f'Sucursal agregada exitosamente: Nombre={nombre}, Dirección={direccion}, Teléfono={telefono}')
        return redirect('agregar_sucursal')

    return render(request, 'agregar_sucursal.html')

def visualizar_sucursales_view(request):
    sucursales = Sucursal.objects.all()
    return render(request, 'visualizar_sucursales.html', {'sucursales': sucursales})

def eliminar_sucursal(request, sucursal_id):
    sucursal = get_object_or_404(Sucursal, sucursalid=sucursal_id)
    if request.method == 'POST':
        sucursal.delete()
        messages.success(request, 'La sucursal ha sido eliminada exitosamente.')
        return redirect('visualizar_sucursales')
    return render(request, 'visualizar_sucursales.html', {'sucursales': Sucursal.objects.all()})

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
        messages.success(request, f'Sucursal actualizada exitosamente: Nombre={nombre}, Dirección={direccion}, Teléfono={telefono}')
        return redirect('visualizar_sucursales')

    return render(request, 'editar_sucursal.html', {'sucursal': sucursal})

def agregar_categoria_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion', '')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(request, 'agregar_categoria.html')

        if Categoria.objects.filter(nombre=nombre).exists():
            messages.error(request, 'El Nombre de la categoría ya está registrado.')
            return render(request, 'agregar_categoria.html')

        categoria = Categoria(nombre=nombre, descripcion=descripcion)
        categoria.save()
        messages.success(request, f'Categoría agregada exitosamente: Nombre={nombre}, Descripción={descripcion}')
        return redirect('agregar_categoria')

    return render(request, 'agregar_categoria.html')

def visualizar_categorias_view(request):
    categorias = Categoria.objects.all()
    return render(request, 'visualizar_categorias.html', {'categorias': categorias})

def eliminar_categoria(request, categoria_id):
    categoria = get_object_or_404(Categoria, categoriaid=categoria_id)
    nombre_categoria = categoria.nombre  # Captura el nombre de la categoría antes de eliminarla
    if request.method == 'POST':
        # Manejar los productos asociados antes de eliminar la categoría
        productos_asociados = Producto.objects.filter(categoria=categoria)
        productos_asociados.update(categoria=None)  # O podrías eliminarlos: productos_asociados.delete()

        categoria.delete()
        messages.success(request, f'La categoría "{nombre_categoria}" ha sido eliminada exitosamente.')
        return redirect('visualizar_categorias')
    return render(request, 'visualizar_categorias.html', {'categorias': Categoria.objects.all()})


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


def agregar_producto_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion')
        precio = request.POST.get('precio')
        categoria_id = request.POST.get('categoria')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return redirect('agregar_producto')

        if Producto.objects.filter(nombre=nombre).exists():
            messages.error(request, 'El Nombre del producto ya está registrado.')
            return redirect('agregar_producto')

        categoria = Categoria.objects.get(pk=categoria_id) if categoria_id else None
        producto = Producto(nombre=nombre, descripcion=descripcion, precio=precio, categoria=categoria)
        producto.save()
        messages.success(request, f'Producto agregado exitosamente: Nombre={nombre}, Descripción={descripcion}, Precio={precio}, Categoría={categoria.nombre if categoria else "Sin categoría"}')
        return redirect('agregar_producto')

    categorias = Categoria.objects.all()
    return render(request, 'agregar_producto.html', {'categorias': categorias})


def visualizar_productos_view(request):
    productos = Producto.objects.all()
    return render(request, 'visualizar_productos.html', {'productos': productos})


def eliminar_producto(request, producto_id):
    producto = get_object_or_404(Producto, productoid=producto_id)
    if request.method == 'POST':
        nombre_producto = producto.nombre
        producto.delete()
        messages.success(request, f'El producto "{nombre_producto}" ha sido eliminado exitosamente.')
        return redirect('visualizar_productos')
    return render(request, 'visualizar_productos.html', {'productos': Producto.objects.all()})

def editar_producto_view(request, producto_id):
    producto = get_object_or_404(Producto, productoid=producto_id)
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        descripcion = request.POST.get('descripcion')
        precio = request.POST.get('precio')
        categoria_id = request.POST.get('categoria')

        if not nombre:
            messages.error(request, 'El Nombre es un campo obligatorio.')
            return render(request, 'editar_producto.html', {'producto': producto, 'categorias': Categoria.objects.all()})

        if Producto.objects.filter(nombre=nombre).exclude(productoid=producto_id).exists():
            messages.error(request, 'El Nombre del producto ya está registrado.')
            return render(request, 'editar_producto.html', {'producto': producto, 'categorias': Categoria.objects.all()})

        producto.nombre = nombre
        producto.descripcion = descripcion
        producto.precio = precio
        producto.categoria_id = categoria_id if categoria_id else None
        producto.save()
        messages.success(request, f'Producto actualizado exitosamente: Nombre={nombre}, Descripción={descripcion}, Precio={precio}, Categoría={producto.categoria.nombre if producto.categoria else "Sin categoría"}')
        return redirect('visualizar_productos')

    return render(request, 'editar_producto.html', {'producto': producto, 'categorias': Categoria.objects.all()})

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

    sucursales_sin_inventario = Sucursal.objects.annotate(inventarios_count=Count('inventario')).filter(inventarios_count=0)
    productos = Producto.objects.all()

    if not sucursales_sin_inventario.exists():
        messages.error(request, 'Todas las sucursales ya tienen inventario. Debe ir a visualizar inventario para modificarlas o ir a agregar sucursales para añadir nuevas sucursales.')

    if not productos.exists():
        messages.error(request, 'No hay productos en el sistema. Debe ir a agregar productos para añadir productos al sistema y generar un inventario.')

    return render(request, 'agregar_inventario.html', {'sucursales': sucursales_sin_inventario, 'productos': productos})

def visualizar_inventarios_view(request):
    sucursales_con_inventario = Sucursal.objects.filter(inventario__isnull=False).distinct()
    inventarios = None
    sucursal_seleccionada = None
    inventario_global = False
    inventario_global_data = []

    if request.method == 'POST':
        sucursal_id = request.POST.get('sucursal')
        if sucursal_id == 'global':
            inventario_global = True
            inventario_global_data = Inventario.objects.values('productoid__nombre').annotate(total_cantidad=Sum('cantidad'))
        else:
            sucursal_seleccionada = get_object_or_404(Sucursal, pk=sucursal_id)
            inventarios = Inventario.objects.filter(sucursalid=sucursal_seleccionada)

    return render(request, 'visualizar_inventarios.html', {
        'sucursales': sucursales_con_inventario,
        'inventarios': inventarios,
        'sucursal_seleccionada': sucursal_seleccionada,
        'inventario_global': inventario_global,
        'inventario_global_data': inventario_global_data
    })


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

        messages.success(request, f'Inventario de la sucursal {sucursal.nombre} actualizado exitosamente.')
        return redirect('visualizar_inventarios')

    return render(request, 'editar_inventario.html', {
        'sucursal': sucursal,
        'inventarios': inventarios,
        'productos': productos,
    })

def eliminar_producto_inventario_view(request, inventario_id):
    if request.method == 'POST':
        inventario = get_object_or_404(Inventario, pk=inventario_id)
        producto_nombre = inventario.productoid.nombre
        inventario.delete()
        return JsonResponse({'success': True, 'message': f'Producto "{producto_nombre}" eliminado exitosamente.', 'producto_nombre': producto_nombre})
    return JsonResponse({'success': False, 'message': 'Método no permitido.'}, status=405)

def agregar_proveedor_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        empresa = request.POST.get('empresa')
        telefono = request.POST.get('telefono')
        email = request.POST.get('email')
        direccion = request.POST.get('direccion')

        if Proveedor.objects.filter(nombre=nombre).exists():
            messages.error(request, 'Ya existe un proveedor con este nombre.')
            return render(request, 'agregar_proveedor.html')

        proveedor = Proveedor(nombre=nombre, empresa=empresa, telefono=telefono, email=email, direccion=direccion)
        proveedor.save()
        messages.success(request, 'Proveedor agregado exitosamente.')
        return redirect('agregar_proveedor')

    return render(request, 'agregar_proveedor.html')

def visualizar_proveedores_view(request):
    proveedores = Proveedor.objects.all()
    return render(request, 'visualizar_proveedores.html', {'proveedores': proveedores})

def eliminar_proveedor(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, proveedorid=proveedor_id)
    if request.method == 'POST':
        proveedor.delete()
        messages.success(request, 'El proveedor ha sido eliminado exitosamente.')
        return redirect('visualizar_proveedores')
    return render(request, 'visualizar_proveedores.html', {'proveedores': Proveedor.objects.all()})

def editar_proveedor_view(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, pk=proveedor_id)
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        empresa = request.POST.get('empresa')
        telefono = request.POST.get('telefono')
        email = request.POST.get('email')
        direccion = request.POST.get('direccion')

        # Validar campos vacíos
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

def agregar_productos_precios_proveedor_view(request):
    if request.method == 'POST':
        proveedor_id = request.POST.get('proveedor')
        productos = request.POST.getlist('producto[]')
        precios = request.POST.getlist('precio[]')

        proveedor = get_object_or_404(Proveedor, pk=proveedor_id)

        for producto_id, precio in zip(productos, precios):
            if producto_id and precio:  # Asegúrate de que producto_id y precio no estén vacíos
                producto = get_object_or_404(Producto, pk=producto_id)
                if PreciosProveedor.objects.filter(productoid=producto, proveedorid=proveedor).exists():
                    messages.error(request, f'El producto {producto.nombre} ya está registrado para el proveedor {proveedor.nombre}.')
                    continue
                PreciosProveedor.objects.create(productoid=producto, proveedorid=proveedor, precio=precio)

        messages.success(request, 'Productos y precios agregados exitosamente al proveedor.')
        return redirect('agregar_productos_precios_proveedor')

    # Filtrar proveedores que no tienen productos asociados
    proveedores_con_productos = PreciosProveedor.objects.filter(proveedorid=OuterRef('pk'))
    proveedores = Proveedor.objects.annotate(tiene_productos=Exists(proveedores_con_productos)).filter(tiene_productos=False)
    
    productos = Producto.objects.all()
    return render(request, 'agregar_productos_precios_proveedor.html', {'proveedores': proveedores, 'productos': productos})

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


def eliminar_precio_proveedor_view(request, id):
    if request.method == 'POST':
        precio_proveedor = get_object_or_404(PreciosProveedor, pk=id)
        nombre_producto = precio_proveedor.productoid.nombre
        precio_proveedor.delete()
        return JsonResponse({'success': True, 'message': f'Producto "{nombre_producto}" eliminado correctamente.'})
    return JsonResponse({'success': False, 'message': 'Error al eliminar el producto.'})

def editar_productos_precios_proveedor_view(request, proveedor_id):
    proveedor = get_object_or_404(Proveedor, pk=proveedor_id)
    productos_precios = PreciosProveedor.objects.filter(proveedorid=proveedor)
    productos_existentes = list(productos_precios.values_list('productoid', flat=True))
    productos = Producto.objects.all()

    if request.method == 'POST':
        nuevos_productos_ids = request.POST.getlist('producto[]')
        nuevos_precios = request.POST.getlist('precio[]')

        # Filtrar los valores vacíos
        nuevos_productos_ids = [pid for pid in nuevos_productos_ids if pid]
        nuevos_precios = [precio for precio in nuevos_precios if precio]

        # Eliminar productos no incluidos en la nueva lista
        PreciosProveedor.objects.filter(proveedorid=proveedor).exclude(productoid__in=nuevos_productos_ids).delete()

        for producto_id, precio in zip(nuevos_productos_ids, nuevos_precios):
            if producto_id and precio:
                producto = get_object_or_404(Producto, pk=producto_id)
                precios_proveedor, created = PreciosProveedor.objects.update_or_create(
                    productoid=producto, proveedorid=proveedor,
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
