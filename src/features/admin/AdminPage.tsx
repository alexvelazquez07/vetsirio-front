import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Input,
  NativeSelect,
  Spinner,
  Stack,
  Tabs,
  Text,
  Textarea,
  chakra,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BadgeDollarSign,
  CheckCircle2,
  Mail,
  MessageCircle,
  Pencil,
  Save,
  Search,
  ShieldCheck,
  ShieldOff,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { MoneyInput } from "@/components/fields/MoneyInput";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { toaster } from "@/components/ui/toaster";
import { mensajeDeError } from "@/features/clients/clients.service";
import {
  capitalizar,
  formatFecha,
  formatFechaHora,
  formatMoneda,
} from "@/lib/formato";
import {
  SOLICITUDES_POR_PAGINA,
  VETERINARIAS_POR_PAGINA,
  useActivarSolicitud,
  useActualizarSolicitud,
  useActualizarSuscripcion,
  useActualizarTrialGlobal,
  useActualizarTrialVeterinaria,
  useConfigAdmin,
  useReactivarVeterinaria,
  useSolicitudes,
  useSuspenderVeterinaria,
  useVeterinariasEnTrial,
  type ActualizarSolicitudPayload,
  type EstadoSolicitud,
  type FiltroEstadoSolicitud,
  type ModalidadPlan,
  type PreciosSuscripcionPayload,
  type SolicitudAdmin,
  type VeterinariaAdmin,
} from "./admin.service";

type Vista = "solicitudes" | "configuracion" | "prueba";

const ESTADO_META: Record<
  EstadoSolicitud,
  { etiqueta: string; color: string }
> = {
  pendiente: { etiqueta: "Pendiente", color: "orange" },
  contactada: { etiqueta: "Contactada", color: "blue" },
  cerrada: { etiqueta: "Cerrada", color: "green" },
  cancelada: { etiqueta: "Cancelada", color: "gray" },
};

const ESTADOS: { valor: EstadoSolicitud; etiqueta: string }[] = [
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "contactada", etiqueta: "Contactada" },
  { valor: "cerrada", etiqueta: "Cerrada" },
  { valor: "cancelada", etiqueta: "Cancelada" },
];

const ESTADOS_FILTRO: { valor: FiltroEstadoSolicitud; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "pendiente", etiqueta: "Pendientes" },
  { valor: "contactada", etiqueta: "Contactadas" },
  { valor: "cerrada", etiqueta: "Cerradas" },
  { valor: "cancelada", etiqueta: "Canceladas" },
];

const MODALIDAD_META: Record<
  ModalidadPlan,
  { etiqueta: string; periodo: string; meses: number }
> = {
  mensual: { etiqueta: "Mensual", periodo: "/ mes", meses: 1 },
  anual: { etiqueta: "Anual", periodo: "/ año", meses: 12 },
};

/** Precio máximo aceptado por el backend, en guaraníes. */
const PRECIO_MAXIMO = 999_999_999;

/**
 * Panel global de VetSirio.
 *
 * Tiene tres caras, separadas en pestañas porque son tareas distintas:
 *
 * - **Solicitudes**: la bandeja completa de pedidos de activación. El cliente
 *   pide el plan desde `/suscripcion`, el SuperAdmin lo contacta, activa el plan
 *   y puede editar el estado o la vigencia de cada solicitud.
 * - **Precio del plan**: los precios mensual y anual que ve el cliente.
 *   Cambiarlos acá afecta a las solicitudes nuevas, no a las que ya guardaron su
 *   snapshot.
 * - **Prueba gratuita**: los días de trial por defecto de la plataforma. Cada
 *   veterinaria conserva el snapshot con el que se registró; para una cuenta
 *   puntual se edita desde la solicitud.
 *
 * El pago se coordina fuera del sistema: activar no registra dinero.
 */
export function AdminPage() {
  const [vista, setVista] = useState<Vista>("solicitudes");
  // La bandeja abre sin filtros: el historial completo es el punto de partida.
  const [estado, setEstado] = useState<FiltroEstadoSolicitud>("todas");
  const [pagina, setPagina] = useState(1);
  const { texto, setTexto, busqueda } = useBusquedaDiferida();

  const consulta = useSolicitudes({ estado, busqueda, pagina });
  const activar = useActivarSolicitud();
  const actualizar = useActualizarSolicitud();

  // ── Activación manual ───────────────────────────────────────────────────
  const [seleccionada, setSeleccionada] = useState<SolicitudAdmin | null>(null);
  const [meses, setMeses] = useState(1);
  const [errorActivacion, setErrorActivacion] = useState<string | null>(null);

  // ── Edición de la solicitud ─────────────────────────────────────────────
  const [editando, setEditando] = useState<SolicitudAdmin | null>(null);
  const [estadoEditado, setEstadoEditado] =
    useState<EstadoSolicitud>("pendiente");
  const [mesesEditados, setMesesEditados] = useState<number | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const abrirActivacion = (solicitud: SolicitudAdmin) => {
    setSeleccionada(solicitud);
    // El plan anual se activa con 12 meses de una; el mensual, con 1.
    setMeses(MODALIDAD_META[solicitud.modalidad].meses);
    setErrorActivacion(null);
    activar.reset();
  };

  const cerrarActivacion = () => {
    if (activar.isPending) return;
    setSeleccionada(null);
    setErrorActivacion(null);
    activar.reset();
  };

  const abrirEdicion = (solicitud: SolicitudAdmin) => {
    setEditando(solicitud);
    setEstadoEditado(solicitud.estado);
    setMesesEditados(null);
    setErrorEdicion(null);
    actualizar.reset();
  };

  const cerrarEdicion = () => {
    if (actualizar.isPending) return;
    setEditando(null);
    setErrorEdicion(null);
    actualizar.reset();
  };

  const mesesValidos = Number.isInteger(meses) && meses >= 1 && meses <= 12;

  const confirmarActivacion = () => {
    if (!seleccionada || !mesesValidos) return;

    activar.mutate(
      { id: seleccionada.id, meses },
      {
        onSuccess: (respuesta) => {
          toaster.success({
            title: "Plan activado",
            description: respuesta.mensaje,
          });
          setSeleccionada(null);
          setErrorActivacion(null);
        },
        onError: (error) => setErrorActivacion(mensajeDeError(error)),
      },
    );
  };

  const planEnTrial = editando?.veterinaria.plan === "trial";
  const inicioAnualSeleccionada = seleccionada
    ? inicioAnualSolicitud(seleccionada)
    : null;
  const mesesEditadosValidos =
    mesesEditados === null ||
    (Number.isInteger(mesesEditados) &&
      mesesEditados >= 1 &&
      mesesEditados <= 12);

  const hayCambios =
    editando !== null &&
    (estadoEditado !== editando.estado || mesesEditados !== null);

  const confirmarEdicion = () => {
    if (!editando || !hayCambios || !mesesEditadosValidos) return;

    const payload: ActualizarSolicitudPayload = { id: editando.id };

    if (estadoEditado !== editando.estado) {
      payload.estado = estadoEditado;
    }

    if (mesesEditados !== null) {
      payload.meses = mesesEditados;
    }

    actualizar.mutate(payload, {
      onSuccess: (respuesta) => {
        toaster.success({
          title: "Solicitud actualizada",
          description: respuesta.mensaje,
        });
        setEditando(null);
        setErrorEdicion(null);
      },
      onError: (error) => setErrorEdicion(mensajeDeError(error)),
    });
  };

  const columnas = useMemo<ColumnDef<SolicitudAdmin, unknown>[]>(
    () => [
      {
        id: "veterinaria",
        header: "Veterinaria",
        enableSorting: false,
        cell: ({ row }) => (
          <Box minW="0">
            <Text fontWeight="semibold" color="ink.900" fontSize="sm" truncate>
              {row.original.veterinaria.nombreComercial}
            </Text>
            <Text fontSize="xs" color="ink.500" truncate>
              RUC {row.original.veterinaria.ruc} ·{" "}
              {capitalizar(row.original.veterinaria.plan)}
            </Text>
          </Box>
        ),
      },
      {
        id: "contacto",
        header: "Contacto",
        enableSorting: false,
        cell: ({ row }) => (
          <Stack gap="1">
            <Flex align="center" gap="1.5" fontSize="sm" color="ink.800">
              <MessageCircle size={14} />
              {row.original.whatsapp}
            </Flex>
            <Flex align="center" gap="1.5" fontSize="xs" color="ink.500">
              <Mail size={13} />
              {row.original.emailContacto}
            </Flex>
          </Stack>
        ),
      },
      {
        id: "precio",
        header: "Precio",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => {
          const modalidad = MODALIDAD_META[row.original.modalidad];

          return (
            <Box textAlign="right">
              <Text fontSize="sm" fontWeight="medium" color="ink.900">
                {formatMoneda(row.original.precioSnapshot, { espacios: true })}
              </Text>
              <Flex justify="flex-end" align="center" gap="1.5" mt="0.5">
                <Text fontSize="xs" color="ink.500">
                  {modalidad.periodo}
                </Text>
                <Badge
                  colorPalette={
                    row.original.modalidad === "anual" ? "purple" : "gray"
                  }
                  variant="subtle"
                  size="sm"
                >
                  {modalidad.etiqueta}
                </Badge>
              </Flex>
            </Box>
          );
        },
      },
      {
        id: "vence",
        header: "Vence",
        enableSorting: false,
        cell: ({ row }) => (
          <Text fontSize="sm" color="ink.700">
            {row.original.veterinaria.planVenceEn
              ? formatFecha(row.original.veterinaria.planVenceEn)
              : "Sin vencimiento"}
          </Text>
        ),
      },
      {
        id: "creadoEn",
        header: "Solicitada",
        enableSorting: false,
        cell: ({ row }) => (
          <Text fontSize="sm" color="ink.700">
            {formatFechaHora(row.original.creadoEn)}
          </Text>
        ),
      },
      {
        id: "estado",
        header: "Estado",
        enableSorting: false,
        cell: ({ row }) => {
          const meta = ESTADO_META[row.original.estado];

          return (
            <Badge colorPalette={meta.color} variant="subtle" size="sm">
              {meta.etiqueta}
            </Badge>
          );
        },
      },
      {
        id: "acciones",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <Flex justify="flex-end" gap="1">
            <chakra.button
              type="button"
              onClick={(evento: React.MouseEvent) => {
                evento.stopPropagation();
                abrirEdicion(row.original);
              }}
              p="1.5"
              borderRadius="md"
              color="ink.500"
              _hover={{ bg: "ink.100", color: "ink.700" }}
              aria-label="Editar solicitud"
            >
              <Pencil size={15} />
            </chakra.button>

            {esAccionable(row.original) && (
              <Button
                size="xs"
                colorPalette="brand"
                variant="subtle"
                onClick={(evento) => {
                  evento.stopPropagation();
                  abrirActivacion(row.original);
                }}
              >
                <CheckCircle2 size={14} /> Activar
              </Button>
            )}
          </Flex>
        ),
      },
    ],
    // Los handlers sólo usan setters estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const accionesListado = (
    <Flex
      w="full"
      gap="3"
      align={{ base: "stretch", lg: "center" }}
      wrap="wrap"
    >
      <CampoBusqueda
        valor={texto}
        onChange={(valor) => {
          setTexto(valor);
          setPagina(1);
        }}
        placeholder="Buscar por veterinaria, RUC, WhatsApp o email…"
      />

      <NativeSelect.Root size="sm" w={{ base: "full", sm: "12rem" }}>
        <NativeSelect.Field
          value={estado}
          onChange={(evento) => {
            setEstado(evento.target.value as FiltroEstadoSolicitud);
            setPagina(1);
          }}
          aria-label="Filtrar por estado"
        >
          {ESTADOS_FILTRO.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Flex>
  );

  const tituloVacio =
    estado === "todas"
      ? "Todavía no hay solicitudes"
      : "No hay solicitudes en este estado";

  return (
    <Box>
      <PageHeader
        titulo="Panel global"
        descripcion="Solicitudes de activación, precios del plan y días de prueba. El pago se coordina fuera del sistema."
        migas={["Inicio", "Panel global"]}
      />

      <Panel flush>
        <Box
          px={{ base: "4", md: "5" }}
          borderBottomWidth="1px"
          borderColor="ink.200"
          overflowX="auto"
        >
          <Tabs.Root
            value={vista}
            onValueChange={({ value }) => setVista(value as Vista)}
            variant="line"
            size="md"
          >
            <Tabs.List borderBottomWidth="0">
              <Tabs.Trigger value="solicitudes">Solicitudes</Tabs.Trigger>
              <Tabs.Trigger value="configuracion">
                Precio del plan
              </Tabs.Trigger>
              <Tabs.Trigger value="prueba">Prueba gratuita</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </Box>

        {vista === "solicitudes" ? (
          <>
            {consulta.isError && (
              <Alert
                status="error"
                rounded="md"
                title="No pudimos cargar las solicitudes"
                m="4"
              >
                {mensajeDeError(consulta.error)}
              </Alert>
            )}

            <DataTable
              data={consulta.data?.items ?? []}
              columns={columnas}
              cargando={consulta.isLoading}
              claveFila={(solicitud) => solicitud.id}
              hayBusqueda={busqueda.length > 0}
              vacioTitulo={tituloVacio}
              vacioDetalle="Cuando una veterinaria pida activar su plan desde Mi plan, la vas a ver acá."
              acciones={accionesListado}
              onFilaClick={abrirEdicion}
            />

            {consulta.data && (
              <Paginacion
                pagina={consulta.data.pagina}
                totalPaginas={consulta.data.totalPaginas}
                total={consulta.data.total}
                porPagina={SOLICITUDES_POR_PAGINA}
                onCambioPagina={setPagina}
                singular="solicitud"
                plural="solicitudes"
              />
            )}
          </>
        ) : vista === "configuracion" ? (
          <Box px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
            <ConfiguracionPrecio />
          </Box>
        ) : (
          <Box px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
            <Stack gap="8">
              <ConfiguracionPrueba />
              <Box borderTopWidth="1px" borderColor="ink.200" pt="6">
                <VeterinariasPrueba />
              </Box>
            </Stack>
          </Box>
        )}
      </Panel>

      {/* ── Activación manual ─────────────────────────────────────────────── */}
      <FormDialog
        abierto={Boolean(seleccionada)}
        onClose={cerrarActivacion}
        titulo="Activar plan manualmente"
        descripcion="El plan se habilita ahora. El pago se coordina fuera del sistema."
        ancho="lg"
        textoConfirmar="Activar plan"
        guardando={activar.isPending}
        bloquearCierre={activar.isPending}
        confirmarDeshabilitado={!mesesValidos}
        onConfirmar={confirmarActivacion}
      >
        {seleccionada && (
          <Stack gap="4">
            <Alert status="info" title="Esto no registra un cobro">
              Activás el acceso de la veterinaria, pero el pago y su registro
              siguen siendo manuales. Verificá que el pago esté coordinado antes
              de confirmar.
            </Alert>

            {!seleccionada.veterinaria.activa && (
              <Alert status="warning" title="Cuenta suspendida">
                <Flex align="flex-start" gap="2">
                  <TriangleAlert size={15} />
                  <Text fontSize="sm">
                    Al activar el plan también se levanta la suspensión.{" "}
                    {seleccionada.veterinaria.suspendidaMotivo ??
                      "No hay motivo registrado."}
                  </Text>
                </Flex>
              </Alert>
            )}

            <ResumenSolicitud solicitud={seleccionada} />

            {inicioAnualSeleccionada && (
              <Alert
                status="info"
                title="El plan anual empieza al vencer el actual"
              >
                El plan actual vence el {formatFecha(inicioAnualSeleccionada)}.
                El anual cubre 12 meses desde esa fecha: no se pierden los días
                que le quedan al cliente.
              </Alert>
            )}

            <Field.Root required>
              <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
                Meses a activar
                <Field.RequiredIndicator />
              </Field.Label>
              <Input
                type="number"
                min={1}
                max={12}
                step={1}
                value={meses}
                onChange={(evento) => setMeses(Number(evento.target.value))}
                inputMode="numeric"
              />
              <Field.HelperText fontSize="xs" color="ink.500">
                Se suma desde hoy o desde el vencimiento actual si el plan sigue
                vigente. Viene con los meses de la modalidad elegida (1 mensual,
                12 anual); podés ajustarlo hasta 12.
              </Field.HelperText>
              {!mesesValidos && (
                <Field.ErrorText fontSize="xs" mt="0.5">
                  Ingresá un número entero entre 1 y 12.
                </Field.ErrorText>
              )}
            </Field.Root>

            {errorActivacion && (
              <Alert status="error" title="No pudimos activar el plan">
                {errorActivacion}
              </Alert>
            )}
          </Stack>
        )}
      </FormDialog>

      {/* ── Edición de estado y vigencia ──────────────────────────────────── */}
      <FormDialog
        abierto={Boolean(editando)}
        onClose={cerrarEdicion}
        titulo="Editar solicitud"
        descripcion="Cambiá el estado de la bandeja, la vigencia del plan, los días de prueba o el acceso de la cuenta."
        ancho="lg"
        textoConfirmar="Guardar cambios"
        guardando={actualizar.isPending}
        bloquearCierre={actualizar.isPending}
        confirmarDeshabilitado={!hayCambios || !mesesEditadosValidos}
        onConfirmar={confirmarEdicion}
      >
        {editando && (
          <Stack gap="4">
            <ResumenSolicitud solicitud={editando} />

            <TrialVeterinaria
              veterinaria={editando.veterinaria}
              onHecho={cerrarEdicion}
            />

            <AccesoCuenta
              veterinaria={editando.veterinaria}
              onHecho={cerrarEdicion}
            />

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
                Estado de la solicitud
              </Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={estadoEditado}
                  onChange={(evento) =>
                    setEstadoEditado(evento.target.value as EstadoSolicitud)
                  }
                >
                  {ESTADOS.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
              <Field.HelperText fontSize="xs" color="ink.500">
                Cerrar o cancelar deja registrado quién atendió la solicitud.
                Volver a pendiente borra esa marca. Este estado es sólo la
                bandeja: no corta el acceso. Para eso usá "Suspender cuenta".
              </Field.HelperText>
            </Field.Root>

            <Field.Root invalid={!mesesEditadosValidos}>
              <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
                Vigencia del plan
              </Field.Label>
              <Input
                type="number"
                min={1}
                max={12}
                step={1}
                placeholder="Sin cambios"
                value={mesesEditados ?? ""}
                disabled={planEnTrial}
                onChange={(evento) =>
                  setMesesEditados(
                    evento.target.value === ""
                      ? null
                      : Number(evento.target.value),
                  )
                }
                inputMode="numeric"
              />
              <Field.HelperText fontSize="xs" color="ink.500">
                {planEnTrial
                  ? "La veterinaria sigue en período de prueba. Activá el plan para poder fijar la vigencia."
                  : "Meses desde hoy. Dejalo vacío para no tocar la vigencia actual. Máximo 12."}
              </Field.HelperText>
              {!mesesEditadosValidos && (
                <Field.ErrorText fontSize="xs" mt="0.5">
                  Ingresá un número entero entre 1 y 12 o dejalo vacío.
                </Field.ErrorText>
              )}
            </Field.Root>

            {errorEdicion && (
              <Alert status="error" title="No pudimos editar la solicitud">
                {errorEdicion}
              </Alert>
            )}
          </Stack>
        )}
      </FormDialog>
    </Box>
  );
}

/** Ficha compacta de la solicitud, compartida por los dos diálogos. */
function ResumenSolicitud({ solicitud }: { solicitud: SolicitudAdmin }) {
  const inicioAnual = inicioAnualSolicitud(solicitud);

  return (
    <Box
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="md"
      p="4"
      bg="ink.50"
    >
      <Flex align="center" gap="2" mb="3">
        <ShieldCheck size={16} color="var(--chakra-colors-brand-600)" />
        <Text fontWeight="semibold" color="ink.900" fontSize="sm">
          {solicitud.veterinaria.nombreComercial}
        </Text>
      </Flex>

      <Stack gap="2" fontSize="sm">
        <Dato etiqueta="RUC" valor={solicitud.veterinaria.ruc} />
        <Dato
          etiqueta="Plan actual"
          valor={capitalizar(solicitud.veterinaria.plan)}
        />
        <Dato
          etiqueta="Vence"
          valor={
            solicitud.veterinaria.planVenceEn
              ? formatFecha(solicitud.veterinaria.planVenceEn)
              : "Sin vencimiento"
          }
        />
        {inicioAnual && (
          <Dato
            etiqueta="Empieza el anual"
            valor={formatFecha(inicioAnual)}
          />
        )}
        <Dato etiqueta="WhatsApp" valor={solicitud.whatsapp} />
        <Dato etiqueta="Email de contacto" valor={solicitud.emailContacto} />
        <Dato
          etiqueta="Modalidad"
          valor={MODALIDAD_META[solicitud.modalidad].etiqueta}
        />
        <Dato
          etiqueta="Precio solicitado"
          valor={`${formatMoneda(solicitud.precioSnapshot, {
            espacios: true,
          })} ${MODALIDAD_META[solicitud.modalidad].periodo}`}
        />
      </Stack>

      {solicitud.comentario && (
        <Box
          mt="3"
          bg="white"
          borderLeftWidth="3px"
          borderColor="brand.400"
          borderRadius="sm"
          p="3"
        >
          <Text fontSize="xs" color="ink.500" fontWeight="semibold" mb="1">
            Comentario del cliente
          </Text>
          <Text fontSize="sm" color="ink.700" whiteSpace="pre-wrap">
            {solicitud.comentario}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Fecha en la que empieza el plan anual pedido.
 *
 * Si la veterinaria tiene un plan pago vigente, el anual se encadena a su
 * vencimiento en lugar de empezar hoy. Devuelve null cuando no hay nada que
 * diferir (trial, plan vencido o solicitud mensual).
 */
function inicioAnualSolicitud(solicitud: SolicitudAdmin): string | null {
  if (solicitud.modalidad !== "anual") return null;

  const { plan, planVenceEn } = solicitud.veterinaria;

  if (plan === "trial" || !planVenceEn) return null;

  return new Date(planVenceEn).getTime() > Date.now() ? planVenceEn : null;
}

/**
 * Días de prueba de una veterinaria concreta.
 *
 * El valor global sólo afecta a las cuentas nuevas; acá se ajusta la que el
 * SuperAdmin está mirando. Igual que el acceso, se aplica al instante y no
 * depende del botón "Guardar cambios".
 */
function TrialVeterinaria({
  veterinaria,
  onHecho,
}: {
  veterinaria: SolicitudAdmin["veterinaria"];
  onHecho: () => void;
}) {
  const guardar = useActualizarTrialVeterinaria();
  const [dias, setDias] = useState(veterinaria.trialDias);
  const [error, setError] = useState<string | null>(null);

  const esTrial = veterinaria.plan === "trial";
  const diasValidos = Number.isInteger(dias) && dias >= 0 && dias <= 365;
  const hayCambio = dias !== veterinaria.trialDias;
  const vence = veterinaria.trialFin ?? veterinaria.planVenceEn;

  const confirmar = () => {
    if (!esTrial || !diasValidos || !hayCambio) return;

    guardar.mutate(
      { veterinariaId: veterinaria.id, diasTrial: dias },
      {
        onSuccess: ({ mensaje }) => {
          toaster.success({
            title: "Período de prueba actualizado",
            description: mensaje,
          });
          onHecho();
        },
        onError: (errorGuardado) => setError(mensajeDeError(errorGuardado)),
      },
    );
  };

  return (
    <Box borderWidth="1px" borderColor="ink.200" borderRadius="md" p="4">
      <Flex align="center" justify="space-between" gap="3">
        <Box minW="0">
          <Flex align="center" gap="2">
            <Timer size={16} color="var(--chakra-colors-brand-600)" />
            <Text fontWeight="semibold" color="ink.900" fontSize="sm">
              Período de prueba
            </Text>
          </Flex>
          <Text fontSize="xs" color="ink.500" mt="0.5">
            {esTrial
              ? "Días de prueba otorgados a esta veterinaria. Se aplica al instante."
              : "Esta veterinaria ya tiene un plan pago."}
          </Text>
        </Box>
        <Badge
          colorPalette={esTrial ? "orange" : "green"}
          variant="subtle"
          size="sm"
          flexShrink={0}
        >
          {esTrial ? "En prueba" : "Plan pago"}
        </Badge>
      </Flex>

      {esTrial ? (
        <Stack gap="3" mt="3">
          <Flex gap="5" wrap="wrap" fontSize="sm">
            <Text color="ink.600">
              Otorgados:{" "}
              <chakra.span fontWeight="semibold" color="ink.900">
                {veterinaria.trialDias} días
              </chakra.span>
            </Text>
            <Text color="ink.600">
              Vence:{" "}
              <chakra.span fontWeight="semibold" color="ink.900">
                {vence ? formatFecha(vence) : "Sin vencimiento"}
              </chakra.span>
            </Text>
          </Flex>

          <Field.Root invalid={!diasValidos}>
            <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
              Días de prueba
            </Field.Label>
            <Input
              type="number"
              min={0}
              max={365}
              step={1}
              value={dias}
              onChange={(evento) => setDias(Number(evento.target.value))}
              inputMode="numeric"
            />
            <Field.HelperText fontSize="xs" color="ink.500">
              {veterinaria.trialInicio
                ? `Se cuenta desde el inicio del trial (${formatFecha(
                    veterinaria.trialInicio,
                  )}). `
                : "Se cuenta desde hoy. "}
              Si el nuevo plazo ya estaría vencido, empieza a contar hoy.
            </Field.HelperText>
            {!diasValidos && (
              <Field.ErrorText fontSize="xs" mt="0.5">
                Ingresá un número entero entre 0 y 365.
              </Field.ErrorText>
            )}
          </Field.Root>

          <Button
            colorPalette="brand"
            variant="subtle"
            size="sm"
            alignSelf="flex-start"
            onClick={confirmar}
            loading={guardar.isPending}
            disabled={!diasValidos || !hayCambio}
          >
            <Save size={14} /> Guardar período
          </Button>
        </Stack>
      ) : (
        <Text fontSize="sm" color="ink.600" mt="3">
          El período de prueba ya no aplica. Si necesitás darle acceso, activá
          su plan o coordiná una renovación.
        </Text>
      )}

      {error && (
        <Alert status="error" title="No pudimos cambiar el período" mt="3">
          {error}
        </Alert>
      )}
    </Box>
  );
}

/**
 * Acceso de la cuenta.
 *
 * Suspender y reactivar actúan sobre la veterinaria, no sobre la solicitud.
 * Van en esta ficha porque es donde el SuperAdmin ya está mirando los datos
 * del cliente. Aplican al instante: no dependen del botón "Guardar cambios".
 */
function AccesoCuenta({
  veterinaria,
  onHecho,
}: {
  veterinaria: SolicitudAdmin["veterinaria"];
  onHecho: () => void;
}) {
  const suspender = useSuspenderVeterinaria();
  const reactivar = useReactivarVeterinaria();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const motivoLimpio = motivo.trim();
  const motivoValido = motivoLimpio.length >= 10 && motivoLimpio.length <= 500;

  const confirmarSuspension = () => {
    if (!motivoValido) return;

    suspender.mutate(
      { veterinariaId: veterinaria.id, motivo: motivoLimpio },
      {
        onSuccess: ({ mensaje }) => {
          toaster.success({ title: "Cuenta suspendida", description: mensaje });
          onHecho();
        },
        onError: (errorSuspension) =>
          setError(mensajeDeError(errorSuspension)),
      },
    );
  };

  const confirmarReactivacion = () => {
    reactivar.mutate(veterinaria.id, {
      onSuccess: ({ mensaje }) => {
        toaster.success({ title: "Cuenta reactivada", description: mensaje });
        onHecho();
      },
      onError: (errorReactivacion) =>
        setError(mensajeDeError(errorReactivacion)),
    });
  };

  return (
    <Box
      borderWidth="1px"
      borderColor={veterinaria.activa ? "ink.200" : "danger.muted"}
      borderRadius="md"
      p="4"
    >
      <Flex align="center" justify="space-between" gap="3">
        <Box minW="0">
          <Text fontWeight="semibold" color="ink.900" fontSize="sm">
            Acceso de la cuenta
          </Text>
          <Text fontSize="xs" color="ink.500" mt="0.5">
            Suspender corta el acceso al instante; reactivar lo devuelve. No
            depende del botón "Guardar cambios".
          </Text>
        </Box>
        <Badge
          colorPalette={veterinaria.activa ? "green" : "red"}
          variant="subtle"
          size="sm"
          flexShrink={0}
        >
          {veterinaria.activa ? "Activa" : "Suspendida"}
        </Badge>
      </Flex>

      {!veterinaria.activa && veterinaria.suspendidaMotivo && (
        <Alert status="warning" title="Motivo de la suspensión" mt="3">
          {veterinaria.suspendidaMotivo}
        </Alert>
      )}

      {veterinaria.activa ? (
        <Stack gap="3" mt="3">
          <Field.Root invalid={motivo.length > 0 && !motivoValido}>
            <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
              Motivo de la suspensión
            </Field.Label>
            <Textarea
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Ej.: pago rechazado, cuenta en revisión…"
              rows={2}
              resize="vertical"
              maxLength={500}
            />
            <Field.HelperText fontSize="xs" color="ink.500">
              Mínimo 10 caracteres. El cliente va a leer este motivo.
            </Field.HelperText>
            {motivo.length > 0 && !motivoValido && (
              <Field.ErrorText fontSize="xs" mt="0.5">
                El motivo debe tener al menos 10 caracteres.
              </Field.ErrorText>
            )}
          </Field.Root>

          <Button
            colorPalette="danger"
            variant="subtle"
            size="sm"
            alignSelf="flex-start"
            onClick={confirmarSuspension}
            loading={suspender.isPending}
            disabled={!motivoValido}
          >
            <ShieldOff size={14} /> Suspender cuenta
          </Button>
        </Stack>
      ) : (
        <Button
          mt="3"
          colorPalette="green"
          variant="subtle"
          size="sm"
          onClick={confirmarReactivacion}
          loading={reactivar.isPending}
        >
          <ShieldCheck size={14} /> Reactivar cuenta
        </Button>
      )}

      {error && (
        <Alert status="error" title="No pudimos cambiar el acceso" mt="3">
          {error}
        </Alert>
      )}
    </Box>
  );
}

/**
 * Precios del plan: mensual y anual.
 *
 * Son dos cifras independientes para toda la plataforma: el producto vende un
 * plan único con dos modalidades de pago. El anual no se calcula desde el
 * mensual, así que cada una se edita por separado. Las solicitudes ya creadas
 * conservan su `precioSnapshot`, por lo que cambiar los precios no reescribe el
 * pasado.
 */
function ConfiguracionPrecio() {
  const config = useConfigAdmin();

  if (config.isLoading) {
    return (
      <Flex align="center" justify="center" py="12" gap="3" color="ink.500">
        <Spinner size="sm" />
        <Text fontSize="sm">Cargando configuración…</Text>
      </Flex>
    );
  }

  if (config.isError) {
    return (
      <Alert status="error" title="No pudimos cargar la configuración">
        {mensajeDeError(config.error)}
      </Alert>
    );
  }

  const mensualItem = config.data?.suscripcion?.suscripcion_precio_mensual;
  const anualItem = config.data?.suscripcion?.suscripcion_precio_anual;
  const moneda = config.data?.suscripcion?.suscripcion_moneda?.valor ?? "PYG";

  // La fecha de referencia es la del precio que se tocó último.
  const ultima = [mensualItem, anualItem]
    .flatMap((item) => (item ? [item] : []))
    .sort(
      (a, b) =>
        new Date(b.actualizadoEn).getTime() - new Date(a.actualizadoEn).getTime(),
    )[0];

  return (
    <FormularioPrecio
      mensualInicial={mensualItem ? Number(mensualItem.valor) : null}
      anualInicial={anualItem ? Number(anualItem.valor) : null}
      moneda={moneda}
      actualizadoPor={ultima?.actualizadoPor ?? null}
      actualizadoEn={ultima?.actualizadoEn ?? null}
    />
  );
}

/**
 * Días de prueba por defecto de la plataforma.
 *
 * Sólo definen con cuánto arranca una veterinaria nueva. Las cuentas ya
 * registradas conservan su snapshot, y si hay que cambiar una puntual se hace
 * desde la solicitud, en "Editar".
 */
function ConfiguracionPrueba() {
  const config = useConfigAdmin();

  if (config.isLoading) {
    return (
      <Flex align="center" justify="center" py="12" gap="3" color="ink.500">
        <Spinner size="sm" />
        <Text fontSize="sm">Cargando configuración…</Text>
      </Flex>
    );
  }

  if (config.isError) {
    return (
      <Alert status="error" title="No pudimos cargar la configuración">
        {mensajeDeError(config.error)}
      </Alert>
    );
  }

  const trial = config.data?.trial;
  const diasItem = trial?.trial_dias_por_defecto;
  const avisoItem = trial?.trial_aviso_dias;

  const dias = diasItem ? Number(diasItem.valor) : 3;
  const aviso = avisoItem ? Number(avisoItem.valor) : 2;

  const ultima = [diasItem, avisoItem]
    .flatMap((item) => (item ? [item] : []))
    .sort(
      (a, b) =>
        new Date(b.actualizadoEn).getTime() -
        new Date(a.actualizadoEn).getTime(),
    )[0];

  return (
    <FormularioPrueba
      diasInicial={Number.isFinite(dias) ? dias : 3}
      avisoInicial={Number.isFinite(aviso) ? aviso : 2}
      actualizadoPor={ultima?.actualizadoPor ?? null}
      actualizadoEn={ultima?.actualizadoEn ?? null}
    />
  );
}

function FormularioPrueba({
  diasInicial,
  avisoInicial,
  actualizadoPor,
  actualizadoEn,
}: {
  diasInicial: number;
  avisoInicial: number;
  actualizadoPor: string | null;
  actualizadoEn: string | null;
}) {
  const [dias, setDias] = useState(diasInicial);
  const [aviso, setAviso] = useState(avisoInicial);
  const guardar = useActualizarTrialGlobal();

  const diasValidos = Number.isInteger(dias) && dias >= 0 && dias <= 365;
  const avisoValido = Number.isInteger(aviso) && aviso >= 0 && aviso <= 30;
  const valido = diasValidos && avisoValido;
  const hayCambios = dias !== diasInicial || aviso !== avisoInicial;

  const guardarConfig = () => {
    if (!valido || !hayCambios) return;

    guardar.mutate(
      { diasTrial: dias, diasAviso: aviso },
      {
        onSuccess: ({ mensaje }) => {
          toaster.success({
            title: "Período de prueba actualizado",
            description: mensaje,
          });
        },
        onError: (error) => {
          toaster.error({
            title: "No pudimos guardar el período de prueba",
            description: mensajeDeError(error),
          });
        },
      },
    );
  };

  return (
    <Box maxW="46rem">
      <Flex align="center" gap="2" mb="1">
        <Timer size={18} color="var(--chakra-colors-brand-600)" />
        <Text fontWeight="semibold" color="ink.900">
          Período de prueba
        </Text>
      </Flex>
      <Text fontSize="sm" color="ink.600" mb="5">
        Días de acceso gratuito que recibe una veterinaria al registrarse. El
        aviso es con cuántos días de anticipación se le empieza a recordar que
        el trial está por vencer.
      </Text>

      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4" mb="4">
        <Field.Root required invalid={!diasValidos}>
          <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
            Días de prueba
            <Field.RequiredIndicator />
          </Field.Label>
          <Input
            type="number"
            min={0}
            max={365}
            step={1}
            value={dias}
            onChange={(evento) => setDias(Number(evento.target.value))}
            inputMode="numeric"
          />
          <Field.HelperText fontSize="xs" color="ink.500">
            Entre 0 y 365. Hoy está en {diasInicial}{" "}
            {diasInicial === 1 ? "día" : "días"}.
          </Field.HelperText>
          {!diasValidos && (
            <Field.ErrorText fontSize="xs" mt="0.5">
              Ingresá un número entero entre 0 y 365.
            </Field.ErrorText>
          )}
        </Field.Root>

        <Field.Root required invalid={!avisoValido}>
          <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
            Días de aviso previo
            <Field.RequiredIndicator />
          </Field.Label>
          <Input
            type="number"
            min={0}
            max={30}
            step={1}
            value={aviso}
            onChange={(evento) => setAviso(Number(evento.target.value))}
            inputMode="numeric"
          />
          <Field.HelperText fontSize="xs" color="ink.500">
            Entre 0 y 30 días antes del vencimiento.
          </Field.HelperText>
          {!avisoValido && (
            <Field.ErrorText fontSize="xs" mt="0.5">
              Ingresá un número entero entre 0 y 30.
            </Field.ErrorText>
          )}
        </Field.Root>
      </Grid>

      <Alert status="info" title="Sólo afecta a las veterinarias nuevas">
        Cambiar estos días no modifica los trials en curso ni los planes pagos:
        cada veterinaria conserva el plazo con el que se registró. Para ajustar
        una cuenta puntual, abrí su solicitud y editá "Período de prueba".
      </Alert>

      <Box mt="4">
        <Button
          colorPalette="brand"
          onClick={guardarConfig}
          loading={guardar.isPending}
          disabled={!valido || !hayCambios}
        >
          <Save size={16} /> Guardar período
        </Button>
      </Box>

      {(actualizadoPor || actualizadoEn) && (
        <Text fontSize="xs" color="ink.500" mt="4">
          Última actualización
          {actualizadoPor ? ` por ${actualizadoPor}` : ""}
          {actualizadoEn ? ` el ${formatFechaHora(actualizadoEn)}` : ""}.
        </Text>
      )}
    </Box>
  );
}

/**
 * Buscador de los listados del panel.
 *
 * Es el mismo campo en solicitudes y en veterinarias: un input con icono y
 * borde de marca al enfocar. Se extrajo para que las dos listas no se separen
 * con el tiempo.
 */
function CampoBusqueda({
  valor,
  onChange,
  placeholder,
}: {
  valor: string;
  onChange: (valor: string) => void;
  placeholder: string;
}) {
  return (
    <Flex position="relative" flex="1" minW={{ base: "full", lg: "20rem" }}>
      <Box
        position="absolute"
        left="3"
        top="50%"
        transform="translateY(-50%)"
        color="ink.400"
        pointerEvents="none"
      >
        <Search size={16} />
      </Box>
      <chakra.input
        value={valor}
        onChange={(evento: React.ChangeEvent<HTMLInputElement>) =>
          onChange(evento.target.value)
        }
        placeholder={placeholder}
        pl="9"
        h="10"
        w="full"
        bg="white"
        borderWidth="1px"
        borderColor="ink.200"
        borderRadius="md"
        fontSize="sm"
        transition="border-color 0.15s ease, box-shadow 0.15s ease"
        _hover={{ borderColor: "ink.300" }}
        _focusVisible={{
          borderColor: "brand.500",
          boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
        }}
      />
    </Flex>
  );
}

/**
 * Veterinarias en período de prueba.
 *
 * Complementa al formulario global: acá se ajusta el plazo de una cuenta
 * puntual, sin depender de que haya enviado una solicitud de activación.
 */
function VeterinariasPrueba() {
  const [pagina, setPagina] = useState(1);
  const { texto, setTexto, busqueda } = useBusquedaDiferida();
  const consulta = useVeterinariasEnTrial({ busqueda, pagina });
  const guardar = useActualizarTrialVeterinaria();

  const [ajustando, setAjustando] = useState<VeterinariaAdmin | null>(null);
  const [dias, setDias] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abrirAjuste = (veterinaria: VeterinariaAdmin) => {
    setAjustando(veterinaria);
    setDias(veterinaria.trialDias);
    setError(null);
    guardar.reset();
  };

  const cerrarAjuste = () => {
    if (guardar.isPending) return;
    setAjustando(null);
    setError(null);
    guardar.reset();
  };

  const diasValidos = Number.isInteger(dias) && dias >= 0 && dias <= 365;
  const hayCambio = ajustando !== null && dias !== ajustando.trialDias;

  const confirmar = () => {
    if (!ajustando || !diasValidos || !hayCambio) return;

    guardar.mutate(
      { veterinariaId: ajustando.id, diasTrial: dias },
      {
        onSuccess: ({ mensaje }) => {
          toaster.success({
            title: "Período de prueba actualizado",
            description: mensaje,
          });
          setAjustando(null);
          setError(null);
        },
        onError: (errorGuardado) => setError(mensajeDeError(errorGuardado)),
      },
    );
  };

  const columnas = useMemo<ColumnDef<VeterinariaAdmin, unknown>[]>(
    () => [
      {
        id: "veterinaria",
        header: "Veterinaria",
        enableSorting: false,
        cell: ({ row }) => (
          <Box minW="0">
            <Text fontWeight="semibold" color="ink.900" fontSize="sm" truncate>
              {row.original.nombreComercial}
            </Text>
            <Text fontSize="xs" color="ink.500" truncate>
              RUC {row.original.ruc}
            </Text>
          </Box>
        ),
      },
      {
        id: "trial",
        header: "Prueba",
        enableSorting: false,
        cell: ({ row }) => (
          <Box>
            <Text fontSize="sm" color="ink.800">
              {row.original.trialDias}{" "}
              {row.original.trialDias === 1 ? "día" : "días"}
            </Text>
            <Text fontSize="xs" color="ink.500">
              {row.original.trialInicio
                ? `Desde ${formatFecha(row.original.trialInicio)}`
                : "Sin inicio registrado"}
            </Text>
          </Box>
        ),
      },
      {
        id: "vence",
        header: "Vence",
        enableSorting: false,
        cell: ({ row }) => {
          const restantes = row.original.estadoSuscripcion.diasRestantes;

          return (
            <Box>
              <Text fontSize="sm" color="ink.700">
                {row.original.trialFin
                  ? formatFecha(row.original.trialFin)
                  : "Sin vencimiento"}
              </Text>
              {restantes !== null && (
                <Text fontSize="xs" color="ink.500">
                  {restantes === 1 ? "1 día restante" : `${restantes} días restantes`}
                </Text>
              )}
            </Box>
          );
        },
      },
      {
        id: "estado",
        header: "Estado",
        enableSorting: false,
        cell: ({ row }) => {
          const estado = row.original.estadoSuscripcion;
          const meta = estado.suspendida
            ? { etiqueta: "Suspendida", color: "red" }
            : estado.expirado
              ? { etiqueta: "Prueba vencida", color: "red" }
              : { etiqueta: "En prueba", color: "orange" };

          return (
            <Badge colorPalette={meta.color} variant="subtle" size="sm">
              {meta.etiqueta}
            </Badge>
          );
        },
      },
      {
        id: "acciones",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <Flex justify="flex-end">
            <Button
              size="xs"
              colorPalette="brand"
              variant="subtle"
              onClick={(evento) => {
                evento.stopPropagation();
                abrirAjuste(row.original);
              }}
            >
              <Timer size={14} /> Ajustar días
            </Button>
          </Flex>
        ),
      },
    ],
    // Los handlers sólo usan setters estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const accionesListado = (
    <Flex w="full" gap="3" align="center" wrap="wrap">
      <CampoBusqueda
        valor={texto}
        onChange={(valor) => {
          setTexto(valor);
          setPagina(1);
        }}
        placeholder="Buscar por veterinaria, RUC o email…"
      />
      <Text fontSize="xs" color="ink.500">
        Sólo veterinarias en período de prueba.
      </Text>
    </Flex>
  );

  return (
    <Box>
      <Flex align="center" gap="2" mb="1">
        <Timer size={18} color="var(--chakra-colors-brand-600)" />
        <Text fontWeight="semibold" color="ink.900">
          Veterinarias en prueba
        </Text>
      </Flex>
      <Text fontSize="sm" color="ink.600" mb="4">
        Ajustá los días de una cuenta puntual. El resto de las veterinarias
        conserva el plazo con el que se registró.
      </Text>

      {consulta.isError && (
        <Alert
          status="error"
          rounded="md"
          title="No pudimos cargar las veterinarias"
          mb="4"
        >
          {mensajeDeError(consulta.error)}
        </Alert>
      )}

      <DataTable
        data={consulta.data?.items ?? []}
        columns={columnas}
        cargando={consulta.isLoading}
        claveFila={(veterinaria) => veterinaria.id}
        hayBusqueda={busqueda.length > 0}
        vacioTitulo="No hay veterinarias en prueba"
        vacioDetalle="Cuando se registre una veterinaria nueva, va a aparecer acá para ajustar sus días."
        acciones={accionesListado}
        onFilaClick={abrirAjuste}
      />

      {consulta.data && (
        <Paginacion
          pagina={consulta.data.pagina}
          totalPaginas={consulta.data.totalPaginas}
          total={consulta.data.total}
          porPagina={VETERINARIAS_POR_PAGINA}
          onCambioPagina={setPagina}
          singular="veterinaria"
          plural="veterinarias"
        />
      )}

      <FormDialog
        abierto={Boolean(ajustando)}
        onClose={cerrarAjuste}
        titulo="Ajustar días de prueba"
        descripcion="Se recalcula el vencimiento desde el inicio del trial. Si el nuevo plazo ya venció, empieza a contar hoy."
        ancho="sm"
        textoConfirmar="Guardar período"
        guardando={guardar.isPending}
        bloquearCierre={guardar.isPending}
        confirmarDeshabilitado={!diasValidos || !hayCambio}
        onConfirmar={confirmar}
      >
        {ajustando && (
          <Stack gap="4">
            <Box
              borderWidth="1px"
              borderColor="ink.200"
              borderRadius="md"
              p="3"
              bg="ink.50"
            >
              <Text fontWeight="semibold" fontSize="sm" color="ink.900">
                {ajustando.nombreComercial}
              </Text>
              <Text fontSize="xs" color="ink.500">
                RUC {ajustando.ruc}
              </Text>
            </Box>

            <Field.Root required invalid={!diasValidos}>
              <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
                Días de prueba
                <Field.RequiredIndicator />
              </Field.Label>
              <Input
                type="number"
                min={0}
                max={365}
                step={1}
                value={dias}
                onChange={(evento) => setDias(Number(evento.target.value))}
                inputMode="numeric"
              />
              <Field.HelperText fontSize="xs" color="ink.500">
                Hoy tiene {ajustando.trialDias}{" "}
                {ajustando.trialDias === 1 ? "día" : "días"}
                {ajustando.trialFin
                  ? ` y vence el ${formatFecha(ajustando.trialFin)}`
                  : ""}
                . Entre 0 y 365.
              </Field.HelperText>
              {!diasValidos && (
                <Field.ErrorText fontSize="xs" mt="0.5">
                  Ingresá un número entero entre 0 y 365.
                </Field.ErrorText>
              )}
            </Field.Root>

            {error && (
              <Alert status="error" title="No pudimos cambiar el período">
                {error}
              </Alert>
            )}
          </Stack>
        )}
      </FormDialog>
    </Box>
  );
}

function esPrecioValido(precio: number | null): boolean {
  return (
    precio !== null &&
    Number.isInteger(precio) &&
    precio >= 0 &&
    precio <= PRECIO_MAXIMO
  );
}

function FormularioPrecio({
  mensualInicial,
  anualInicial,
  moneda,
  actualizadoPor,
  actualizadoEn,
}: {
  mensualInicial: number | null;
  anualInicial: number | null;
  moneda: string;
  actualizadoPor: string | null;
  actualizadoEn: string | null;
}) {
  const [mensual, setMensual] = useState<number | null>(mensualInicial);
  const [anual, setAnual] = useState<number | null>(anualInicial);
  const guardar = useActualizarSuscripcion();

  const mensualValido = esPrecioValido(mensual);
  const anualValido = esPrecioValido(anual);
  const valido = mensualValido && anualValido;

  const cambiaMensual = mensual !== mensualInicial;
  const cambiaAnual = anual !== anualInicial;
  const hayCambios = cambiaMensual || cambiaAnual;

  // El ahorro es sólo informativo: no modifica lo que se guarda.
  const totalMensualAnual = mensual !== null ? mensual * 12 : null;
  const ahorro =
    totalMensualAnual !== null && anual !== null
      ? totalMensualAnual - anual
      : null;

  const guardarPrecios = () => {
    if (!valido || !hayCambios) return;

    const payload: PreciosSuscripcionPayload = {};

    if (cambiaMensual && mensual !== null) {
      payload.precioMensual = mensual;
    }

    if (cambiaAnual && anual !== null) {
      payload.precioAnual = anual;
    }

    guardar.mutate(payload, {
      onSuccess: ({ mensaje }) => {
        toaster.success({ title: "Precios actualizados", description: mensaje });
      },
      onError: (error) => {
        toaster.error({
          title: "No pudimos guardar los precios",
          description: mensajeDeError(error),
        });
      },
    });
  };

  return (
    <Box maxW="46rem">
      <Flex align="center" gap="2" mb="1">
        <BadgeDollarSign size={18} color="var(--chakra-colors-brand-600)" />
        <Text fontWeight="semibold" color="ink.900">
          Precios del plan
        </Text>
      </Flex>
      <Text fontSize="sm" color="ink.600" mb="5">
        Son los montos que ve el cliente en Mi plan al pedir la activación. Las
        solicitudes ya enviadas conservan el precio con el que se crearon.
      </Text>

      {(mensualInicial !== null || anualInicial !== null) && (
        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap="3"
          mb="5"
        >
          <PrecioActual
            etiqueta="Mensual"
            precio={mensualInicial}
            periodo="/ mes"
            moneda={moneda}
          />
          <PrecioActual
            etiqueta="Anual"
            precio={anualInicial}
            periodo="/ año"
            moneda={moneda}
            destacado
          />
        </Grid>
      )}

      <Stack gap="4">
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
          <MoneyInput
            label="Precio mensual"
            required
            value={mensual}
            onChange={setMensual}
            placeholder="0"
            helperText="En guaraníes, sin centavos."
            errorText={
              mensual !== null && !mensualValido
                ? "Ingresá un monto entero entre 0 y 999.999.999 Gs."
                : undefined
            }
            mostrarTotal
          />

          <MoneyInput
            label="Precio anual"
            required
            value={anual}
            onChange={setAnual}
            placeholder="0"
            helperText="Cubre 12 meses de servicio."
            errorText={
              anual !== null && !anualValido
                ? "Ingresá un monto entero entre 0 y 999.999.999 Gs."
                : undefined
            }
            mostrarTotal
          />
        </Grid>

        {ahorro !== null && totalMensualAnual !== null && (
          <Box
            px="4"
            py="3"
            bg={ahorro > 0 ? "green.50" : "ink.50"}
            borderRadius="md"
            borderWidth="1px"
            borderColor={ahorro > 0 ? "green.200" : "ink.200"}
          >
            <Text fontSize="sm" color="ink.700">
              {ahorro > 0 ? (
                <>
                  El plan anual ahorra{" "}
                  <chakra.span fontWeight="semibold" color="green.700">
                    {formatMoneda(ahorro)}
                  </chakra.span>{" "}
                  frente a pagar 12 meses del plan mensual (
                  {formatMoneda(totalMensualAnual, { espacios: true })}).
                </>
              ) : ahorro === 0 ? (
                "El plan anual cuesta lo mismo que 12 meses del plan mensual."
              ) : (
                "Ojo: el plan anual cuesta más que 12 meses del plan mensual."
              )}
            </Text>
          </Box>
        )}

        <Box>
          <Button
            colorPalette="brand"
            onClick={guardarPrecios}
            loading={guardar.isPending}
            disabled={!valido || !hayCambios}
          >
            <Save size={16} /> Guardar precios
          </Button>
        </Box>

        {(actualizadoPor || actualizadoEn) && (
          <Text fontSize="xs" color="ink.500">
            Última actualización
            {actualizadoPor ? ` por ${actualizadoPor}` : ""}
            {actualizadoEn ? ` el ${formatFechaHora(actualizadoEn)}` : ""}.
          </Text>
        )}
      </Stack>
    </Box>
  );
}

function PrecioActual({
  etiqueta,
  precio,
  periodo,
  moneda,
  destacado,
}: {
  etiqueta: string;
  precio: number | null;
  periodo: string;
  moneda: string;
  destacado?: boolean;
}) {
  return (
    <Flex
      align="baseline"
      gap="2"
      px="4"
      py="3"
      bg={destacado ? "purple.50" : "brand.50"}
      borderRadius="md"
      borderWidth="1px"
      borderColor={destacado ? "purple.100" : "brand.100"}
    >
      <Text fontSize="xs" color="ink.500" fontWeight="medium">
        {etiqueta}
      </Text>
      <Text
        fontSize="lg"
        fontWeight="bold"
        color={destacado ? "purple.700" : "brand.700"}
        fontVariantNumeric="tabular-nums"
      >
        {precio === null
          ? "Sin configurar"
          : formatMoneda(precio, { espacios: true })}
      </Text>
      <Text fontSize="xs" color="ink.500">
        {periodo} · {moneda}
      </Text>
    </Flex>
  );
}

function esAccionable(solicitud: SolicitudAdmin): boolean {
  return solicitud.estado === "pendiente" || solicitud.estado === "contactada";
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Flex justify="space-between" gap="4">
      <Text color="ink.500">{etiqueta}</Text>
      <Text color="ink.900" fontWeight="medium" textAlign="right">
        {valor}
      </Text>
    </Flex>
  );
}
