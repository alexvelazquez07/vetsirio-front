import { Badge, Box, Button, Flex, Grid, Spinner, Text, chakra } from "@chakra-ui/react";
import {
  FileText,
  ImagePlus,
  Paperclip,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { toaster } from "@/components/ui/toaster";
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import { ApiError, api } from "@/services/api";
import type {
  ArchivoConsulta,
  Consulta,
  PrescripcionConsulta,
  RespuestaUpload,
} from "@/types/dominio";
import { urlFotoPaciente } from "@/features/patients/patients.service";
import {
  useActualizarConsulta,
  useBuscarPacientesConsulta,
  useCrearConsulta,
  type ArchivoConsultaData,
  type ConsultaFormData,
  type PacienteConsulta,
  type PrescripcionConsultaData,
} from "./consultations.service";

const TIPOS_ADJUNTO = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/svg+xml",
  "application/pdf",
]);
const MAX_ARCHIVO_BYTES = 5 * 1024 * 1024;

interface RecetaForm {
  medicamento: string;
  presentacion: string;
  dosis: string;
  via: string;
  frecuencia: string;
  duracion: string;
  indicaciones: string;
  cantidad: string;
}

interface ValoresConsulta {
  pacienteId: number | null;
  fecha: string;
  motivoConsulta: string;
  sintomas: string;
  examenFisico: string;
  diagnostico: string;
  tratamientoIndicado: string;
  observaciones: string;
  pesoKg: string;
  temperatura: string;
  frecuenciaCardiaca: string;
  frecuenciaRespiratoria: string;
}

const VALORES_INICIALES: ValoresConsulta = {
  pacienteId: null,
  fecha: fechaHoraLocal(),
  motivoConsulta: "",
  sintomas: "",
  examenFisico: "",
  diagnostico: "",
  tratamientoIndicado: "",
  observaciones: "",
  pesoKg: "",
  temperatura: "",
  frecuenciaCardiaca: "",
  frecuenciaRespiratoria: "",
};

function fechaHoraLocal(fecha = new Date()) {
  const diferencia = fecha.getTimezoneOffset() * 60_000;
  return new Date(fecha.getTime() - diferencia).toISOString().slice(0, 16);
}

function detalleResponsable(paciente: PacienteConsulta | null) {
  if (!paciente?.cliente) return "Responsable sin registrar";
  return (
    [paciente.cliente.nombres, paciente.cliente.apellidos]
      .filter(Boolean)
      .join(" ") ||
    paciente.cliente.razonSocial ||
    "Responsable sin registrar"
  );
}

function aRecetaForm(prescripcion: PrescripcionConsulta): RecetaForm {
  return {
    medicamento: prescripcion.medicamento,
    presentacion: prescripcion.presentacion ?? "",
    dosis: prescripcion.dosis,
    via: prescripcion.via ?? "",
    frecuencia: prescripcion.frecuencia ?? "",
    duracion: prescripcion.duracion ?? "",
    indicaciones: prescripcion.indicaciones ?? "",
    cantidad:
      prescripcion.cantidad === null ? "" : String(prescripcion.cantidad),
  };
}

function adjuntoExistente(archivo: ArchivoConsulta): ArchivoConsultaData {
  return {
    url: archivo.url,
    nombreOriginal: archivo.nombreOriginal,
    mimeType: archivo.mimeType,
    tamanoBytes: archivo.tamanoBytes,
    descripcion: archivo.descripcion,
  };
}

export function ConsultaForm({
  abierto,
  consulta,
  onClose,
  onGuardado,
}: {
  abierto: boolean;
  consulta: Consulta | null;
  onClose: () => void;
  onGuardado: (consulta: Consulta) => void;
}) {
  const { usuario } = useAuth();
  const [valores, setValores] = useState<ValoresConsulta>(VALORES_INICIALES);
  const [textoPaciente, setTextoPaciente] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState<PacienteConsulta | null>(null);
  const [recetas, setRecetas] = useState<RecetaForm[]>([]);
  const [archivos, setArchivos] = useState<ArchivoConsultaData[]>([]);
  const [archivosNuevos, setArchivosNuevos] = useState<File[]>([]);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const inputArchivos = useRef<HTMLInputElement>(null);
  const busquedaPacientes = useBuscarPacientesConsulta(textoPaciente);
  const crear = useCrearConsulta();
  const actualizar = useActualizarConsulta();
  const guardando = crear.isPending || actualizar.isPending || subiendo;

  useEffect(() => {
    if (!abierto) return;
    setErrorFormulario("");
    setArchivosNuevos([]);
    if (!consulta) {
      setValores({ ...VALORES_INICIALES, fecha: fechaHoraLocal() });
      setTextoPaciente("");
      setPacienteSeleccionado(null);
      setRecetas([]);
      setArchivos([]);
      return;
    }

    const paciente: PacienteConsulta = {
      id: consulta.paciente.id,
      nombre: consulta.paciente.nombre,
      especie: consulta.paciente.especie,
      cliente: consulta.paciente.cliente,
    };
    setPacienteSeleccionado(paciente);
    setTextoPaciente(paciente.nombre);
    setValores({
      pacienteId: paciente.id,
      fecha: fechaHoraLocal(new Date(consulta.fecha)),
      motivoConsulta: consulta.motivoConsulta,
      sintomas: consulta.sintomas ?? "",
      examenFisico: consulta.examenFisico ?? "",
      diagnostico: consulta.diagnostico ?? "",
      tratamientoIndicado: consulta.tratamientoIndicado ?? "",
      observaciones: consulta.observaciones ?? "",
      pesoKg: consulta.pesoKg === null ? "" : String(consulta.pesoKg),
      temperatura:
        consulta.temperatura === null ? "" : String(consulta.temperatura),
      frecuenciaCardiaca:
        consulta.frecuenciaCardiaca === null
          ? ""
          : String(consulta.frecuenciaCardiaca),
      frecuenciaRespiratoria:
        consulta.frecuenciaRespiratoria === null
          ? ""
          : String(consulta.frecuenciaRespiratoria),
    });
    setRecetas((consulta.prescripciones ?? []).map(aRecetaForm));
    setArchivos((consulta.archivos ?? []).map(adjuntoExistente));
  }, [abierto, consulta]);

  function cambiar<K extends keyof ValoresConsulta>(
    campo: K,
    valor: ValoresConsulta[K],
  ) {
    setValores((anterior) => ({ ...anterior, [campo]: valor }));
    setErrorFormulario("");
  }

  function seleccionarPaciente(paciente: PacienteConsulta) {
    setPacienteSeleccionado(paciente);
    setTextoPaciente(paciente.nombre);
    cambiar("pacienteId", paciente.id);
  }

  function agregarArchivos(lista: FileList | null) {
    if (!lista) return;
    const elegidos = Array.from(lista);
    const invalido = elegidos.find(
      (archivo) =>
        !TIPOS_ADJUNTO.has(archivo.type) ||
        archivo.size === 0 ||
        archivo.size > MAX_ARCHIVO_BYTES ||
        archivo.name.length > 255,
    );
    if (invalido) {
      setErrorFormulario(
        !TIPOS_ADJUNTO.has(invalido.type)
          ? "Adjuntá imágenes JPG, PNG, WEBP, GIF, AVIF o BMP, o documentos PDF."
          : invalido.name.length > 255
            ? "El nombre de cada archivo debe tener como máximo 255 caracteres."
            : invalido.size === 0
              ? "No se pueden adjuntar archivos vacíos."
              : "Cada archivo adjunto puede pesar hasta 5 MB.",
      );
      if (inputArchivos.current) inputArchivos.current.value = "";
      return;
    }
    if (archivos.length + archivosNuevos.length + elegidos.length > 20) {
      setErrorFormulario("Podés adjuntar hasta 20 archivos por consulta.");
      if (inputArchivos.current) inputArchivos.current.value = "";
      return;
    }
    setArchivosNuevos((anteriores) => [...anteriores, ...elegidos]);
    if (inputArchivos.current) inputArchivos.current.value = "";
  }

  async function subirArchivosNuevos(): Promise<ArchivoConsultaData[]> {
    if (archivosNuevos.length === 0) return [];
    setSubiendo(true);
    try {
      const subidos: ArchivoConsultaData[] = [];
      for (const archivo of archivosNuevos) {
        const datos = new FormData();
        datos.append("archivo", archivo);
        const respuesta = await api.post<RespuestaUpload>("/uploads", datos, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        subidos.push({
          url: respuesta.data.data.url,
          nombreOriginal: archivo.name,
          mimeType: respuesta.data.data.mimeType,
          tamanoBytes: respuesta.data.data.tamanoBytes,
          descripcion: null,
        });
      }
      return subidos;
    } finally {
      setSubiendo(false);
    }
  }

  function recetaValida(receta: RecetaForm) {
    return receta.medicamento.trim().length > 0 && receta.dosis.trim().length > 0;
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrorFormulario("");
    if (!pacienteSeleccionado || !valores.pacienteId) {
      setErrorFormulario("Seleccioná el paciente de esta consulta.");
      return;
    }
    if (valores.motivoConsulta.trim().length < 2) {
      setErrorFormulario("Ingresá el motivo de la consulta.");
      return;
    }
    if (!valores.fecha || Number.isNaN(new Date(valores.fecha).getTime())) {
      setErrorFormulario("Ingresá una fecha y hora válida para la consulta.");
      return;
    }
    if (recetas.some((receta) => !recetaValida(receta))) {
      setErrorFormulario(
        "Completá el medicamento y la dosis de cada receta o quitá la receta incompleta.",
      );
      return;
    }

    try {
      const nuevos = await subirArchivosNuevos();
      const datos: ConsultaFormData = {
        pacienteId: valores.pacienteId,
        citaId: consulta?.citaId ?? null,
        fecha: new Date(valores.fecha).toISOString(),
        motivoConsulta: valores.motivoConsulta.trim(),
        sintomas: valores.sintomas.trim() || null,
        examenFisico: valores.examenFisico.trim() || null,
        diagnostico: valores.diagnostico.trim() || null,
        tratamientoIndicado: valores.tratamientoIndicado.trim() || null,
        observaciones: valores.observaciones.trim() || null,
        pesoKg: valores.pesoKg === "" ? null : Number(valores.pesoKg),
        temperatura:
          valores.temperatura === "" ? null : Number(valores.temperatura),
        frecuenciaCardiaca:
          valores.frecuenciaCardiaca === ""
            ? null
            : Number(valores.frecuenciaCardiaca),
        frecuenciaRespiratoria:
          valores.frecuenciaRespiratoria === ""
            ? null
            : Number(valores.frecuenciaRespiratoria),
        prescripciones: recetas.map((receta): PrescripcionConsultaData => ({
          medicamento: receta.medicamento.trim(),
          presentacion: receta.presentacion.trim() || null,
          dosis: receta.dosis.trim(),
          via: receta.via.trim() || null,
          frecuencia: receta.frecuencia.trim() || null,
          duracion: receta.duracion.trim() || null,
          indicaciones: receta.indicaciones.trim() || null,
          cantidad: receta.cantidad === "" ? null : Number(receta.cantidad),
        })),
        archivos: [...archivos, ...nuevos],
      };
      const guardado = consulta
        ? await actualizar.mutateAsync({ id: consulta.id, datos })
        : await crear.mutateAsync(datos);
      toaster.success({
        title: consulta ? "Consulta actualizada" : "Consulta registrada",
        description: `${pacienteSeleccionado.nombre} · ${formatearFecha(guardado.fecha)}`,
      });
      onGuardado(guardado);
    } catch (error) {
      const detallesValidacion =
        error instanceof ApiError && error.errors
          ? Object.entries(error.errors)
              .flatMap(([campo, mensajes]) =>
                mensajes.map((detalle) => `${campo}: ${detalle}`),
              )
              .join(" · ")
          : "";
      const mensaje = detallesValidacion
        ? `${mensajeDeError(error)} ${detallesValidacion}`
        : mensajeDeError(error);
      setErrorFormulario(mensaje);
      toaster.error({ title: "No se pudo guardar la consulta", description: mensaje });
    }
  }

  function cambiarReceta(
    indice: number,
    campo: keyof RecetaForm,
    valor: string,
  ) {
    setRecetas((anteriores) =>
      anteriores.map((receta, i) =>
        i === indice ? { ...receta, [campo]: valor } : receta,
      ),
    );
  }

  function eliminarAdjunto(indice: number) {
    setArchivos((anteriores) => anteriores.filter((_, i) => i !== indice));
  }

  function actualizarDescripcion(indice: number, descripcion: string) {
    setArchivos((anteriores) =>
      anteriores.map((archivo, i) =>
        i === indice ? { ...archivo, descripcion: descripcion || null } : archivo,
      ),
    );
  }

  const pacienteResultados = busquedaPacientes.data ?? [];
  const responsable = detalleResponsable(pacienteSeleccionado);

  return (
    <DialogRoot
      open={abierto}
      onOpenChange={(detalle) => {
        if (!detalle.open && !guardando) onClose();
      }}
      size="cover"
      motionPreset="slide-in-bottom"
    >
      <DialogContent
        maxW="64rem"
        maxH="calc(100dvh - 2rem)"
        borderRadius="lg"
        overflow="hidden"
        p="0"
        display="flex"
        flexDirection="column"
      >
        <DialogHeader
          px="6"
          py="5"
          pr="14"
          bg="brand.800"
          borderBottomWidth="1px"
          borderColor="brand.900"
        >
          <DialogTitle fontSize="lg" fontWeight="bold" color="white">
            {consulta ? "Editar consulta médica" : "Nueva consulta médica"}
          </DialogTitle>
          <Text color="brand.100" fontSize="sm" mt="1">
            Historia clínica, signos vitales, tratamiento, recetas y estudios.
          </Text>
        </DialogHeader>
        <chakra.button
          type="button"
          onClick={onClose}
          disabled={guardando}
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
          aria-label="Cerrar"
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
          <chakra.form id="consulta-medica-form" onSubmit={enviar} noValidate>
            {errorFormulario && (
              <Alert status="error" rounded="md" mb="4">
                {errorFormulario}
              </Alert>
            )}

            <Seccion titulo="Paciente y consulta" descripcion="Identificación del paciente y motivo de atención.">
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
                <Box position="relative" gridColumn={{ md: "1 / -1" }}>
                  <Campo etiqueta="Paciente" requerido>
                    <Flex position="relative">
                      <chakra.input
                        value={textoPaciente}
                        onChange={(evento) => {
                          setTextoPaciente(evento.target.value);
                          setPacienteSeleccionado(null);
                          cambiar("pacienteId", null);
                        }}
                        placeholder="Buscar por nombre del paciente o responsable"
                        autoComplete="off"
                        aria-label="Buscar paciente"
                        borderWidth="1px"
                        borderColor="ink.300"
                        borderRadius="md"
                        px="3"
                        py="2.5"
                        w="full"
                        _focus={{ outline: "2px solid", outlineColor: "brand.500" }}
                      />
                      <Box position="absolute" right="3" top="3" color="ink.400">
                        <Search size={16} />
                      </Box>
                    </Flex>
                  </Campo>
                  {textoPaciente.trim().length >= 2 && !pacienteSeleccionado && (
                    <Box
                      position="absolute"
                      zIndex="5"
                      top="100%"
                      mt="1"
                      w="full"
                      bg="white"
                      borderWidth="1px"
                      borderColor="ink.200"
                      borderRadius="md"
                      boxShadow="lg"
                      maxH="14rem"
                      overflowY="auto"
                    >
                      {busquedaPacientes.isFetching ? (
                        <Flex align="center" gap="2" p="3">
                          <Spinner size="xs" />
                          <Text fontSize="sm" color="ink.600">Buscando pacientes…</Text>
                        </Flex>
                      ) : pacienteResultados.length > 0 ? (
                        pacienteResultados.map((paciente) => (
                          <chakra.button
                            key={paciente.id}
                            type="button"
                            onClick={() => seleccionarPaciente(paciente)}
                            display="block"
                            textAlign="left"
                            w="full"
                            px="3"
                            py="2.5"
                            _hover={{ bg: "ink.50" }}
                          >
                            <Text fontWeight="semibold" color="ink.900">{paciente.nombre}</Text>
                            <Text fontSize="xs" color="ink.600">
                              {paciente.especie?.nombre ?? "Especie sin registrar"} · {detalleResponsable(paciente)}
                            </Text>
                          </chakra.button>
                        ))
                      ) : (
                        <Text p="3" fontSize="sm" color="ink.600">No encontramos pacientes activos.</Text>
                      )}
                    </Box>
                  )}
                  {pacienteSeleccionado && (
                    <Flex mt="2" p="3" bg="brand.50" borderRadius="md" gap="2" align="center">
                      <Box minW="0" flex="1">
                        <Text fontWeight="semibold" color="brand.900">{pacienteSeleccionado.nombre}</Text>
                        <Text fontSize="xs" color="brand.800">
                          {pacienteSeleccionado.especie?.nombre ?? "Especie sin registrar"} · Responsable: {responsable}
                        </Text>
                      </Box>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setPacienteSeleccionado(null);
                          setTextoPaciente("");
                          cambiar("pacienteId", null);
                        }}
                        aria-label="Quitar paciente seleccionado"
                      >
                        <X size={15} />
                      </Button>
                    </Flex>
                  )}
                </Box>
                <Campo etiqueta="Fecha y hora">
                  <Input
                    type="datetime-local"
                    value={valores.fecha}
                    onChange={(valor) => cambiar("fecha", valor)}
                  />
                </Campo>
                <Campo etiqueta="Veterinario responsable">
                  <Input
                    value={usuario ? `${usuario.nombre} ${usuario.apellido}` : ""}
                    readOnly
                    aria-label="Veterinario responsable"
                  />
                </Campo>
                <Campo etiqueta="Motivo de consulta" requerido anchoCompleto>
                  <Textarea
                    value={valores.motivoConsulta}
                    onChange={(valor) => cambiar("motivoConsulta", valor)}
                    placeholder="Ej.: decaimiento, control, vómitos, cojera…"
                    rows={2}
                  />
                </Campo>
                <Campo etiqueta="Síntomas observados" anchoCompleto>
                  <Textarea
                    value={valores.sintomas}
                    onChange={(valor) => cambiar("sintomas", valor)}
                    placeholder="Describí los síntomas, cuándo comenzaron, evolución y frecuencia."
                    rows={3}
                  />
                </Campo>
              </Grid>
            </Seccion>

            <Seccion titulo="Evaluación clínica" descripcion="Signos vitales y examen físico del paciente.">
              <Grid templateColumns={{ base: "1fr 1fr", md: "repeat(4, 1fr)" }} gap="4">
                <Campo etiqueta="Peso (kg)">
                  <Input type="number" min="0" step="0.001" value={valores.pesoKg} onChange={(valor) => cambiar("pesoKg", valor)} />
                </Campo>
                <Campo etiqueta="Temperatura (°C)">
                  <Input type="number" min="20" max="50" step="0.01" value={valores.temperatura} onChange={(valor) => cambiar("temperatura", valor)} />
                </Campo>
                <Campo etiqueta="Frecuencia cardíaca (lpm)">
                  <Input type="number" min="0" max="1000" step="1" value={valores.frecuenciaCardiaca} onChange={(valor) => cambiar("frecuenciaCardiaca", valor)} />
                </Campo>
                <Campo etiqueta="Frecuencia respiratoria (rpm)">
                  <Input type="number" min="0" max="1000" step="1" value={valores.frecuenciaRespiratoria} onChange={(valor) => cambiar("frecuenciaRespiratoria", valor)} />
                </Campo>
                <Campo etiqueta="Examen físico" anchoCompleto>
                  <Textarea
                    value={valores.examenFisico}
                    onChange={(valor) => cambiar("examenFisico", valor)}
                    placeholder="Hallazgos del examen físico por sistemas."
                    rows={3}
                  />
                </Campo>
                <Campo etiqueta="Diagnóstico" anchoCompleto>
                  <Textarea
                    value={valores.diagnostico}
                    onChange={(valor) => cambiar("diagnostico", valor)}
                    placeholder="Diagnóstico presuntivo o definitivo."
                    rows={3}
                  />
                </Campo>
                <Campo etiqueta="Tratamiento indicado" anchoCompleto>
                  <Textarea
                    value={valores.tratamientoIndicado}
                    onChange={(valor) => cambiar("tratamientoIndicado", valor)}
                    placeholder="Plan terapéutico, procedimientos y recomendaciones."
                    rows={3}
                  />
                </Campo>
                <Campo etiqueta="Observaciones y seguimiento" anchoCompleto>
                  <Textarea
                    value={valores.observaciones}
                    onChange={(valor) => cambiar("observaciones", valor)}
                    placeholder="Indicaciones para el responsable y próxima revisión."
                    rows={3}
                  />
                </Campo>
              </Grid>
            </Seccion>

            <Seccion
              titulo="Recetas y prescripciones"
              descripcion="Agregá los medicamentos indicados, dosis y duración."
              accion={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  colorPalette="brand"
                  disabled={recetas.length >= 30}
                  onClick={() =>
                    setRecetas((anteriores) => [
                      ...anteriores,
                      {
                        medicamento: "",
                        presentacion: "",
                        dosis: "",
                        via: "",
                        frecuencia: "",
                        duracion: "",
                        indicaciones: "",
                        cantidad: "",
                      },
                    ])
                  }
                >
                  <Plus size={15} /> Agregar medicamento
                </Button>
              }
            >
              {recetas.length === 0 ? (
                <Text fontSize="sm" color="ink.500">No se agregaron medicamentos a esta consulta.</Text>
              ) : (
                <Flex direction="column" gap="4">
                  {recetas.map((receta, indice) => (
                    <Box key={`receta-${indice}`} p="4" borderWidth="1px" borderColor="ink.200" borderRadius="md">
                      <Flex justify="space-between" align="center" mb="3">
                        <Text fontSize="sm" fontWeight="semibold" color="ink.800">Medicamento {indice + 1}</Text>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => setRecetas((anteriores) => anteriores.filter((_, i) => i !== indice))}
                          aria-label={`Quitar medicamento ${indice + 1}`}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </Flex>
                      <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="3">
                        <Campo etiqueta="Medicamento" requerido>
                          <Input value={receta.medicamento} onChange={(valor) => cambiarReceta(indice, "medicamento", valor)} />
                        </Campo>
                        <Campo etiqueta="Presentación">
                          <Input value={receta.presentacion} onChange={(valor) => cambiarReceta(indice, "presentacion", valor)} placeholder="Comprimido, jarabe…" />
                        </Campo>
                        <Campo etiqueta="Dosis" requerido>
                          <Input value={receta.dosis} onChange={(valor) => cambiarReceta(indice, "dosis", valor)} placeholder="Ej.: 1 comprimido" />
                        </Campo>
                        <Campo etiqueta="Vía">
                          <Input value={receta.via} onChange={(valor) => cambiarReceta(indice, "via", valor)} placeholder="Oral, tópica…" />
                        </Campo>
                        <Campo etiqueta="Frecuencia">
                          <Input value={receta.frecuencia} onChange={(valor) => cambiarReceta(indice, "frecuencia", valor)} placeholder="Cada 12 horas" />
                        </Campo>
                        <Campo etiqueta="Duración">
                          <Input value={receta.duracion} onChange={(valor) => cambiarReceta(indice, "duracion", valor)} placeholder="7 días" />
                        </Campo>
                        <Campo etiqueta="Cantidad">
                          <Input type="number" min="0" step="0.01" value={receta.cantidad} onChange={(valor) => cambiarReceta(indice, "cantidad", valor)} />
                        </Campo>
                        <Campo etiqueta="Indicaciones" anchoCompleto>
                          <Textarea value={receta.indicaciones} onChange={(valor) => cambiarReceta(indice, "indicaciones", valor)} rows={2} />
                        </Campo>
                      </Grid>
                    </Box>
                  ))}
                </Flex>
              )}
            </Seccion>

            <Seccion
              titulo="Archivos y estudios"
              descripcion="Adjuntá recetas escaneadas, radiografías, ecografías, análisis e imágenes clínicas (PDF o imagen, hasta 5 MB por archivo)."
              accion={
                <>
                  <input
                    ref={inputArchivos}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/svg+xml,application/pdf"
                    multiple
                    hidden
                    onChange={(evento) => agregarArchivos(evento.target.files)}
                    aria-label="Seleccionar archivos clínicos"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    colorPalette="brand"
                    onClick={() => inputArchivos.current?.click()}
                  >
                    <ImagePlus size={15} /> Adjuntar archivos
                  </Button>
                </>
              }
            >
              {archivos.length === 0 && archivosNuevos.length === 0 ? (
                <Flex align="center" gap="2" color="ink.500">
                  <Paperclip size={16} />
                  <Text fontSize="sm">Todavía no hay archivos adjuntos.</Text>
                </Flex>
              ) : (
                <Flex direction="column" gap="2">
                  {archivos.map((archivo, indice) => (
                    <Flex key={`${archivo.url}-${indice}`} align="center" gap="3" p="3" borderWidth="1px" borderColor="ink.200" borderRadius="md">
                      <Badge colorPalette={archivo.mimeType === "application/pdf" ? "red" : "blue"} variant="subtle">
                        {archivo.mimeType === "application/pdf" ? "PDF" : "Imagen"}
                      </Badge>
                      <Box minW="0" flex="1">
                        <Text fontSize="sm" fontWeight="medium" truncate>{archivo.nombreOriginal}</Text>
                        <Input
                          aria-label={`Descripción de ${archivo.nombreOriginal}`}
                          value={archivo.descripcion ?? ""}
                          onChange={(valor) => actualizarDescripcion(indice, valor)}
                          placeholder="Descripción: radiografía de tórax, receta…"
                        />
                      </Box>
                      <a href={urlFotoPaciente(archivo.url)} target="_blank" rel="noreferrer" aria-label={`Abrir ${archivo.nombreOriginal}`}>
                        <FileText size={17} />
                      </a>
                      <Button type="button" size="xs" variant="ghost" colorPalette="red" onClick={() => eliminarAdjunto(indice)} aria-label={`Quitar ${archivo.nombreOriginal}`}>
                        <Trash2 size={15} />
                      </Button>
                    </Flex>
                  ))}
                  {archivosNuevos.map((archivo, indice) => (
                    <Flex key={`${archivo.name}-${indice}`} align="center" gap="3" p="3" borderWidth="1px" borderColor="brand.200" borderRadius="md" bg="brand.50">
                      <Badge colorPalette={archivo.type === "application/pdf" ? "red" : "blue"} variant="subtle">
                        {archivo.type === "application/pdf" ? "PDF" : "Imagen"}
                      </Badge>
                      <Text fontSize="sm" flex="1" truncate>{archivo.name}</Text>
                      <Text fontSize="xs" color="ink.500">{formatearTamano(archivo.size)}</Text>
                      <Button type="button" size="xs" variant="ghost" colorPalette="red" onClick={() => setArchivosNuevos((anteriores) => anteriores.filter((_, i) => i !== indice))} aria-label={`Quitar archivo ${archivo.name}`}>
                        <Trash2 size={15} />
                      </Button>
                    </Flex>
                  ))}
                </Flex>
              )}
            </Seccion>

          </chakra.form>
        </DialogBody>
        <DialogFooter
          px="6"
          py="4"
          borderTopWidth="1px"
          borderColor="ink.200"
          gap="2"
          bg="ink.50"
          flexShrink="0"
        >
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={guardando}
            flex={{ base: "1", sm: "initial" }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="consulta-medica-form"
            colorPalette="brand"
            loading={guardando}
            loadingText={subiendo ? "Adjuntando archivos…" : "Guardando…"}
            flex={{ base: "1", sm: "initial" }}
          >
            {consulta ? "Guardar cambios" : "Registrar consulta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

function Seccion({
  titulo,
  descripcion,
  accion,
  children,
}: {
  titulo: string;
  descripcion: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box mb="6" pb="5" borderBottomWidth="1px" borderColor="ink.200">
      <Flex justify="space-between" align="flex-start" gap="3" wrap="wrap" mb="4">
        <Box>
          <Text fontSize="md" fontWeight="bold" color="ink.900">{titulo}</Text>
          <Text fontSize="xs" color="ink.500" mt="0.5">{descripcion}</Text>
        </Box>
        {accion}
      </Flex>
      {children}
    </Box>
  );
}

function Campo({
  etiqueta,
  requerido,
  anchoCompleto,
  children,
}: {
  etiqueta: string;
  requerido?: boolean;
  anchoCompleto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box gridColumn={anchoCompleto ? { md: "1 / -1" } : undefined}>
      <Text as="label" display="block" mb="1.5" fontSize="sm" fontWeight="medium" color="ink.700">
        {etiqueta}{requerido && <chakra.span color="red.600"> *</chakra.span>}
      </Text>
      {children}
    </Box>
  );
}

function Input({
  value,
  onChange,
  ...rest
}: {
  value: string;
  onChange?: (value: string) => void;
} & Record<string, unknown>) {
  return (
    <chakra.input
      value={value}
      onChange={onChange ? (evento) => onChange(evento.target.value) : undefined}
      borderWidth="1px"
      borderColor="ink.300"
      borderRadius="md"
      px="3"
      py="2.5"
      w="full"
      fontSize="sm"
      _focus={{ outline: "2px solid", outlineColor: "brand.500" }}
      {...rest}
    />
  );
}

function Textarea({
  value,
  onChange,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
} & Record<string, unknown>) {
  return (
    <chakra.textarea
      value={value}
      onChange={(evento) => onChange(evento.target.value)}
      borderWidth="1px"
      borderColor="ink.300"
      borderRadius="md"
      px="3"
      py="2.5"
      w="full"
      fontSize="sm"
      resize="vertical"
      _focus={{ outline: "2px solid", outlineColor: "brand.500" }}
      {...rest}
    />
  );
}

function formatearFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(fecha));
}

function formatearTamano(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
