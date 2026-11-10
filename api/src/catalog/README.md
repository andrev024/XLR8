# Catálogo de vehículos

El archivo `data/vehicles.json` contiene versiones de referencia para ayudar a
completar los formularios móviles. Cada entrada identifica su fuente técnica;
los años y valores de potencia en hp son aproximados y pueden variar según el
año-modelo, el mercado y la versión exacta. La potencia se puede editar en la
app: el catálogo no restringe el registro y la API calcula la categoría de
potencia con el valor que envía el usuario.

Los endpoints son públicos y no requieren JWT:

- `GET /catalog/brands?type=MOTORCYCLE|CAR`
- `GET /catalog/models?type=MOTORCYCLE|CAR&brand=Yamaha`
- `GET /catalog/versions?type=MOTORCYCLE|CAR&brand=Yamaha&model=FZ`

Las versiones devuelven `version`, `yearFrom`, `yearTo` (`null` si sigue
vigente), `horsepower` y `source`.

El catálogo incluye versiones comerciales actuales de modelos populares en
Colombia. Las fichas verificadas para esta selección son:

- AKT NKD 125 (estándar, FP y Classic): [AKT Colombia](https://aktmotos.com/motos-akt/calle/nkd-125/), [FP](https://aktmotos.com/motos-akt/calle/nkd-125-fp/) y [Classic](https://aktmotos.com/motos-akt/calle/nkd-125-classic/).
- Yamaha FZ 3.0: [Incolmotos Yamaha](https://www.incolmotos-yamaha.com.co/vehiculo/fz15v3/25294/).
- Chevrolet Onix Sedán 2027 (LT MT, LT AT, LTZ AT y Premier AT): [Chevrolet Colombia](https://www.chevrolet.com.co/carros/onix-sedan).
- Kia Picanto 2026-2027 (Vibrant MT, Zenith MT, Zenith AT y GT Line): [Kia Colombia](https://kia.com.co/nuestros-vehiculos/picanto) y fichas individuales de [Vibrant MT](https://kia.com.co/nuestros-vehiculos/picanto/especificaciones/vibrant-mt), [Zenith MT](https://kia.com.co/nuestros-vehiculos/picanto/especificaciones/zenith-mt), [Zenith AT](https://kia.com.co/nuestros-vehiculos/picanto/especificaciones/zenith-at) y [GT Line](https://kia.com.co/nuestros-vehiculos/picanto/especificaciones/gt-line).

La selección no implica que todos los modelos del catálogo tengan sus versiones
comerciales completas. Cuando no hay una ficha verificable, el formulario
permite ingresar manualmente la versión, el año y la potencia.
