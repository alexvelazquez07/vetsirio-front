/**
 * Tipos del dominio, alineados con lo que devuelve la API.
 *
 * Se replican acá y no se importan del backend porque el frontend no compila
 * contra el backend: el contrato vivo es el JSON. Cuando cambie un campo en
 * Prisma hay que actualizarlo en ambos lados, y por eso los tipos viven
 * centralizados en un solo archivo para que el cambio sea visible.
 */

export type PlanVeterinaria = "trial" | "basico" | "profesional" | "enterprise";

export type CodigoBloqueo =
  | "SUSCRIPCION_SUSPENDIDA"
  | "TRIAL_EXPIRADO"
  | "PLAN_VENCIDO"
  | null;

export interface EstadoSuscripcion {
  plan: PlanVeterinaria;
  enTrial: boolean;
  expirado: boolean;
  suspendida: boolean;
  diasRestantes: number | null;
  horasRestantes: number | null;
  venceEn: string | null;
  enZonaDeAviso: boolean;
  motivoBloqueo: string | null;
  codigoBloqueo: CodigoBloqueo;
}

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  permisos?: Permiso[];
}

export interface Permiso {
  clave: string;
  modulo: string;
  descripcion: string | null;
}

export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  fotoUrl: string | null;
  especialidad: string | null;
  colorAgenda: string | null;
  diasTrabajo: number[];
  debeCambiarPassword: boolean;
  ultimoAcceso: string | null;
  rol: Rol;
}

/** Integrante del equipo tal como lo devuelve /personal. */
export interface UsuarioPersonal {
  id: number;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  cedula: string | null;
  email: string;
  telefono: string | null;
  fotoUrl: string | null;
  especialidad: string | null;
  registroProfesional: string | null;
  colorAgenda: string | null;
  horarioInicio: string | null;
  horarioFin: string | null;
  diasTrabajo: number[];
  activo: boolean;
  debeCambiarPassword: boolean;
  ultimoAcceso: string | null;
  creadoEn: string;
  rol: Rol;
}

/** Rol con su catálogo de permisos y cuántos usuarios del tenant lo tienen. */
export interface RolPersonal extends Rol {
  esPlataforma: boolean;
  permisos: Permiso[];
  usuarios: number;
}

export interface PermisoPorModulo {
  modulo: string;
  permisos: Permiso[];
}


export interface Veterinaria {
  id: number;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  email: string;
  telefono: string | null;
  whatsapp: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  logoUrl: string | null;
  colorPrimario: string;
  moneda: string;
  plan: PlanVeterinaria;
  maxUsuarios: number;
  timbradoNro: string | null;
  puntoVenta: string;
  establecimiento: string;
}

export interface RespuestaPerfil {
  usuario: Usuario;
  veterinaria: Veterinaria;
  estadoSuscripcion: EstadoSuscripcion;
}

export interface RespuestaLogin {
  usuario: Usuario;
  veterinaria: Veterinaria;
  estadoSuscripcion: EstadoSuscripcion;
}

// ── Entidades del negocio ────────────────────────────────────────────────

export interface Cliente {
  id: number;
  /**
   * Documento principal, derivado por el backend con prioridad
   * cédula > RUC > pasaporte. Es el que muestran los listados.
   */
  documento: string;
  tipoDocumento: "cedula" | "ruc" | "pasaporte";
  /**
   * Documentos de identificación, en campos separados.
   *
   * Son independientes porque una persona natural puede tener cédula y RUC al
   * mismo tiempo. Antes había un único campo y un selector de tipo, que obligaba
   * a Falsear uno de los dos datos para poder guardar.
   */
  cedula: string | null;
  ruc: string | null;
  pasaporte: string | null;
  nombres: string | null;
  apellidos: string | null;
  razonSocial: string | null;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  direccion: string | null;
  departamento: string | null;
  ciudad: string | null;
  barrio: string | null;
  notas: string | null;
  activo: boolean;
  creadoEn: string;
  /**
   * Nombre listo para mostrar, calculado en el backend: la razón social si es
   * empresa, el nombre completo si es persona natural, o el documento si no hay
   * ninguno de los dos.
   *
   * Se calcula en el servidor y no en el cliente a propósito: la regla tiene que
   * ser la misma en el listado, en el autocompletado y en los comprobantes. Si
   * cada pantalla la armara por su cuenta, el día que cambie el formato del
   * nombre hay que corregirla en cinco lugares.
   */
  nombreCompleto: string;
  _count?: { pacientes: number; ventas: number };
}

export interface Paciente {
  id: number;
  nombre: string;
  especieId: number;
  especie?: { id: number; nombre: string; icono: string | null };
  raza: string | null;
  sexo: "macho" | "hembra" | null;
  fechaNacimiento: string | null;
  edadAnios: number | null;
  pesoKg: string | number | null;
  color: string | null;
  fotoUrl: string | null;
  chipId: string | null;
  esterilizado: boolean;
  desparasitado: boolean;
  alergias: string | null;
  notas: string | null;
  activo: boolean;
  cliente?: Pick<
    Cliente,
    | "id"
    | "documento"
    | "nombres"
    | "apellidos"
    | "razonSocial"
    | "telefono"
    | "whatsapp"
  >;
}

/** Contacto completo del responsable, tal como lo devuelve la ficha 360. */
export interface ClienteResumen {
  id: number;
  documento: string;
  nombres: string | null;
  apellidos: string | null;
  razonSocial: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
}

export interface PacienteFicha extends Omit<Paciente, "cliente"> {
  microchipUrl: string | null;
  creadoEn: string;
  cliente?: ClienteResumen;
}

export interface FichaConsulta {
  id: number;
  fecha: string;
  estado: EstadoConsulta;
  motivoConsulta: string;
  sintomas: string | null;
  diagnostico: string | null;
  tratamientoIndicado: string | null;
  pesoKg: string | number | null;
  temperatura: string | number | null;
  frecuenciaCardiaca: number | null;
  frecuenciaRespiratoria: number | null;
  veterinario: Pick<Usuario, "id" | "nombre" | "apellido" | "especialidad">;
}

export interface FichaVacunacion {
  id: number;
  nombreVacuna: string;
  lote: string | null;
  fechaAplicacion: string;
  fechaProxima: string | null;
  via: string | null;
  loteVenceEn: string | null;
  certificadoUrl: string | null;
  aplicadaPor: Pick<Usuario, "id" | "nombre" | "apellido"> | null;
}

export interface FichaTratamientoDosis {
  id: number;
  numeroDosis: number;
  cantidad: string | number;
  unidad: string;
  fechaProgramada: string;
  fechaAplicada: string | null;
  administrada: boolean;
  observaciones: string | null;
  producto: { id: number; nombre: string } | null;
}

export interface FichaTratamiento {
  id: number;
  nombre: string;
  descripcion: string | null;
  fechaInicio: string;
  fechaFinPrevista: string | null;
  fechaFinReal: string | null;
  activo: boolean;
  notas: string | null;
  veterinario: Pick<Usuario, "id" | "nombre" | "apellido" | "especialidad">;
  dosis: FichaTratamientoDosis[];
}

export interface FichaCita {
  id: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  motivo: string;
  notas: string | null;
  motivoCita: { id: number; nombre: string; color: string } | null;
  veterinario: Pick<
    Usuario,
    "id" | "nombre" | "apellido" | "especialidad" | "colorAgenda"
  > | null;
}

export interface FichaGrooming {
  id: number;
  fechaInicio: string;
  fechaFin: string | null;
  tipoServicio: string | null;
  estado: string;
  precio: string | number;
  observaciones: string | null;
  fotoAntesUrl: string | null;
  fotoDespuesUrl: string | null;
  peluquero: Pick<Usuario, "id" | "nombre" | "apellido"> | null;
}

export interface ResumenFichaPaciente {
  totalConsultas: number;
  totalVacunaciones: number;
  totalTratamientos: number;
  tratamientosActivos: number;
  totalCitas: number;
  totalGrooming: number;
  ultimaConsulta: string | null;
  proximaCita: FichaCita | null;
  proximaVacuna: FichaVacunacion | null;
  ultimoPeso: { pesoKg: string | number; fecha: string } | null;
  actividad: { mes: string; consultas: number }[];
}

/** Respuesta agregada de `GET /pacientes/:id/ficha`. */
export interface FichaPaciente {
  paciente: PacienteFicha;
  resumen: ResumenFichaPaciente;
  consultas: FichaConsulta[];
  vacunaciones: FichaVacunacion[];
  tratamientos: FichaTratamiento[];
  proximasCitas: FichaCita[];
  ultimasCitas: FichaCita[];
  grooming: FichaGrooming[];
}

export type EstadoConsulta = "abierta" | "en_curso" | "finalizada" | "anulada";

export interface ArchivoConsulta {
  id?: number;
  url: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  descripcion: string | null;
  creadoEn?: string;
}

export interface PrescripcionConsulta {
  id?: number;
  medicamento: string;
  presentacion: string | null;
  dosis: string;
  via: string | null;
  frecuencia: string | null;
  duracion: string | null;
  indicaciones: string | null;
  cantidad: string | number | null;
  creadoEn?: string;
}

export interface Consulta {
  id: number;
  pacienteId: number;
  veterinarioId: number;
  citaId: number | null;
  fecha: string;
  estado: EstadoConsulta;
  motivoConsulta: string;
  sintomas: string | null;
  examenFisico: string | null;
  diagnostico: string | null;
  tratamientoIndicado: string | null;
  observaciones: string | null;
  pesoKg: string | number | null;
  temperatura: string | number | null;
  frecuenciaCardiaca: number | null;
  frecuenciaRespiratoria: number | null;
  paciente: Pick<Paciente, "id" | "nombre" | "especie" | "cliente">;
  veterinario: Pick<Usuario, "id" | "nombre" | "apellido" | "especialidad">;
  archivos?: ArchivoConsulta[];
  prescripciones?: PrescripcionConsulta[];
  _count?: { archivos: number; prescripciones: number };
  cerradoEn?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface Vacunacion {
  id: number;
  pacienteId: number;
  consultaId: number | null;
  productoId: number | null;
  aplicadaPorId: number | null;
  nombreVacuna: string;
  lote: string | null;
  fechaAplicacion: string;
  fechaProxima: string | null;
  via: string | null;
  loteVenceEn: string | null;
  certificadoUrl: string | null;
  creadoEn: string;
  paciente: Pick<Paciente, "id" | "nombre" | "especie" | "cliente">;
  aplicadaPor: Pick<Usuario, "id" | "nombre" | "apellido"> | null;
}

export interface TratamientoDosis {
  id?: number;
  tratamientoId?: number;
  productoId: number | null;
  numeroDosis: number;
  cantidad: string | number;
  unidad: string;
  fechaProgramada: string;
  fechaAplicada: string | null;
  administrada: boolean;
  observaciones: string | null;
  producto?: { id: number; nombre: string } | null;
}

export interface Tratamiento {
  id: number;
  pacienteId: number;
  veterinarioId: number;
  nombre: string;
  descripcion: string | null;
  fechaInicio: string;
  fechaFinPrevista: string | null;
  fechaFinReal: string | null;
  activo: boolean;
  notas?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
  paciente: Pick<Paciente, "id" | "nombre" | "especie" | "cliente">;
  veterinario: Pick<Usuario, "id" | "nombre" | "apellido" | "especialidad">;
  dosis: TratamientoDosis[];
}

export type EstadoGrooming =
  | "pendiente"
  | "en_proceso"
  | "finalizada"
  | "cancelada";

export interface GroomingSesion {
  id: number;
  pacienteId: number;
  peluqueroId: number | null;
  citaId: number | null;
  fechaInicio: string;
  fechaFin: string | null;
  tipoServicio: string | null;
  estado: EstadoGrooming;
  precio: string | number;
  observaciones: string | null;
  fotoAntesUrl: string | null;
  fotoDespuesUrl: string | null;
  creadoEn?: string;
  paciente: Pick<Paciente, "id" | "nombre" | "especie" | "cliente">;
  peluquero: Pick<Usuario, "id" | "nombre" | "apellido"> | null;
  cita: {
    id: number;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
    motivo: string;
  } | null;
}

export interface CategoriaProducto {
  id: number;
  nombre: string;
  cantidad?: number;
}

export interface ProductoLote {
  id: number;
  codigoLote: string;
  cantidadInicial: string | number;
  cantidadActual: string | number;
  fechaVencimiento: string | null;
  fechaIngreso?: string;
  precioCosto?: string | number;
  ubicacion: string | null;
}

/** Lote vencido o próximo a vencer que el listado necesita señalar. */
export interface LoteAlertaProducto {
  id: number;
  codigoLote: string;
  fechaVencimiento: string;
  vencido: boolean;
}

export type TipoMovimientoStock =
  | "entrada"
  | "salida"
  | "ajuste"
  | "devolucion"
  | "merma"
  | "ajuste_inicial";

export interface StockMovimiento {
  id: number;
  tipo: TipoMovimientoStock;
  origen: string;
  cantidad: string | number;
  stockResultante: string | number;
  documentoRef: string | null;
  observacion: string | null;
  fecha: string;
  usuario: { id: number; nombre: string; apellido: string };
}

export interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  codigoBarras?: string | null;
  codigoSifen?: string | null;
  marca?: string | null;
  laboratorio?: string | null;
  principioActivo?: string | null;
  concentracion?: string | null;
  presentacion?: string | null;
  especieDestino?: string | null;
  registroSenacsa?: string | null;
  ubicacion?: string | null;
  unidadMedida: string;
  precioVenta: string | number;
  precioCosto: string | number;
  porcentajeIva: number;
  stockActual: string | number;
  stockMinimo: string | number;
  esMedicamento: boolean;
  esControlado?: boolean;
  requiereReceta: boolean;
  requiereLote: boolean;
  requiereVencimiento?: boolean;
  fechaVencimiento?: string | null;
  activo: boolean;
  fotoUrl: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
  categoria?: { id: number; nombre: string } | null;
  proveedor?: {
    id: number;
    razonSocial: string;
    nombreFantasia?: string | null;
  } | null;
  lotes?: ProductoLote[];
  movimientos?: StockMovimiento[];
  cantidadLotes?: number;
  lotesPorVencer?: number;
  lotesVencidos?: number;
  proximoVencimiento?: string | null;
  alertaVencimiento?: "vencido" | "por_vencer" | null;
  /** Lotes vencidos o por vencer, del más antiguo al más reciente. */
  lotesAlerta?: LoteAlertaProducto[];
}

export interface CategoriaServicio {
  id: number;
  nombre: string;
  color: string | null;
  icono: string | null;
  cantidad?: number;
}

export interface Servicio {
  id: number;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  precio: string | number;
  duracionMin: number;
  requiereVeterinario: boolean;
  consumeInsumos: boolean;
  precioPersonalizado: boolean;
  activo: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
  categoria?: CategoriaServicio | null;
}

export interface Proveedor {
  id: number;
  documento: string;
  razonSocial: string;
  nombreFantasia: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  departamento: string | null;
  ciudad: string | null;
  barrio: string | null;
  /** Persona a la que llamar dentro de la empresa. */
  contactoNombre: string | null;
  notas: string | null;
  activo: boolean;
  creadoEn?: string;
  /** Nombre a mostrar: el de fantasía si existe, si no la razón social. */
  nombreMostrable?: string;
  _count?: { productos: number; facturasCompra: number; egresos: number };
}

export interface Venta {
  id: number;
  numero: number;
  tipoDocumento: "ticket" | "factura" | "nota_credito" | "nota_debito";
  fecha: string;
  subtotal: string | number;
  descuento: string | number;
  IVA: string | number;
  total: string | number;
  estado: string;
  anulada: boolean;
  puntoVenta: string | null;
  establecimiento: string | null;
  cliente?: Cliente | null;
  usuario?: { id: number; nombre: string; apellido: string } | null;
  items?: VentaItem[];
}

export interface VentaItem {
  id: number;
  descripcion: string;
  cantidad: string | number;
  precioUnitario: string | number;
  descuento: string | number;
  IVA: string | number;
  total: string | number;
  productoId: number | null;
  servicioId: number | null;
  vencimientoSnapshot: string | null;
}

export interface FormaPago {
  metodo:
    | "efectivo"
    | "tarjeta_debito"
    | "tarjeta_credito"
    | "transferencia"
    | "giro"
    | "credito";
  monto: number;
  referencia?: string;
}

// ── Utilidades de API ───────────────────────────────────────────────────

export interface RespuestaPaginada<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

export interface RespuestaAccion {
  success: true;
  mensaje: string;
}

/** Forma genérica de lo que devuelve el endpoint de uploads. */
export interface RespuestaUpload {
  success: true;
  data: {
    url: string;
    nombreArchivo: string;
    mimeType: string;
    tamanoBytes: number;
  };
}