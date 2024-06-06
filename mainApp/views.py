# views.py
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from .models import Usuario, Sucursal, Categoria, Producto, Inventario
from django.db.models import Count, Sum
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
    if request.method == 'POST':
        # Aquí puedes manejar los productos asociados antes de eliminar la categoría
        productos_asociados = Producto.objects.filter(categoria=categoria)
        productos_asociados.update(categoria=None)  # O podrías eliminarlos: productos_asociados.delete()

        categoria.delete()
        messages.success(request, 'La categoría ha sido eliminada exitosamente.')
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
        messages.success(request, f'Categoría actualizada exitosamente: Nombre={nombre}, Descripción={descripcion}')
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
        producto.delete()
        messages.success(request, 'El producto ha sido eliminado exitosamente.')
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

        # Obtener los productos y cantidades del formulario
        productos = request.POST.getlist('producto[]')
        cantidades = request.POST.getlist('cantidad[]')

        # Crear inventario para cada producto
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
    inventario = get_object_or_404(Inventario, pk=inventario_id)
    sucursal_id = inventario.sucursalid.sucursalid
    inventario.delete()
    messages.success(request, 'Producto eliminado del inventario')
    return redirect('visualizar_inventarios')