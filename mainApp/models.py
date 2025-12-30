from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from decimal import Decimal
from datetime import date
from django.db import models, transaction
from django.db.models import Q

class Sucursal(models.Model):
    sucursalid = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100, unique=True)
    direccion = models.TextField(null=True, blank=True)
    telefono = models.CharField(max_length=20, null=True, blank=True)

    class Meta:
        db_table = 'sucursales'

    def __str__(self):
        return self.nombre

class Categoria(models.Model):
    categoriaid = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'categorias'

    def __str__(self):
        return self.nombre

class Producto(models.Model):
    productoid = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100, unique=True, db_index=True)  # Agregar índice aquí
    descripcion = models.TextField(null=True, blank=True)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE, null=True, blank=True)
    codigo_de_barras = models.CharField(max_length=100, null=True, blank=True, db_index=True)  # Agregar índice aquí
    iva = models.FloatField(default=0.0)

    class Meta:
        db_table = 'productos'
        indexes = [
            models.Index(fields=['nombre']),
            models.Index(fields=['productoid']),
            models.Index(fields=['codigo_de_barras']),
        ]

    def __str__(self):
        return self.nombre


class Inventario(models.Model):
    inventarioid = models.AutoField(primary_key=True)
    productoid = models.ForeignKey(Producto, on_delete=models.CASCADE, db_column='productoid')
    sucursalid = models.ForeignKey(Sucursal, on_delete=models.CASCADE, db_column='sucursalid')
    cantidad = models.IntegerField()

    class Meta:
        db_table = 'inventario'

    def __str__(self):
        return f"Inventario de {self.productoid.nombre} en {self.sucursalid.nombre}"

class Proveedor(models.Model):
    proveedorid = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    empresa = models.CharField(max_length=100, null=True, blank=True)
    telefono = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(max_length=100, null=True, blank=True)
    direccion = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'proveedores'

    def __str__(self):
        return self.nombre

class PreciosProveedor(models.Model):
    id = models.AutoField(primary_key=True)
    productoid = models.ForeignKey(Producto, on_delete=models.CASCADE, db_column='productoid')
    proveedorid = models.ForeignKey(Proveedor, on_delete=models.CASCADE, db_column='proveedorid')
    precio = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'preciosproveedor'
        unique_together = ('productoid', 'proveedorid')

    def __str__(self):
        return f"Precio del producto {self.productoid.nombre} por el proveedor {self.proveedorid.nombre}"
    
class PuntosPago(models.Model):
    puntopagoid = models.AutoField(primary_key=True)
    sucursalid = models.ForeignKey('Sucursal', on_delete=models.CASCADE, db_column='sucursalid')
    nombre = models.CharField(max_length=100)
    descripcion = models.CharField(max_length=100, blank=True, null=True)
    dinerocaja = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)

    class Meta:
        db_table = 'puntospago'

    def __str__(self):
        return self.nombre

class Rol(models.Model):
    rolid = models.AutoField(primary_key=True)  # Asegúrate de definir rolid como clave primaria
    nombre = models.CharField(max_length=50)
    descripcion = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'roles'

    def __str__(self):
        return self.nombre

class UsuarioManager(BaseUserManager):
    def create_user(self, nombreusuario, password=None, **extra_fields):
        if not nombreusuario:
            raise ValueError('El nombre de usuario es obligatorio')
        user = self.model(nombreusuario=nombreusuario, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, nombreusuario, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if extra_fields.get('is_staff') is not True or extra_fields.get('is_superuser') is not True:
            raise ValueError('El superusuario debe tener is_staff=True e is_superuser=True.')
        return self.create_user(nombreusuario, password, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    class Meta:
        db_table = 'usuarios'

    usuarioid     = models.AutoField(db_column='usuarioid', primary_key=True)
    nombreusuario = models.CharField(db_column='nombreusuario', max_length=100, unique=True)

    # Aquí dejamos el atributo en Python como `password`, pero le decimos
    # que en la BD el nombre de columna es `contraseña`
    password      = models.CharField(db_column='contraseña', max_length=255)

    rolid = models.ForeignKey('Rol', db_column='rolid', null=True, blank=True, on_delete=models.SET_NULL)

    last_login    = models.DateTimeField(db_column='last_login', blank=True, null=True)
    is_active     = models.BooleanField(db_column='is_active', default=True)
    is_staff      = models.BooleanField(db_column='is_staff', default=False)

    objects = UsuarioManager()

    USERNAME_FIELD = 'nombreusuario'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.nombreusuario
    
class Empleado(models.Model):
    empleadoid = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20, unique=True)
    email = models.CharField(max_length=100, unique=True)
    direccion = models.TextField(null=True, blank=True)
    puesto = models.CharField(max_length=50, null=True, blank=True)
    numerodocumento = models.CharField(max_length=50, unique=True)
    usuarioid = models.OneToOneField(Usuario, on_delete=models.CASCADE, db_column='usuarioid', null=True, blank=True)
    sucursalid = models.ForeignKey(Sucursal, on_delete=models.SET_NULL, db_column='sucursalid', null=True, blank=True)

    class Meta:
        db_table = 'empleados'

    def __str__(self):
        return f'{self.nombre} {self.apellido}'
    
class HorariosNegocio(models.Model):
    horarioid = models.AutoField(primary_key=True)
    dia_semana = models.CharField(max_length=10)
    horaapertura = models.TimeField()
    horacierre = models.TimeField()
    sucursalid = models.ForeignKey(Sucursal, on_delete=models.CASCADE, db_column='sucursalid')

    class Meta:
        db_table = 'horariosnegocio'

    def __str__(self):
        return f"{self.dia_semana} - {self.sucursalid.nombre}"
    
class HorarioCaja(models.Model):
    horariocajaid = models.AutoField(primary_key=True)  # Corrige el nombre del campo aquí
    puntopagoid = models.ForeignKey(PuntosPago, on_delete=models.CASCADE, related_name='horarios_caja')
    dia_semana = models.CharField(max_length=3)
    horaapertura = models.TimeField()
    horacierre = models.TimeField()

    class Meta:
        db_table = 'horarioscajas'

class Cliente(models.Model):
    clienteid = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    email = models.CharField(max_length=100, blank=True, null=True)
    numerodocumento = models.CharField(max_length=50)

    class Meta:
        db_table = 'clientes'

    def __str__(self):
        return f'{self.nombre} {self.apellido}'


class Venta(models.Model):
    ventaid = models.AutoField(primary_key=True)
    fecha = models.DateField()
    hora = models.TimeField()

    clienteid = models.ForeignKey('Cliente', on_delete=models.CASCADE, null=True, blank=True, db_column='clienteid')
    empleadoid = models.ForeignKey('Empleado', on_delete=models.CASCADE, db_column='empleadoid')
    sucursalid = models.ForeignKey('Sucursal', on_delete=models.CASCADE, db_column='sucursalid')
    puntopagoid = models.ForeignKey('PuntosPago', on_delete=models.CASCADE, db_column='puntopagoid')

    total = models.DecimalField(max_digits=10, decimal_places=2)

    # ✅ si es pago único: "efectivo", "nequi"... si es mixto: "mixto"
    mediopago = models.CharField(max_length=50)

    class Meta:
        db_table = 'ventas'


class DetalleVenta(models.Model):
    detalleventaid = models.AutoField(primary_key=True)
    ventaid = models.ForeignKey(Venta, on_delete=models.CASCADE, db_column='ventaid')
    productoid = models.ForeignKey('Producto', on_delete=models.CASCADE, db_column='productoid')
    cantidad = models.IntegerField()
    preciounitario = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'detallesventas'


class PagoVenta(models.Model):
    # En tu BD es bigint y se llama "id"
    pagoventaid = models.BigAutoField(primary_key=True, db_column="id")

    # En tu BD la columna se llama "ventaid"
    ventaid = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        related_name="pagos",
        db_column="ventaid"
    )

    # En tu BD la columna se llama "metodo"
    medio_pago = models.CharField(max_length=50, db_column="metodo")

    # En tu BD es numeric(12,2)
    monto = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "venta_pagos"
        managed = False   # 👈 importante si esa tabla NO la maneja Django con migrations

class PedidoProveedor(models.Model):
    ESTADOS = [
        ('En espera', 'En espera'),
        ('Recibido',  'Recibido'),
        ('Devuelto',  'Devuelto'),
    ]

    pedidoid               = models.AutoField(primary_key=True)
    proveedorid            = models.ForeignKey('Proveedor',
                                               on_delete=models.CASCADE,
                                               db_column='proveedorid')
    sucursalid             = models.ForeignKey('Sucursal',
                                               on_delete=models.CASCADE,
                                               db_column='sucursalid')
    fechapedido            = models.DateField(auto_now_add=True)
    fechaestimadaentrega   = models.DateField(null=True, blank=True)
    costototal             = models.DecimalField(max_digits=10,
                                                decimal_places=2,
                                                default=Decimal('0.00'))
    estado                 = models.CharField(max_length=50,
                                              choices=ESTADOS,
                                              default='En espera')
    comentario             = models.TextField(null=True, blank=True)

    # Nuevos campos para "Recibido"
    fecha_recibido         = models.DateField(null=True, blank=True)
    monto_pagado           = models.DecimalField(max_digits=12,
                                                decimal_places=2,
                                                null=True, blank=True)
    caja_pago               = models.ForeignKey('PuntosPago',
                                               on_delete=models.SET_NULL,
                                               null=True, blank=True,
                                               db_column='caja_pagoid')

    class Meta:
        db_table = 'pedidosproveedor'
        constraints = [
            models.CheckConstraint(
                check=Q(estado__in=[e[0] for e in [
        ('En espera', 'En espera'),
        ('Recibido',  'Recibido'),
        ('Devuelto',  'Devuelto'),
    ]]),
                name='pedidosproveedor_estado_check',
            ),
        ]

    def __str__(self):
        return f"Pedido {self.pedidoid} - {self.proveedorid.nombre}"

class DetallePedidoProveedor(models.Model):
    detallepedidoid = models.AutoField(primary_key=True)
    pedidoid = models.ForeignKey(PedidoProveedor, on_delete=models.CASCADE, db_column='pedidoid')
    productoid = models.ForeignKey('Producto', on_delete=models.CASCADE, db_column='productoid')
    cantidad = models.IntegerField()
    preciounitario = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'detallespedidosproveedor'

    def __str__(self):
        return f"Detalle {self.detallepedidoid} - {self.productoid.nombre}"
    
class CambioDevolucion(models.Model):
    """Cada fila representa un producto devuelto o cambiado."""
    cambioid = models.AutoField(primary_key=True)

    venta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        related_name="cambios",
        db_column="ventaid",          # ya corregido
    )
    detalle = models.ForeignKey(
        DetalleVenta,
        on_delete=models.CASCADE,
        db_column="detalle_id",       # ya corregido
    )
    # ⬇⬇⬇  NUEVO: indica a Django el nombre exacto
    productoid = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        db_column="productoid"
    )

    cantidad = models.PositiveIntegerField()
    tipo     = models.CharField(max_length=50,
                                choices=[("Cambio", "Cambio"),
                                         ("Devolucion", "Devolucion")])
    estado   = models.CharField(max_length=50, default="Completado")
    fecha    = models.DateField(default=date.today)
    motivo   = models.TextField(blank=True)

    class Meta:
        db_table = "cambiosdevoluciones"
        verbose_name = "Cambio / devolución"
        verbose_name_plural = "Cambios / devoluciones"

    def __str__(self):
        return f"{self.tipo} • {self.productoid} ({self.cantidad})"

    # ----------  LÓGICA DE NEGOCIO  ----------
    @staticmethod
    @transaction.atomic
    def registrar_devolucion(venta: "Venta", devoluciones: list[dict]):
        """
        • devoluciones = [{"detalle": DetalleVenta, "cantidad": int}, …]
        • Crea registros, ajusta inventario, resta total.
        """
        total_a_restar = Decimal("0")

        for item in devoluciones:
            det     = item["detalle"]
            cant    = item["cantidad"]

            if cant <= 0:
                continue
            if cant > det.cantidad:
                raise ValidationError("No puedes devolver más de lo comprado.")

            CambioDevolucion.objects.create(
                venta      = venta,
                detalle    = det,
                productoid = det.productoid,
                cantidad   = cant,
                tipo       = "Devolucion",
            )

            # línea de venta
            det.cantidad -= cant
            det.save(update_fields=["cantidad"])

            # inventario (sucursal de la venta)
            inv, _ = Inventario.objects.select_for_update().get_or_create(
                        sucursalid = venta.sucursalid,
                        productoid = det.productoid,
                        defaults   = {"cantidad": 0})
            inv.cantidad += cant
            inv.save(update_fields=["cantidad"])

            # acumular total
            total_a_restar += det.preciounitario * cant

        # total venta
        if total_a_restar:
            venta.total -= total_a_restar
            venta.save(update_fields=["total"])
            
class Permiso(models.Model):
    """
    Mapea la tabla existente public.persmisos
    Campos según dump: permisoid (PK), nombre, descripcion
    """
    permisoid = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "permisos"
        verbose_name = "permiso"
        verbose_name_plural = "permisos"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

class RolPermiso(models.Model):
    id      = models.BigAutoField(primary_key=True, db_column="id")
    rol     = models.ForeignKey(
        Rol,
        on_delete=models.CASCADE,
        db_column="rolid",
        related_name="rolespermisos",
    )
    permiso = models.ForeignKey(
        Permiso,
        on_delete=models.CASCADE,
        db_column="permisoid",
        related_name="rolespermisos",
    )

    class Meta:
        db_table = "rolespermisos"     # nombre EXACTO de tu tabla
        managed  = False               # la tabla ya existe (creada/alterada a mano)
        constraints = [
            models.UniqueConstraint(
                fields=["rol", "permiso"],
                name="ux_rolespermisos_rol_perm",  # coincide con tu índice único
            )
        ]

    def __str__(self):
        return f"{self.rol} ↔ {self.permiso}"