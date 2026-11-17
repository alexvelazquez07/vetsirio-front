import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  NativeSelect,
  Spinner,
  Tabs,
  Text,
  chakra,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Clock,
  KeyRound,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import {
  errorDeCampo,
  mensajeDeError,
  useDialogo,
} from "@/features/clients/clients.service";
import {
  POR_PAGINA,
  useActualizarUsuario,
  useCrearUsuario,
  useDesactivarUsuario,
  usePersonal,
  usePersonalDetalle,
  useReactivarUsuario,
  useRolesPersonal,
} from "./personal.service";
import {
  UsuarioForm,
  type UsuarioFormValues,
} from "./UsuarioForm";
import { COLOR_ROL, nombreRol } from "./personal.utils";
import {
  capitalizar,
  formatFechaHora,
  formatTelefono,
  formatTiempoRelativo,
  iniciales,
} from "@/lib/formato";
import type { RolPersonal, UsuarioPersonal } from "@/types/dominio";

type Vista = "equipo" | "roles";

export function PersonalPage() {
  const { puede, usuario: usuarioActual } = useAuth();
  const [vista, setVista] = useState<Vista>("equipo");
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [rolFiltro, setRolFiltro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [usuarioEstado, setUsuarioEstado] = useState<UsuarioPersonal | null>(
    null,
  );
  const { texto, setTexto, busqueda } = useBusquedaDiferida();

  const dialogo = useDialogo();

  const consulta = usePersonal({
    busqueda,
    pagina,
    incluirInactivos,
    rolId: rolFiltro ? Number(rolFiltro) : undefined,
  });
  const roles = useRolesPersonal();
  const detalle = usePersonalDetalle(
    dialogo.editando ? (dialogo.id ?? undefined) : undefined,
  );
  const crear = useCrearUsuario();
  const actualizar = useActualizarUsuario();
  const desactivar = useDesactivarUsuario();
  const reactivar = useReactivarUsuario();

  const usuarioEnListado = useMemo<UsuarioPersonal | null>(() => {
    if (!dialogo.editando) return null;
    return consulta.data?.items.find((item) => item.id === dialogo.id) ?? null;
  }, [dialogo.editando, dialogo.id, consulta.data]);
  const usuarioEditando = detalle.data ?? usuarioEnListado;

  const guardando = crear.isPending || actualizar.isPending;
  const errorMutation = crear.error ?? actualizar.error;
  const erroresServidor = obtenerErroresUsuario(errorMutation);
  const detallesServidor = obtenerDetallesError(errorMutation, erroresServidor);

  function alGuardar(valores: UsuarioFormValues) {
    const esEdicion = dialogo.modo === "editar";
    const datos = {
      ...valores,
      cedula: valores.cedula?.trim() || null,
      telefono: valores.telefono?.trim() || null,
      especialidad: valores.especialidad?.trim() || null,
      registroProfesional: valores.registroProfesional?.trim() || null,
      colorAgenda: valores.colorAgenda?.trim() || null,
      horarioInicio: valores.horarioInicio?.trim() || null,
      horarioFin: valores.horarioFin?.trim() || null,
    };

    const mutacion =
      dialogo.estado.modo === "editar"
        ? actualizar.mutateAsync({ id: dialogo.estado.id, datos })
        : crear.mutateAsync(datos);

    mutacion
      .then((usuario) => {
        toaster.success({
          title: esEdicion ? "Integrante actualizado" : "Integrante agregado",
          description: `${usuario.nombreCompleto} · ${nombreRol(usuario.rol.nombre)}`,
        });
        dialogo.cerrar();
        if (!esEdicion) setPagina(1);
      })
      .catch((error) => {
        console.error(mensajeDeError(error));
      });
  }

  function cambiarEstado(usuario: UsuarioPersonal) {
    const accion = usuario.activo ? desactivar : reactivar;

    accion
      .mutateAsync(usuario.id)
      .then((respuesta) => {
        toaster.success({
          title: usuario.activo ? "Integrante desactivado" : "Integrante reactivado",
          description: respuesta.mensaje,
        });
        setUsuarioEstado(null);
      })
      .catch((error) => {
        toaster.error({
          title: "No se pudo cambiar el estado",
          description: mensajeDeError(error),
        });
      });
  }

  const columnas = useMemo<ColumnDef<UsuarioPersonal, unknown>[]>(
    () => [
      {
        accessorKey: "nombre",
        header: "Integrante",
        cell: ({ row }) => (
          <Flex align="center" gap="3" minW="0">
            <Flex
              align="center"
              justify="center"
              w="9"
              h="9"
              borderRadius="full"
              bg={row.original.activo ? "brand.subtle" : "ink.100"}
              color={row.original.activo ? "brand.fg" : "ink.500"}
              fontSize="xs"
              fontWeight="bold"
              flexShrink={0}
            >
              {iniciales(row.original.nombreCompleto)}
            </Flex>
            <Box minW="0">
              <chakra.span fontWeight="semibold" color="ink.900" display="block">
                {row.original.nombreCompleto}
              </chakra.span>
              <chakra.span fontSize="xs" color="ink.500" display="block">
                {row.original.email}
              </chakra.span>
            </Box>
          </Flex>
        ),
      },
      {
        accessorKey: "rol",
        header: "Rol",
        cell: ({ row }) => (
          <Box>
            <Badge
              colorPalette={COLOR_ROL[row.original.rol.nombre] ?? "gray"}
              variant="subtle"
              size="sm"
            >
              {nombreRol(row.original.rol.nombre)}
            </Badge>
            {row.original.especialidad && (
              <chakra.span display="block" fontSize="xs" color="ink.500" mt="1">
                {row.original.especialidad}
              </chakra.span>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "telefono",
        header: "Contacto",
        cell: ({ row }) => (
          <Box>
            <chakra.span fontSize="sm" color="ink.700">
              {formatTelefono(row.original.telefono) || "—"}
            </chakra.span>
            {row.original.cedula && (
              <chakra.span display="block" fontSize="xs" color="ink.500">
                CI {row.original.cedula}
              </chakra.span>
            )}
          </Box>
        ),
      },
      {
        id: "horario",
        header: "Horario",
        cell: ({ row }) =>
          row.original.horarioInicio && row.original.horarioFin ? (
            <chakra.span
              fontSize="sm"
              color="ink.700"
              fontVariantNumeric="tabular-nums"
            >
              {row.original.horarioInicio}–{row.original.horarioFin}
            </chakra.span>
          ) : (
            <chakra.span fontSize="sm" color="ink.400">
              Sin horario
            </chakra.span>
          ),
      },
      {
        accessorKey: "ultimoAcceso",
        header: "Último acceso",
        cell: ({ row }) =>
          row.original.ultimoAcceso ? (
            <Box>
              <chakra.span display="block" fontSize="sm" color="ink.700">
                {formatTiempoRelativo(row.original.ultimoAcceso)}
              </chakra.span>
              <chakra.span display="block" fontSize="xs" color="ink.500">
                {formatFechaHora(row.original.ultimoAcceso)}
              </chakra.span>
            </Box>
          ) : (
            <chakra.span fontSize="sm" color="ink.400">
              Nunca ingresó
            </chakra.span>
          ),
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }) =>
          row.original.activo ? (
            <Badge colorPalette="success" variant="solid" size="sm">
              Activo
            </Badge>
          ) : (
            <Badge colorPalette="red" variant="solid" size="sm">
              Inactivo
            </Badge>
          ),
      },
      {
        id: "acciones",
        header: "",
        meta: { align: "right" },
        enableSorting: false,
        cell: ({ row }) => {
          const esUnoMismo = row.original.id === usuarioActual?.id;

          return (
            <Flex justify="flex-end" gap="1">
              {puede("usuarios.editar") && (
                <chakra.button
                  type="button"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    dialogo.abrirEditar(row.original.id);
                  }}
                  p="1.5"
                  borderRadius="md"
                  color="ink.500"
                  _hover={{ bg: "ink.100", color: "brand.600" }}
                  aria-label={`Editar ${row.original.nombreCompleto}`}
                  title="Editar"
                >
                  <Pencil size={16} />
                </chakra.button>
              )}

              {!esUnoMismo &&
                (row.original.activo
                  ? puede("usuarios.eliminar")
                  : puede("usuarios.editar")) && (
                  <chakra.button
                    type="button"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setUsuarioEstado(row.original);
                    }}
                    p="1.5"
                    borderRadius="md"
                    color="ink.500"
                    _hover={{
                      bg: row.original.activo ? "danger.subtle" : "success.subtle",
                      color: row.original.activo ? "danger.600" : "success.600",
                    }}
                    aria-label={
                      row.original.activo
                        ? "Desactivar integrante"
                        : "Reactivar integrante"
                    }
                    title={row.original.activo ? "Desactivar" : "Reactivar"}
                  >
                    {row.original.activo ? (
                      <Trash2 size={16} />
                    ) : (
                      <RotateCcw size={16} />
                    )}
                  </chakra.button>
                )}
            </Flex>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puede, usuarioActual?.id],
  );

  const accionesListado = (
    <Flex
      w="full"
      gap="3"
      align={{ base: "stretch", lg: "center" }}
      wrap="wrap"
    >
      <Flex position="relative" flex="1" minW={{ base: "full", lg: "22rem" }}>
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
          value={texto}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setTexto(e.target.value);
            setPagina(1);
          }}
          placeholder="Buscar por nombre, correo, cédula…"
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

      <NativeSelect.Root size="sm" w={{ base: "full", sm: "12rem" }}>
        <NativeSelect.Field
          value={rolFiltro}
          onChange={(evento) => {
            setRolFiltro(evento.target.value);
            setPagina(1);
          }}
          aria-label="Filtrar por rol"
        >
          <option value="">Todos los roles</option>
          {(roles.data ?? []).map((rol) => (
            <option key={rol.id} value={rol.id}>
              {nombreRol(rol.nombre)}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>

      <Button
        variant={incluirInactivos ? "subtle" : "outline"}
        size="sm"
        colorPalette={incluirInactivos ? "brand" : "gray"}
        flex={{ base: "1", lg: "initial" }}
        onClick={() => {
          setIncluirInactivos((previo) => !previo);
          setPagina(1);
        }}
      >
        {incluirInactivos ? "Inactivos incluidos" : "Ver inactivos"}
      </Button>
    </Flex>
  );

  return (
    <Box>
      <PageHeader
        titulo="Personal"
        descripcion="Usuarios, roles y permisos del equipo de la veterinaria."
        acciones={
          vista === "equipo" && puede("usuarios.crear") ? (
            <Button colorPalette="brand" onClick={dialogo.abrirCrear}>
              <Flex align="center" gap="2">
                <UserPlus size={17} />
                <chakra.span>Nuevo integrante</chakra.span>
              </Flex>
            </Button>
          ) : null
        }
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
              <Tabs.Trigger value="equipo">Equipo</Tabs.Trigger>
              <Tabs.Trigger value="roles">Roles y permisos</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </Box>

        {vista === "equipo" ? (
          <>
            <DataTable
              data={consulta.data?.items ?? []}
              columns={columnas}
              cargando={consulta.isLoading || consulta.isFetching}
              claveFila={(fila) => fila.id}
              hayBusqueda={
                busqueda.trim().length > 0 ||
                incluirInactivos ||
                rolFiltro !== ""
              }
              vacioTitulo="Todavía no hay integrantes"
              vacioDetalle="Agregá a tu equipo para que cada uno acceda con su propio correo y rol."
              onFilaClick={(fila) =>
                puede("usuarios.editar")
                  ? dialogo.abrirEditar(fila.id)
                  : undefined
              }
              acciones={accionesListado}
            />

            {consulta.data && (
              <Paginacion
                pagina={pagina}
                totalPaginas={consulta.data.totalPaginas}
                total={consulta.data.total}
                porPagina={POR_PAGINA}
                onCambioPagina={setPagina}
                singular="integrante"
                plural="integrantes"
              />
            )}
          </>
        ) : (
          <RolesYPermisos roles={roles.data ?? []} cargando={roles.isLoading} />
        )}
      </Panel>

      <FormDialog
        abierto={dialogo.abierto}
        onClose={dialogo.cerrar}
        titulo={dialogo.editando ? "Editar integrante" : "Nuevo integrante"}
        descripcion={
          dialogo.editando
            ? "Actualizá sus datos, su rol o restablecé su contraseña."
            : "Creá una cuenta para que pueda ingresar con su correo."
        }
        textoConfirmar={dialogo.editando ? "Guardar cambios" : "Agregar integrante"}
        guardando={guardando}
        onConfirmar={() => {
          document
            .querySelector<HTMLFormElement>("#usuario-form")
            ?.requestSubmit();
        }}
        bloquearCierre={guardando}
        ancho="xl"
      >
        {dialogo.editando && detalle.isLoading ? (
          <Flex align="center" justify="center" gap="3" py="10">
            <Spinner size="sm" color="brand.500" />
            <Text fontSize="sm" color="ink.500">
              Cargando datos del integrante…
            </Text>
          </Flex>
        ) : dialogo.editando && detalle.isError ? (
          <Text role="alert" color="danger.600" fontSize="sm">
            No se pudieron cargar sus datos: {mensajeDeError(detalle.error)}
          </Text>
        ) : (
          <UsuarioForm
            usuario={usuarioEditando}
            roles={roles.data ?? []}
            onGuardar={alGuardar}
            errorGeneral={
              crear.isError || actualizar.isError
                ? mensajeDeError(crear.error ?? actualizar.error)
                : null
            }
            erroresServidor={erroresServidor}
            detallesServidor={detallesServidor}
          />
        )}
      </FormDialog>

      <Dialog.Root
        open={usuarioEstado !== null}
        onOpenChange={(detalleDialogo) => {
          if (!detalleDialogo.open) setUsuarioEstado(null);
        }}
        role="alertdialog"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="lg">
            <Dialog.Header>
              <Dialog.Title>
                {usuarioEstado?.activo
                  ? "Desactivar integrante"
                  : "Reactivar integrante"}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text fontSize="sm" color="ink.700">
                {usuarioEstado?.activo
                  ? `${usuarioEstado.nombreCompleto} va a dejar de poder ingresar y se cerrarán sus sesiones abiertas. Sus registros históricos se conservan.`
                  : `${usuarioEstado?.nombreCompleto ?? "El integrante"} va a poder volver a ingresar con su correo y rol actual.`}
              </Text>
            </Dialog.Body>
            <Dialog.Footer gap="2">
              <Button
                variant="ghost"
                onClick={() => setUsuarioEstado(null)}
                disabled={desactivar.isPending || reactivar.isPending}
              >
                Cancelar
              </Button>
              <Button
                colorPalette={usuarioEstado?.activo ? "red" : "brand"}
                loading={desactivar.isPending || reactivar.isPending}
                onClick={() => {
                  if (usuarioEstado) cambiarEstado(usuarioEstado);
                }}
              >
                {usuarioEstado?.activo ? "Desactivar" : "Reactivar"}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
}

function RolesYPermisos({
  roles,
  cargando,
}: {
  roles: RolPersonal[];
  cargando: boolean;
}) {
  if (cargando) {
    return (
      <Flex align="center" justify="center" py="16" direction="column" gap="3">
        <Spinner size="lg" color="brand.500" />
        <Text fontSize="sm" color="ink.500">
          Cargando roles y permisos…
        </Text>
      </Flex>
    );
  }

  return (
    <Box p={{ base: "4", md: "5" }}>
      <Alert status="info" rounded="md" mb="5" title="Roles definidos por VetSirio">
        Los roles y sus permisos son parte de la configuración de la plataforma.
        Podés asignar un rol a cada integrante desde la pestaña Equipo.
      </Alert>

      <Grid
        templateColumns={{
          base: "minmax(0, 1fr)",
          lg: "repeat(2, minmax(0, 1fr))",
        }}
        gap="4"
      >
        {roles.map((rol) => {
          const permisosPorModulo = agruparPermisos(rol);

          return (
            <Box
              key={rol.id}
              borderWidth="1px"
              borderColor="ink.200"
              borderRadius="lg"
              bg="white"
              overflow="hidden"
            >
              <Flex
                align="flex-start"
                justify="space-between"
                gap="3"
                p="4"
                borderBottomWidth="1px"
                borderColor="ink.100"
                bg="ink.50"
              >
                <Box minW="0">
                  <Flex align="center" gap="2" wrap="wrap">
                    <Badge
                      colorPalette={COLOR_ROL[rol.nombre] ?? "gray"}
                      variant="solid"
                      size="sm"
                    >
                      {nombreRol(rol.nombre)}
                    </Badge>
                    <Flex align="center" gap="1" color="ink.500" fontSize="xs">
                      <Users size={13} />
                      {rol.usuarios} {rol.usuarios === 1 ? "integrante" : "integrantes"}
                    </Flex>
                  </Flex>
                  {rol.descripcion && (
                    <Text fontSize="sm" color="ink.600" mt="1.5" lineHeight="1.5">
                      {rol.descripcion}
                    </Text>
                  )}
                </Box>
                <Flex
                  align="center"
                  justify="center"
                  w="9"
                  h="9"
                  borderRadius="full"
                  bg="brand.subtle"
                  color="brand.fg"
                  flexShrink={0}
                >
                  <ShieldCheck size={18} />
                </Flex>
              </Flex>

              <Box p="4" maxH="18rem" overflowY="auto">
                {rol.permisos.length === 0 ? (
                  <Text fontSize="sm" color="ink.500">
                    Este rol todavía no tiene permisos asignados.
                  </Text>
                ) : (
                  <Flex direction="column" gap="3">
                    {[...permisosPorModulo.entries()].map(([modulo, permisos]) => (
                      <Box key={modulo}>
                        <Flex align="center" gap="2" mb="1.5">
                          <KeyRound size={13} color="var(--chakra-colors-ink-400)" />
                          <Text
                            fontSize="xs"
                            fontWeight="bold"
                            textTransform="uppercase"
                            letterSpacing="0.04em"
                            color="ink.500"
                          >
                            {capitalizar(modulo)}
                          </Text>
                        </Flex>
                        <Flex gap="1.5" wrap="wrap">
                          {permisos.map((permiso) => (
                            <Badge
                              key={permiso.clave}
                              colorPalette="gray"
                              variant="subtle"
                              size="sm"
                              title={permiso.descripcion ?? permiso.clave}
                            >
                              {permiso.descripcion ?? permiso.clave}
                            </Badge>
                          ))}
                        </Flex>
                      </Box>
                    ))}
                  </Flex>
                )}
              </Box>
            </Box>
          );
        })}
      </Grid>

      <Flex align="center" gap="2" mt="5" color="ink.500">
        <Clock size={14} />
        <Text fontSize="xs">
          Los cambios en los permisos se aplican la próxima vez que el integrante
          inicia sesión o actualiza la página.
        </Text>
      </Flex>
    </Box>
  );
}

function agruparPermisos(rol: RolPersonal) {
  const grupos = new Map<string, RolPersonal["permisos"]>();

  for (const permiso of rol.permisos) {
    const grupo = grupos.get(permiso.modulo) ?? [];
    grupo.push(permiso);
    grupos.set(permiso.modulo, grupo);
  }

  return grupos;
}

function obtenerDetallesError(
  error: unknown,
  erroresCampos: Partial<Record<keyof UsuarioFormValues, string>>,
): string[] | undefined {
  if (!error || typeof error !== "object") return undefined;

  const errores = (error as { errors?: Record<string, string[]> }).errors;
  if (!errores) return undefined;

  const erroresMostrados = new Set(Object.values(erroresCampos));
  return Object.values(errores)
    .flat()
    .filter((detalle) => !erroresMostrados.has(detalle));
}

function obtenerErroresUsuario(
  error: unknown,
): Partial<Record<keyof UsuarioFormValues, string>> {
  const campos: (keyof UsuarioFormValues)[] = [
    "nombre",
    "apellido",
    "email",
    "rolId",
    "cedula",
    "telefono",
    "especialidad",
    "registroProfesional",
    "colorAgenda",
    "horarioInicio",
    "horarioFin",
    "diasTrabajo",
    "debeCambiarPassword",
    "password",
  ];

  return campos.reduce<Partial<Record<keyof UsuarioFormValues, string>>>(
    (errores, campo) => {
      const mensaje = errorDeCampo(error, campo);
      if (mensaje) errores[campo] = mensaje;
      return errores;
    },
    {},
  );
}
