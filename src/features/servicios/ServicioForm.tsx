import {
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Input,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  chakra,
} from "@chakra-ui/react";
import { CircleDollarSign, ClipboardList, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { MoneyInput } from "@/components/fields/MoneyInput";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import type { CategoriaServicio, Servicio } from "@/types/dominio";
import type { ServicioFormData } from "./servicios.service";

/* ──────────────────────────────── Tipos y datos ──────────────────────────────── */

export interface ServicioFormValues {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoriaId: string;
  precio: string;
  duracionMin: string;
  consumeInsumos: boolean;
  requiereVeterinario: boolean;
  precioPersonalizado: boolean;
  activo: boolean;
}

type Errores = Partial<Record<keyof ServicioFormValues, string>>;

const VALORES_INICIALES: ServicioFormValues = {
  codigo: "",
  nombre: "",
  descripcion: "",
  categoriaId: "",
  precio: "",
  duracionMin: "30",
  consumeInsumos: false,
  requiereVeterinario: false,
  precioPersonalizado: true,
  activo: true,
};

const ID = {
  codigo: "servicio-codigo",
  nombre: "servicio-nombre",
  categoriaId: "servicio-categoria",
  precio: "servicio-precio",
  duracionMin: "servicio-duracion",
  descripcion: "servicio-descripcion",
} as const;

/** Orden en que aparecen los campos validables en pantalla. */
const ORDEN_CAMPOS: (keyof typeof ID)[] = [
  "nombre",
  "codigo",
  "precio",
  "duracionMin",
  "descripcion",
];

const DURACIONES_COMUNES = [15, 30, 45, 60, 90];
const MAX_DESCRIPCION = 1000;

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

/** 90 → "1 h 30 min"; 45 → "45 min". */
function formatearDuracion(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos < 1) return "";
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/* ───────────────────────────── Componentes de apoyo ───────────────────────────── */

function Seccion({
  icono: Icono,
  titulo,
  descripcion,
  accesorio,
  children,
}: {
  icono: typeof ClipboardList;
  titulo: string;
  descripcion?: string;
  accesorio?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <chakra.section
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p={{ base: "4", md: "5" }}
    >
      <Flex align="center" justify="space-between" gap="3" wrap="wrap" mb="4">
        <Flex align="center" gap="3" minW="0">
          <Flex
            align="center"
            justify="center"
            w="9"
            h="9"
            flexShrink={0}
            borderRadius="lg"
            bg="brand.50"
            color="brand.600"
          >
            <Icono size={18} />
          </Flex>
          <Box minW="0">
            <Text fontSize="sm" fontWeight="semibold" color="ink.900" lineHeight="1.3">
              {titulo}
            </Text>
            {descripcion && (
              <Text fontSize="xs" color="ink.600" mt="0.5">
                {descripcion}
              </Text>
            )}
          </Box>
        </Flex>
        {accesorio}
      </Flex>
      {children}
    </chakra.section>
  );
}

function Campo({
  id,
  etiqueta,
  requerido,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <Field.Root invalid={!!error} required={requerido} ids={{ control: id }}>
      <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
        {etiqueta}
        {requerido && <Field.RequiredIndicator />}
      </Field.Label>
      {children}
      {error ? (
        <Field.ErrorText fontSize="xs">{error}</Field.ErrorText>
      ) : ayuda ? (
        <Field.HelperText fontSize="xs" color="ink.500">
          {ayuda}
        </Field.HelperText>
      ) : null}
    </Field.Root>
  );
}

/** Fila con interruptor y una línea de descripción. */
function FilaInterruptor({
  titulo,
  descripcion,
  checked,
  onChange,
}: {
  titulo: string;
  descripcion: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap="3"
      p="3"
      borderWidth="1px"
      borderColor={checked ? "brand.200" : "ink.200"}
      bg={checked ? "brand.50" : "white"}
      borderRadius="lg"
      transition="background 0.15s ease, border-color 0.15s ease"
    >
      <Box minW="0">
        <Text fontSize="sm" fontWeight="semibold" color="ink.900">
          {titulo}
        </Text>
        <Text fontSize="xs" color="ink.600">
          {descripcion}
        </Text>
      </Box>
      <Switch
        checked={checked}
        onCheckedChange={(detalle) => onChange(detalle.checked)}
        colorPalette="brand"
        aria-label={titulo}
      />
    </Flex>
  );
}

/* ─────────────────────────────────── Formulario ─────────────────────────────────── */

export function ServicioForm({
  servicio,
  categorias = [],
  onGuardar,
  errorGeneral,
  erroresServidor,
  detallesServidor,
  formId = "servicio-form",
}: {
  servicio?: Servicio | null;
  categorias?: CategoriaServicio[];
  onGuardar: (datos: ServicioFormData) => void;
  errorGeneral?: string | null;
  erroresServidor?: Errores;
  detallesServidor?: string[];
  formId?: string;
}) {
  const [valores, setValores] = useState<ServicioFormValues>(VALORES_INICIALES);
  const [errores, setErrores] = useState<Errores>({});

  useEffect(() => {
    if (!servicio) {
      setValores(VALORES_INICIALES);
      setErrores({});
      return;
    }

    setValores({
      codigo: servicio.codigo ?? "",
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? "",
      categoriaId: servicio.categoria?.id ? String(servicio.categoria.id) : "",
      precio: String(servicio.precio),
      duracionMin: String(servicio.duracionMin ?? 30),
      consumeInsumos: servicio.consumeInsumos,
      requiereVeterinario: servicio.requiereVeterinario,
      precioPersonalizado: servicio.precioPersonalizado,
      activo: servicio.activo,
    });
    setErrores({});
  }, [servicio]);

  function cambiar<K extends keyof ServicioFormValues>(
    campo: K,
    nuevo: ServicioFormValues[K],
  ) {
    setValores((previo) => ({ ...previo, [campo]: nuevo }));
    setErrores((previo) => ({ ...previo, [campo]: undefined }));
  }

  function validar(): Errores {
    const nuevos: Errores = {};

    if (valores.nombre.trim().length < 2) {
      nuevos.nombre = "Ingresá un nombre de al menos 2 letras.";
    }

    const precio = Number(valores.precio.replace(",", "."));
    if (valores.precio.trim() === "" || !Number.isFinite(precio) || precio < 0) {
      nuevos.precio = "Ingresá un precio válido.";
    }

    const duracion = Number(valores.duracionMin);
    if (!Number.isFinite(duracion) || duracion < 1 || duracion > 480) {
      nuevos.duracionMin = "La duración debe estar entre 1 y 480 minutos.";
    }

    if (valores.codigo.trim().length > 50) {
      nuevos.codigo = "El código admite hasta 50 caracteres.";
    }

    if (valores.descripcion.trim().length > MAX_DESCRIPCION) {
      nuevos.descripcion = `La descripción admite hasta ${MAX_DESCRIPCION} caracteres.`;
    }

    setErrores(nuevos);
    return nuevos;
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    const nuevos = validar();
    const primero = ORDEN_CAMPOS.find((campo) => nuevos[campo]);
    if (primero) {
      document.getElementById(ID[primero])?.focus();
      return;
    }

    const datos: ServicioFormData = {
      codigo: valores.codigo.trim() || undefined,
      nombre: valores.nombre.trim(),
      descripcion: valores.descripcion.trim() || null,
      categoriaId: valores.categoriaId ? Number(valores.categoriaId) : null,
      precio: Number(valores.precio.replace(",", ".")),
      duracionMin: Number(valores.duracionMin),
      consumeInsumos: valores.consumeInsumos,
      requiereVeterinario: valores.requiereVeterinario,
      precioPersonalizado: valores.precioPersonalizado,
      activo: valores.activo,
    };

    onGuardar(datos);
  }

  // Un error local (aunque haya quedado vacío al editar) tiene prioridad sobre el del servidor.
  const error = (campo: keyof ServicioFormValues) =>
    campo in errores ? errores[campo] : erroresServidor?.[campo];

  const duracionActual = Number(valores.duracionMin);
  const duracionLegible = formatearDuracion(duracionActual);

  return (
    <chakra.form id={formId} onSubmit={enviar} noValidate>
      <Stack gap="4">
        {errorGeneral && (
          <Alert status="error" rounded="md">
            {errorGeneral}
            {detallesServidor && detallesServidor.length > 0 && (
              <chakra.ul mt="1" pl="4" listStyleType="disc">
                {detallesServidor.map((detalle) => (
                  <chakra.li key={detalle}>{detalle}</chakra.li>
                ))}
              </chakra.ul>
            )}
          </Alert>
        )}

        {/* ── Datos del servicio ───────────────────────────────────── */}
        <Seccion
          icono={ClipboardList}
          titulo="Datos del servicio"
          descripcion="Cómo se identifica y se muestra en el sistema."
          accesorio={
            <Flex align="center" gap="2.5">
              <Text fontSize="xs" color="ink.600">
                {valores.activo ? "Servicio activo" : "Servicio inactivo"}
              </Text>
              <Switch
                checked={valores.activo}
                onCheckedChange={(detalle) => cambiar("activo", detalle.checked)}
                colorPalette="success"
                aria-label="Servicio activo"
              />
            </Flex>
          }
        >
          <Stack gap="5">
            <Campo id={ID.nombre} etiqueta="Nombre" requerido error={error("nombre")}>
              <Input
                value={valores.nombre}
                onChange={(evento) => cambiar("nombre", evento.target.value)}
                placeholder="Ej.: Consulta general"
                maxLength={150}
                autoFocus
              />
            </Campo>

            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <Campo
                id={ID.codigo}
                etiqueta="Código interno"
                error={error("codigo")}
                ayuda="Opcional. Si lo dejás vacío se genera solo."
              >
                <Input
                  value={valores.codigo}
                  onChange={(evento) => cambiar("codigo", evento.target.value.toUpperCase())}
                  placeholder="Se genera automáticamente"
                  maxLength={50}
                  fontFamily="mono"
                />
              </Campo>

              <Campo id={ID.categoriaId} etiqueta="Categoría">
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={valores.categoriaId}
                    onChange={(evento) => cambiar("categoriaId", evento.target.value)}
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Campo>
            </Grid>

            <Campo
              id={ID.descripcion}
              etiqueta="Descripción"
              error={error("descripcion")}
              ayuda={`${valores.descripcion.length} / ${MAX_DESCRIPCION} caracteres`}
            >
              <Textarea
                value={valores.descripcion}
                onChange={(evento) => cambiar("descripcion", evento.target.value)}
                rows={3}
                resize="vertical"
                maxLength={MAX_DESCRIPCION}
                placeholder="En qué consiste el servicio…"
              />
            </Campo>
          </Stack>
        </Seccion>

        {/* ── Precio y duración ────────────────────────────────────── */}
        <Seccion
          icono={CircleDollarSign}
          titulo="Precio y duración"
          descripcion="Cuánto se cobra y cuánto tiempo ocupa en la agenda."
        >
          <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5" alignItems="start">
            <Campo id={ID.precio} etiqueta="Precio" requerido error={error("precio")}>
              <MoneyInput
                id={ID.precio}
                value={valores.precio === "" ? null : Number(valores.precio)}
                onChange={(valor) => cambiar("precio", valor === null ? "" : String(valor))}
                placeholder="0"
                mostrarTotal
              />
            </Campo>

            <Stack gap="2">
              <Campo
                id={ID.duracionMin}
                etiqueta="Duración"
                error={error("duracionMin")}
                ayuda={duracionLegible ? `Equivale a ${duracionLegible}.` : undefined}
              >
                <Box position="relative" w="full">
                  <Input
                    type="number"
                    min="1"
                    max="480"
                    value={valores.duracionMin}
                    onChange={(evento) => cambiar("duracionMin", evento.target.value)}
                    pe="12"
                  />
                  <Text
                    position="absolute"
                    right="3"
                    top="50%"
                    transform="translateY(-50%)"
                    fontSize="sm"
                    color="ink.500"
                    pointerEvents="none"
                  >
                    min
                  </Text>
                </Box>
              </Campo>

              <Flex gap="1.5" wrap="wrap" role="group" aria-label="Duraciones frecuentes">
                {DURACIONES_COMUNES.map((minutos) => {
                  const activa = duracionActual === minutos;
                  return (
                    <Button
                      key={minutos}
                      type="button"
                      size="2xs"
                      borderRadius="full"
                      variant={activa ? "subtle" : "outline"}
                      colorPalette={activa ? "brand" : "gray"}
                      aria-pressed={activa}
                      onClick={() => cambiar("duracionMin", String(minutos))}
                    >
                      {formatearDuracion(minutos)}
                    </Button>
                  );
                })}
              </Flex>
            </Stack>
          </Grid>
        </Seccion>

        {/* ── Opciones ─────────────────────────────────────────────── */}
        <Seccion
          icono={SlidersHorizontal}
          titulo="Opciones"
          descripcion="Cómo se comporta este servicio al usarlo."
        >
          <Stack gap="2.5">
            <FilaInterruptor
              titulo="Consume insumos"
              descripcion="El servicio utiliza insumos del inventario."
              checked={valores.consumeInsumos}
              onChange={(valor) => cambiar("consumeInsumos", valor)}
            />
            <FilaInterruptor
              titulo="Requiere veterinario"
              descripcion="Debe ser atendido por un veterinario."
              checked={valores.requiereVeterinario}
              onChange={(valor) => cambiar("requiereVeterinario", valor)}
            />
            <FilaInterruptor
              titulo="Precio personalizado"
              descripcion="Permite ajustar el precio al cobrar."
              checked={valores.precioPersonalizado}
              onChange={(valor) => cambiar("precioPersonalizado", valor)}
            />
          </Stack>
        </Seccion>
      </Stack>
    </chakra.form>
  );
}