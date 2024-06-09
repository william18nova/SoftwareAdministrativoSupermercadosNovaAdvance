from django.db import models

class Usuario(models.Model):
    usuarioid = models.AutoField(primary_key=True)
    nombreusuario = models.CharField(max_length=100, unique=True)
    contraseña = models.CharField(max_length=255)
    rol = models.CharField(max_length=50, choices=[('Trabajador', 'Trabajador'), ('Administrador', 'Administrador')])

    class Meta:
        db_table = 'usuarios'

    def __str__(self):
        return self.nombreusuario

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