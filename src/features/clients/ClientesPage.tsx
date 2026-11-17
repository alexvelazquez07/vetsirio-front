import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Spinner,
  Text,
  chakra,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  LayoutGrid,
  MapPin,
  Pencil,
  PawPrint,
  Phone,
  RotateCcw,
  Table2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

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
import {
  mensajeDeError,
  POR_PAGINA,
  useActualizarCliente,
  useClientes,
  useCrearCliente,
  useDesactivarCliente,
  useDialogo,
  obtenerClientesParaExportar,
  useReactivarCliente,
} from "./clients.service";
import {
  descargarClientesExcel,
  descargarClientesPdf,
} from "./clientes.export";
import { ClienteForm, type ClienteFormValues } from "./ClienteForm";
import type { Cliente } from "@/types/dominio";

export function ClientesPage() {
  const { puede } = useAuth();

  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [clienteCambioEstado, setClienteCambioEstado] =
    useState<Cliente | null>(null);
  const [vista, setVista] = useState<"tabla" | "tarjetas">("tabla");
  const { texto, setTexto, busqueda } = useBusquedaDiferida();

  const dialogo = useDialogo();

  const consulta = useClientes({ busqueda, pagina, incluirInactivos: true });
  const crear = useCrearCliente();
  const actualizar = useActualizarCliente();
  const desactivar = useDesactivarCliente();
  const reactivar = useReactivarCliente();

  const clienteEditando = useMemo<Cliente | null>(() => {
    if (!dialogo.editando) return null;
    return consulta.data?.items.find((item) => item.id === dialogo.id) ?? null;
  }, [dialogo.editando, dialogo.id, consulta.data]);

  function alGuardar(valores: ClienteFormValues) {
    const datos = {
      ...valores,
      // Los tres documentos van limpios. El backend también los normaliza,
      // pero mandarlos ya limpios evita que dos RUC que sólo difieren en los
      // guiones se traten como distintos en el mensaje de duplicado.
      cedula: valores.cedula.trim() || undefined,
      ruc: valores.ruc.trim() || undefined,
      pasaporte: valores.pasaporte.trim() || undefined,
      email: valores.email.trim() || undefined,
      telefono: valores.telefono || undefined,
      whatsapp: valores.whatsapp || undefined,
      direccion: valores.direccion || undefined,
      departamento: valores.departamento || undefined,
      ciudad: valores.ciudad || undefined,
      barrio: valores.barrio || undefined,
      notas: valores.notas || undefined,
      nombres: valores.nombres || undefined,
      apellidos: valores.apellidos || undefined,
      razonSocial: valores.razonSocial || undefined,
    };

    const esEdicion = dialogo.editando && dialogo.id !== null;

    const mutacion = esEdicion
      ? actualizar.mutateAsync({ id: dialogo.id as number, datos })
      : crear.mutateAsync(datos);

    mutacion
      .then((cliente) => {
        toaster.success({
          title: esEdicion ? "Cliente actualizado" : "Cliente registrado",
          description: cliente.nombreCompleto,
        });

        dialogo.cerrar();
        if (!esEdicion) setPagina(1);

        // SiVEN la página quedó vacía tras filtrar y borramos el último
        // elemento de la última página, hay que volver atrás: si no, el
        // usuario ve una lista vacía sin saber por qué.
        if (
          esEdicion &&
          consulta.data &&
          consulta.data.items.length === 1 &&
          pagina > 1
        ) {
          setPagina(pagina - 1);
        }
      })
      .catch((error) => {
        // El error se muestra adentro del diálogo; acá sólo se evita que
        // quede flotando como un toast que tapa el formulario.
        console.error(mensajeDeError(error));
      });
  }

  async function confirmarCambioEstado() {
    if (!clienteCambioEstado) return;

    try {
      const respuesta = clienteCambioEstado.activo
        ? await desactivar.mutateAsync(clienteCambioEstado.id)
        : await reactivar.mutateAsync(clienteCambioEstado.id);

      toaster.success({
        title: clienteCambioEstado.activo
          ? "Cliente desactivado"
          : "Cliente reactivado",
        description: respuesta.mensaje,
      });
      setClienteCambioEstado(null);
    } catch (error) {
      toaster.error({
        title: "No se pudo cambiar el estado",
        description: mensajeDeError(error),
      });
    }
  }

  async function exportarClientes(formato: "excel" | "pdf") {
    setExportando(formato);

    try {
      const clientes = await obtenerClientesParaExportar(busqueda);

      if (formato === "excel") {
        descargarClientesExcel(clientes);
      } else {
        descargarClientesPdf(clientes, busqueda);
      }

      toaster.success({
        title: `Archivo ${formato === "excel" ? "Excel" : "PDF"} descargado`,
        description: `Se exportaron ${clientes.length} clientes.`,
      });
    } catch (error) {
      toaster.error({
        title: "No se pudo exportar la lista",
        description: mensajeDeError(error),
      });
    } finally {
      setExportando(null);
    }
  }

  const columnas = useMemo<ColumnDef<Cliente, unknown>[]>(
    () => [
      {
        accessorKey: "nombreCompleto",
        header: "Cliente",
        cell: ({ row }) => (
          <Box>
            <chakra.span fontWeight="semibold" color="ink.900">
              {row.original.nombreCompleto}
            </chakra.span>
            <chakra.span
              display="block"
              fontSize="xs"
              color="ink.500"
              fontVariantNumeric="tabular-nums"
            >
              {row.original.tipoDocumento === "ruc" ? "RUC" : "Cédula"}{" "}
              {row.original.documento}
            </chakra.span>
          </Box>
        ),
      },
      {
        accessorKey: "telefono",
        header: "Teléfono",
        cell: ({ row }) => (
          <Flex align="center" gap="1.5" color="ink.700">
            <Phone size={13} color="var(--chakra-colors-ink-400)" />
            <chakra.span fontVariantNumeric="tabular-nums" fontSize="sm">
              {row.original.telefono ?? row.original.whatsapp ?? "—"}
            </chakra.span>
          </Flex>
        ),
      },
      {
        accessorKey: "ciudad",
        header: "Ciudad",
        cell: ({ row }) => (
          <Box>
            <chakra.span fontSize="sm">
              {row.original.ciudad ?? "—"}
            </chakra.span>
            {row.original.barrio && (
              <chakra.span display="block" fontSize="xs" color="ink.500">
                {row.original.barrio}
              </chakra.span>
            )}
          </Box>
        ),
      },
      {
        id: "mascotas",
        header: "Mascotas",
        align: "center",
        cell: ({ row }) => {
          const cantidad = row.original._count?.pacientes ?? 0;

          return (
            <Badge
              colorPalette={cantidad > 0 ? "brand" : "gray"}
              variant="subtle"
              size="sm"
            >
              {cantidad}
            </Badge>
          );
        },
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
        cell: ({ row }) => (
          <Flex justify="flex-end" gap="1">
            {puede("clientes.editar") && (
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

            {puede("clientes.eliminar") && (
              <chakra.button
                type="button"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setClienteCambioEstado(row.original);
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
                    ? `Desactivar ${row.original.nombreCompleto}`
                    : `Reactivar ${row.original.nombreCompleto}`
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
        ),
      },
    ],
    // dialogo.abrirEditar y confirmarBaja cambian en cada render; incluirlos
    // evita recrear las columnas y perder el foco del buscador en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puede, desactivar, reactivar],
  );

  const accionesListado = (
    <Flex
      w="full"
      gap="3"
      align={{ base: "stretch", lg: "center" }}
      wrap="wrap"
    >
      <Flex position="relative" flex="1" minW={{ base: "full", lg: "28rem" }}>
        <Box
          position="absolute"
          left="3"
          top="50%"
          transform="translateY(-50%)"
          color="ink.400"
          pointerEvents="none"
        >
          <Users size={16} />
        </Box>
        <chakra.input
          value={texto}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setTexto(e.target.value);
            setPagina(1);
          }}
          placeholder="Buscar por nombre, documento, teléfono…"
          pl="9"
          h="10"
          w="full"
          bg="white"
        />
      </Flex>

      <Flex
        gap="2"
        ml={{ base: "0", lg: "auto" }}
        w={{ base: "full", lg: "auto" }}
      >
        <Button
          variant="outline"
          size="sm"
          flex={{ base: "1", lg: "initial" }}
          disabled={exportando !== null || consulta.data?.total === 0}
          loading={exportando === "excel"}
          loadingText="Preparando…"
          onClick={() => void exportarClientes("excel")}
        >
          <FileSpreadsheet size={16} />
          Excel
        </Button>
        <Button
          variant="outline"
          size="sm"
          flex={{ base: "1", lg: "initial" }}
          disabled={exportando !== null || consulta.data?.total === 0}
          loading={exportando === "pdf"}
          loadingText="Preparando…"
          onClick={() => void exportarClientes("pdf")}
        >
          <FileDown size={16} />
          PDF
        </Button>
      </Flex>

      <Flex
        gap="1"
        p="1"
        borderWidth="1px"
        borderColor="ink.200"
        borderRadius="md"
        bg="ink.50"
        w={{ base: "full", lg: "auto" }}
      >
        <Button
          type="button"
          size="sm"
          variant={vista === "tabla" ? "solid" : "ghost"}
          colorPalette={vista === "tabla" ? "brand" : "gray"}
          flex={{ base: "1", lg: "initial" }}
          aria-pressed={vista === "tabla"}
          onClick={() => setVista("tabla")}
        >
          <Table2 size={16} />
          Tabla
        </Button>
        <Button
          type="button"
          size="sm"
          variant={vista === "tarjetas" ? "solid" : "ghost"}
          colorPalette={vista === "tarjetas" ? "brand" : "gray"}
          flex={{ base: "1", lg: "initial" }}
          aria-pressed={vista === "tarjetas"}
          onClick={() => setVista("tarjetas")}
        >
          <LayoutGrid size={16} />
          Tarjetas
        </Button>
      </Flex>
    </Flex>
  );

  return (
    <Box>
      <PageHeader
        titulo="Clientes"
        descripcion="Dueños de las mascotas que atiende tu veterinaria."
        acciones={
          puede("clientes.crear") ? (
            <Button colorPalette="brand" onClick={dialogo.abrirCrear}>
              <Flex align="center" gap="2">
                <UserPlus size={17} />
                <chakra.span>Nuevo cliente</chakra.span>
              </Flex>
            </Button>
          ) : null
        }
      />

      <Panel flush>
        {vista === "tabla" ? (
          <DataTable
            data={consulta.data?.items ?? []}
            columns={columnas}
            cargando={consulta.isLoading || consulta.isFetching}
            claveFila={(fila) => fila.id}
            hayBusqueda={busqueda.trim().length > 0}
            vacioTitulo="Todavía no hay clientes"
            vacioDetalle="Registrá al primer dueño de mascota para empezar a agendar consultas."
            onFilaClick={(fila) =>
              puede("clientes.editar")
                ? dialogo.abrirEditar(fila.id)
                : undefined
            }
            acciones={accionesListado}
          />
        ) : (
          <>
            <Flex
              align={{ base: "stretch", md: "center" }}
              gap="3"
              wrap="wrap"
              p="4"
              borderBottomWidth="1px"
              borderColor="ink.200"
            >
              {accionesListado}
            </Flex>

            {consulta.isLoading || consulta.isFetching ? (
              <Flex
                align="center"
                justify="center"
                py="16"
                direction="column"
                gap="3"
              >
                <Spinner size="lg" color="brand.500" />
                <Text fontSize="sm" color="ink.500">
                  Cargando…
                </Text>
              </Flex>
            ) : (consulta.data?.items.length ?? 0) === 0 ? (
              <Flex
                align="center"
                justify="center"
                py="16"
                px="4"
                direction="column"
                gap="2"
              >
                <Text fontWeight="semibold" color="ink.800">
                  {busqueda.trim()
                    ? "Sin resultados"
                    : "Todavía no hay clientes"}
                </Text>
                <Text fontSize="sm" color="ink.500" textAlign="center">
                  {busqueda.trim()
                    ? "Probá con otro término de búsqueda o quitá los filtros."
                    : "Registrá al primer dueño de mascota para empezar a agendar consultas."}
                </Text>
              </Flex>
            ) : (
              <Grid
                templateColumns={{
                  base: "minmax(0, 1fr)",
                  md: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(3, minmax(0, 1fr))",
                }}
                gap="4"
                p="4"
              >
                {consulta.data?.items.map((cliente) => {
                  const cantidadMascotas = cliente._count?.pacientes ?? 0;

                  return (
                    <Box
                      key={cliente.id}
                      borderWidth="1px"
                      borderColor={cliente.activo ? "ink.200" : "red.200"}
                      borderRadius="lg"
                      p="4"
                      bg={cliente.activo ? "white" : "red.50"}
                      transition="box-shadow 0.15s ease, border-color 0.15s ease"
                      _hover={{
                        borderColor: cliente.activo ? "brand.300" : "red.300",
                        boxShadow: "sm",
                      }}
                    >
                      <Flex align="flex-start" justify="space-between" gap="3">
                        <Box minW="0" flex="1">
                          <chakra.button
                            type="button"
                            textAlign="left"
                            fontWeight="semibold"
                            color="ink.900"
                            lineHeight="1.4"
                            onClick={() => {
                              if (puede("clientes.editar"))
                                dialogo.abrirEditar(cliente.id);
                            }}
                            cursor={
                              puede("clientes.editar") ? "pointer" : "default"
                            }
                            _hover={
                              puede("clientes.editar")
                                ? { color: "brand.700" }
                                : undefined
                            }
                          >
                            {cliente.nombreCompleto}
                          </chakra.button>
                          <Text
                            fontSize="xs"
                            color="ink.500"
                            mt="1"
                            fontVariantNumeric="tabular-nums"
                          >
                            {cliente.tipoDocumento === "ruc" ? "RUC" : "Cédula"}{" "}
                            {cliente.documento}
                          </Text>
                        </Box>
                        <Badge
                          colorPalette={cliente.activo ? "success" : "red"}
                          variant="solid"
                          size="sm"
                          flexShrink={0}
                        >
                          {cliente.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </Flex>

                      <Flex direction="column" gap="2.5" mt="4" color="ink.700">
                        <Flex align="center" gap="2">
                          <Phone
                            size={15}
                            color="var(--chakra-colors-ink-400)"
                          />
                          <Text fontSize="sm">
                            {cliente.telefono ??
                              cliente.whatsapp ??
                              "Sin teléfono"}
                          </Text>
                        </Flex>
                        <Flex align="center" gap="2">
                          <MapPin
                            size={15}
                            color="var(--chakra-colors-ink-400)"
                          />
                          <Text fontSize="sm">
                            {[cliente.ciudad, cliente.barrio]
                              .filter(Boolean)
                              .join(", ") || "Sin ubicación"}
                          </Text>
                        </Flex>
                        <Flex align="center" gap="2">
                          <PawPrint
                            size={15}
                            color="var(--chakra-colors-ink-400)"
                          />
                          <Text fontSize="sm">
                            {cantidadMascotas}{" "}
                            {cantidadMascotas === 1 ? "mascota" : "mascotas"}
                          </Text>
                        </Flex>
                      </Flex>

                      {(puede("clientes.editar") ||
                        puede("clientes.eliminar")) && (
                        <Flex
                          justify="flex-end"
                          gap="1"
                          mt="3"
                          pt="3"
                          borderTopWidth="1px"
                          borderColor="ink.100"
                        >
                          {puede("clientes.editar") && (
                            <chakra.button
                              type="button"
                              onClick={() => dialogo.abrirEditar(cliente.id)}
                              p="1.5"
                              borderRadius="md"
                              color="ink.500"
                              _hover={{ bg: "ink.100", color: "brand.600" }}
                              aria-label={`Editar ${cliente.nombreCompleto}`}
                              title="Editar"
                            >
                              <Pencil size={16} />
                            </chakra.button>
                          )}
                          {puede("clientes.eliminar") && (
                            <chakra.button
                              type="button"
                              onClick={() => setClienteCambioEstado(cliente)}
                              p="1.5"
                              borderRadius="md"
                              color="ink.500"
                              _hover={{
                                bg: cliente.activo
                                  ? "danger.subtle"
                                  : "success.subtle",
                                color: cliente.activo
                                  ? "danger.600"
                                  : "success.600",
                              }}
                              aria-label={
                                cliente.activo
                                  ? `Desactivar ${cliente.nombreCompleto}`
                                  : `Reactivar ${cliente.nombreCompleto}`
                              }
                              title={
                                cliente.activo ? "Desactivar" : "Reactivar"
                              }
                            >
                              {cliente.activo ? (
                                <Trash2 size={16} />
                              ) : (
                                <RotateCcw size={16} />
                              )}
                            </chakra.button>
                          )}
                        </Flex>
                      )}
                    </Box>
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
            porPagina={POR_PAGINA}
            onCambioPagina={setPagina}
            singular="cliente"
            plural="clientes"
          />
        )}
      </Panel>

      <FormDialog
        abierto={dialogo.abierto}
        onClose={dialogo.cerrar}
        titulo={dialogo.editando ? "Editar cliente" : "Nuevo cliente"}
        descripcion={
          dialogo.editando
            ? "Modificá los datos. El historial no se altera."
            : "Registrá un dueño de mascota. Sólo se pide lo esencial."
        }
        textoConfirmar={dialogo.editando ? "Guardar cambios" : "Registrar"}
        guardando={crear.isPending || actualizar.isPending}
        onConfirmar={() => {
          // Se dispara el submit del formulario en vez de llamar a la mutación
          // directo: así la validación del cliente corre siempre, incluso si
          // el usuario aprieta el botón del diálogo en vez del del formulario.
          document
            .querySelector<HTMLFormElement>("#cliente-form")
            ?.requestSubmit();
        }}
        bloquearCierre={crear.isPending || actualizar.isPending}
        ancho="xl"
      >
        <ClienteForm
          cliente={clienteEditando}
          onGuardar={alGuardar}
          errorGeneral={
            crear.isError || actualizar.isError
              ? mensajeDeError(crear.error ?? actualizar.error)
              : null
          }
        />
      </FormDialog>

      <DialogRoot
        open={clienteCambioEstado !== null}
        onOpenChange={({ open }) => {
          if (!open && !desactivar.isPending && !reactivar.isPending) {
            setClienteCambioEstado(null);
          }
        }}
        closeOnEscape={!desactivar.isPending && !reactivar.isPending}
        closeOnInteractOutside={!desactivar.isPending && !reactivar.isPending}
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
                bg={clienteCambioEstado?.activo ? "red.50" : "green.50"}
                color={clienteCambioEstado?.activo ? "red.600" : "green.600"}
              >
                {clienteCambioEstado?.activo ? (
                  <AlertTriangle size={22} />
                ) : (
                  <CheckCircle2 size={22} />
                )}
              </Flex>
              <Box>
                <DialogTitle fontSize="lg" fontWeight="bold" color="ink.900">
                  {clienteCambioEstado?.activo
                    ? "Desactivar cliente"
                    : "Reactivar cliente"}
                </DialogTitle>
                <chakra.p fontSize="sm" color="ink.600" mt="1">
                  {clienteCambioEstado?.nombreCompleto}
                </chakra.p>
              </Box>
            </Flex>
          </DialogHeader>

          <DialogBody>
            <DialogDescription color="ink.700" fontSize="sm" lineHeight="1.6">
              {clienteCambioEstado?.activo
                ? "El cliente dejará de aparecer en los listados habituales. Su historial clínico y sus ventas se conservarán, y podrás reactivarlo cuando quieras."
                : "El cliente volverá a aparecer en los listados habituales y podrá seleccionarse en las operaciones del sistema."}
            </DialogDescription>
          </DialogBody>

          <DialogFooter gap="2">
            <Button
              variant="ghost"
              disabled={desactivar.isPending || reactivar.isPending}
              onClick={() => setClienteCambioEstado(null)}
            >
              Cancelar
            </Button>
            <Button
              colorPalette={clienteCambioEstado?.activo ? "red" : "success"}
              loading={desactivar.isPending || reactivar.isPending}
              loadingText={
                clienteCambioEstado?.activo ? "Desactivando…" : "Reactivando…"
              }
              onClick={() => void confirmarCambioEstado()}
            >
              {clienteCambioEstado?.activo ? "Sí, desactivar" : "Sí, reactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </Box>
  );
}
