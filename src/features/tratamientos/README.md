# Módulo de tratamientos

La ruta `/tratamientos` lista los tratamientos de la veterinaria, permite buscar
por paciente o nombre, filtrar los cerrados y abrir la ficha de cada registro.
Desde la ficha se puede editar, cerrar (baja lógica) o reactivar el tratamiento.

## Persistencia

Los datos se guardan en el backend NestJS (`src/tratamientos`), bajo
`/api/v1/tratamientos`. El formulario administra el paciente, las fechas y el
esquema de dosis (`tratamiento_dosis`). El campo histórico `adminisrada` de la
base se expone como `administrada` en la API.

## Permisos

- `tratamientos.ver`
- `tratamientos.crear`
- `tratamientos.editar`
- `tratamientos.eliminar` (cierre del tratamiento)

## Archivos

- `TratamientosPage.tsx`: listado, ficha, cierre y reactivación.
- `TratamientoForm.tsx`: alta y edición con buscador de pacientes y dosis.
- `tratamientos.service.ts`: hooks de React Query contra la API.
