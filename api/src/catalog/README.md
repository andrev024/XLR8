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
