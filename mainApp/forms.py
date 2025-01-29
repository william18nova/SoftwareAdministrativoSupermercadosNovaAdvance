# mainApp/forms.py

from django import forms
from .models import Categoria, Cliente, Empleado, Usuario, Sucursal, HorarioCaja, PuntosPago, HorariosNegocio, Producto, Proveedor, Rol, Inventario, PreciosProveedor
import re
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from dal import autocomplete
import json
from django.db.models import Exists, OuterRef  # Agrega esta línea

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

class EditarCategoriaForm(forms.ModelForm):
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
            }),
            'descripcion': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa una descripción (opcional)',
            }),
        }

    def clean_nombre(self):
        """
        Asegúrate de que no haya otra categoría con el mismo nombre, 
        excepto la que estamos editando.
        """
        nombre = self.cleaned_data.get('nombre')
        # self.instance => la instancia que se está editando
        categoriaid_excluir = self.instance.categoriaid

        if Categoria.objects.filter(nombre__iexact=nombre)\
                            .exclude(categoriaid=categoriaid_excluir)\
                            .exists():
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

class EditarClienteForm(forms.ModelForm):
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
            }),
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre',
            }),
            'apellido': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el apellido',
            }),
            'telefono': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el teléfono',
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el correo electrónico',
            }),
        }

    def clean_numerodocumento(self):
        numerodocumento = self.cleaned_data.get('numerodocumento', '')
        # Validaciones similares a las del "ClienteForm" original
        if not numerodocumento.isdigit():
            raise forms.ValidationError('El número de documento debe contener solo dígitos.')

        # Excluir la PK actual (self.instance) para no chocar con uno mismo
        if (Cliente.objects.filter(numerodocumento=numerodocumento)
                           .exclude(pk=self.instance.pk)
                           .exists()):
            raise forms.ValidationError('El número de documento ya está registrado.')
        return numerodocumento

    def clean_telefono(self):
        telefono = self.cleaned_data.get('telefono', '')
        if not telefono.isdigit():
            raise forms.ValidationError('El teléfono debe contener solo dígitos.')
        if len(telefono) < 7 or len(telefono) > 15:
            raise forms.ValidationError('El teléfono debe tener entre 7 y 15 dígitos.')
        if (Cliente.objects.filter(telefono=telefono)
                           .exclude(pk=self.instance.pk)
                           .exists()):
            raise forms.ValidationError('El teléfono ya está registrado.')
        return telefono

    def clean_email(self):
        email = self.cleaned_data.get('email', '')
        if (email
            and Cliente.objects.filter(email=email)
                               .exclude(pk=self.instance.pk)
                               .exists()):
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

    # Definición de los campos con widgets que incluyen placeholders
    numerodocumento = forms.CharField(
        label='Número de Documento',
        validators=[numerodocumento_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el número de documento',
            'required': 'required'
        })
    )
    nombre = forms.CharField(
        validators=[nombre_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el nombre',
            'required': 'required'
        })
    )
    apellido = forms.CharField(
        validators=[apellido_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el apellido',
            'required': 'required'
        })
    )
    telefono = forms.CharField(
        validators=[telefono_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el teléfono',
            'required': 'required'
        })
    )
    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el correo electrónico',
            'required': 'required'
        })
    )
    direccion = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa la dirección'
        })
    )
    puesto = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el puesto'
        })
    )
    
    # Cambiamos 'usuario' y 'sucursal' a 'usuarioid' y 'sucursalid'
    usuarioid = forms.ModelChoiceField(
        queryset=Usuario.objects.all(),
        widget=forms.HiddenInput(),
        required=True
    )
    sucursalid = forms.ModelChoiceField(
        queryset=Sucursal.objects.all(),
        widget=forms.HiddenInput(),
        required=True
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
            'numerodocumento': 'Número de Documento',
            'nombre': 'Nombre',
            'apellido': 'Apellido',
            'telefono': 'Teléfono',
            'email': 'Correo Electrónico',
            'direccion': 'Dirección',
            'puesto': 'Puesto',
            'usuarioid': 'Usuario',
            'sucursalid': 'Sucursal',
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

    def clean_sucursalid(self):
        sucursalid = self.cleaned_data.get('sucursalid')
        if not sucursalid:
            raise forms.ValidationError('Este campo es obligatorio.')
        return sucursalid

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

    def save(self, commit=True):
        empleado = super().save(commit=False)
        # Los campos 'usuarioid' y 'sucursalid' ya están asignados automáticamente
        if commit:
            empleado.save()
        return empleado

class EditarEmpleadoForm(forms.ModelForm):
    # Validadores similares a los de EmpleadoForm
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

    numerodocumento = forms.CharField(
        label='Número de Documento',
        required=False,  # Si permites "dejar en blanco para mantener la actual"
        validators=[numerodocumento_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Dejar en blanco para mantener la actual'
        })
    )
    nombre = forms.CharField(
        validators=[nombre_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el nombre'
        })
    )
    apellido = forms.CharField(
        validators=[apellido_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el apellido'
        })
    )
    telefono = forms.CharField(
        validators=[telefono_validator],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el teléfono'
        })
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el correo electrónico'
        })
    )
    direccion = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa la dirección'
        })
    )
    puesto = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el puesto'
        })
    )
    # usuarioid y sucursalid podrían manejarse con inputs/hidden o selects
    # depende de tu lógica de autocompletado o select normal
    usuarioid = forms.ModelChoiceField(
        queryset=Usuario.objects.all(),
        required=False,  # O True si es obligatorio
        widget=forms.Select(attrs={
            'class': 'form-control'
        })
    )
    sucursalid = forms.ModelChoiceField(
        queryset=Sucursal.objects.all(),
        required=False,
        widget=forms.Select(attrs={
            'class': 'form-control'
        })
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

    def clean_numerodocumento(self):
        numero = self.cleaned_data.get('numerodocumento')
        # Si se deja en blanco => no se cambia
        # Si no está en blanco => validamos
        if numero:
            if Empleado.objects.filter(numerodocumento=numero).exclude(pk=self.instance.pk).exists():
                raise forms.ValidationError('El número de documento ya está en uso.')
        return numero

    def clean_telefono(self):
        tel = self.cleaned_data.get('telefono')
        # Validar si ya existe en otro Empleado, excluyendo el actual
        if Empleado.objects.filter(telefono=tel).exclude(pk=self.instance.pk).exists():
            raise forms.ValidationError('El teléfono ya está en uso.')
        return tel

    def clean_email(self):
        mail = self.cleaned_data.get('email')
        if Empleado.objects.filter(email=mail).exclude(pk=self.instance.pk).exists():
            raise forms.ValidationError('El correo ya está en uso.')
        return mail

    # Podrías agregar más clean_... si gustas replicar la lógica de:
    # clean_nombre, clean_apellido => Revisar solo letras, etc.

    def save(self, commit=True):
        """
        Si 'numerodocumento' vino en blanco => se mantiene la actual
        """
        instance = super().save(commit=False)
        # Lógica: si numerodocumento == '', no sobrescribir
        if not self.cleaned_data.get('numerodocumento'):
            # Dejamos la anterior
            pass  # El instance ya tiene su numerodocumento previo
        # De lo contrario, la forma ya se aplicó
        if commit:
            instance.save()
        return instance

class HorariosNegocioForm(forms.ModelForm):
    """
    Formulario para agregar horarios a una sucursal.
    Incluye un campo de autocompletado para seleccionar la sucursal,
    campos para seleccionar días de la semana y horarios de apertura y cierre.
    """

    # Campos para el autocompletado de sucursal
    sucursal_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar sucursal...',
            'autocomplete': 'off',
        })
    )

    # Campo oculto que guarda el ID de la sucursal elegida
    sucursalid = forms.ModelChoiceField(
        queryset=Sucursal.objects.exclude(horariosnegocio__isnull=False),
        widget=forms.HiddenInput(),
        required=True,
    )

    # Campos para días y horarios
    dia_semana = forms.CharField(
        required=False,  # Solo obligatorio si no hay horarios listados
        widget=forms.HiddenInput()
    )
    horaapertura = forms.TimeField(
        required=False,  # Solo obligatorio si no hay horarios listados
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time',
            'placeholder': 'Seleccione la hora de apertura',
        })
    )
    horacierre = forms.TimeField(
        required=False,  # Solo obligatorio si no hay horarios listados
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time',
            'placeholder': 'Seleccione la hora de cierre',
        })
    )

    class Meta:
        model = HorariosNegocio
        fields = ['sucursalid', 'dia_semana', 'horaapertura', 'horacierre']
        labels = {
            'sucursal_autocomplete': 'Sucursal',
            'dia_semana': 'Día de la Semana',
            'horaapertura': 'Hora de Apertura',
            'horacierre': 'Hora de Cierre',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Excluir sucursales que ya tienen horarios asignados
        self.fields['sucursalid'].queryset = Sucursal.objects.exclude(horariosnegocio__isnull=False)

    def clean(self):
        """
        Validaciones personalizadas:
         - Sucursal no puede quedar vacía en ningún caso.
         - Si el usuario no ha agregado horarios a la lista temporal,
           los campos (dia_semana, horaapertura y horacierre) deben estar llenos.
         - Si se llenan horaapertura y horacierre, validar que horaapertura < horacierre.
        """
        cleaned_data = super().clean()

        # Campos del formulario
        sucursalid = cleaned_data.get('sucursalid')
        dia_semana = cleaned_data.get('dia_semana')
        horaapertura = cleaned_data.get('horaapertura')
        horacierre = cleaned_data.get('horacierre')

        # Este campo hidden viene del JavaScript con la lista de horarios temporales
        horarios_json = self.data.get('horarios')

        # 1. Validación de sucursalid (siempre requerida)
        if not sucursalid:
            self.add_error('sucursalid', 'Debe seleccionar una sucursal.')

        # 2. Revisar si hay horarios listados en la tabla temporal
        #    (el usuario pudo haber agregado horarios sin usar estos campos)
        if not horarios_json:
            # Si NO hay horarios listados, entonces estos campos son obligatorios:
            # dia_semana, horaapertura, horacierre
            if not dia_semana:
                self.add_error('dia_semana', 'Debe seleccionar al menos un día de la semana.')
            if not horaapertura:
                self.add_error('horaapertura', 'Debe seleccionar una hora de apertura.')
            if not horacierre:
                self.add_error('horacierre', 'Debe seleccionar una hora de cierre.')

            # Validar también que horaapertura < horacierre si ambos están presentes
            if horaapertura and horacierre and horaapertura >= horacierre:
                self.add_error('horacierre', 'La hora de cierre debe ser mayor que la hora de apertura.')
        else:
            # Si hay horarios en horarios_json, no es obligatorio
            # rellenar estos campos, pero si se rellenan, verificarlos
            if horaapertura and horacierre and horaapertura >= horacierre:
                self.add_error('horacierre', 'La hora de cierre debe ser mayor que la hora de apertura.')

        return cleaned_data

class EditarHorariosSucursalForm(forms.Form):
    """
    Formulario para editar horarios de una sucursal.
    Usado principalmente para validar la información básica
    que llega vía AJAX (JSON).
    """
    # Campo autocompletado: si deseas permitir cambiar de sucursal
    sucursalid = forms.CharField(required=True)
    
    # Campos "dummy" para evitar errores si tu plantilla envía algo extra.
    dia_semana = forms.CharField(required=False)
    horaapertura = forms.TimeField(required=False)
    horacierre = forms.TimeField(required=False)

    def __init__(self, *args, horarios_present=False, **kwargs):
        """
        'horarios_present' indica si en el POST (JSON) venía la lista de horarios.
        Podrías usarlo para validaciones personalizadas.
        """
        super().__init__(*args, **kwargs)
        self.horarios_present = horarios_present

    def clean_sucursalid(self):
        s_id = self.cleaned_data.get('sucursalid')
        # Valida que sea dígito (opcional, si tus PK son numéricos)
        if not s_id.isdigit():
            raise forms.ValidationError('ID de sucursal inválido.')
        # Valida que la sucursal exista
        try:
            Sucursal.objects.get(pk=s_id)
        except Sucursal.DoesNotExist:
            raise forms.ValidationError('La sucursal no existe.')
        return s_id

    def clean(self):
        """
        Aquí podrías agregar validaciones adicionales:
         - Que existan horarios
         - Que las horas sean correctas, etc.
        """
        cleaned_data = super().clean()
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
    
class EditarHorarioCajaForm(forms.Form):
    """
    Formulario genérico para validar que la sucursal y el punto de pago sean válidos.
    Se valida que el ID de la sucursal y del punto de pago sean dígitos y que existan.
    """
    sucursalid = forms.CharField(required=True)
    puntopagoid = forms.CharField(required=True)
    
    # Se definen estos campos para evitar errores en la validación (aunque no se usen directamente)
    dia_semana = forms.CharField(required=False)
    horaapertura = forms.TimeField(required=False)
    horacierre = forms.TimeField(required=False)

    def __init__(self, *args, horarios_present=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.horarios_present = horarios_present

    def clean_sucursalid(self):
        s_id = self.cleaned_data.get('sucursalid')
        if not s_id.isdigit():
            raise forms.ValidationError('ID de sucursal inválido.')
        try:
            Sucursal.objects.get(pk=s_id)
        except Sucursal.DoesNotExist:
            raise forms.ValidationError('La sucursal no existe.')
        return s_id

    def clean_puntopagoid(self):
        p_id = self.cleaned_data.get('puntopagoid')
        if not p_id.isdigit():
            raise forms.ValidationError('ID de punto de pago inválido.')
        try:
            PuntosPago.objects.get(pk=p_id)
        except PuntosPago.DoesNotExist:
            raise forms.ValidationError('El punto de pago no existe.')
        return p_id

    def clean(self):
        cleaned_data = super().clean()
        # Aquí podrías agregar validaciones adicionales según tu lógica (por ejemplo, que el 
        # punto de pago pertenezca a la sucursal) si lo consideras necesario.
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
    codigo_de_barras_validator = RegexValidator(
        regex=r'^\d{12}$',
        message='El código de barras debe contener exactamente 12 dígitos.'
    )

    codigo_de_barras = forms.CharField(
        validators=[codigo_de_barras_validator],
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa el código de barras'
        })
    )

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
            'iva': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el IVA (Por ejemplo, para 19% ingrese 0.19)',
                'required': 'required',
                'step': '0.01',
                'min': '0',
                'max': '1'
            }),
        }

    def __init__(self, *args, **kwargs):
        # Recibir 'instance' para editar
        super().__init__(*args, **kwargs)
        self.instance = kwargs.get('instance', None)

    def clean_nombre(self):
        nombre = self.cleaned_data.get('nombre')
        qs = Producto.objects.filter(nombre__iexact=nombre)
        if self.instance:
            qs = qs.exclude(productoid=self.instance.productoid)
        if qs.exists():
            raise forms.ValidationError('El nombre del producto ya está registrado.')
        return nombre

    def clean_codigo_de_barras(self):
        codigo_de_barras = self.cleaned_data.get('codigo_de_barras')
        if codigo_de_barras:
            qs = Producto.objects.filter(codigo_de_barras=codigo_de_barras)
            if self.instance:
                qs = qs.exclude(productoid=self.instance.productoid)
            if qs.exists():
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
    

class EditarProveedorForm(forms.ModelForm):
    """
    Form para editar un proveedor (con la misma lógica de validación que el de agregar).
    """
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
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el nombre del proveedor',
                'required': 'required'
            }),
            'empresa': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa la empresa',
                'required': 'required'
            }),
            'telefono': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el teléfono',
                'required': 'required'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa el correo electrónico'
            }),
            'direccion': forms.Textarea(attrs={
                'class': 'form-control',
                'placeholder': 'Ingresa la dirección',
                'rows': 3
            }),
        }

    def clean_nombre(self):
        nombre = self.cleaned_data['nombre']
        # Evitar duplicados con otros proveedores
        qs = (Proveedor.objects
             .exclude(pk=self.instance.pk)  # excluye al actual
             .filter(nombre__iexact=nombre))
        if qs.exists():
            raise forms.ValidationError('Ya existe un proveedor con este nombre.')
        return nombre

    def clean_telefono(self):
        telefono = self.cleaned_data['telefono']
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

class InventarioForm(forms.Form):
    """
    Form para 'Agregar Inventario' con autocompletado de Sucursal y Producto,
    y campo de cantidad.
    """
    # Campo de autocompletado para Sucursal
    sucursal_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar sucursal...',
            'autocomplete': 'off',
        })
    )
    # ID oculto de la sucursal
    sucursal = forms.ModelChoiceField(
        queryset=Sucursal.objects.none(),
        widget=forms.HiddenInput(),
        required=True,
    )

    # Campo de autocompletado para Producto
    producto_autocomplete = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar producto...',
            'autocomplete': 'off',
        })
    )
    # ID oculto del producto
    productoid = forms.ModelChoiceField(
        queryset=Producto.objects.none(),
        widget=forms.HiddenInput(),
        required=False,
    )

    # Campo de cantidad
    cantidad = forms.IntegerField(
        required=False,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa la cantidad',
            'min': '1'
        })
    )

    class Meta:
        fields = ['sucursal', 'productoid', 'cantidad']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Filtra Sucursales sin inventario
        subquery = Inventario.objects.filter(sucursalid=OuterRef('pk'))
        self.fields['sucursal'].queryset = (
            Sucursal.objects
                    .annotate(tiene_inventario=Exists(subquery))
                    .filter(tiene_inventario=False)
        )

        # Todos los productos
        self.fields['productoid'].queryset = Producto.objects.all()

    def clean(self):
        cleaned_data = super().clean()
        sucursal_obj = cleaned_data.get('sucursal')
        product_obj = cleaned_data.get('productoid')
        cantidad_val = cleaned_data.get('cantidad')

        if not sucursal_obj:
            self.add_error('sucursal', 'Debe seleccionar una sucursal válida.')

        if product_obj and (not cantidad_val or cantidad_val <= 0):
            self.add_error('cantidad', 'La cantidad debe ser mayor que 0.')

        return cleaned_data
    
class EditarInventarioForm(forms.Form):
    """
    Formulario para editar el inventario de una sucursal con autocomplete.
    """
    # Campo autocompletado de sucursal
    sucursal_autocomplete = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar sucursal...',
            'autocomplete': 'off',
        })
    )
    # Campo hidden para la ID de la sucursal
    sucursal = forms.ModelChoiceField(
        queryset=Sucursal.objects.all(),  # o .none() y luego sobreescribir en la vista
        widget=forms.HiddenInput(),
        required=True
    )

    # Campo oculto con la lista final de productos/cantidades en JSON
    inventarios_temp = forms.CharField(
        required=False,
        widget=forms.HiddenInput()
    )

    def clean_sucursal(self):
        suc = self.cleaned_data.get('sucursal')
        if not suc:
            raise forms.ValidationError('Debe seleccionar una sucursal.')
        return suc

    def clean_inventarios_temp(self):
        # Podrías validar que sea JSON, etc. Por ahora, lo dejas pasar.
        data = self.cleaned_data.get('inventarios_temp', '')
        return data
    

    
class PreciosProveedorForm(forms.Form):
    """
    Form para 'Agregar Productos y Precios' a un Proveedor,
    con autocompletado.
    """
    proveedor_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar proveedor...',
            'autocomplete': 'off',
        })
    )
    proveedor = forms.ModelChoiceField(
        queryset=Proveedor.objects.none(),
        widget=forms.HiddenInput(),
        required=True,
    )

    producto_autocomplete = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar producto...',
            'autocomplete': 'off',
        })
    )
    productoid = forms.ModelChoiceField(
        queryset=Producto.objects.none(),
        widget=forms.HiddenInput(),
        required=False,
    )

    precio = forms.DecimalField(
        required=False,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingrese el precio',
            'min': '0.01',
            'step': '0.01'
        })
    )

    class Meta:
        fields = ['proveedor', 'productoid', 'precio']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Filtra Proveedores sin productos (o la lógica que quieras)
        subquery = PreciosProveedor.objects.filter(proveedorid=OuterRef('pk'))
        self.fields['proveedor'].queryset = (
            Proveedor.objects
                     .annotate(tiene_productos=Exists(subquery))
                     .filter(tiene_productos=False)
        )

        # Todos los productos (o filtra según tu lógica)
        self.fields['productoid'].queryset = Producto.objects.all()

    def clean(self):
        cleaned_data = super().clean()
        prov_obj = cleaned_data.get('proveedor')
        prod_obj = cleaned_data.get('productoid')
        precio_val = cleaned_data.get('precio')

        if not prov_obj:
            self.add_error('proveedor', 'Debe seleccionar un proveedor válido.')

        if prod_obj and (not precio_val or precio_val <= 0):
            self.add_error('precio', 'El precio debe ser mayor que 0.')

        return cleaned_data
    

class EditarPreciosProveedorForm(forms.Form):
    """
    Form para 'Editar Productos y Precios' de un Proveedor existente.
    Se asume que se permita editar un proveedor que ya tiene productos.
    """
    proveedor_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar proveedor...',
            'autocomplete': 'off',
        })
    )
    proveedor = forms.ModelChoiceField(
        queryset=Proveedor.objects.all(),  # Permitir todos los proveedores
        widget=forms.HiddenInput(),
        required=True,
    )

    producto_autocomplete = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar producto...',
            'autocomplete': 'off',
        })
    )
    productoid = forms.ModelChoiceField(
        queryset=Producto.objects.all(),
        widget=forms.HiddenInput(),
        required=False,
    )

    precio = forms.DecimalField(
        required=False,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingrese el precio',
            'min': '0.01',
            'step': '0.01'
        })
    )

    precios_temp = forms.CharField(
        required=False,
        widget=forms.HiddenInput()
    )

    class Meta:
        fields = ['proveedor', 'productoid', 'precio', 'precios_temp']

    def clean(self):
        cleaned_data = super().clean()
        prov_obj = cleaned_data.get('proveedor')
        prod_obj = cleaned_data.get('productoid')
        precio_val = cleaned_data.get('precio')

        if not prov_obj:
            self.add_error('proveedor', 'Debe seleccionar un proveedor válido.')

        if prod_obj and (not precio_val or precio_val <= 0):
            self.add_error('precio', 'El precio debe ser mayor que 0.')

        return cleaned_data


class PuntosPagoForm(forms.Form):
    """
    Form para 'Agregar Puntos de Pago' con autocompletado de Sucursal
    y campos para nombre, descripción, dinero en caja.
    Maneja validaciones mínimas (el resto las hacemos en la vista).
    """

    # Autocomplete de Sucursal
    sucursal_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar sucursal...',
            'autocomplete': 'off',
        })
    )

    # ID oculto de la sucursal
    sucursal = forms.ModelChoiceField(
        queryset=Sucursal.objects.none(),
        widget=forms.HiddenInput(),
        required=True,
    )

    # Campos para añadir un solo “punto de pago” si deseas (aunque luego iremos a la tabla)
    nombre = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre del punto de pago...',
        })
    )
    descripcion = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Descripción (opcional)...',
        })
    )
    dinerocaja = forms.DecimalField(
        required=False,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': 'Dinero en caja...',
            'min': '0.00',
            'step': '0.01'
        })
    )

    class Meta:
        fields = ['sucursal', 'nombre', 'descripcion', 'dinerocaja']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Filtrar Sucursales que no tengan Puntos de Pago (o la lógica que necesites)
        # Aquí, asumiendo que solo quieres sucursales sin puntos de pago en 'puntospago'.
        # Ojo: Si la lógica es que cada sucursal puede tener muchos puntos de pago,
        #      no hagas filter en el queryset.
        subquery = PuntosPago.objects.filter(sucursalid=OuterRef('pk'))
        self.fields['sucursal'].queryset = (
            Sucursal.objects
                    .annotate(tiene_puntos=Exists(subquery))
                    .filter(tiene_puntos=False)
        )

    def clean(self):
        cleaned_data = super().clean()
        # Validaciones mínimas
        sucursal_obj = cleaned_data.get('sucursal')
        if not sucursal_obj:
            self.add_error('sucursal', 'Debe seleccionar una sucursal válida.')

        # No forzamos a que “nombre” sea obligatorio, puesto que
        # se agregarán varios nombres en la tabla
        return cleaned_data

class PuntosPagoEditarForm(forms.Form):
    """
    Form para 'Editar Puntos de Pago': permite elegir/editar
    la Sucursal con un autocomplete y validamos que la sucursal sea válida.
    """
    # Nuevo campo de autocomplete (mostrará la sucursal actual y permitirá cambiarla)
    sucursal_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar sucursal...',
            'autocomplete': 'off',
        })
    )
    
    # Sucursal oculta donde guardamos el ID resultante del autocomplete
    sucursal = forms.ModelChoiceField(
        queryset=Sucursal.objects.none(),
        widget=forms.HiddenInput(),
        required=True,
    )

    # Campos opcionales (usados en la parte superior del form para agregar un punto)
    nombre = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre del punto de pago...',
        })
    )
    descripcion = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Descripción (opcional)...',
        })
    )
    dinerocaja = forms.DecimalField(
        required=False,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': 'Dinero en caja...',
            'min': '0.00',
            'step': '0.01'
        })
    )

    def __init__(self, *args, **kwargs):
        # Podemos recibir por kwargs un 'initial_sucursal_id'
        # o simplemente usar initial['sucursal'].
        super().__init__(*args, **kwargs)

        # Permitimos "todas" las sucursales, ya que la vista
        # se encargará de filtrar en el autocomplete.
        self.fields['sucursal'].queryset = Sucursal.objects.all()

        # Si existe un initial con 'sucursal_autocomplete' (nombre)
        # o 'sucursal', se puede prefijar. La vista lo hará.

    def clean(self):
        cleaned_data = super().clean()
        sucursal_obj = cleaned_data.get('sucursal')
        if not sucursal_obj:
            self.add_error('sucursal', 'Sucursal no válida.')
        return cleaned_data
    
class UsuarioForm(forms.Form):
    """
    Form para 'Agregar Usuario' con autocompletado de Rol,
    campos para nombre de usuario y contraseñas.
    """
    # Autocomplete de Rol
    rol_autocomplete = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Escriba para buscar rol...',
            'autocomplete': 'off',
        })
    )
    rolid = forms.ModelChoiceField(
        queryset=Rol.objects.none(),
        widget=forms.HiddenInput(),
        required=True,
    )

    nombreusuario = forms.CharField(
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre de usuario',
        })
    )
    contraseña = forms.CharField(
        required=True,
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Contraseña',
        })
    )
    confirmar_contraseña = forms.CharField(
        required=True,
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Confirmar contraseña',
        })
    )

    class Meta:
        fields = ['rolid', 'nombreusuario', 'contraseña', 'confirmar_contraseña']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Si deseas filtrar roles de alguna manera, puedes hacerlo aquí.
        self.fields['rolid'].queryset = Rol.objects.all()

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('contraseña')
        confirm = cleaned_data.get('confirmar_contraseña')
        if password and confirm and password != confirm:
            self.add_error('confirmar_contraseña', 'Las contraseñas no coinciden.')

        return cleaned_data