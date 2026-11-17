import { Badge, Box, Button, Flex, Grid, Text, chakra } from "@chakra-ui/react";
import {
  CheckCircle2,
  FileText,
  ImagePlus,
  Info,
  MapPin,
  Phone,
  Printer,
  Receipt,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CiudadInput } from "@/components/fields/CiudadInput";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { api, urlDeArchivo } from "@/services/api";
import type { RespuestaUpload } from "@/types/dominio";
import { HojaPreview } from "@/features/ventas/HojaVenta";
import { TicketPreview } from "@/features/ventas/TicketVenta";
import { descargarHoja } from "@/features/ventas/hoja";
import { imprimirComprobante } from "@/features/ventas/imprimir";
import type {
  TicketOrganizacion,
  TicketVentaDatos,
} from "@/features/ventas/ticket";
import {
  FORMATOS_IMPRESION,
  IMPRESION_POR_DEFECTO,
  TAMANOS_HOJA,
  esFormatoHoja,
  formatoImpresion,
  normalizarConfiguracionImpresion,
  tamanoHoja,
  type ConfiguracionImpresion,
} from "./impresion";
import {
  type ConfiguracionFormData,
  mensajeDeError,
  useActualizarConfiguracion,
  useConfiguracion,
} from "../clients/clients.service";

type Errores = Partial<Record<keyof ConfiguracionFormData, string>>;

const COLOR_POR_DEFECTO = "#0D9E87";

const ESTILOS_COLOR: { nombre: string; valor: string }[] = [
  { nombre: "Verde clínico", valor: "#0D9E87" },
  { nombre: "Azul confianza", valor: "#2E90FA" },
  { nombre: "Violeta", valor: "#8B5CF6" },
  { nombre: "Rosa", valor: "#EC4899" },
  { nombre: "Ámbar", valor: "#F79009" },
  { nombre: "Rojo", valor: "#F04438" },
  { nombre: "Piedra", valor: "#64748B" },
];

const SECCIONES = [
  { id: "negocio", titulo: "Datos del negocio" },
  { id: "marca", titulo: "Marca" },
  { id: "contacto", titulo: "Contacto" },
  { id: "facturacion", titulo: "Facturación" },
  { id: "impresion", titulo: "Impresión" },
] as const;

/** Orden en que aparecen los campos validables, para enfocar el primero con error. */
const ORDEN_CAMPOS: (keyof ConfiguracionFormData)[] = [
  "ruc",
  "colorPrimario",
  "email",
  "establecimiento",
  "puntoVenta",
  "timbradoFechaVencimiento",
];

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const TIPOS_LOGO = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
]);

type EstadoFiscal = "vigente" | "vencido" | "sin-timbrar";

const ETIQUETA_FISCAL: Record<
  EstadoFiscal,
  { texto: string; paleta: "success" | "red" | "orange" }
> = {
  vigente: { texto: "Timbrado vigente", paleta: "success" },
  vencido: { texto: "Timbrado vencido", paleta: "red" },
  "sin-timbrar": { texto: "Sin timbrado", paleta: "orange" },
};

/**
 * Configuración de la veterinaria.
 *
 * Se organiza en secciones porque son datos de dominios distintos y con
 * consecuencias distintas: lo visual se cambia cada mes, lo fiscal casi nunca
 * y una vez que se timbra hay que ser cuidadoso.
 */
export function ConfiguracionPage() {
  const { puede } = useAuth();
  const consulta = useConfiguracion();
  const actualizar = useActualizarConfiguracion();

  const puedeEditar = puede("configuracion.editar");

  const [valores, setValores] = useState<ConfiguracionFormData>({});
  const [errores, setErrores] = useState<Errores>({});
  const [sucio, setSucio] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [generandoComprobante, setGenerandoComprobante] = useState(false);
  // La fecha de ejemplo se congela al entrar: si cambiara en cada render, la
  // vista previa del PDF se regeneraría todo el tiempo.
  const [fechaPreview] = useState(() => new Date().toISOString());
  const [arrastrandoLogo, setArrastrandoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState("");
  const [vistaPreviaLogo, setVistaPreviaLogo] = useState("");
  const inputLogo = useRef<HTMLInputElement>(null);
  const urlVistaPreviaLogo = useRef("");

  const seccionActiva = useSeccionActiva(
    SECCIONES.map((s) => s.id),
    !consulta.isLoading,
  );

  useEffect(() => {
    if (!consulta.data) return;

    setValores({
      ruc: consulta.data.ruc,
      razonSocial: consulta.data.razonSocial,
      nombreComercial: consulta.data.nombreComercial,
      nombreFantasia: consulta.data.nombreFantasia ?? "",
      email: consulta.data.email ?? "",
      telefono: consulta.data.telefono ?? "",
      whatsapp: consulta.data.whatsapp ?? "",
      sitioWeb: consulta.data.sitioWeb ?? "",
      direccion: consulta.data.direccion ?? "",
      departamento: consulta.data.departamento ?? "",
      ciudad: consulta.data.ciudad ?? "",
      barrio: consulta.data.barrio ?? "",
      actividadEconomica: consulta.data.actividadEconomica ?? "",
      registroProfesional: consulta.data.registroProfesional ?? "",
      nombreRepresentante: consulta.data.nombreRepresentante ?? "",
      logoUrl: consulta.data.logoUrl ?? "",
      timbradoNro: consulta.data.timbradoNro ?? "",
      timbradoFechaInicio: aFechaIso(consulta.data.timbradoFechaInicio),
      timbradoFechaVencimiento: aFechaIso(consulta.data.timbradoFechaVencimiento),
      puntoVenta: consulta.data.puntoVenta,
      establecimiento: consulta.data.establecimiento,
      colorPrimario: consulta.data.colorPrimario,
      moneda: consulta.data.moneda,
      zonaHoraria: consulta.data.zonaHoraria,
      emitirTicketSinTimbrado: consulta.data.emitirTicketSinTimbrado,
      impresion: normalizarConfiguracionImpresion(consulta.data.impresion),
    });

    setSucio(false);
  }, [consulta.data]);

  // Libera la URL local de la vista previa al salir de la página.
  useEffect(
    () => () => {
      if (urlVistaPreviaLogo.current) {
        URL.revokeObjectURL(urlVistaPreviaLogo.current);
      }
    },
    [],
  );

  // Avisa antes de cerrar la pestaña si hay cambios sin guardar.
  useEffect(() => {
    if (!sucio) return;
    const aviso = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sucio]);

  function limpiarVistaPreviaLogo() {
    if (urlVistaPreviaLogo.current) {
      URL.revokeObjectURL(urlVistaPreviaLogo.current);
      urlVistaPreviaLogo.current = "";
    }
    setVistaPreviaLogo("");
  }

  async function subirLogo(archivo?: File) {
    if (!archivo) return;
    setErrorLogo("");

    if (!TIPOS_LOGO.has(archivo.type)) {
      setErrorLogo("Usá una imagen JPG, PNG, WEBP, GIF, AVIF o BMP.");
      if (inputLogo.current) inputLogo.current.value = "";
      return;
    }
    if (archivo.size > MAX_LOGO_BYTES) {
      setErrorLogo("La imagen no puede superar los 5 MB.");
      if (inputLogo.current) inputLogo.current.value = "";
      return;
    }

    if (urlVistaPreviaLogo.current) {
      URL.revokeObjectURL(urlVistaPreviaLogo.current);
    }
    const urlLocal = URL.createObjectURL(archivo);
    urlVistaPreviaLogo.current = urlLocal;
    setVistaPreviaLogo(urlLocal);

    const datos = new FormData();
    datos.append("archivo", archivo);
    setSubiendoLogo(true);
    try {
      const respuesta = await api.post<RespuestaUpload>("/uploads", datos, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      cambiar("logoUrl", respuesta.data.data.url);
    } catch (error) {
      setErrorLogo(
        error instanceof Error
          ? error.message
          : "No se pudo subir el logo. Intentá nuevamente.",
      );
      URL.revokeObjectURL(urlLocal);
      urlVistaPreviaLogo.current = "";
      setVistaPreviaLogo("");
    } finally {
      setSubiendoLogo(false);
      if (inputLogo.current) inputLogo.current.value = "";
    }
  }

  function quitarLogo() {
    limpiarVistaPreviaLogo();
    cambiar("logoUrl", null);
    setErrorLogo("");
  }

  function cambiar<K extends keyof ConfiguracionFormData>(
    campo: K,
    nuevo: ConfiguracionFormData[K],
  ) {
    setValores((previo) => ({ ...previo, [campo]: nuevo }));
    setErrores((previo) => ({ ...previo, [campo]: undefined }));
    setSucio(true);
  }

  function cambiarImpresion<K extends keyof ConfiguracionImpresion>(
    campo: K,
    nuevo: ConfiguracionImpresion[K],
  ) {
    setValores((previo) => {
      const impresion = previo.impresion ?? IMPRESION_POR_DEFECTO;
      return {
        ...previo,
        impresion: { ...impresion, [campo]: nuevo },
      };
    });
    setSucio(true);
  }

  function validar(): Errores {
    const nuevos: Errores = {};

    if (valores.ruc && !/^(?:\d{8,11}|\d{7,10}-\d)$/.test(valores.ruc.trim())) {
      nuevos.ruc =
        "El RUC debe tener entre 8 y 11 dígitos, con guion opcional antes del último dígito.";
    }

    if (valores.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email.trim())) {
      nuevos.email = "Ingresá un correo válido.";
    }

    if (valores.colorPrimario && !/^#[0-9A-Fa-f]{6}$/.test(valores.colorPrimario)) {
      nuevos.colorPrimario = "Usá un color hexadecimal de 6 dígitos, como #0D9E87.";
    }

    if (valores.puntoVenta && !/^\d{1,5}$/.test(valores.puntoVenta.trim())) {
      nuevos.puntoVenta = "Sólo números, hasta 5 dígitos.";
    }

    if (valores.establecimiento && !/^\d{1,5}$/.test(valores.establecimiento.trim())) {
      nuevos.establecimiento = "Sólo números, hasta 5 dígitos.";
    }

    if (
      valores.timbradoFechaInicio &&
      valores.timbradoFechaVencimiento &&
      valores.timbradoFechaInicio > valores.timbradoFechaVencimiento
    ) {
      nuevos.timbradoFechaVencimiento =
        "El vencimiento no puede ser anterior al inicio.";
    }

    setErrores(nuevos);
    return nuevos;
  }

  function guardar() {
    if (subiendoLogo) {
      setErrorLogo("Esperá a que termine la carga del logo.");
      return;
    }

    const nuevos = validar();
    const primeroConError = ORDEN_CAMPOS.find((campo) => nuevos[campo]);
    if (primeroConError) {
      toaster.error({
        title: "Revisá los datos",
        description: "Hay campos con errores marcados en rojo.",
      });
      document.getElementById(primeroConError)?.focus();
      return;
    }

    actualizar
      .mutateAsync(valores)
      .then(() => {
        limpiarVistaPreviaLogo();
        setSucio(false);
        toaster.success({
          title: "Configuración guardada",
          description: "Los cambios ya se aplican en todo el sistema.",
        });
      })
      .catch((error) => {
        toaster.error({
          title: "No se pudo guardar",
          description: mensajeDeError(error),
        });
      });
  }

  function descartar() {
    limpiarVistaPreviaLogo();
    setErrores({});
    setErrorLogo("");
    setSucio(false);
    void consulta.refetch();
  }

  function irASeccion(id: string) {
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
  }

  const timbrado = consulta.data?.estadoTimbrado;
  const estadoFiscal: EstadoFiscal | null = !timbrado
    ? null
    : !timbrado.timbrado
      ? "sin-timbrar"
      : timbrado.vencido
        ? "vencido"
        : "vigente";

  const color = valores.colorPrimario || COLOR_POR_DEFECTO;
  const colorValido = /^#[0-9A-Fa-f]{6}$/.test(color);
  const colorEfectivo = colorValido ? color : COLOR_POR_DEFECTO;
  const estiloActivo = ESTILOS_COLOR.find(
    (e) => e.valor.toLowerCase() === color.toLowerCase(),
  );
  const srcLogo = vistaPreviaLogo || urlDeArchivo(valores.logoUrl);
  const nombreMostrado =
    valores.nombreComercial || valores.razonSocial || "Tu veterinaria";

  const impresion = valores.impresion ?? IMPRESION_POR_DEFECTO;
  const formatoActual = formatoImpresion(impresion.formato);
  const esHoja = esFormatoHoja(impresion.formato);
  const hojaActual = tamanoHoja(impresion.tamanoHoja);

  // La vista previa usa los datos del negocio que están en pantalla, no los
  // guardados: así el dueño ve el resultado antes de confirmar el cambio.
  const organizacionPreview: TicketOrganizacion = {
    nombre: valores.nombreFantasia || nombreMostrado,
    razonSocial: valores.razonSocial,
    ruc: valores.ruc,
    direccion: valores.direccion,
    telefono: valores.telefono,
    email: valores.email,
    logoUrl: srcLogo,
    colorPrimario: valores.colorPrimario,
    timbrado: valores.timbradoNro,
    timbradoVencimiento: valores.timbradoFechaVencimiento,
    establecimiento: valores.establecimiento,
    puntoVenta: valores.puntoVenta,
  };

  const ticketPreview: TicketVentaDatos = {
    numeroComprobante: `${valores.establecimiento || "001"}-${
      valores.puntoVenta || "001"
    }-0000157`,
    fechaEmision: fechaPreview,
    tipoComprobante: valores.timbradoNro ? "factura" : "ticket",
    timbrado: valores.timbradoNro,
    establecimiento: valores.establecimiento,
    puntoExpedicion: valores.puntoVenta,
    moneda: "PYG",
    condicionPago: "contado",
    estado: "ACTIVA",
    cliente: { nombre: "María González", documento: "1.234.567-8" },
    vendedor: "Dr. Juan Pérez",
    items: [
      {
        descripcion: "Consulta clínica general",
        cantidad: 1,
        precioUnitario: 150000,
        total: 150000,
      },
      {
        descripcion: "Vacuna antirrábica",
        cantidad: 1,
        precioUnitario: 80000,
        total: 80000,
      },
      {
        descripcion: "Alimento balanceado 3 kg",
        cantidad: 2,
        precioUnitario: 65000,
        total: 130000,
      },
    ],
    subtotal: 327273,
    iva5: 0,
    iva10: 32727,
    exenta: 0,
    total: 360000,
    pagos: [
      { metodo: "efectivo", monto: 200000 },
      { metodo: "transferencia", monto: 160000 },
    ],
  };

  function imprimirPrueba() {
    setGenerandoComprobante(true);
    void imprimirComprobante(ticketPreview, organizacionPreview, impresion)
      .catch(() => {
        toaster.error({
          title: "No se pudo generar el comprobante",
          description: "Revisá la configuración y volvé a intentar.",
        });
      })
      .finally(() => setGenerandoComprobante(false));
  }

  function descargarPrueba() {
    setGenerandoComprobante(true);
    void descargarHoja(ticketPreview, organizacionPreview, impresion)
      .catch(() => {
        toaster.error({
          title: "No se pudo generar el PDF",
          description: "Revisá la configuración y volvé a intentar.",
        });
      })
      .finally(() => setGenerandoComprobante(false));
  }

  if (consulta.isLoading) {
    return (
      <Box>
        <PageHeader titulo="Configuración" />
        <Panel>
          <Flex align="center" justify="center" py="16">
            <chakra.div color="ink.400" fontSize="sm">
              Cargando configuración…
            </chakra.div>
          </Flex>
        </Panel>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        titulo="Configuración"
        descripcion="Datos del negocio, marca, contacto y facturación."
      />

      {!puedeEditar && (
        <Alert status="info" rounded="md" mb="5">
          Sólo el administrador puede modificar estos datos.
        </Alert>
      )}

      {/* ── Resumen: identidad del negocio de un vistazo ─────────────── */}
      <Panel mb="6">
        <Flex
          align={{ base: "flex-start", sm: "center" }}
          direction={{ base: "column", sm: "row" }}
          gap="4"
          p={{ base: "4", md: "5" }}
        >
          <Flex
            align="center"
            justify="center"
            w="16"
            h="16"
            flexShrink={0}
            overflow="hidden"
            borderRadius="full"
            borderWidth="1px"
            borderColor="ink.200"
            style={{ background: `${colorEfectivo}1A` }}
          >
            {srcLogo ? (
              <chakra.img
                src={srcLogo}
                alt={`Logo de ${nombreMostrado}`}
                w="full"
                h="full"
                objectFit="cover"
              />
            ) : (
              <Text
                fontSize="2xl"
                fontWeight="bold"
                style={{ color: colorEfectivo }}
                aria-hidden="true"
              >
                {nombreMostrado.charAt(0).toUpperCase()}
              </Text>
            )}
          </Flex>

          <Box flex="1" minW="0">
            <Text
              fontSize="lg"
              fontWeight="semibold"
              color="ink.900"
              lineHeight="1.3"
              truncate
            >
              {nombreMostrado}
            </Text>
            <Text fontSize="sm" color="ink.600" mt="0.5" truncate>
              {valores.razonSocial && valores.razonSocial !== nombreMostrado
                ? `${valores.razonSocial} · `
                : ""}
              {valores.ruc ? `RUC ${valores.ruc}` : "RUC sin cargar"}
            </Text>
          </Box>

          {estadoFiscal && (
            <Badge
              colorPalette={ETIQUETA_FISCAL[estadoFiscal].paleta}
              variant="subtle"
              size="md"
            >
              {ETIQUETA_FISCAL[estadoFiscal].texto}
            </Badge>
          )}
        </Flex>
      </Panel>

      {/* ── Navegación entre secciones ───────────────────────────────── */}
      <chakra.nav
        aria-label="Secciones de la configuración"
        position="sticky"
        top="0"
        zIndex="5"
        bg="white"
        borderBottomWidth="1px"
        borderColor="ink.100"
        mb="8"
        py="2"
        overflowX="auto"
      >
        <Flex gap="1" minW="max-content">
          {SECCIONES.map((seccion) => {
            const activa = seccionActiva === seccion.id;
            return (
              <chakra.button
                key={seccion.id}
                type="button"
                onClick={() => irASeccion(seccion.id)}
                aria-current={activa ? "true" : undefined}
                px="3"
                py="1.5"
                borderRadius="md"
                fontSize="sm"
                fontWeight={activa ? "semibold" : "medium"}
                color={activa ? "brand.700" : "ink.600"}
                bg={activa ? "brand.50" : "transparent"}
                transition="background 0.15s ease, color 0.15s ease"
                _hover={{ bg: activa ? "brand.50" : "ink.50", color: "ink.900" }}
                _focusVisible={{
                  outline: "2px solid",
                  outlineColor: "brand.500",
                  outlineOffset: "2px",
                }}
              >
                {seccion.titulo}
              </chakra.button>
            );
          })}
        </Flex>
      </chakra.nav>

      <Flex direction="column" gap="10">
        {/* ── Datos del negocio ──────────────────────────────────────── */}
        <Seccion
          id="negocio"
          titulo="Datos del negocio"
          descripcion="Los datos legales con los que se emiten tus comprobantes."
        >
          <Flex direction="column" gap="5">
            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <Campo
                id="ruc"
                label="RUC"
                error={errores.ruc}
                ayuda="Podés incluir el guion antes del dígito verificador."
              >
                <Entrada
                  id="ruc"
                  inputMode="text"
                  placeholder="80012345-6"
                  value={valores.ruc ?? ""}
                  invalido={!!errores.ruc}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("ruc", e.target.value.replace(/[^\d-]/g, ""))}
                />
              </Campo>

              <Campo id="nombreComercial" label="Nombre comercial">
                <Entrada
                  id="nombreComercial"
                  value={valores.nombreComercial ?? ""}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("nombreComercial", e.target.value)}
                />
              </Campo>
            </Grid>

            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <Campo id="razonSocial" label="Razón social">
                <Entrada
                  id="razonSocial"
                  value={valores.razonSocial ?? ""}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("razonSocial", e.target.value)}
                />
              </Campo>

              <Campo
                id="nombreFantasia"
                label="Nombre de fantasía"
                ayuda="Aparece en los comprobantes. Si es igual a la razón social, dejalo vacío."
              >
                <Entrada
                  id="nombreFantasia"
                  value={valores.nombreFantasia ?? ""}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("nombreFantasia", e.target.value)}
                />
              </Campo>
            </Grid>

            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <Campo id="actividadEconomica" label="Actividad económica">
                <Entrada
                  id="actividadEconomica"
                  placeholder="Servicios veterinarios"
                  value={valores.actividadEconomica ?? ""}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("actividadEconomica", e.target.value)}
                />
              </Campo>

              <Campo id="registroProfesional" label="Registro profesional">
                <Entrada
                  id="registroProfesional"
                  placeholder="M.V. 12345"
                  value={valores.registroProfesional ?? ""}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("registroProfesional", e.target.value)}
                />
              </Campo>
            </Grid>

            <Campo id="nombreRepresentante" label="Representante legal">
              <Entrada
                id="nombreRepresentante"
                value={valores.nombreRepresentante ?? ""}
                disabled={!puedeEditar}
                onChange={(e) => cambiar("nombreRepresentante", e.target.value)}
              />
            </Campo>
          </Flex>
        </Seccion>

        {/* ── Marca ──────────────────────────────────────────────────── */}
        <Seccion
          id="marca"
          titulo="Marca"
          descripcion="El logo y el color con los que el sistema se ve como tu negocio."
          separador
        >
          <Flex direction="column" gap="6">
            {/* Logo */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="ink.800" mb="1.5">
                Logo
              </Text>
              <Flex
                gap="4"
                align="center"
                direction={{ base: "column", sm: "row" }}
                p="4"
                borderWidth="1px"
                borderStyle="dashed"
                borderColor={arrastrandoLogo ? "brand.500" : "ink.300"}
                borderRadius="lg"
                bg={arrastrandoLogo ? "brand.50" : "ink.50"}
                transition="background 0.15s ease, border-color 0.15s ease"
                onDragOver={(evento: React.DragEvent) => {
                  evento.preventDefault();
                  if (puedeEditar && !subiendoLogo) setArrastrandoLogo(true);
                }}
                onDragLeave={(evento: React.DragEvent) => {
                  if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) {
                    setArrastrandoLogo(false);
                  }
                }}
                onDrop={(evento: React.DragEvent) => {
                  evento.preventDefault();
                  setArrastrandoLogo(false);
                  if (puedeEditar && !subiendoLogo)
                    void subirLogo(evento.dataTransfer.files[0]);
                }}
                role="group"
                aria-label="Zona para adjuntar el logo de la veterinaria"
                data-testid="logo-dropzone"
              >
                <Flex
                  align="center"
                  justify="center"
                  w="24"
                  h="24"
                  flexShrink={0}
                  overflow="hidden"
                  borderRadius="full"
                  bg="white"
                  borderWidth="1px"
                  borderColor="ink.200"
                >
                  {srcLogo ? (
                    <chakra.img
                      src={srcLogo}
                      alt="Logo de la veterinaria"
                      w="full"
                      h="full"
                      objectFit="cover"
                    />
                  ) : (
                    <ImagePlus size={30} color="var(--chakra-colors-ink-400)" />
                  )}
                </Flex>

                <Box flex="1" textAlign={{ base: "center", sm: "left" }}>
                  <Text fontSize="sm" color="ink.700" lineHeight="1.6">
                    Se muestra en forma circular en el menú, los comprobantes y los
                    mensajes a tus clientes.
                  </Text>

                  <Flex
                    gap="2"
                    wrap="wrap"
                    mt="3"
                    justify={{ base: "center", sm: "flex-start" }}
                  >
                    <input
                      ref={inputLogo}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp"
                      hidden
                      disabled={!puedeEditar || subiendoLogo}
                      onChange={(evento) => void subirLogo(evento.currentTarget.files?.[0])}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={subiendoLogo}
                      loadingText="Subiendo…"
                      disabled={!puedeEditar}
                      onClick={() => inputLogo.current?.click()}
                    >
                      <Upload size={15} />
                      {valores.logoUrl ? "Cambiar logo" : "Subir logo"}
                    </Button>
                    {valores.logoUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        colorPalette="red"
                        disabled={!puedeEditar || subiendoLogo}
                        onClick={quitarLogo}
                      >
                        <Trash2 size={15} />
                        Quitar
                      </Button>
                    )}
                  </Flex>

                  <Text
                    fontSize="xs"
                    color={errorLogo ? "danger.600" : "ink.500"}
                    fontWeight={errorLogo ? "medium" : "normal"}
                    mt="2.5"
                    role={errorLogo ? "alert" : undefined}
                  >
                    {errorLogo ||
                      "JPG, PNG, WEBP, GIF, AVIF o BMP, hasta 5 MB. También podés arrastrar la imagen hasta acá."}
                  </Text>
                </Box>
              </Flex>
            </Box>

            {/* Color */}
            <Campo
              id="colorPrimario"
              label="Color principal"
              ayuda="Se aplica a botones, enlaces y acentos de todo el sistema."
              error={errores.colorPrimario}
            >
              <Flex
                gap="2.5"
                wrap="wrap"
                mb="3"
                role="group"
                aria-label="Colores sugeridos"
              >
                {ESTILOS_COLOR.map((estilo) => {
                  const activo = estiloActivo?.valor === estilo.valor;
                  return (
                    <chakra.button
                      key={estilo.valor}
                      type="button"
                      onClick={() => cambiar("colorPrimario", estilo.valor)}
                      disabled={!puedeEditar}
                      title={estilo.nombre}
                      aria-label={estilo.nombre}
                      aria-pressed={activo}
                      w="9"
                      h="9"
                      borderRadius="full"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      transition="box-shadow 0.12s ease"
                      cursor={puedeEditar ? "pointer" : "not-allowed"}
                      _focusVisible={{
                        outline: "2px solid",
                        outlineColor: "ink.900",
                        outlineOffset: "3px",
                      }}
                      style={{
                        background: estilo.valor,
                        boxShadow: activo
                          ? `0 0 0 2px white, 0 0 0 4px ${estilo.valor}`
                          : "none",
                      }}
                    >
                      {activo && <CheckCircle2 size={16} color="white" />}
                    </chakra.button>
                  );
                })}
              </Flex>

              <Flex align="center" gap="2">
                <Entrada
                  id="colorPrimario"
                  placeholder={COLOR_POR_DEFECTO}
                  value={valores.colorPrimario ?? ""}
                  invalido={!!errores.colorPrimario}
                  disabled={!puedeEditar}
                  maxW="9rem"
                  fontFamily="mono"
                  onChange={(e) => cambiar("colorPrimario", e.target.value)}
                />
                <chakra.input
                  type="color"
                  aria-label="Elegir otro color"
                  value={colorEfectivo}
                  disabled={!puedeEditar}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    cambiar("colorPrimario", e.target.value.toUpperCase())
                  }
                  w="10"
                  h="10"
                  p="1"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="ink.200"
                  bg="white"
                  cursor={puedeEditar ? "pointer" : "not-allowed"}
                />
                <Text fontSize="sm" color="ink.600">
                  {estiloActivo ? estiloActivo.nombre : "Color personalizado"}
                </Text>
              </Flex>
            </Campo>

            {/* Vista previa en vivo */}
            <Box
              borderWidth="1px"
              borderColor="ink.200"
              borderRadius="lg"
              overflow="hidden"
              aria-label="Vista previa del color elegido"
              role="img"
            >
              <Flex
                align="center"
                gap="2.5"
                px="4"
                py="2.5"
                color="white"
                style={{ background: colorEfectivo }}
              >
                <Flex
                  align="center"
                  justify="center"
                  w="7"
                  h="7"
                  borderRadius="full"
                  overflow="hidden"
                  bg="whiteAlpha.300"
                  flexShrink={0}
                >
                  {srcLogo ? (
                    <chakra.img src={srcLogo} alt="" w="full" h="full" objectFit="cover" />
                  ) : (
                    <Text fontSize="xs" fontWeight="bold">
                      {nombreMostrado.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </Flex>
                <Text fontSize="sm" fontWeight="semibold" truncate>
                  {nombreMostrado}
                </Text>
              </Flex>

              <Flex gap="3" wrap="wrap" align="center" p="4" bg="white">
                <Button
                  size="sm"
                  color="white"
                  _hover={{ opacity: 0.9 }}
                  style={{ background: colorEfectivo }}
                  tabIndex={-1}
                >
                  Botón principal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  bg="white"
                  tabIndex={-1}
                  style={{ borderColor: colorEfectivo, color: colorEfectivo }}
                >
                  Botón secundario
                </Button>
                <Text fontSize="sm" fontWeight="medium" style={{ color: colorEfectivo }}>
                  Enlace de ejemplo
                </Text>
              </Flex>
            </Box>

            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <Campo id="moneda" label="Moneda">
                <chakra.select
                  id="moneda"
                  value={valores.moneda ?? "PYG"}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    cambiar("moneda", e.target.value)
                  }
                  disabled={!puedeEditar}
                >
                  <option value="PYG">Guaraníes (₲)</option>
                  <option value="USD">Dólares (US$)</option>
                </chakra.select>
              </Campo>

              <Campo id="zonaHoraria" label="Zona horaria">
                <chakra.select
                  id="zonaHoraria"
                  value={valores.zonaHoraria ?? "America/Asuncion"}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    cambiar("zonaHoraria", e.target.value)
                  }
                  disabled={!puedeEditar}
                >
                  <option value="America/Asuncion">Asunción</option>
                  <option value="America/Argentina/Buenos_Aires">Buenos Aires</option>
                  <option value="America/Santiago">Santiago</option>
                </chakra.select>
              </Campo>
            </Grid>
          </Flex>
        </Seccion>

        {/* ── Contacto ───────────────────────────────────────────────── */}
        <Seccion
          id="contacto"
          titulo="Contacto"
          descripcion="Cómo te encuentran tus clientes. Estos datos salen en los comprobantes."
          separador
        >
          <Flex direction="column" gap="5">
            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <Campo id="email" label="Correo electrónico" error={errores.email}>
                <Entrada
                  id="email"
                  type="email"
                  value={valores.email ?? ""}
                  invalido={!!errores.email}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("email", e.target.value)}
                />
              </Campo>

              <Campo id="sitioWeb" label="Sitio web">
                <Entrada
                  id="sitioWeb"
                  placeholder="www.miveterinaria.com"
                  value={valores.sitioWeb ?? ""}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("sitioWeb", e.target.value)}
                />
              </Campo>

              <Campo id="telefono" label="Teléfono">
                <EntradaConIcono icono={Phone}>
                  <Entrada
                    id="telefono"
                    inputMode="tel"
                    conIcono
                    value={valores.telefono ?? ""}
                    disabled={!puedeEditar}
                    onChange={(e) => cambiar("telefono", e.target.value)}
                  />
                </EntradaConIcono>
              </Campo>

              <Campo id="whatsapp" label="WhatsApp">
                <EntradaConIcono icono={Phone}>
                  <Entrada
                    id="whatsapp"
                    inputMode="tel"
                    conIcono
                    value={valores.whatsapp ?? ""}
                    disabled={!puedeEditar}
                    onChange={(e) => cambiar("whatsapp", e.target.value)}
                  />
                </EntradaConIcono>
              </Campo>
            </Grid>

            <Campo id="direccion" label="Dirección">
              <EntradaConIcono icono={MapPin} alinearArriba>
                <chakra.textarea
                  id="direccion"
                  rows={2}
                  minH="4.5rem"
                  maxH="7rem"
                  resize="vertical"
                  data-icon-input
                  value={valores.direccion ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    cambiar("direccion", e.target.value)
                  }
                  disabled={!puedeEditar}
                />
              </EntradaConIcono>
            </Campo>

            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="5">
              <Box>
                <CiudadInput
                  value={valores.ciudad ?? ""}
                  onChange={(ciudad, departamento) => {
                    if (departamento) cambiar("departamento", departamento);
                    cambiar("ciudad", ciudad);
                  }}
                  label="Ciudad"
                  departamento={valores.departamento}
                  disabled={!puedeEditar}
                />
              </Box>

              <Campo id="departamento" label="Departamento" error={errores.departamento}>
                <Entrada
                  id="departamento"
                  value={valores.departamento ?? ""}
                  invalido={!!errores.departamento}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("departamento", e.target.value)}
                />
              </Campo>

              <Campo id="barrio" label="Barrio" error={errores.barrio}>
                <Entrada
                  id="barrio"
                  value={valores.barrio ?? ""}
                  invalido={!!errores.barrio}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("barrio", e.target.value)}
                />
              </Campo>
            </Grid>
          </Flex>
        </Seccion>

        {/* ── Facturación ────────────────────────────────────────────── */}
        <Seccion
          id="facturacion"
          titulo="Facturación"
          descripcion="Datos del timbrado para emitir comprobantes ante la DNIT."
          separador
        >
          <Flex direction="column" gap="5">
            {estadoFiscal === "sin-timbrar" && timbrado && (
              <Alert status="warning" rounded="md">
                <Box>
                  <chakra.p fontWeight="semibold" fontSize="sm">
                    Todavía no timbraste ante la DNIT
                  </chakra.p>
                  <chakra.p fontSize="xs" mt="1" lineHeight="1.6">
                    {timbrado.motivo} Para emitir facturas fiscales necesitás un
                    timbrado vigente. Mientras tanto podés emitir tickets.
                  </chakra.p>
                </Box>
              </Alert>
            )}

            {estadoFiscal === "vencido" && timbrado && (
              <Alert status="error" rounded="md">
                <Box>
                  <chakra.p fontWeight="semibold" fontSize="sm">
                    Tu timbrado venció
                  </chakra.p>
                  <chakra.p fontSize="xs" mt="1" lineHeight="1.6">
                    {timbrado.motivo}
                  </chakra.p>
                </Box>
              </Alert>
            )}

            {estadoFiscal === "vigente" && (
              <Alert status="success" rounded="md">
                <Box>
                  <chakra.p fontWeight="semibold" fontSize="sm">
                    Timbrado vigente
                    {consulta.data?.timbradoFechaVencimiento
                      ? ` hasta el ${formatearFecha(
                          aFechaIso(consulta.data.timbradoFechaVencimiento),
                        )}`
                      : ""}
                  </chakra.p>
                  <chakra.p fontSize="xs" mt="1" lineHeight="1.6">
                    Ya podés emitir facturas fiscales desde el establecimiento{" "}
                    {consulta.data?.establecimiento}, punto de venta{" "}
                    {consulta.data?.puntoVenta}.
                  </chakra.p>
                </Box>
              </Alert>
            )}

            {/* Es la decisión que más impacto tiene en si un negocio recién
                empezado puede documentar sus ventas o no. */}
            <Flex
              align={{ base: "flex-start", sm: "center" }}
              justify="space-between"
              gap="4"
              p="4"
              borderRadius="lg"
              bg="ink.50"
              borderWidth="1px"
              borderColor="ink.200"
              wrap="wrap"
            >
              <Box flex="1" minW="16rem">
                <Flex align="center" gap="2" mb="1">
                  <Receipt size={16} color="var(--chakra-colors-ink-500)" />
                  <chakra.p fontWeight="semibold" fontSize="sm" color="ink.900">
                    Emitir ticket sin timbrado
                  </chakra.p>
                </Flex>
                <chakra.p fontSize="xs" color="ink.600" lineHeight="1.6">
                  Mientras no tengas timbrado, activalo para documentar cada venta
                  con un ticket. No es una factura fiscal.
                </chakra.p>
              </Box>

              <Switch
                checked={valores.emitirTicketSinTimbrado ?? true}
                onCheckedChange={(detalle: { checked: boolean }) =>
                  cambiar("emitirTicketSinTimbrado", detalle.checked)
                }
                disabled={!puedeEditar}
                colorPalette="brand"
                aria-label="Emitir ticket sin timbrado"
              />
            </Flex>

            <Grid templateColumns={{ base: "1fr", sm: "2fr 1fr 1fr" }} gap="5">
              <Campo id="timbradoNro" label="Número de timbrado" ayuda="Lo emite la DNIT.">
                <Entrada
                  id="timbradoNro"
                  placeholder="12345678"
                  value={valores.timbradoNro ?? ""}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("timbradoNro", e.target.value)}
                />
              </Campo>

              <Campo id="establecimiento" label="Establecimiento" error={errores.establecimiento}>
                <Entrada
                  id="establecimiento"
                  inputMode="numeric"
                  placeholder="001"
                  value={valores.establecimiento ?? ""}
                  invalido={!!errores.establecimiento}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("establecimiento", e.target.value.replace(/\D/g, ""))}
                />
              </Campo>

              <Campo id="puntoVenta" label="Punto de venta" error={errores.puntoVenta}>
                <Entrada
                  id="puntoVenta"
                  inputMode="numeric"
                  placeholder="001"
                  value={valores.puntoVenta ?? ""}
                  invalido={!!errores.puntoVenta}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("puntoVenta", e.target.value.replace(/\D/g, ""))}
                />
              </Campo>
            </Grid>

            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <Campo id="timbradoFechaInicio" label="Timbrado desde">
                <Entrada
                  id="timbradoFechaInicio"
                  type="date"
                  value={valores.timbradoFechaInicio ?? ""}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("timbradoFechaInicio", e.target.value)}
                />
              </Campo>

              <Campo
                id="timbradoFechaVencimiento"
                label="Timbrado hasta"
                error={errores.timbradoFechaVencimiento}
              >
                <Entrada
                  id="timbradoFechaVencimiento"
                  type="date"
                  value={valores.timbradoFechaVencimiento ?? ""}
                  invalido={!!errores.timbradoFechaVencimiento}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiar("timbradoFechaVencimiento", e.target.value)}
                />
              </Campo>
            </Grid>

            <Flex
              align="flex-start"
              gap="2.5"
              p="3"
              borderRadius="md"
              bg="info.subtle"
              color="info.fg"
            >
              <Box mt="0.5" flexShrink={0}>
                <Info size={15} />
              </Box>
              <chakra.p fontSize="xs" lineHeight="1.6">
                La facturación electrónica ante la DNIT se activa más adelante, con
                tu certificado digital. Los datos que cargues acá se van a usar
                tal cual, sin que tengas que volver a ingresarlos.
              </chakra.p>
            </Flex>
          </Flex>
        </Seccion>

        {/* ── Impresión ──────────────────────────────────────────────── */}
        <Seccion
          id="impresion"
          titulo="Impresión"
          descripcion="El formato del comprobante que sale en la impresora del mostrador."
          separador
        >
          <Grid
            templateColumns={{ base: "1fr", xl: "minmax(0, 1fr) auto" }}
            gap={{ base: 7, xl: 8 }}
            alignItems="start"
          >
            <Flex direction="column" gap="6">
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="ink.800" mb="2">
                  Formato de impresión
                </Text>
                <Grid
                  templateColumns="repeat(auto-fit, minmax(13rem, 1fr))"
                  gap="3"
                  role="group"
                  aria-label="Formato de impresión del comprobante"
                >
                  {FORMATOS_IMPRESION.map((formato) => {
                    const activo = impresion.formato === formato.valor;
                    return (
                      <chakra.button
                        key={formato.valor}
                        type="button"
                        onClick={() =>
                          puedeEditar && cambiarImpresion("formato", formato.valor)
                        }
                        disabled={!puedeEditar}
                        aria-pressed={activo}
                        textAlign="left"
                        p="3.5"
                        borderRadius="lg"
                        borderWidth="1px"
                        borderColor={activo ? "brand.500" : "ink.200"}
                        bg={activo ? "brand.50" : "white"}
                        transition="border-color 0.15s ease, background 0.15s ease"
                        cursor={puedeEditar ? "pointer" : "not-allowed"}
                        opacity={puedeEditar ? 1 : 0.7}
                        _hover={
                          puedeEditar ? { borderColor: "brand.400" } : undefined
                        }
                        _focusVisible={{
                          outline: "2px solid",
                          outlineColor: "brand.500",
                          outlineOffset: "2px",
                        }}
                      >
                        <Flex align="center" gap="3">
                          <Flex
                            align="center"
                            justify="center"
                            w="9"
                            h="9"
                            flexShrink={0}
                            borderRadius="md"
                            bg={activo ? "brand.100" : "ink.100"}
                            color={activo ? "brand.700" : "ink.500"}
                          >
                            <Printer size={18} />
                          </Flex>
                          <Box flex="1" minW="0">
                            <Text
                              fontSize="sm"
                              fontWeight="semibold"
                              color="ink.900"
                            >
                              {formato.etiqueta}
                            </Text>
                            <Text fontSize="xs" color="ink.500">
                              {formato.detalle}
                            </Text>
                          </Box>
                          {activo && (
                            <CheckCircle2
                              size={16}
                              color="var(--chakra-colors-brand-600)"
                            />
                          )}
                        </Flex>
                      </chakra.button>
                    );
                  })}
                </Grid>
              </Box>

              {esHoja && (
                <Box
                  p="4"
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor="ink.200"
                  bg="white"
                >
                  <Text fontSize="sm" fontWeight="semibold" color="ink.800">
                    Hoja
                  </Text>
                  <Text fontSize="xs" color="ink.600" lineHeight="1.6" mt="0.5">
                    Elegí el papel y si querés aprovechar sólo la mitad superior.
                  </Text>

                  <Flex
                    gap="2.5"
                    wrap="wrap"
                    mt="3"
                    role="group"
                    aria-label="Tamaño de hoja"
                  >
                    {TAMANOS_HOJA.map((opcion) => {
                      const activo = impresion.tamanoHoja === opcion.valor;
                      return (
                        <chakra.button
                          key={opcion.valor}
                          type="button"
                          onClick={() =>
                            puedeEditar &&
                            cambiarImpresion("tamanoHoja", opcion.valor)
                          }
                          disabled={!puedeEditar}
                          aria-pressed={activo}
                          textAlign="left"
                          px="4"
                          py="2.5"
                          minW="9rem"
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor={activo ? "brand.500" : "ink.200"}
                          bg={activo ? "brand.50" : "white"}
                          cursor={puedeEditar ? "pointer" : "not-allowed"}
                          opacity={puedeEditar ? 1 : 0.7}
                          _hover={
                            puedeEditar
                              ? { borderColor: "brand.400" }
                              : undefined
                          }
                          _focusVisible={{
                            outline: "2px solid",
                            outlineColor: "brand.500",
                            outlineOffset: "2px",
                          }}
                        >
                          <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                            {opcion.etiqueta}
                          </Text>
                          <Text fontSize="xs" color="ink.500">
                            {opcion.detalle}
                          </Text>
                        </chakra.button>
                      );
                    })}
                  </Flex>

                  <Box mt="3">
                    <FilaSwitch
                      etiqueta="Aprovechar media hoja"
                      descripcion="Deja el comprobante en la mitad superior y marca una línea de corte."
                      checked={impresion.mediaHoja}
                      disabled={!puedeEditar}
                      onChange={(valor) => {
                        cambiarImpresion("mediaHoja", valor);
                        if (!valor) {
                          cambiarImpresion("duplicadoMediaHoja", false);
                        }
                      }}
                    />
                  </Box>

                  {impresion.mediaHoja && (
                    <Box mt="2.5">
                      <FilaSwitch
                        etiqueta="Duplicado en la otra mitad"
                        descripcion="Imprime el original arriba y una copia idéntica abajo. La línea de corte queda entre los dos."
                        checked={impresion.duplicadoMediaHoja}
                        disabled={!puedeEditar}
                        onChange={(valor) =>
                          cambiarImpresion("duplicadoMediaHoja", valor)
                        }
                      />
                    </Box>
                  )}
                </Box>
              )}

              <Flex
                align={{ base: "flex-start", sm: "center" }}
                justify="space-between"
                gap="4"
                p="4"
                borderRadius="lg"
                bg="ink.50"
                borderWidth="1px"
                borderColor="ink.200"
                wrap="wrap"
              >
                <Box flex="1" minW="15rem">
                  <Text fontWeight="semibold" fontSize="sm" color="ink.900" mb="1">
                    Autoimpresión
                  </Text>
                  <Text fontSize="xs" color="ink.600" lineHeight="1.6">
                    Envía el comprobante a la impresora apenas se emite o se activa
                    una venta.
                  </Text>
                </Box>
                <Switch
                  checked={impresion.autoImprimir}
                  onCheckedChange={(detalle: { checked: boolean }) =>
                    cambiarImpresion("autoImprimir", detalle.checked)
                  }
                  disabled={!puedeEditar}
                  colorPalette="brand"
                  aria-label="Imprimir automáticamente al activar una venta"
                />
              </Flex>

              <Grid
                templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
                gap="5"
                alignItems="start"
              >
                <Campo
                  id="impresion-copias"
                  label="Copias"
                  ayuda={
                    esHoja
                      ? impresion.duplicadoMediaHoja
                        ? "Cada copia ocupa una hoja con original y duplicado."
                        : "Cada copia sale en una página del PDF."
                      : "Se repiten en la misma impresión."
                  }
                >
                  <chakra.select
                    id="impresion-copias"
                    value={String(impresion.copias)}
                    disabled={!puedeEditar}
                    onChange={(evento: React.ChangeEvent<HTMLSelectElement>) =>
                      cambiarImpresion("copias", Number(evento.target.value))
                    }
                  >
                    <option value="1">1 copia</option>
                    <option value="2">2 copias</option>
                    <option value="3">3 copias</option>
                  </chakra.select>
                </Campo>

                <Campo
                  id="impresion-mensaje"
                  label="Mensaje al pie"
                  ayuda={`${impresion.mensajePie.length}/160 caracteres.`}
                >
                  <chakra.textarea
                    id="impresion-mensaje"
                    rows={2}
                    maxLength={160}
                    resize="vertical"
                    value={impresion.mensajePie}
                    disabled={!puedeEditar}
                    onChange={(evento: React.ChangeEvent<HTMLTextAreaElement>) =>
                      cambiarImpresion("mensajePie", evento.target.value)
                    }
                  />
                </Campo>
              </Grid>

              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="ink.800" mb="2">
                  Qué incluir en el comprobante
                </Text>
                <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="2.5">
                  <FilaSwitch
                    etiqueta="Logo del negocio"
                    checked={impresion.mostrarLogo}
                    disabled={!puedeEditar}
                    onChange={(valor) => cambiarImpresion("mostrarLogo", valor)}
                  />
                  <FilaSwitch
                    etiqueta="Datos fiscales"
                    descripcion="Timbrado, establecimiento y punto"
                    checked={impresion.mostrarDatosFiscales}
                    disabled={!puedeEditar}
                    onChange={(valor) =>
                      cambiarImpresion("mostrarDatosFiscales", valor)
                    }
                  />
                  <FilaSwitch
                    etiqueta="Cliente"
                    checked={impresion.mostrarCliente}
                    disabled={!puedeEditar}
                    onChange={(valor) => cambiarImpresion("mostrarCliente", valor)}
                  />
                  <FilaSwitch
                    etiqueta="Documento del cliente"
                    checked={impresion.mostrarDocumentoCliente}
                    disabled={!puedeEditar || !impresion.mostrarCliente}
                    onChange={(valor) =>
                      cambiarImpresion("mostrarDocumentoCliente", valor)
                    }
                  />
                  <FilaSwitch
                    etiqueta="Desglose de IVA"
                    checked={impresion.mostrarDesgloseIva}
                    disabled={!puedeEditar}
                    onChange={(valor) =>
                      cambiarImpresion("mostrarDesgloseIva", valor)
                    }
                  />
                  <FilaSwitch
                    etiqueta="Pagos"
                    checked={impresion.mostrarPagos}
                    disabled={!puedeEditar}
                    onChange={(valor) => cambiarImpresion("mostrarPagos", valor)}
                  />
                  <FilaSwitch
                    etiqueta="Vendedor"
                    checked={impresion.mostrarVendedor}
                    disabled={!puedeEditar}
                    onChange={(valor) => cambiarImpresion("mostrarVendedor", valor)}
                  />
                </Grid>
              </Box>
            </Flex>

            <Box
              position={{ base: "static", xl: "sticky" }}
              top="6"
              w={{ base: "full", xl: "auto" }}
            >
              <Flex align="center" justify="space-between" gap="3" mb="3">
                <Text fontSize="sm" fontWeight="semibold" color="ink.800">
                  Vista previa en vivo
                </Text>
                <Flex gap="2" wrap="wrap" justify="flex-end">
                  {esHoja && impresion.mediaHoja && (
                    <Badge colorPalette="orange" variant="subtle">
                      {impresion.duplicadoMediaHoja
                        ? "Original + duplicado"
                        : "Media hoja"}
                    </Badge>
                  )}
                  <Badge colorPalette="brand" variant="subtle">
                    {esHoja
                      ? `${hojaActual.etiqueta} · PDF`
                      : formatoActual.etiqueta}
                  </Badge>
                </Flex>
              </Flex>

              <Box
                bg="ink.100"
                p={{ base: "4", md: "5" }}
                borderRadius="xl"
                display="flex"
                justifyContent="center"
                overflowX="auto"
              >
                {esHoja ? (
                  <HojaPreview
                    datos={ticketPreview}
                    organizacion={organizacionPreview}
                    configuracion={impresion}
                  />
                ) : (
                  <TicketPreview
                    datos={ticketPreview}
                    organizacion={organizacionPreview}
                    configuracion={impresion}
                  />
                )}
              </Box>

              <Button
                type="button"
                variant="outline"
                w="full"
                mt="3"
                loading={generandoComprobante}
                loadingText="Generando…"
                onClick={imprimirPrueba}
              >
                <Printer size={15} /> Imprimir prueba
              </Button>

              {esHoja && (
                <Button
                  type="button"
                  variant="ghost"
                  w="full"
                  mt="2"
                  loading={generandoComprobante}
                  onClick={descargarPrueba}
                >
                  <FileText size={15} /> Descargar PDF de prueba
                </Button>
              )}

              <Text fontSize="xs" color="ink.500" mt="2" lineHeight="1.5">
                {esHoja
                  ? "Los datos son de ejemplo. El PDF se genera con estos mismos datos y opciones, y se imprime tal como se ve acá."
                  : "Los datos son de ejemplo. El ancho, los campos y el pie se aplican a la impresión real de cada venta."}
              </Text>
            </Box>
          </Grid>
        </Seccion>
      </Flex>

      {/* ── Barra de guardado: aparece sólo cuando hay cambios ─────────── */}
      {puedeEditar && sucio && (
        <Flex
          role="status"
          position="sticky"
          bottom="4"
          zIndex="10"
          mt="8"
          align="center"
          justify="space-between"
          gap="3"
          wrap="wrap"
          px="4"
          py="3"
          bg="ink.900"
          color="white"
          borderRadius="lg"
          boxShadow="0 10px 30px -10px rgba(16, 24, 40, 0.45)"
        >
          <Flex align="center" gap="2.5">
            <Box w="2" h="2" borderRadius="full" bg="orange.400" flexShrink={0} />
            <Text fontSize="sm" fontWeight="medium">
              Tenés cambios sin guardar
            </Text>
          </Flex>

          <Flex gap="2">
            <Button
              size="sm"
              variant="outline"
              color="white"
              borderColor="whiteAlpha.400"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={descartar}
              disabled={actualizar.isPending || subiendoLogo}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              colorPalette="brand"
              onClick={guardar}
              loading={actualizar.isPending}
              loadingText="Guardando…"
              disabled={subiendoLogo}
            >
              <Save size={15} />
              Guardar cambios
            </Button>
          </Flex>
        </Flex>
      )}
    </Box>
  );
}

/* ─────────────────────────── Componentes de apoyo ─────────────────────────── */

/** Sección con el título a la izquierda y los campos en un panel a la derecha. */
function Seccion({
  id,
  titulo,
  descripcion,
  separador = false,
  children,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  separador?: boolean;
  children: React.ReactNode;
}) {
  return (
    <chakra.section
      id={id}
      aria-labelledby={`${id}-titulo`}
      scrollMarginTop="4.5rem"
      pt={separador ? "10" : "0"}
      borderTopWidth={separador ? "1px" : "0"}
      borderColor="ink.100"
    >
      <Grid
        templateColumns={{ base: "1fr", lg: "15rem minmax(0, 1fr)" }}
        gap={{ base: 4, lg: 8 }}
      >
        <Box>
          <chakra.h2
            id={`${id}-titulo`}
            fontSize="md"
            fontWeight="semibold"
            color="ink.900"
          >
            {titulo}
          </chakra.h2>
          <Text fontSize="sm" color="ink.600" mt="1" lineHeight="1.6" maxW="22rem">
            {descripcion}
          </Text>
        </Box>

        <Panel>
          <Box p={{ base: "4", md: "6" }}>{children}</Box>
        </Panel>
      </Grid>
    </chakra.section>
  );
}

function Campo({
  id,
  label,
  error,
  ayuda,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <Box minW="0">
      <chakra.label
        htmlFor={id}
        fontSize="sm"
        fontWeight="semibold"
        color="ink.800"
        mb="1.5"
        display="block"
      >
        {label}
      </chakra.label>

      <Box
        css={{
          "& input:not([type='color']), & select, & textarea": {
            width: "100%",
            minHeight: "2.625rem",
            paddingInline: "0.875rem",
            border: `1px solid ${
              error ? "var(--chakra-colors-danger-500)" : "var(--chakra-colors-ink-200)"
            }`,
            borderRadius: "var(--chakra-radii-md)",
            background: "white",
            fontSize: "0.9375rem",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          },
          "& input[data-icon-input], & textarea[data-icon-input]": {
            paddingInlineStart: "2.5rem",
          },
          "& input:hover:not(:disabled), & select:hover:not(:disabled), & textarea:hover:not(:disabled)":
            {
              borderColor: error
                ? "var(--chakra-colors-danger-500)"
                : "var(--chakra-colors-ink-300)",
            },
          "& input:focus-visible, & select:focus-visible, & textarea:focus-visible": {
            borderColor: error
              ? "var(--chakra-colors-danger-500)"
              : "var(--chakra-colors-brand-500)",
            outline: "none",
            boxShadow: error
              ? "0 0 0 3px color-mix(in srgb, var(--chakra-colors-danger-500) 16%, transparent)"
              : "0 0 0 3px color-mix(in srgb, var(--chakra-colors-brand-500) 16%, transparent)",
          },
          "& input:disabled, & select:disabled, & textarea:disabled": {
            background: "var(--chakra-colors-ink-50)",
            color: "var(--chakra-colors-ink-500)",
            cursor: "not-allowed",
            opacity: 1,
          },
          "& textarea": {
            paddingBlock: "0.5rem",
            lineHeight: "1.5",
          },
        }}
      >
        {children}
      </Box>

      {error ? (
        <chakra.p
          id={`${id}-desc`}
          role="alert"
          fontSize="xs"
          color="danger.600"
          mt="1.5"
          fontWeight="medium"
        >
          {error}
        </chakra.p>
      ) : ayuda ? (
        <chakra.p id={`${id}-desc`} fontSize="xs" color="ink.500" mt="1.5" lineHeight="1.5">
          {ayuda}
        </chakra.p>
      ) : null}
    </Box>
  );
}

/** Interruptor con etiqueta, para las opciones de qué incluir en el ticket. */
function FilaSwitch({
  etiqueta,
  descripcion,
  checked,
  disabled,
  onChange,
}: {
  etiqueta: string;
  descripcion?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap="3"
      p="3"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="md"
      bg="white"
      opacity={disabled ? 0.65 : 1}
    >
      <Box minW="0">
        <Text fontSize="sm" fontWeight="medium" color="ink.800">
          {etiqueta}
        </Text>
        {descripcion && (
          <Text fontSize="xs" color="ink.500" lineHeight="1.4">
            {descripcion}
          </Text>
        )}
      </Box>
      <Switch
        checked={checked}
        onCheckedChange={(detalle: { checked: boolean }) =>
          onChange(detalle.checked)
        }
        disabled={disabled}
        colorPalette="brand"
        aria-label={etiqueta}
      />
    </Flex>
  );
}

/** Input con los atributos de accesibilidad ya resueltos. */
function Entrada({
  id,
  invalido = false,
  conIcono = false,
  ...resto
}: {
  id: string;
  invalido?: boolean;
  conIcono?: boolean;
} & React.ComponentProps<typeof chakra.input>) {
  return (
    <chakra.input
      id={id}
      aria-invalid={invalido || undefined}
      aria-describedby={`${id}-desc`}
      data-icon-input={conIcono ? "" : undefined}
      {...resto}
    />
  );
}

function EntradaConIcono({
  icono: Icono,
  alinearArriba = false,
  children,
}: {
  icono: typeof Phone;
  alinearArriba?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Flex align="center" position="relative">
      <Box
        position="absolute"
        left="3"
        top={alinearArriba ? "0.75rem" : "50%"}
        transform={alinearArriba ? undefined : "translateY(-50%)"}
        color="ink.400"
        pointerEvents="none"
        zIndex="1"
      >
        <Icono size={16} />
      </Box>
      {children}
    </Flex>
  );
}

/** Marca como activa la sección que está en pantalla mientras se hace scroll. */
function useSeccionActiva(ids: readonly string[], listo: boolean) {
  const [activa, setActiva] = useState<string>(ids[0]);

  useEffect(() => {
    if (!listo || typeof IntersectionObserver === "undefined") return;

    const elementos = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((entrada) => entrada.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );

    elementos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  return activa;
}

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

/** Date | null → "AAAA-MM-DD" para los <input type="date">. */
function aFechaIso(fecha: string | Date | null | undefined): string {
  if (!fecha) return "";
  return typeof fecha === "string" ? fecha.slice(0, 10) : fecha.toISOString().slice(0, 10);
}

/** "AAAA-MM-DD" → "DD/MM/AAAA" (sin pasar por Date, para evitar desfases de zona horaria). */
function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}