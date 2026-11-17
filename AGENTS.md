# VetSirio — Frontend (React 19 + Vite + Chakra UI v3)

Interfaz en español para una clínica veterinaria paraguaya. Consume la API en
`/api/v1` con cookies HttpOnly.

## Estructura

- `src/features/<dominio>/`: `<X>Page.tsx`, `<X>Form.tsx`, `<x>.service.ts` (hooks de React Query), `<x>.calculo.ts`, `<x>.export.ts` y tests colocados.
- `src/components/`: `data/` (`DataTable`, `FormDialog`, `Paginacion`), `fields/` (`MoneyInput`), `layout/` (`PageHeader`, `Panel`, `AppShell`), `ui/` (snippets de Chakra).
- `src/types/dominio.ts` es el contrato con la API y se mantiene a mano: al cambiar un campo en Prisma hay que actualizarlo acá.
- Rutas en `src/App.tsx` + `src/routes/AppRoutes.tsx`; menú y permisos en `src/routes/menu.ts`.
- Alias `@/` configurado en `vite.config.ts` y en ambos tsconfig. `verbatimModuleSyntax` está activo: todo tipo importado debe usar `import type`.

## Datos

- `http` de `src/services/api.ts` (axios con `withCredentials`, refresh de sesión y normalización de errores). Los errores llegan como `ApiError` (`status`, `code`, `errors`, `errorDeCampo`).
- React Query v5: una clave por dominio (`["clientes", { busqueda, pagina }]`), `placeholderData` para no parpadear e invalidación sólo de lo afectado.
- Paginación fija de 5 filas: `POR_PAGINA = 5` en cada servicio y `porPagina` máximo 5 en el backend. La respuesta es `RespuestaPaginada<T>` (`items`, `total`, `pagina`, `porPagina`, `totalPaginas`).
- Listados: `DataTable` con `cargando`, `Paginacion` y `useBusquedaDiferida` de `components/data/Paginacion`.
- Exportaciones: se generan a mano con `jsPDF` (PDF) y `fflate` (XLSX). No hay librería de Excel; seguí el patrón de `*.export.ts`.

## UI y Chakra v3

- Es **Chakra v3**, no v2. No existe `useToast`: usá `toaster.success(...)` / `toaster.error(...)` de `components/ui/toaster`.
- `Button` usa `loading={...}`, no `isLoading`. `isLoading` sólo aparece como campo de React Query (`consulta.isLoading`).
- Componentes v3: `Field.Root`, `DialogRoot`, `Stat.Root`, `Switch`, `Alert`. No hay un `AlertDialog` dedicado: las confirmaciones destructivas se arman con `DialogRoot`.
- No existe `PermissionGuard`. Usá `const { puede, puedeAlguno } = useAuth()` para ocultar acciones y `RutaConPermiso permiso="..."` para proteger rutas.
- Formularios: estado controlado + esquemas Zod de `src/lib/validaciones.ts`. **No** se usa react-hook-form ni Formik, aunque figuren en `package.json`.
- Diálogos: `FormDialog` para alta/edición; `DialogRoot` + `DialogBody/Footer` para flujos propios.
- Montos: `MoneyInput` y `src/lib/formato.ts`. Guaraní con punto de miles y sin centavos en pantalla; internamente se calcula con 2 decimales y se redondea al mostrar.
- Toda la UI, etiquetas y mensajes van en español con convenciones locales ("RUC", "Monto Inicial", "Arqueo"). Los nombres de archivos, componentes y tipos ya están en español: no los traduzcas.

## Tests y verificación

- Vitest + jsdom; setup en `src/test/setup.ts`. Para componentes usá `renderConChakra` de `src/test/utils.tsx` (`conRouter`, `conQuery`).
- `npm test`, un archivo: `npx vitest run src/features/ventas/ventas.calculo.test.ts`.
- `npm run typecheck` (`tsc -b`), `npm run lint` (oxlint), `npm run build`.
- Los tests de cálculo puro no montan componentes; los de formulario sí y necesitan los providers.

## Estado actual

- Caja y Egresos ya tienen UI en `src/features/caja/`: `CajaPage` (`/caja`, permiso
  `caja.ver`), `EgresosPage` (`/egresos`, permiso `caja.egresos`), `EgresoForm`,
  `caja.service.ts` (hooks de React Query) y `caja.calculo.ts` (arqueo y
  denominaciones PYG). Ya no usan `ModuloEnConstruccion`.
- Caja: estado de la sesión abierta, apertura, cierre con arqueo opcional por
  denominación e historial paginado. El descuadre se muestra en vivo, pero lo
  recalcula el backend al cerrar.
- Egresos: listado con filtros (estado, tipo, método, fechas), alta en diálogo y
  anulación con motivo. "Nuevo egreso" se deshabilita si la caja está cerrada,
  porque todo egreso exige caja abierta.
- El backend de Caja ya existe (`/api/v1/caja`):
  - `GET /caja/actual` → `{ abierta, sesion, efectivo: { ingresos, egresos, esperado }, otrosMedios }`. Con la caja cerrada devuelve `abierta: false` y `sesion: null`, no 404.
  - `GET /caja` → historial paginado (`estado=abierta|cerrada|todas`, `desde`, `hasta`).
  - `POST /caja/apertura` → `{ montoInicial?, moneda?, tipoCambio?, observaciones? }`. Sólo `PYG`; si ya hay una caja abierta responde 400.
  - `POST /caja/cierre` → `{ montoReal, detalles?: [{ denominacion, cantidad, esBillete }], observaciones? }`. La diferencia la calcula el servidor y exige observación si no es cero.
  - `GET /caja/egresos`, `POST /caja/egresos`, `POST /caja/egresos/:id/anular`.
  - Permisos: `caja.ver`, `caja.abrir`, `caja.cerrar`, `caja.egresos`.
- `VentasService` ya registra los cobros en el libro de caja:
  - `CrearVentaDto.pagos` (`[{ metodo, monto, referencia? }]`) es opcional. Si se envía, el backend crea los `VentaPago` y sus movimientos de caja.
  - `POST /ventas/:id/pagos` cobra una venta ya emitida (crédito o cobro posterior).
  - Cobrar exige caja abierta. Una venta de contado debe cobrarse completa; a crédito admite pagos parciales.
  - La venta devuelve `pagos`, `pagado` y `saldo`.
  - `useRegistrarPagoVenta()` en `features/ventas/ventas.service.ts` ya está listo; falta la UI de cobro en `VentaForm`.
- Facturación tiene UI real en `src/features/facturacion/`: `FacturacionPage`
  (`/facturacion`, permiso `facturas.ver`), `facturacion.service.ts` y helpers
  puros. Tiene dos pestañas: Comprobantes (resumen del período, filtros por tipo
  de documento, estado, estado SIFEN y fechas, y detalle en diálogo) y Timbrado
  (lectura y edición con `facturas.configurar`).
- Facturación es un libro fiscal sobre ventas: no crea comprobantes. El
  correlativo y el "siguiente número" son de sólo lectura; avanzan al emitir una
  venta. Al guardar el timbrado se invalidan también `ventas` y `configuracion`,
  porque cambia la habilitación para facturar.
- El backend de Facturación ya existe (`/api/v1/facturacion`):
  - `GET /facturacion/resumen` → totales del período (`desde`/`hasta`, default mes actual), por tipo de documento, estado, estado SIFEN y moneda. Los montos excluyen anuladas.
  - `GET /facturacion/comprobantes` → listado paginado con `tipoDocumento`, `estadoSifen`, `estado`, `desde`, `hasta`, `clienteId` y `busqueda`.
  - `GET /facturacion/comprobantes/:id` → detalle con ítems y pagos.
  - `GET /facturacion/timbrado` y `PATCH /facturacion/timbrado` (permiso `facturas.configurar`).
  - Permisos: `facturas.ver`, `facturas.configurar`.
- Personal tiene UI real en `src/features/personal/`: `PersonalPage` (`/personal`, permiso `usuarios.ver`), `UsuarioForm`, `personal.service.ts` y `personal.utils.ts`. Tiene dos pestañas: Equipo (alta, edición, baja lógica y reactivación de usuarios) y Roles y permisos (solo lectura, porque los roles son globales del producto).

## Reglas de UX que importan

- En acciones con dinero, el botón de envío lleva `loading` para bloquear el doble clic.
- Nunca muestres una tabla vacía mientras carga: `DataTable` ya resuelve esqueleto y estado vacío con `cargando`.
- Cada mutación muestra un toast y, si corresponde, invalida la query afectada.
- Fechas y moneda se presentan en formato paraguayo, no en `en-US`.
