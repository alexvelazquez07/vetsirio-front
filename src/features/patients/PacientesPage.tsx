import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  EmptyState,
  Flex,
  Grid,
  IconButton,
  Input,
  SegmentGroup,
  Skeleton,
  Text,
  VStack,
  chakra,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Pencil,
  PawPrint,
  RotateCcw,
  Search,
  Stethoscope,
  Table2,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import {
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError, useDialogo } from "@/features/clients/clients.service";
import { PacienteForm, type PacienteFormValues } from "./PacienteForm";
import {
  PACIENTES_POR_PAGINA,
  useActualizarPaciente,
  useCrearPaciente,
  useDesactivarPaciente,
  usePacienteDetalle,
  usePacientes,
  useReactivarPaciente,
  urlFotoPaciente,
} from "./patients.service";
import type { Paciente } from "@/types/dominio";

type Vista = "tabla" | "tarjetas";

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

function responsable(paciente: Paciente) {
  const cliente = paciente.cliente;
  if (!cliente) return "Sin responsable";
  return (
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ||
    cliente.documento
  );
}

function telefonoResponsable(paciente: Paciente) {
  return paciente.cliente?.telefono ?? paciente.cliente?.whatsapp ?? null;
}

function especieYRaza(paciente: Paciente) {
  return (
    [paciente.especie?.nombre, paciente.raza].filter(Boolean).join(" · ") ||
    "Especie sin definir"
  );
}

function edad(paciente: Paciente) {
  if (paciente.edadAnios !== null) {
    return `${paciente.edadAnios} ${paciente.edadAnios === 1 ? "año" : "años"}`;
  }
  if (!paciente.fechaNacimiento) return "Edad no registrada";
  const nacimiento = new Date(paciente.fechaNacimiento);
  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const aniversarioPendiente =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() &&
      hoy.getDate() < nacimiento.getDate());
  if (aniversarioPendiente) anios -= 1;
  return anios < 1
    ? "Menos de 1 año"
    : `${anios} ${anios === 1 ? "año" : "años"}`;
}

/* ─────────────────────────────── Componentes de apoyo ─────────────────────────────── */

const TAMANO_ICONO_AVATAR = { sm: 16, md: 18, lg: 24, xl: 28 } as const;

/** Avatar de la mascota: foto si existe, huella si no. La foto se puede ampliar. */
function AvatarMascota({
  paciente,
  size = "md",
  onAmpliar,
}: {
  paciente: Paciente;
  size?: keyof typeof TAMANO_ICONO_AVATAR;
  onAmpliar?: (paciente: Paciente) => void;
}) {
  const url = urlFotoPaciente(paciente.fotoUrl);

  const avatar = (
    <Avatar.Root size={size} colorPalette="brand" flexShrink={0}>
      {url && <Avatar.Image src={url} alt="" />}
      <Avatar.Fallback>
        <PawPrint size={TAMANO_ICONO_AVATAR[size]} />
      </Avatar.Fallback>
    </Avatar.Root>
  );

  if (!url || !onAmpliar) return avatar;

  return (
    <chakra.button
      type="button"
      onClick={(evento: React.MouseEvent) => {
        evento.stopPropagation();
        onAmpliar(paciente);
      }}
      aria-label={`Ampliar foto de ${paciente.nombre}`}
      borderRadius="full"
      cursor="zoom-in"
      flexShrink={0}
    >
      {avatar}
    </chakra.button>
  );
}

function BadgeEstado({ activo }: { activo: boolean }) {
  return (
    <Badge colorPalette={activo ? "success" : "gray"} variant="subtle" size="sm">
      {activo ? "Activo" : "Inactivo"}
    </Badge>
  );
}

/** Esterilizado, desparasitado y alerta médica. Si no hay ninguno, muestra `vacio`. */
function InsigniasSalud({
  paciente,
  vacio = null,
}: {
  paciente: Paciente;
  vacio?: React.ReactNode;
}) {
  if (!paciente.esterilizado && !paciente.desparasitado && !paciente.alergias) {
    return <>{vacio}</>;
  }
  return (
    <Flex gap="1.5" wrap="wrap">
      {paciente.esterilizado && (
        <Badge colorPalette="purple" variant="subtle" size="sm">
          Esterilizado
        </Badge>
      )}
      {paciente.desparasitado && (
        <Badge colorPalette="success" variant="subtle" size="sm">
          Desparasitado
        </Badge>
      )}
      {paciente.alergias && (
        <Badge
          colorPalette="orange"
          variant="subtle"
          size="sm"
          title={paciente.alergias}
        >
          <AlertTriangle size={12} />
          Alerta médica
        </Badge>
      )}
    </Flex>
  );
}

/** Botones de acción de un paciente, compartidos por la tabla y las tarjetas. */
function AccionesPaciente({
  paciente,
  puedeVerConsultas,
  puedeEditar,
  puedeEliminar,
  onHistorial,
  onEditar,
  onCambiarEstado,
}: {
  paciente: Paciente;
  puedeVerConsultas: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  onHistorial: (paciente: Paciente) => void;
  onEditar: (paciente: Paciente) => void;
  onCambiarEstado: (paciente: Paciente) => void;
}) {
  const detener = (accion: (paciente: Paciente) => void) => (evento: React.MouseEvent) => {
    evento.stopPropagation();
    accion(paciente);
  };

  return (
    <Flex justify="flex-end" gap="0.5">
      {puedeVerConsultas && (
        <IconButton
          type="button"
          size="xs"
          variant="ghost"
          color="ink.500"
          _hover={{ bg: "ink.100", color: "brand.600" }}
          onClick={detener(onHistorial)}
          aria-label={`Ver historial clínico de ${paciente.nombre}`}
          title="Historial clínico"
        >
          <Stethoscope size={16} />
        </IconButton>
      )}
      {puedeEditar && (
        <IconButton
          type="button"
          size="xs"
          variant="ghost"
          color="ink.500"
          _hover={{ bg: "ink.100", color: "brand.600" }}
          onClick={detener(onEditar)}
          aria-label={`Editar ${paciente.nombre}`}
          title="Editar"
        >
          <Pencil size={16} />
        </IconButton>
      )}
      {puedeEliminar && (
        <IconButton
          type="button"
          size="xs"
          variant="ghost"
          color="ink.500"
          _hover={{
            bg: paciente.activo ? "danger.subtle" : "success.subtle",
            color: paciente.activo ? "danger.600" : "success.600",
          }}
          onClick={detener(onCambiarEstado)}
          aria-label={
            paciente.activo
              ? `Desactivar ${paciente.nombre}`
              : `Reactivar ${paciente.nombre}`
          }
          title={paciente.activo ? "Desactivar" : "Reactivar"}
        >
          {paciente.activo ? <Trash2 size={16} /> : <RotateCcw size={16} />}
        </IconButton>
      )}
    </Flex>
  );
}

/** Estado vacío compartido por la vista de tarjetas. */
function SinPacientes({ hayBusqueda, onBorrar }: { hayBusqueda: boolean; onBorrar: () => void }) {
  return (
    <EmptyState.Root py="14">
      <EmptyState.Content>
        <EmptyState.Indicator color="brand.600">
          <PawPrint />
        </EmptyState.Indicator>
        <VStack textAlign="center" gap="1">
          <EmptyState.Title>
            {hayBusqueda ? "Sin resultados" : "Todavía no hay pacientes"}
          </EmptyState.Title>
          <EmptyState.Description maxW="26rem">
            {hayBusqueda
              ? "Probá con otro término o quitá la búsqueda."
              : "Registrá la primera mascota para empezar a crear su ficha clínica."}
          </EmptyState.Description>
        </VStack>
        {hayBusqueda && (
          <Button variant="outline" onClick={onBorrar}>
            Borrar búsqueda
          </Button>
        )}
      </EmptyState.Content>
    </EmptyState.Root>
  );
}

function CargandoTarjetas() {
  return (
    <Grid
      templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }}
      gap="4"
      p="4"
      role="status"
      aria-label="Cargando pacientes"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} h="44" borderRadius="lg" />
      ))}
    </Grid>
  );
}

/* ─────────────────────────────────────── Página ─────────────────────────────────────── */

export function PacientesPage() {
  const { puede } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navegar = useNavigate();
  const [pagina, setPagina] = useState(1);
  const [vista, setVista] = useState<Vista>("tabla");
  const [pacienteCambioEstado, setPacienteCambioEstado] =
    useState<Paciente | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<Paciente | null>(null);
  const [pacientePrecargado, setPacientePrecargado] = useState<Paciente | null>(null);
  const { texto, setTexto, busqueda } = useBusquedaDiferida(
    searchParams.get("busqueda") ?? "",
  );
  const dialogo = useDialogo();
  const abrirPacienteEditar = dialogo.abrirEditar;

  const pacienteDestinoRaw = searchParams.get("pacienteId");
  const pacienteDestinoId =
    pacienteDestinoRaw && /^\d+$/.test(pacienteDestinoRaw)
      ? Number(pacienteDestinoRaw)
      : undefined;
  const consultaPacienteDestino = usePacienteDetalle(
    puede("pacientes.editar") ? pacienteDestinoId : undefined,
  );

  const consulta = usePacientes({ busqueda, pagina, incluirInactivos: true });
  const crear = useCrearPaciente();
  const actualizar = useActualizarPaciente();
  const desactivar = useDesactivarPaciente();
  const reactivar = useReactivarPaciente();
  const pacienteEditando = useMemo(
    () =>
      consulta.data?.items.find((paciente) => paciente.id === dialogo.id) ??
      (pacientePrecargado?.id === dialogo.id ? pacientePrecargado : null),
    [consulta.data, dialogo.id, pacientePrecargado],
  );

  const puedeVerConsultas = puede("consultas.ver");
  const puedeEditar = puede("pacientes.editar");
  const puedeEliminar = puede("pacientes.eliminar");
  const cambiandoEstado = desactivar.isPending || reactivar.isPending;

  useEffect(() => {
    if (!pacienteDestinoId) return;
    if (!puede("pacientes.editar")) {
      setSearchParams((params) => {
        params.delete("pacienteId");
        return params;
      }, { replace: true });
      return;
    }
    if (consultaPacienteDestino.isError) {
      toaster.error({
        title: "No se pudo abrir la ficha del paciente",
        description: mensajeDeError(consultaPacienteDestino.error),
      });
      setSearchParams((params) => {
        params.delete("pacienteId");
        return params;
      }, { replace: true });
      return;
    }
    if (!consultaPacienteDestino.data) return;

    setPacientePrecargado(consultaPacienteDestino.data);
    abrirPacienteEditar(pacienteDestinoId);
    setSearchParams((params) => {
      params.delete("pacienteId");
      return params;
    }, { replace: true });
  }, [
    pacienteDestinoId,
    puede,
    consultaPacienteDestino.data,
    consultaPacienteDestino.error,
    consultaPacienteDestino.isError,
    abrirPacienteEditar,
    setSearchParams,
  ]);

  function alGuardar(valores: PacienteFormValues) {
    if (!valores.clienteId || !valores.especieId) return;
    const datos = {
      clienteId: valores.clienteId,
      especieId: valores.especieId,
      nombre: valores.nombre.trim(),
      raza: valores.raza.trim() || null,
      sexo: valores.sexo || null,
      fechaNacimiento: valores.fechaNacimiento || null,
      edadAnios: valores.edadAnios === "" ? null : Number(valores.edadAnios),
      pesoKg: valores.pesoKg === "" ? null : Number(valores.pesoKg),
      color: valores.color.trim() || null,
      chipId: valores.chipId.trim() || null,
      fotoUrl: valores.fotoUrl || null,
      esterilizado: valores.esterilizado,
      desparasitado: valores.desparasitado,
      alergias: valores.alergias.trim() || null,
      notas: valores.notas.trim() || null,
      activo: valores.activo,
    };
    const esEdicion = dialogo.editando && dialogo.id !== null;
    const mutacion = esEdicion
      ? actualizar.mutateAsync({ id: dialogo.id as number, datos })
      : crear.mutateAsync(datos);

    mutacion
      .then((paciente) => {
        toaster.success({
          title: esEdicion ? "Paciente actualizado" : "Paciente registrado",
          description: paciente.nombre,
        });
        dialogo.cerrar();
        if (!esEdicion) {
          setPagina(1);
        } else if (
          consulta.data &&
          consulta.data.items.length === 1 &&
          pagina > 1
        ) {
          setPagina(pagina - 1);
        }
      })
      .catch((error) => {
        console.error(mensajeDeError(error));
      });
  }

  async function confirmarCambioEstado() {
    if (!pacienteCambioEstado) return;
    try {
      const respuesta = pacienteCambioEstado.activo
        ? await desactivar.mutateAsync(pacienteCambioEstado.id)
        : await reactivar.mutateAsync(pacienteCambioEstado.id);
      toaster.success({
        title: pacienteCambioEstado.activo
          ? "Paciente desactivado"
          : "Paciente reactivado",
        description: respuesta.mensaje,
      });
      if (
        pacienteCambioEstado.activo &&
        consulta.data?.items.length === 1 &&
        pagina > 1
      ) {
        setPagina(pagina - 1);
      }
      setPacienteCambioEstado(null);
    } catch (error) {
      toaster.error({
        title: "No se pudo cambiar el estado",
        description: mensajeDeError(error),
      });
    }
  }

  const columnas = useMemo<ColumnDef<Paciente, unknown>[]>(
    () => [
      {
        accessorKey: "nombre",
        header: "Paciente",
        cell: ({ row }) => (
          <Flex align="center" gap="3" minW="44">
            <AvatarMascota paciente={row.original} size="md" onAmpliar={setFotoAmpliada} />
            <Box minW="0">
              <Text fontWeight="semibold" color="ink.900" truncate>
                {row.original.nombre}
              </Text>
              <Text fontSize="xs" color="ink.500" truncate>
                {especieYRaza(row.original)}
              </Text>
            </Box>
          </Flex>
        ),
      },
      {
        id: "responsable",
        header: "Responsable",
        cell: ({ row }) => {
          const telefono = telefonoResponsable(row.original);
          return (
            <Box>
              <Text fontSize="sm" color="ink.800">
                {responsable(row.original)}
              </Text>
              {telefono && (
                <Text fontSize="xs" color="ink.500">
                  {telefono}
                </Text>
              )}
            </Box>
          );
        },
      },
      {
        id: "datos",
        header: "Ficha",
        cell: ({ row }) => (
          <Box>
            <Text fontSize="sm" color="ink.700">
              {edad(row.original)}
            </Text>
            {row.original.pesoKg ? (
              <Text fontSize="xs" color="ink.500">
                {row.original.pesoKg} kg
              </Text>
            ) : null}
          </Box>
        ),
      },
      {
        id: "salud",
        header: "Salud",
        cell: ({ row }) => (
          <InsigniasSalud
            paciente={row.original}
            vacio={
              <Text fontSize="xs" color="ink.400">
                Sin alertas
              </Text>
            }
          />
        ),
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }) => <BadgeEstado activo={row.original.activo} />,
      },
      {
        id: "acciones",
        header: "",
        meta: { align: "right" },
        enableSorting: false,
        cell: ({ row }) => (
          <AccionesPaciente
            paciente={row.original}
            puedeVerConsultas={puedeVerConsultas}
            puedeEditar={puedeEditar}
            puedeEliminar={puedeEliminar}
            onHistorial={(p) => navegar(`/consultas?pacienteId=${p.id}`)}
            onEditar={(p) => dialogo.abrirEditar(p.id)}
            onCambiarEstado={setPacienteCambioEstado}
          />
        ),
      },
    ],
    // El diálogo se abre por id y las funciones del hook cambian entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navegar, puedeVerConsultas, puedeEditar, puedeEliminar],
  );

  const hayBusqueda = busqueda.trim().length > 0;
  const cargando = consulta.isLoading || consulta.isFetching;

  const accionesListado = (
    <Flex w="full" gap="3" align={{ base: "stretch", lg: "center" }} wrap="wrap">
      <Box position="relative" flex="1" minW={{ base: "full", lg: "24rem" }}>
        <Box
          position="absolute"
          left="3"
          top="50%"
          transform="translateY(-50%)"
          color="ink.400"
          pointerEvents="none"
          zIndex="1"
        >
          <Search size={16} />
        </Box>
        <Input
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setPagina(1);
          }}
          placeholder="Buscar mascota, especie, raza, responsable o microchip…"
          aria-label="Buscar pacientes"
          ps="9"
          pe={texto ? "9" : "3"}
          bg="white"
        />
        {texto && (
          <IconButton
            type="button"
            size="2xs"
            variant="ghost"
            position="absolute"
            right="2"
            top="50%"
            transform="translateY(-50%)"
            borderRadius="full"
            onClick={() => {
              setTexto("");
              setPagina(1);
            }}
            aria-label="Borrar búsqueda"
          >
            <X size={14} />
          </IconButton>
        )}
      </Box>

      <SegmentGroup.Root
        value={vista}
        onValueChange={({ value }) => value && setVista(value as Vista)}
        size="sm"
        w={{ base: "full", lg: "auto" }}
      >
        <SegmentGroup.Indicator />
        <SegmentGroup.Items
          items={[
            {
              value: "tabla",
              label: (
                <Flex align="center" gap="1.5">
                  <Table2 size={15} /> Tabla
                </Flex>
              ),
            },
            {
              value: "tarjetas",
              label: (
                <Flex align="center" gap="1.5">
                  <LayoutGrid size={15} /> Tarjetas
                </Flex>
              ),
            },
          ]}
        />
      </SegmentGroup.Root>
    </Flex>
  );

  return (
    <Box>
      <PageHeader
        titulo="Pacientes"
        descripcion="Fichas de tus pacientes, con foto, responsable y alertas de salud."
        acciones={
          puede("pacientes.crear") ? (
            <Button colorPalette="brand" onClick={dialogo.abrirCrear}>
              <UserPlus size={17} /> Nuevo paciente
            </Button>
          ) : null
        }
      />

      <Panel flush>
        {vista === "tabla" ? (
          <DataTable
            data={consulta.data?.items ?? []}
            columns={columnas}
            cargando={cargando}
            claveFila={(fila) => fila.id}
            hayBusqueda={hayBusqueda}
            vacioTitulo="Todavía no hay pacientes"
            vacioDetalle="Registrá la primera mascota para empezar a crear su ficha clínica."
            onFilaClick={(fila) =>
              puedeEditar ? dialogo.abrirEditar(fila.id) : undefined
            }
            acciones={accionesListado}
          />
        ) : (
          <>
            <Flex p="4" borderBottomWidth="1px" borderColor="ink.200">
              {accionesListado}
            </Flex>

            {cargando ? (
              <CargandoTarjetas />
            ) : (consulta.data?.items.length ?? 0) === 0 ? (
              <SinPacientes
                hayBusqueda={hayBusqueda}
                onBorrar={() => {
                  setTexto("");
                  setPagina(1);
                }}
              />
            ) : (
              <Grid
                templateColumns={{
                  base: "1fr",
                  md: "repeat(2, 1fr)",
                  xl: "repeat(3, 1fr)",
                }}
                gap="4"
                p="4"
              >
                {consulta.data?.items.map((paciente) => {
                  const telefono = telefonoResponsable(paciente);
                  const hayAcciones = puedeEditar || puedeEliminar || puedeVerConsultas;
                  return (
                    <Card.Root
                      key={paciente.id}
                      variant="outline"
                      opacity={paciente.activo ? 1 : 0.75}
                      transition="border-color 0.15s ease, box-shadow 0.15s ease"
                      _hover={{ borderColor: "brand.300", boxShadow: "sm" }}
                      cursor={puedeEditar ? "pointer" : "default"}
                      onClick={() => puedeEditar && dialogo.abrirEditar(paciente.id)}
                    >
                      <Card.Body gap="3" p="4">
                        <Flex align="center" gap="3">
                          <AvatarMascota paciente={paciente} size="lg" onAmpliar={setFotoAmpliada} />
                          <Box minW="0" flex="1">
                            <Text fontWeight="semibold" color="ink.900" truncate>
                              {paciente.nombre}
                            </Text>
                            <Text fontSize="sm" color="ink.600" truncate>
                              {especieYRaza(paciente)}
                            </Text>
                          </Box>
                          <BadgeEstado activo={paciente.activo} />
                        </Flex>

                        <Grid templateColumns="auto 1fr" columnGap="3" rowGap="1.5" fontSize="sm">
                          <Text color="ink.500">Responsable</Text>
                          <Text color="ink.800" truncate>
                            {responsable(paciente)}
                            {telefono && (
                              <chakra.span color="ink.500"> · {telefono}</chakra.span>
                            )}
                          </Text>

                          <Text color="ink.500">Edad</Text>
                          <Text color="ink.800">{edad(paciente)}</Text>

                          {paciente.pesoKg ? (
                            <>
                              <Text color="ink.500">Peso</Text>
                              <Text color="ink.800">{paciente.pesoKg} kg</Text>
                            </>
                          ) : null}

                          {paciente.chipId ? (
                            <>
                              <Text color="ink.500">Microchip</Text>
                              <Text color="ink.800" truncate>
                                {paciente.chipId}
                              </Text>
                            </>
                          ) : null}
                        </Grid>

                        <InsigniasSalud paciente={paciente} />
                      </Card.Body>

                      {hayAcciones && (
                        <Card.Footer
                          px="4"
                          py="2"
                          borderTopWidth="1px"
                          borderColor="ink.100"
                          justifyContent="flex-end"
                        >
                          <AccionesPaciente
                            paciente={paciente}
                            puedeVerConsultas={puedeVerConsultas}
                            puedeEditar={puedeEditar}
                            puedeEliminar={puedeEliminar}
                            onHistorial={(p) => navegar(`/consultas?pacienteId=${p.id}`)}
                            onEditar={(p) => dialogo.abrirEditar(p.id)}
                            onCambiarEstado={setPacienteCambioEstado}
                          />
                        </Card.Footer>
                      )}
                    </Card.Root>
                  );
                })}
              </Grid>
            )}
          </>
        )}

        {consulta.data && (
          <Paginacion
            pagina={pagina}
            totalPaginas={consulta.data.totalPaginas}
            total={consulta.data.total}
            porPagina={PACIENTES_POR_PAGINA}
            onCambioPagina={setPagina}
            singular="paciente"
            plural="pacientes"
          />
        )}
      </Panel>

      <FormDialog
        abierto={dialogo.abierto}
        onClose={dialogo.cerrar}
        titulo={dialogo.editando ? "Editar paciente" : "Nuevo paciente"}
        descripcion={
          dialogo.editando
            ? "Actualizá la ficha. El historial clínico se conserva."
            : "Completá los datos esenciales para identificar y cuidar a tu paciente."
        }
        textoConfirmar={
          dialogo.editando ? "Guardar cambios" : "Registrar paciente"
        }
        guardando={crear.isPending || actualizar.isPending}
        bloquearCierre={crear.isPending || actualizar.isPending}
        onConfirmar={() =>
          document
            .querySelector<HTMLFormElement>("#paciente-form")
            ?.requestSubmit()
        }
        ancho="xl"
      >
        <PacienteForm
          paciente={pacienteEditando}
          onGuardar={alGuardar}
          errorGeneral={
            crear.isError || actualizar.isError
              ? mensajeDeError(crear.error ?? actualizar.error)
              : null
          }
        />
      </FormDialog>

      {/* ── Confirmar activar / desactivar ───────────────────────────── */}
      <DialogRoot
        open={pacienteCambioEstado !== null}
        onOpenChange={({ open }) => {
          if (!open && !cambiandoEstado) setPacienteCambioEstado(null);
        }}
        closeOnEscape={!cambiandoEstado}
        closeOnInteractOutside={!cambiandoEstado}
        size="sm"
      >
        <DialogContent>
          <DialogHeader>
            <Flex align="center" gap="3">
              <Flex
                align="center"
                justify="center"
                w="11"
                h="11"
                borderRadius="full"
                flexShrink={0}
                bg={pacienteCambioEstado?.activo ? "red.50" : "green.50"}
                color={pacienteCambioEstado?.activo ? "red.600" : "green.600"}
              >
                {pacienteCambioEstado?.activo ? (
                  <AlertTriangle size={22} />
                ) : (
                  <CheckCircle2 size={22} />
                )}
              </Flex>
              <DialogTitle fontSize="lg" fontWeight="bold" color="ink.900">
                {pacienteCambioEstado?.activo
                  ? "Desactivar paciente"
                  : "Reactivar paciente"}
              </DialogTitle>
            </Flex>
          </DialogHeader>
          <DialogBody>
            {pacienteCambioEstado && (
              <Flex
                align="center"
                gap="3"
                p="3"
                mb="4"
                bg="ink.50"
                borderWidth="1px"
                borderColor="ink.200"
                borderRadius="lg"
              >
                <AvatarMascota paciente={pacienteCambioEstado} size="md" />
                <Box minW="0">
                  <Text fontWeight="semibold" color="ink.900" truncate>
                    {pacienteCambioEstado.nombre}
                  </Text>
                  <Text fontSize="xs" color="ink.600" truncate>
                    {especieYRaza(pacienteCambioEstado)} · {responsable(pacienteCambioEstado)}
                  </Text>
                </Box>
              </Flex>
            )}
            <DialogDescription color="ink.700" fontSize="sm" lineHeight="1.6">
              {pacienteCambioEstado?.activo
                ? "Dejará de aparecer en los listados habituales, pero su historial clínico se conservará y podrás reactivarlo cuando quieras."
                : "Volverá a aparecer en los listados habituales y podrá seleccionarse en las operaciones de la veterinaria."}
            </DialogDescription>
          </DialogBody>
          <DialogFooter gap="2">
            <Button
              variant="ghost"
              disabled={cambiandoEstado}
              onClick={() => setPacienteCambioEstado(null)}
            >
              Cancelar
            </Button>
            <Button
              colorPalette={pacienteCambioEstado?.activo ? "red" : "success"}
              loading={cambiandoEstado}
              loadingText={
                pacienteCambioEstado?.activo ? "Desactivando…" : "Reactivando…"
              }
              onClick={() => void confirmarCambioEstado()}
            >
              {pacienteCambioEstado?.activo ? "Desactivar" : "Reactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      {/* ── Foto ampliada ────────────────────────────────────────────── */}
      <DialogRoot
        open={fotoAmpliada !== null}
        onOpenChange={({ open }) => {
          if (!open) setFotoAmpliada(null);
        }}
        size="xl"
      >
        <DialogContent maxW="min(92vw, 56rem)" p="4">
          <DialogHeader>
            <Flex align="center" gap="3">
              {fotoAmpliada && <AvatarMascota paciente={fotoAmpliada} size="sm" />}
              <Box minW="0">
                <DialogTitle truncate>{fotoAmpliada?.nombre}</DialogTitle>
                {fotoAmpliada && (
                  <Text fontSize="xs" color="ink.500" truncate>
                    {especieYRaza(fotoAmpliada)}
                  </Text>
                )}
              </Box>
            </Flex>
          </DialogHeader>
          <DialogBody>
            {fotoAmpliada?.fotoUrl && (
              <chakra.img
                src={urlFotoPaciente(fotoAmpliada.fotoUrl)}
                alt={`Foto ampliada de ${fotoAmpliada.nombre}`}
                w="full"
                maxH="75vh"
                objectFit="contain"
                borderRadius="md"
              />
            )}
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </Box>
  );
}