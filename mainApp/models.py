from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

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
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(null=True, blank=True)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE, null=True, blank=True)
    codigo_de_barras = models.CharField(max_length=100, null=True, blank=True)  # Nuevo campo
    iva = models.FloatField(default=0.0)  # Campo para el porcentaje de IVA

    class Meta:
        db_table = 'productos'

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
    descripcion = models.CharField(max_length=100, blank=True, null=True)  # Actualizado

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
        
        return self.create_user(nombreusuario, password, **extra_fields)

class Usuario(AbstractBaseUser, PermissionsMixin):
    usuarioid = models.AutoField(db_column='usuarioid', primary_key=True)  # Nombre de la columna en PostgreSQL
    nombreusuario = models.CharField(db_column='nombreusuario', max_length=100, unique=True)
    password = models.CharField(db_column='contraseña', max_length=255)  # Nombre de la columna en PostgreSQL
    rolid = models.IntegerField(db_column='rolid', blank=True, null=True)  # Nombre de la columna en PostgreSQL
    
    # Campos adicionales requeridos por AbstractBaseUser y PermissionsMixin
    last_login = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UsuarioManager()

    USERNAME_FIELD = 'nombreusuario'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'usuarios'  # Nombre de la tabla en la base de datos

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
    puntopagoid = models.IntegerField()
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
    hora = models.TimeField()  # Nuevo campo
    clienteid = models.ForeignKey(Cliente, on_delete=models.CASCADE, null=True, blank=True, db_column='clienteid')
    empleadoid = models.ForeignKey(Empleado, on_delete=models.CASCADE, db_column='empleadoid')
    sucursalid = models.ForeignKey(Sucursal, on_delete=models.CASCADE, db_column='sucursalid')
    puntopagoid = models.ForeignKey(PuntosPago, on_delete=models.CASCADE, db_column='puntopagoid')
    total = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'ventas'

class DetalleVenta(models.Model):
    detalleventaid = models.AutoField(primary_key=True)
    ventaid = models.ForeignKey(Venta, on_delete=models.CASCADE, db_column='ventaid')
    productoid = models.ForeignKey(Producto, on_delete=models.CASCADE, db_column='productoid')
    cantidad = models.IntegerField()
    preciounitario = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'detallesventas'