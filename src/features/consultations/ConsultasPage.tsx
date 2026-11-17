import { Badge, Box, Button, Flex, Grid, Spinner, Text, chakra } from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarDays,
  ChevronRight,
  ClipboardPlus,
  FileText,
  Paperclip,
  Pencil,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DataTable } from "@/components/data/DataTable";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel, PanelHeader } from "@/components/layout/PageHeader";
import { descargarConsultaPdf } from "@/features/consultations/consulta.export";
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import { urlFotoPaciente } from "@/features/patients/patients.service";
import type { Consulta } from "@/types/dominio";
import { ConsultaForm } from "./ConsultaForm";
import {
  CONSULTAS_POR_PAGINA,
  useConsultaDetalle,
  useConsultas,
  useFinalizarConsulta,
} from "./consultations.service";

const ESTADOS = {
  abierta: { etiqueta: "Abierta", color: "warning" },
  en_curso: { etiqueta: "En curso", color: "info" },
  finalizada: { etiqueta: "Finalizada", color: "success" },
  anulada: { etiqueta: "Anulada", color: "gray" },
} as const;

function nombreResponsable(consulta: Consulta) {
  const responsable = consulta.paciente.cliente;
  if (!responsable) return "Responsable sin registrar";
  return (
    [responsable.nombres, responsable.apellidos].filter(Boolean).join(" ") ||
    responsable.razonSocial ||
    responsable.documento ||
    "Responsable sin registrar"
  );
}

function fechaConsulta(fecha: string) {
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(fecha));
}

function columnasConsultas(
  onVer: (consulta: Consulta) => void,
): ColumnDef<Consulta>[] {
  return [
    {
      accessorKey: "fecha",
      header: "Fecha",
      cell: ({ row }) => (
        <Text fontSize="sm" color="ink.700" whiteSpace="nowrap">
          {fechaConsulta(row.original.fecha)}
        </Text>
      ),
    },
    {
      accessorKey: "paciente.nombre",
      header: "Paciente",
      cell: ({ row }) => (
        <Box minW="36">
          <Text fontWeight="semibold" color="ink.900">
            {row.original.paciente.nombre}
          </Text>
          <Text fontSize="xs" color="ink.500">
            {row.original.paciente.especie?.nombre ?? "Especie no registrada"}{" "}
            de {nombreResponsable(row.original)}
          </Text>
        </Box>
      ),
    },
    {
      accessorKey: "motivoConsulta",
      header: "Motivo y diagnóstico",
      cell: ({ row }) => (
        <Box maxW="64">
          <Text fontSize="sm" color="ink.800" truncate>
            {row.original.motivoConsulta}
          </Text>
          <Text fontSize="xs" color="ink.500" truncate>
            {row.original.diagnostico || "Diagnóstico pendiente"}
          </Text>
        </Box>
      ),
    },
    {
      accessorKey: "veterinario.nombre",
      header: "Veterinario",
      cell: ({ row }) => (
        <Text fontSize="sm" color="ink.700" whiteSpace="nowrap">
          {row.original.veterinario.nombre} {row.original.veterinario.apellido}
        </Text>
      ),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <Badge
          colorPalette={ESTADOS[row.original.estado].color}
          variant="subtle"
          size="sm"
        >
          {ESTADOS[row.original.estado].etiqueta}
        </Badge>
      ),
    },
    {
      id: "detalle",
      header: "",
      cell: ({ row }) => (
        <Button
          size="xs"
          variant="ghost"
          colorPalette="brand"
          onClick={() => onVer(row.original)}
          aria-label={`Ver consulta de ${row.original.paciente.nombre}`}
        >
          Ver ficha <ChevronRight size={15} />
        </Button>
      ),
    },
  ];
}

export function ConsultasPage() {
  const { puede, veterinaria } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagina, setPagina] = useState(1);
  const [consultaSeleccionadaId, setConsultaSeleccionadaId] =
    useState<number | null>(null);
  const [consultaEditando, setConsultaEditando] = useState<Consulta | null>(
    null,
  );
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const { texto, setTexto, busqueda } = useBusquedaDiferida(
    searchParams.get("busqueda") ?? "",
  );

  const consultaIdRaw = searchParams.get("pacienteId");
  const pacienteId =
    consultaIdRaw && /^\d+$/.test(consultaIdRaw)
      ? Number(consultaIdRaw)
      : undefined;
  const consulta = useConsultas({ busqueda, pagina, pacienteId });
  const detalle = useConsultaDetalle(consultaSeleccionadaId ?? undefined);
  const finalizar = useFinalizarConsulta();

  useEffect(() => {
    if (searchParams.get("nuevo") !== "1") return;
    if (puede("consultas.crear")) {
      setConsultaEditando(null);
      setFormularioAbierto(true);
    }
    setSearchParams(
      (params) => {
        params.delete("nuevo");
        return params;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, puede]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, pacienteId]);

  const columnas = useMemo(
    () =>
      columnasConsultas((registro) => {
        setConsultaSeleccionadaId(registro.id);
      }),
    [],
  );

  function abrirNueva() {
    setConsultaEditando(null);
    setFormularioAbierto(true);
  }

  function editarDetalle() {
    if (!detalle.data) return;
    setConsultaEditando(detalle.data);
    setFormularioAbierto(true);
    setConsultaSeleccionadaId(null);
  }

  async function finalizarConsulta() {
    if (!detalle.data) return;
    try {
      const actualizada = await finalizar.mutateAsync(detalle.data.id);
      toaster.success({
        title: "Consulta finalizada",
        description: actualizada.paciente.nombre,
      });
    } catch (error) {
      toaster.error({
        title: "No se pudo finalizar la consulta",
        description: mensajeDeError(error),
      });
    }
  }

  const total = consulta.data?.total ?? 0;
  const titulo = pacienteId ? "Historial de consultas" : "Consultas médicas";

  return (
    <>
      <PageHeader
        titulo={titulo}
        descripcion="Historia clínica por paciente: síntomas, evaluación, diagnósticos, recetas y estudios adjuntos."
        migas={["Atención al cliente", "Consultas"]}
        acciones={
          puede("consultas.crear") ? (
            <Button colorPalette="brand" onClick={abrirNueva}>
              <ClipboardPlus size={17} />
              Nueva consulta
            </Button>
          ) : undefined
        }
      />

      <Panel flush>
        <PanelHeader
          titulo="Registro clínico"
          descripcion={`${total} ${total === 1 ? "consulta registrada" : "consultas registradas"}`}
          acciones={
            <Flex
              align="center"
              position="relative"
              w={{ base: "full", md: "18rem" }}
            >
              <Box position="absolute" left="3" color="ink.400" pointerEvents="none">
                <Search size={16} />
              </Box>
              <chakra.input
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                placeholder="Buscar paciente, síntoma o diagnóstico"
                aria-label="Buscar consultas"
                borderWidth="1px"
                borderColor="ink.300"
                borderRadius="md"
                pl="9"
                pr="3"
                py="2"
                w="full"
                fontSize="sm"
              />
            </Flex>
          }
        />

        {consulta.isPending ? (
          <Flex justify="center" align="center" gap="3" py="16">
            <Spinner color="brand.500" />
            <Text color="ink.600">Cargando consultas…</Text>
          </Flex>
        ) : consulta.isError ? (
          <Box p="5">
            <AlertError mensaje={mensajeDeError(consulta.error)} />
          </Box>
        ) : consulta.data?.items.length ? (
          <>
            <DataTable
              columns={columnas}
              data={consulta.data.items}
              vacioTitulo="No hay consultas"
              vacioDetalle="No hay consultas que coincidan con la búsqueda."
              hayBusqueda={Boolean(busqueda)}
              claveFila={(fila) => fila.id}
            />
            <Paginacion
              pagina={pagina}
              totalPaginas={consulta.data.totalPaginas}
              total={consulta.data.total}
              porPagina={CONSULTAS_POR_PAGINA}
              onCambioPagina={setPagina}
              singular="consulta"
              plural="consultas"
            />
          </>
        ) : (
          <Box px="5" py="12" textAlign="center">
            <Flex
              mx="auto"
              mb="4"
              w="12"
              h="12"
              align="center"
              justify="center"
              borderRadius="full"
              bg="brand.50"
              color="brand.700"
            >
              <Stethoscope size={24} />
            </Flex>
            <Text fontWeight="semibold" color="ink.900">
              {busqueda ? "No encontramos consultas" : "Todavía no hay consultas"}
            </Text>
            <Text color="ink.600" fontSize="sm" mt="1" mb="4">
              {busqueda
                ? "Probá buscar por otro paciente, síntoma o diagnóstico."
                : "Registrá la atención clínica para dejar asentados síntomas, evaluación y tratamiento."}
            </Text>
            {!busqueda && puede("consultas.crear") && (
              <Button colorPalette="brand" variant="outline" onClick={abrirNueva}>
                Registrar primera consulta
              </Button>
            )}
          </Box>
        )}
      </Panel>

      <ConsultaForm
        abierto={formularioAbierto}
        consulta={consultaEditando}
        onClose={() => {
          setFormularioAbierto(false);
          setConsultaEditando(null);
        }}
        onGuardado={(guardada) => {
          setFormularioAbierto(false);
          setConsultaEditando(null);
          setConsultaSeleccionadaId(guardada.id);
          setPagina(1);
        }}
      />

      <DialogRoot
        open={consultaSeleccionadaId !== null}
        onOpenChange={(detalleDialogo) => {
          if (!detalleDialogo.open) setConsultaSeleccionadaId(null);
        }}
        size="cover"
      >
        <DialogContent
          maxW="52rem"
          maxH="calc(100dvh - 2rem)"
          p="0"
          overflow="hidden"
          display="flex"
          flexDirection="column"
        >
          <DialogHeader
            px="6"
            py="5"
            pr="14"
            bg="brand.800"
            color="white"
            flexShrink="0"
          >
            <DialogTitle fontSize="lg" fontWeight="bold" color="white">
              Ficha de consulta
            </DialogTitle>
            {detalle.data && (
              <Text color="brand.100" fontSize="sm" mt="1">
                {detalle.data.paciente.nombre} · {fechaConsulta(detalle.data.fecha)}
              </Text>
            )}
          </DialogHeader>
          <chakra.button
            type="button"
            onClick={() => setConsultaSeleccionadaId(null)}
            position="absolute"
            top="3"
            right="3"
            zIndex="1"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="9"
            h="9"
            borderRadius="full"
            color="white"
            bg="brand.700"
            _hover={{ bg: "brand.600" }}
            aria-label="Cerrar ficha de consulta"
          >
            <X size={18} />
          </chakra.button>
          <DialogBody
            px={{ base: "4", md: "6" }}
            py="5"
            flex="1"
            minH="0"
            overflowY="auto"
          >
            {detalle.isPending ? (
              <Flex justify="center" py="10"><Spinner color="brand.500" /></Flex>
            ) : detalle.isError ? (
              <AlertError mensaje={mensajeDeError(detalle.error)} />
            ) : detalle.data ? (
              <DetalleConsulta
                consulta={detalle.data}
              />
            ) : null}
          </DialogBody>
          {detalle.data && (
              <DialogFooter
                px="6"
                py="4"
                borderTopWidth="1px"
                borderColor="ink.200"
                gap="2"
                bg="ink.50"
                flexShrink="0"
                justifyContent="space-between"
              >
                <Button
                  variant="outline"
                  colorPalette="gray"
                  onClick={() => {
                    if (!detalle.data) return;
                    void descargarConsultaPdf(detalle.data, veterinaria);
                  }}
                  flex={{ base: "1", sm: "initial" }}
                >
                  <FileText size={16} /> Exportar Ficha en PDF
                </Button>
                {detalle.data.estado !== "finalizada" &&
                  detalle.data.estado !== "anulada" && (
                    <Flex gap="2" ml="auto">
                      {puede("consultas.editar") && (
                        <Button
                          variant="outline"
                          colorPalette="brand"
                          onClick={editarDetalle}
                          flex={{ base: "1", sm: "initial" }}
                        >
                          <Pencil size={16} /> Editar consulta
                        </Button>
                      )}
                      {puede("consultas.cerrar") && (
                        <Button
                          colorPalette="brand"
                          onClick={() => void finalizarConsulta()}
                          loading={finalizar.isPending}
                          flex={{ base: "1", sm: "initial" }}
                        >
                          Finalizar consulta
                        </Button>
                      )}
                    </Flex>
                  )}
              </DialogFooter>
            )}
        </DialogContent>
      </DialogRoot>
    </>
  );
}

function DetalleConsulta({
  consulta,
}: {
  consulta: Consulta;
}) {
  const estado = ESTADOS[consulta.estado];
  const archivos = consulta.archivos ?? [];
  const recetas = consulta.prescripciones ?? [];
  const valoresClinicos = [
    ["Peso", consulta.pesoKg === null ? null : `${consulta.pesoKg} kg`],
    ["Temperatura", consulta.temperatura === null ? null : `${consulta.temperatura} °C`],
    ["Frecuencia cardíaca", consulta.frecuenciaCardiaca === null ? null : `${consulta.frecuenciaCardiaca} lpm`],
    ["Frecuencia respiratoria", consulta.frecuenciaRespiratoria === null ? null : `${consulta.frecuenciaRespiratoria} rpm`],
  ].filter((dato): dato is [string, string] => dato[1] !== null);

  return (
    <Flex direction="column" gap="5">
      <Flex justify="space-between" align="flex-start" gap="3" wrap="wrap">
        <Box>
          <Text fontSize="xl" fontWeight="bold" color="ink.900">{consulta.paciente.nombre}</Text>
          <Text color="ink.600" fontSize="sm">
            {consulta.paciente.especie?.nombre ?? "Especie no registrada"} · {nombreResponsable(consulta)}
          </Text>
          <Text color="ink.500" fontSize="xs" mt="1">
            Atendió {consulta.veterinario.nombre} {consulta.veterinario.apellido}
          </Text>
        </Box>
        <Badge colorPalette={estado.color} variant="subtle">{estado.etiqueta}</Badge>
      </Flex>

      <section>
        <TituloDetalle icono={<CalendarDays size={16} />} titulo="Atención" />
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4" mt="3">
          <Dato titulo="Fecha y hora" valor={fechaConsulta(consulta.fecha)} />
          <Dato titulo="Motivo de consulta" valor={consulta.motivoConsulta} />
          <Dato titulo="Síntomas" valor={consulta.sintomas} ancho />
          <Dato titulo="Examen físico" valor={consulta.examenFisico} ancho />
          <Dato titulo="Signos vitales" valor={valoresClinicos.map(([nombre, valor]) => `${nombre}: ${valor}`).join(" · ") || null} ancho />
        </Grid>
      </section>

      <section>
        <TituloDetalle icono={<Stethoscope size={16} />} titulo="Diagnóstico y tratamiento" />
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4" mt="3">
          <Dato titulo="Diagnóstico" valor={consulta.diagnostico} />
          <Dato titulo="Tratamiento indicado" valor={consulta.tratamientoIndicado} />
          <Dato titulo="Observaciones y seguimiento" valor={consulta.observaciones} ancho />
        </Grid>
      </section>

      <section>
        <TituloDetalle icono={<FileText size={16} />} titulo={`Recetas y prescripciones (${recetas.length})`} />
        {recetas.length ? (
          <Flex direction="column" gap="2" mt="3">
            {recetas.map((receta, indice) => (
              <Box key={receta.id ?? indice} p="3" borderWidth="1px" borderColor="ink.200" borderRadius="md">
                <Text fontWeight="semibold" color="ink.900">
                  {receta.medicamento}{receta.presentacion ? ` · ${receta.presentacion}` : ""}
                </Text>
                <Text fontSize="sm" color="ink.700">
                  Dosis: {receta.dosis}
                  {receta.via ? ` · Vía: ${receta.via}` : ""}
                  {receta.frecuencia ? ` · ${receta.frecuencia}` : ""}
                  {receta.duracion ? ` · ${receta.duracion}` : ""}
                </Text>
                {receta.indicaciones && <Text fontSize="sm" color="ink.600" mt="1">{receta.indicaciones}</Text>}
              </Box>
            ))}
          </Flex>
        ) : (
          <Text fontSize="sm" color="ink.500" mt="2">No se registraron medicamentos.</Text>
        )}
      </section>

      <section>
        <TituloDetalle icono={<Paperclip size={16} />} titulo={`Archivos y estudios (${archivos.length})`} />
        {archivos.length ? (
          <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3" mt="3">
            {archivos.map((archivo, indice) => (
              <a
                key={archivo.id ?? `${archivo.url}-${indice}`}
                href={urlFotoPaciente(archivo.url)}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none" }}
              >
                <Flex align="center" gap="3" p="3" borderWidth="1px" borderColor="ink.200" borderRadius="md" _hover={{ bg: "ink.50" }}>
                  <FileText size={20} />
                  <Box minW="0">
                    <Text fontSize="sm" fontWeight="medium" truncate>{archivo.nombreOriginal}</Text>
                    <Text fontSize="xs" color="ink.500">{archivo.descripcion || (archivo.mimeType === "application/pdf" ? "Documento PDF" : "Imagen clínica")}</Text>
                  </Box>
                </Flex>
              </a>
            ))}
          </Grid>
        ) : (
          <Text fontSize="sm" color="ink.500" mt="2">No se adjuntaron documentos o imágenes.</Text>
        )}
      </section>

    </Flex>
  );
}

function TituloDetalle({ icono, titulo }: { icono: React.ReactNode; titulo: string }) {
  return (
    <Flex align="center" gap="2" color="brand.700">
      {icono}
      <Text fontWeight="semibold" color="ink.900">{titulo}</Text>
    </Flex>
  );
}

function Dato({
  titulo,
  valor,
  ancho,
}: {
  titulo: string;
  valor: string | null | undefined;
  ancho?: boolean;
}) {
  return (
    <Box gridColumn={ancho ? { md: "1 / -1" } : undefined}>
      <Text fontSize="xs" fontWeight="semibold" color="ink.500" textTransform="uppercase">
        {titulo}
      </Text>
      <Text fontSize="sm" color={valor ? "ink.800" : "ink.400"} mt="1" whiteSpace="pre-wrap">
        {valor || "Sin registro"}
      </Text>
    </Box>
  );
}

function AlertError({ mensaje }: { mensaje: string }) {
  return (
    <Box p="4" bg="red.50" color="red.800" borderRadius="md" role="alert">
      {mensaje}
    </Box>
  );
}
