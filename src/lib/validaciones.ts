import { z } from "zod";

/**
 * Esquemas de validación de formularios.
 *
 * El backend valida con class-validator y el frontend con Zod. Es duplicación
 * a propósito: el backend es la autoridad y no puede depender de que el
 * frontend mande lo correcto, pero validar también del lado del cliente evita
 * un viaje de ida y vuelta por cada error tonto.
 *
 * Los mensajes están escritos para el usuario final, no para developers.
 */

// ── Reutilizables ────────────────────────────────────────────────────────

/** Cédula paraguaya: 7 u 8 dígitos, sin guiones ni espacios. */
export const cedulaSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^\d{7,8}$/, "La cédula debe tener 7 u 8 dígitos")
      .or(
        z
          .string()
          .regex(/^\d{9,11}$/, "Si es persona jurídica, ingresá el RUC"),
      ),
  );

export const rucSchema = z
  .string()
  .trim()
  .min(1, "El RUC es obligatorio")
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .pipe(z.string().regex(/^\d{8,11}$/, "El RUC debe tener entre 8 y 11 dígitos"));

export const telefonoSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^(\d{7,15})?$/, "Ingresá solo números, entre 7 y 15 dígitos")
      .or(z.literal("")),
  );

export const emailSchema = z
  .string()
  .trim()
  .min(1, "El correo es obligatorio")
  .toLowerCase()
  .pipe(z.string().email("Ingresá un correo válido"));

/**
 * Contraseña: 8 caracteres con minúscula, mayúscula y número.
 * Debe coincidir exactamente con la regla del backend (AuthDto).
 */
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(200, "La contraseña es demasiado larga")
  .regex(/[a-z]/, "Debe incluir al menos una minúscula")
  .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
  .regex(/\d/, "Debe incluir al menos un número");

/**
 * Monto: acepta number o el string que manda Prisma para los Decimal.
 * Null significa "no informado", que es distinto de cero.
 */
export const montoSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? Number.parseFloat(v) : v))
  .refine((v) => Number.isFinite(v), "Ingresá un número válido")
  .refine((v) => v >= 0, "El monto no puede ser negativo")
  .refine((v) => v <= 999_999_999_999, "El monto es demasiado alto");

/** Cantidad: admite decimales porque los insumos se venden por kg o litro. */
export const cantidadSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? Number.parseFloat(v) : v))
  .refine((v) => Number.isFinite(v), "Ingresá un número válido")
  .refine((v) => v > 0, "La cantidad debe ser mayor a cero");

// ── Autenticación ────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export type LoginForm = z.infer<typeof loginSchema>;

export const registroSchema = z
  .object({
    // Datos de la veterinaria
    ruc: rucSchema,
    razonSocial: z
      .string()
      .trim()
      .min(3, "Ingresá la razón social")
      .max(200, "Máximo 200 caracteres"),
    nombreComercial: z
      .string()
      .trim()
      .min(2, "Ingresá el nombre comercial")
      .max(150, "Máximo 150 caracteres"),
    email: emailSchema,
    telefono: telefonoSchema.optional(),
    whatsapp: telefonoSchema.optional(),
    direccion: z.string().trim().max(400).optional(),
    ciudad: z.string().trim().max(80).optional(),

    // Datos del responsable
    nombre: z
      .string()
      .trim()
      .min(2, "Ingresá tu nombre")
      .max(100, "Máximo 100 caracteres"),
    apellido: z
      .string()
      .trim()
      .min(2, "Ingresá tu apellido")
      .max(100, "Máximo 100 caracteres"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((datos) => datos.password === datos.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RegistroForm = z.infer<typeof registroSchema>;

export const recuperacionSchema = z.object({
  email: emailSchema,
});

export const nuevaPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((datos) => datos.password === datos.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

/**
 * Cambio de contraseña desde una sesión ya iniciada.
 *
 * La contraseña actual no impone política: pudo haberla definido un
 * administrador como clave temporal. La nueva sí usa `passwordSchema`.
 */
export const cambiarPasswordSchema = z
  .object({
    passwordActual: z
      .string()
      .min(1, "Ingresá tu contraseña actual")
      .max(200, "La contraseña es demasiado larga"),
    passwordNuevo: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((datos) => datos.passwordNuevo === datos.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type CambiarPasswordForm = z.infer<typeof cambiarPasswordSchema>;

// ── Clientes ─────────────────────────────────────────────────────────────

export const clienteSchema = z
  .object({
    tipoDocumento: z.enum(["cedula", "ruc", "pasaporte"]),
    documento: z.string().trim().min(1, "El documento es obligatorio"),
    nombres: z.string().trim().max(150).optional().or(z.literal("")),
    apellidos: z.string().trim().max(150).optional().or(z.literal("")),
    razonSocial: z.string().trim().max(200).optional().or(z.literal("")),
    email: emailSchema.optional().or(z.literal("")),
    telefono: telefonoSchema.optional().or(z.literal("")),
    whatsapp: telefonoSchema.optional().or(z.literal("")),
    direccion: z.string().trim().max(400).optional().or(z.literal("")),
    ciudad: z.string().trim().max(80).optional().or(z.literal("")),
    barrio: z.string().trim().max(120).optional().or(z.literal("")),
    notas: z.string().trim().max(1000).optional().or(z.literal("")),
    activo: z.boolean().default(true),
  })
  .refine(
    (datos) => {
      // Persona jurídica necesita razón social; persona natural, nombres.
      if (datos.tipoDocumento === "ruc") {
        return (datos.razonSocial ?? "").trim().length >= 3;
      }
      return (datos.nombres ?? "").trim().length >= 2;
    },
    {
      message: "Completá los datos correspondientes al tipo de documento",
      path: ["tipoDocumento"],
    },
  );

export type ClienteForm = z.infer<typeof clienteSchema>;

// ── Productos ────────────────────────────────────────────────────────────

export const productoSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, "El código es obligatorio")
    .max(50, "Máximo 50 caracteres")
    .transform((v) => v.toUpperCase()),
  nombre: z
    .string()
    .trim()
    .min(2, "Ingresá el nombre del producto")
    .max(200, "Máximo 200 caracteres"),
  descripcion: z.string().trim().max(500).optional().or(z.literal("")),
  categoriaId: z.number().int().positive().nullable().optional(),
  proveedorId: z.number().int().positive().nullable().optional(),

  unidadMedida: z.string().trim().min(1, "Indicá la unidad").max(20),
  precioCosto: montoSchema.nullable(),
  precioVenta: montoSchema.nullable(),
  stockMinimo: z.number().min(0, "No puede ser negativo").nullable(),
  porcentajeIva: z.number().int().min(0).max(100).default(5),

  esMedicamento: z.boolean().default(false),
  requiereReceta: z.boolean().default(false),
  activo: z.boolean().default(true),
});

export type ProductoForm = z.infer<typeof productoSchema>;

// ── Servicios ────────────────────────────────────────────────────────────

export const servicioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "Ingresá el nombre del servicio")
    .max(150, "Máximo 150 caracteres"),
  descripcion: z.string().trim().max(500).optional().or(z.literal("")),
  categoriaId: z.number().int().positive().nullable().optional(),
  precio: montoSchema,
  duracionMin: z
    .number()
    .int()
    .min(5, "Mínimo 5 minutos")
    .max(480, "Máximo 480 minutos"),
  requiereVeterinario: z.boolean().default(false),
  consumeInsumos: z.boolean().default(false),
  activo: z.boolean().default(true),
});

export type ServicioForm = z.infer<typeof servicioSchema>;

// ── Proveedores ──────────────────────────────────────────────────────────

export const proveedorSchema = z.object({
  documento: rucSchema,
  razonSocial: z
    .string()
    .trim()
    .min(3, "Ingresá la razón social")
    .max(200, "Máximo 200 caracteres"),
  nombreFantasia: z.string().trim().max(150).optional().or(z.literal("")),
  email: emailSchema.optional().or(z.literal("")),
  telefono: telefonoSchema.optional().or(z.literal("")),
  direccion: z.string().trim().max(400).optional().or(z.literal("")),
  activo: z.boolean().default(true),
});

export type ProveedorForm = z.infer<typeof proveedorSchema>;