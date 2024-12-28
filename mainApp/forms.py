# mainApp/forms.py

from django import forms
from .models import Categoria, Cliente, Empleado, Usuario, Sucursal, HorarioCaja, PuntosPago, HorariosNegocio, Producto, Proveedor, Rol
import re
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from dal import autocomplete
import json

class CategoriaForm(forms.ModelForm):
    class Meta:
        model = Categoria
        fields = ['nombre', 'descripcion']
        labels = {
            'nombre': 'Nombre',
            'descripcion': 'Descripción',
        }
        widgets = {
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre de la categoría',
                'required': 'required'
            }),
            'descripcion': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa una descripción (opcional)'
            }),
        }
    
    def clean_nombre(self):
        nombre = self.cleaned_data.get('nombre')
        if Categoria.objects.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError('El Nombre de la categoría ya está registrado.')
        return nombre


class ClienteForm(forms.ModelForm):
    class Meta:
        model = Cliente
        fields = ['numerodocumento', 'nombre', 'apellido', 'telefono', 'email']
        labels = {
            'numerodocumento': 'Número de Documento',
            'nombre': 'Nombre',
            'apellido': 'Apellido',
            'telefono': 'Teléfono',
            'email': 'Correo Electrónico',
        }
        widgets = {
            'numerodocumento': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el número de documento',
                'required': 'required'
            }),
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre',
                'required': 'required'
            }),
            'apellido': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el apellido',
                'required': 'required'
            }),
            'telefono': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el teléfono',
                'required': 'required'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el correo electrónico',
                'required': 'required'
            }),
        }

    def clean_numerodocumento(self):
        numerodocumento = self.cleaned_data.get('numerodocumento')
        if not numerodocumento.isdigit():
            raise forms.ValidationError('El número de documento debe contener solo dígitos.')
        if Cliente.objects.filter(numerodocumento=numerodocumento).exists():
            raise forms.ValidationError('El número de documento ya está registrado.')
        return numerodocumento

    def clean_telefono(self):
        telefono = self.cleaned_data.get('telefono')
        if not telefono.isdigit():
            raise forms.ValidationError('El teléfono debe contener solo dígitos.')
        if len(telefono) < 7 or len(telefono) > 15:
            raise forms.ValidationError('El teléfono debe tener entre 7 y 15 dígitos.')
        if Cliente.objects.filter(telefono=telefono).exists():
            raise forms.ValidationError('El teléfono ya está registrado.')
        return telefono

    def clean_nombre(self):
        nombre = self.cleaned_data.get('nombre')
        if not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$', nombre):
            raise forms.ValidationError('El nombre solo puede contener letras.')
        return nombre

    def clean_apellido(self):
        apellido = self.cleaned_data.get('apellido')
        if not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$', apellido):
            raise forms.ValidationError('El apellido solo puede contener letras.')
        return apellido

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email and Cliente.objects.filter(email=email).exists():
            raise forms.ValidationError('El correo electrónico ya está registrado.')
        return email
    
class EmpleadoForm(forms.ModelForm):
    # Validadores para campos específicos
    nombre_validator = RegexValidator(
        regex=r'^[A-Za-z\s]+$',
        message='El nombre solo debe contener letras y espacios.'
    )
    
    apellido_validator = RegexValidator(
        regex=r'^[A-Za-z\s]+$',
        message='El apellido solo debe contener letras y espacios.'
    )
    
    numerodocumento_validator = RegexValidator(
        regex=r'^\d{6,10}$',
        message='El número de documento debe contener entre 6 y 10 dígitos.'
    )
    
    telefono_validator = RegexValidator(
        regex=r'^\d{10}$',
        message='El teléfono debe contener exactamente 10 dígitos.'
    )

    # Redefinimos los campos para incluir validadores y label (si procede)
    numerodocumento = forms.CharField(
        label='Número de Documento',
        validators=[numerodocumento_validator]
    )
    nombre = forms.CharField(
        validators=[nombre_validator]
    )
    apellido = forms.CharField(
        validators=[apellido_validator]
    )
    telefono = forms.CharField(
        validators=[telefono_validator]
    )

    class Meta:
        model = Empleado
        fields = [
            'numerodocumento', 
            'nombre', 
            'apellido', 
            'telefono', 
            'email', 
            'direccion', 
            'puesto', 
            'usuarioid', 
            'sucursalid'
        ]
        labels = {
            'numerodocumento': 'Número de Documento',  # (opcional, pues ya lo redefinimos arriba)
            'nombre': 'Nombre',
            'apellido': 'Apellido',
            'telefono': 'Teléfono',
            'email': 'Correo Electrónico',
            'direccion': 'Dirección',
            'puesto': 'Puesto',
            'usuarioid': 'Usuario',
            'sucursalid': 'Sucursal',
        }
        widgets = {
            'numerodocumento': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el número de documento',
                'required': 'required'
            }),
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre',
                'required': 'required'
            }),
            'apellido': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el apellido',
                'required': 'required'
            }),
            'telefono': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el teléfono',
                'required': 'required'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el correo electrónico',
                'required': 'required'
            }),
            'direccion': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa la dirección'
            }),
            'puesto': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el puesto'
            }),
            'usuarioid': forms.HiddenInput(),
            'sucursalid': forms.HiddenInput(),
        }

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if Empleado.objects.filter(email=email).exists():
            raise forms.ValidationError('El correo ya está en uso.')
        return email

    def clean_usuarioid(self):
        usuarioid = self.cleaned_data.get('usuarioid')
        if not usuarioid:
            raise forms.ValidationError('Este campo es obligatorio.')
        if Empleado.objects.filter(usuarioid=usuarioid).exists():
            raise forms.ValidationError('Este usuario ya está asignado a un empleado.')
        return usuarioid

    def clean_numerodocumento(self):
        numerodocumento = self.cleaned_data.get('numerodocumento')
        if Empleado.objects.filter(numerodocumento=numerodocumento).exists():
            raise forms.ValidationError('El número de documento ya está en uso.')
        return numerodocumento

    def clean_telefono(self):
        telefono = self.cleaned_data.get('telefono')
        if Empleado.objects.filter(telefono=telefono).exists():
            raise forms.ValidationError('El teléfono ya está en uso.')
        return telefono 

    def clean_sucursalid(self):
        sucursalid = self.cleaned_data.get('sucursalid')
        if not sucursalid:
            raise forms.ValidationError('Este campo es obligatorio.')
        return sucursalid

class HorariosNegocioForm(forms.ModelForm):
    sucursal_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar sucursal...',
            'autocomplete': 'off',
        })
    )
    sucursalid = forms.ModelChoiceField(
        queryset=Sucursal.objects.none(),
        widget=forms.HiddenInput(),
        required=True,
    )
    horaapertura = forms.TimeField(
        required=False,
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time'
        })
    )
    horacierre = forms.TimeField(
        required=False,
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time'
        })
    )
    dia_semana = forms.CharField(
        required=False,
        widget=forms.HiddenInput()
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Excluir sucursales que ya tienen horarios asignados
        self.fields['sucursalid'].queryset = Sucursal.objects.exclude(horariosnegocio__isnull=False)

    class Meta:
        model = HorariosNegocio
        fields = ['sucursalid', 'dia_semana', 'horaapertura', 'horacierre']
        labels = {
            'sucursal_autocomplete': 'Sucursal',
            'dia_semana': 'Día de la Semana',
            'horaapertura': 'Hora de Apertura',
            'horacierre': 'Hora de Cierre',
        }

    def clean(self):
        cleaned_data = super().clean()
        sucursalid = cleaned_data.get('sucursalid')

        if not sucursalid:
            raise forms.ValidationError('Debe seleccionar una sucursal válida.')

        # Validaciones adicionales (si es necesario)

        return cleaned_data

class HorarioCajaForm(forms.ModelForm):
    puntopago_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar punto de pago...',
            'autocomplete': 'off',
        })
    )
    puntopagoid = forms.ModelChoiceField(
        queryset=PuntosPago.objects.none(),
        widget=forms.HiddenInput(),
        required=True,
    )
    dia_semana = forms.CharField(
        required=False,
        widget=forms.HiddenInput()
    )
    horaapertura = forms.TimeField(
        required=False,
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time'
        })
    )
    horacierre = forms.TimeField(
        required=False,
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time'
        })
    )

    class Meta:
        model = HorarioCaja
        fields = ['puntopagoid', 'dia_semana', 'horaapertura', 'horacierre']
        labels = {
            'puntopagoid': 'Punto de Pago',
            'dia_semana': 'Día de la Semana',
            'horaapertura': 'Hora de Apertura',
            'horacierre': 'Hora de Cierre',
        }
        widgets = {
            'puntopagoid': forms.HiddenInput(),
            'dia_semana': forms.HiddenInput(),
            'horaapertura': forms.TimeInput(attrs={
                'class': 'form-control',
                'type': 'time'
            }),
            'horacierre': forms.TimeInput(attrs={
                'class': 'form-control',
                'type': 'time'
            }),
        }

    def __init__(self, *args, horarios_present=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.horarios_present = horarios_present

        # Filtrar los Puntos de Pago que no tienen horario asignado
        self.fields['puntopagoid'].queryset = PuntosPago.objects.filter(
            sucursalid__isnull=False
        ).exclude(
            horarios_caja__isnull=False
        )

    def clean(self):
        cleaned_data = super().clean()
        horaapertura = cleaned_data.get('horaapertura')
        horacierre = cleaned_data.get('horacierre')
        dia_semana = cleaned_data.get('dia_semana')
        puntopagoid = cleaned_data.get('puntopagoid')

        # Si no hay horarios listados, validar los campos
        if not self.horarios_present:
            if horaapertura and horacierre:
                if horaapertura >= horacierre:
                    raise forms.ValidationError('La hora de apertura debe ser menor que la hora de cierre.')

            if not dia_semana:
                raise forms.ValidationError('Debe seleccionar al menos un día de la semana.')

            # Validar que no exista ya un horario para el mismo día y punto de pago
            if dia_semana and puntopagoid:
                dias = dia_semana.split(',')
                for dia in dias:
                    if HorarioCaja.objects.filter(puntopagoid=puntopagoid, dia_semana=dia).exists():
                        raise forms.ValidationError(f'Ya existe un horario para el día {dia} en este punto de pago.')

        return cleaned_data
    
class SucursalForm(forms.ModelForm):
    class Meta:
        model = Sucursal
        fields = ['nombre', 'direccion', 'telefono']
        labels = {
            'nombre': 'Nombre',
            'direccion': 'Dirección',
            'telefono': 'Teléfono',
        }
        widgets = {
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre de la sucursal',
                'required': 'required'
            }),
            'direccion': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa la dirección',
                'required': 'required'
            }),
            'telefono': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el teléfono',
                'required': 'required'
            }),
        }

    # Validadores personalizados
    nombre_validator = RegexValidator(
        regex=r'^[A-Za-z\s]+$',
        message='El nombre solo debe contener letras y espacios.'
    )
    
    telefono_validator = RegexValidator(
        regex=r'^\d{10}$',
        message='El teléfono debe contener exactamente 10 dígitos.'
    )

    nombre = forms.CharField(
        max_length=100,
        validators=[nombre_validator]
    )

    telefono = forms.CharField(validators=[telefono_validator])

    def clean_nombre(self):
        nombre = self.cleaned_data.get('nombre')
        if Sucursal.objects.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError('El nombre de la sucursal ya está registrado.')
        return nombre
    
class ProductoForm(forms.ModelForm):
    class Meta:
        model = Producto
        fields = ['nombre', 'descripcion', 'precio', 'categoria', 'codigo_de_barras', 'iva']
        labels = {
            'nombre': 'Nombre',
            'descripcion': 'Descripción',
            'precio': 'Precio',
            'categoria': 'Categoría',
            'codigo_de_barras': 'Código de Barras',
            'iva': 'IVA (Por ejemplo, para 19% ingrese 0.19)',
        }
        widgets = {
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre del producto',
                'required': 'required'
            }),
            'descripcion': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa la descripción del producto'
            }),
            'precio': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el precio',
                'required': 'required',
                'step': '0.01',
                'min': '0'
            }),
            'categoria': forms.HiddenInput(),  # Campo oculto para almacenar el ID de la categoría
            'codigo_de_barras': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el código de barras'
            }),
            'iva': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el IVA (Por ejemplo, para 19% ingrese 0.19)',
                'required': 'required',
                'step': '0.01',
                'min': '0',
                'max': '1'
            }),
        }
    
    
    codigo_de_barras_validator = RegexValidator(
        regex=r'^\d{12}$',
        message='El código de barras debe contener exactamente 12 dígitos.'
    )
    
    # Aplicar validadores a los campos
    codigo_de_barras = forms.CharField(validators=[codigo_de_barras_validator], required=False)
    
    def clean_nombre(self):
        nombre = self.cleaned_data.get('nombre')
        if Producto.objects.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError('El nombre del producto ya está registrado.')
        return nombre
    
    def clean_codigo_de_barras(self):
        codigo_de_barras = self.cleaned_data.get('codigo_de_barras')
        if codigo_de_barras and Producto.objects.filter(codigo_de_barras=codigo_de_barras).exists():
            raise forms.ValidationError('El código de barras ya está registrado.')
        return codigo_de_barras
    
class ProveedorForm(forms.ModelForm):
    nombre = forms.CharField(
        max_length=100,
        validators=[
            RegexValidator(
                regex=r'^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$',
                message='El nombre solo debe contener letras y espacios.'
            )
        ],
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el nombre del proveedor',
            'required': 'required'
        })
    )
    empresa = forms.CharField(
        max_length=100,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa la empresa',
            'required': 'required'
        })
    )
    telefono = forms.CharField(
        max_length=20,
        validators=[
            RegexValidator(
                regex=r'^\d{7,15}$',
                message='El teléfono debe contener solo dígitos y tener entre 7 y 15 caracteres.'
            )
        ],
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el teléfono',
            'required': 'required'
        })
    )
    email = forms.EmailField(
        max_length=100,
        required=False,  # Campo opcional
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el correo electrónico'
        })
    )
    direccion = forms.CharField(
        required=False,  # Campo opcional
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa la dirección',
            'rows': 3
        })
    )
    
    class Meta:
        model = Proveedor
        fields = ['nombre', 'empresa', 'telefono', 'email', 'direccion']
        labels = {
            'nombre': 'Nombre',
            'empresa': 'Empresa',
            'telefono': 'Teléfono',
            'email': 'Email',
            'direccion': 'Dirección',
        }
        widgets = {
            'empresa': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa la empresa',
                'required': 'required'
            }),
        }
    
    def clean_nombre(self):
        nombre = self.cleaned_data.get('nombre')
        if Proveedor.objects.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError('Ya existe un proveedor con este nombre.')
        return nombre
    
    def clean_telefono(self):
        telefono = self.cleaned_data.get('telefono')
        if not telefono.isdigit():
            raise forms.ValidationError('El teléfono debe contener solo dígitos.')
        return telefono
    
class RolForm(forms.ModelForm):
    nombre = forms.CharField(
        max_length=50,
        validators=[
            RegexValidator(
                regex=r'^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$',
                message='El nombre del rol solo debe contener letras y espacios.'
            )
        ],
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el nombre del rol',
            'required': 'required'
        })
    )
    descripcion = forms.CharField(
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa la descripción del rol',
            'rows': 4
        }),
        required=False
    )
    
    class Meta:
        model = Rol
        fields = ['nombre', 'descripcion']
        labels = {
            'nombre': 'Nombre del Rol',
            'descripcion': 'Descripción',
        }
    
    def clean_nombre(self):
        nombre = self.cleaned_data.get('nombre')
        if Rol.objects.filter(nombre__iexact=nombre).exists():
            raise forms.ValidationError('Ya existe un rol con ese nombre.')
        return nombre