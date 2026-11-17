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
  Building2,
  FileDown,
  FileSpreadsheet,
  LayoutGrid,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RotateCcw,
  Search,
  Table2,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { ApiError } from "@/services/api";
import {
  mensajeDeError,
  errorDeCampo,
  useActualizarProveedor,
  useDesactivarProveedor,
  useDialogo,
  POR_PAGINA,
  useProveedores,
  useCrearProveedor,
  useReactivarProveedor,
  useProveedorDetalle,
  obtenerProveedoresParaExportar,
} from "../clients/clients.service";
import {
  ProveedorForm,
  type ProveedorFormValues,
} from "./ProveedorForm";
import { formatearRucProveedor } from "./proveedores.utils";
import type { Proveedor } from "@/types/dominio";
import {
  descargarProveedoresExcel,
  descargarProveedoresPdf,
} from "./proveedores.export";

export function ProveedoresPage() {
  const { puede } = useAuth();

  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [vista, setVista] = useState<"tabla" | "tarjetas">("tabla");
  const { texto, setTexto, busqueda } = useBusquedaDiferida();

  const dialogo = useDialogo();

  const consulta = useProveedores({ busqueda, pagina, incluirInactivos });
  const consultaDetalleProveedor = useProveedorDetalle(
    dialogo.editando ? dialogo.id ?? undefined : undefined,
  );
  const crear = useCrearProveedor();
  const actualizar = useActualizarProveedor();
  const desactivar = useDesactivarProveedor();
  const reactivar = useReactivarProveedor();

  const proveedorEnListado = useMemo<Proveedor | null>(() => {
    if (!dialogo.editando) return null;
    return consulta.data?.items.find((item) => item.id === dialogo.id) ?? null;
  }, [dialogo.editando, dialogo.id, consulta.data]);
  const proveedorEditando =
    consultaDetalleProveedor.data ?? proveedorEnListado;

  const guardando = crear.isPending || actualizar.isPending;
  const errorMutation = crear.error ?? actualizar.error;
  const erroresServidor = obtenerErroresProveedor(errorMutation);
  const detallesServidor = obtenerDetallesError(errorMutation, erroresServidor);

  function alGuardar(valores: ProveedorFormValues) {
    const datos = {
      ...valores,
      nombreFantasia: valores.nombreFantasia || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      direccion: valores.direccion || undefined,
      departamento: valores.departamento || undefined,
      ciudad: valores.ciudad || undefined,
      barrio: valores.barrio || undefined,
      contactoNombre: valores.contactoNombre || undefined,
      notas: valores.notas || undefined,
    };

    const esEdicion = dialogo.modo === "editar";
    const mutacion =
      dialogo.estado.modo === "editar"
        ? actualizar.mutateAsync({ id: dialogo.estado.id, datos })
        : crear.mutateAsync(datos);

    mutacion
      .then((proveedor) => {
        toaster.success({
          title: esEdicion ? "Proveedor actualizado" : "Proveedor registrado",
          description: proveedor.nombreMostrable ?? proveedor.razonSocial,
        });
        dialogo.cerrar();
        if (!esEdicion) setPagina(1);
      })
      .catch((error) => {
        console.error(mensajeDeError(error));
      });
  }

  function confirmarBaja(proveedor: Proveedor) {
    const acepta = window.confirm(
      `¿Desactivar a ${proveedor.razonSocial}?\n\n` +
        "Va a dejar de aparecer en los listados. Las facturas de compra y los " +
        "productos ya cargados se conservan.",
    );

    if (!acepta) return;

    const mutacion = proveedor.activo
      ? desactivar.mutateAsync(proveedor.id)
      : reactivar.mutateAsync(proveedor.id);

    mutacion
      .then((respuesta) => {
        toaster.success({
          title: proveedor.activo ? "Proveedor desactivado" : "Proveedor reactivado",
          description: respuesta.mensaje,
        });
      })
      .catch((error) => {
        toaster.error({
          title: "No se pudo cambiar el estado",
          description: mensajeDeError(error),
        });
      });
  }

  async function exportarProveedores(formato: "excel" | "pdf") {
    setExportando(formato);

    try {
      const proveedores = await obtenerProveedoresParaExportar(
        busqueda,
        incluirInactivos,
      );

      if (formato === "excel") {
        descargarProveedoresExcel(proveedores);
      } else {
        descargarProveedoresPdf(proveedores, busqueda);
      }

      toaster.success({
        title: `Archivo ${formato === "excel" ? "Excel" : "PDF"} descargado`,
        description: `Se exportaron ${proveedores.length} proveedores.`,
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

  const columnas = useMemo<ColumnDef<Proveedor, unknown>[]>(
    () => [
      {
        accessorKey: "razonSocial",
        header: "Proveedor",
        cell: ({ row }) => (
          <Box>
            <chakra.span fontWeight="semibold" color="ink.900">
              {row.original.razonSocial}
            </chakra.span>
            {row.original.nombreFantasia && (
              <chakra.span
                display="block"
                fontSize="xs"
                color="ink.500"
              >
                {row.original.nombreFantasia}
              </chakra.span>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "documento",
        header: "RUC",
        cell: ({ row }) => (
          <chakra.span
            fontVariantNumeric="tabular-nums"
            fontSize="sm"
            color="ink.700"
          >
            {formatearRucProveedor(row.original.documento)}
          </chakra.span>
        ),
      },
      {
        accessorKey: "telefono",
        header: "Teléfono",
        cell: ({ row }) => (
          <chakra.span fontVariantNumeric="tabular-nums" fontSize="sm">
            {row.original.telefono ?? "—"}
          </chakra.span>
        ),
      },
      {
        accessorKey: "email",
        header: "Correo",
        cell: ({ row }) => (
          <chakra.span fontSize="sm" color="ink.700">
            {row.original.email ?? "—"}
          </chakra.span>
        ),
      },
      {
        accessorKey: "contactoNombre",
        header: "Contacto",
        cell: ({ row }) => (
          <chakra.span fontSize="sm" color="ink.700">
            {row.original.contactoNombre ?? "—"}
          </chakra.span>
        ),
      },
      {
        accessorKey: "ciudad",
        header: "Ciudad",
        cell: ({ row }) => (
          <Box>
            <chakra.span fontSize="sm">{row.original.ciudad ?? "—"}</chakra.span>
            {row.original.departamento && (
              <chakra.span display="block" fontSize="xs" color="ink.500">
                {row.original.departamento}
              </chakra.span>
            )}
          </Box>
        ),
      },
      {
        id: "productos",
        header: "Productos",
        align: "center",
        cell: ({ row }) => {
          const cantidad = row.original._count?.productos ?? 0;
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
            {puede("proveedores.editar") && (
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
                aria-label={`Editar ${row.original.razonSocial}`}
                title="Editar"
              >
                <Pencil size={16} />
              </chakra.button>
            )}

            {(row.original.activo
              ? puede("proveedores.eliminar")
              : puede("proveedores.editar")) && (
              <chakra.button
                type="button"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  confirmarBaja(row.original);
                }}
                p="1.5"
                borderRadius="md"
                color="ink.500"
                _hover={{
                  bg: row.original.activo ? "danger.subtle" : "success.subtle",
                  color: row.original.activo ? "danger.600" : "success.600",
                }}
                aria-label={
                  row.original.activo ? "Desactivar proveedor" : "Reactivar proveedor"
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
          <Search size={16} />
        </Box>
        <chakra.input
          value={texto}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setTexto(e.target.value);
            setPagina(1);
          }}
          placeholder="Buscar por razón social, RUC, contacto…"
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
          onClick={() => void exportarProveedores("excel")}
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
          onClick={() => void exportarProveedores("pdf")}
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
        {incluirInactivos ? "Ocultos incluidos" : "Ver inactivos"}
      </Button>
    </Flex>
  );

  return (
    <Box>
      <PageHeader
        titulo="Proveedores"
        descripcion="Laboratorios y distribuidores que abastecen tu inventario."
        acciones={
          puede("proveedores.crear") ? (
            <Button colorPalette="brand" onClick={dialogo.abrirCrear}>
              <Flex align="center" gap="2">
                <Truck size={17} />
                <chakra.span>Nuevo proveedor</chakra.span>
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
            hayBusqueda={busqueda.trim().length > 0 || incluirInactivos}
            vacioTitulo="Todavía no hay proveedores"
            vacioDetalle="Cargá tus laboratorios y distribuidores para poder registrar compras."
            onFilaClick={(fila) =>
              puede("proveedores.editar")
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
                  {busqueda.trim() || incluirInactivos
                    ? "Sin resultados"
                    : "Todavía no hay proveedores"}
                </Text>
                <Text fontSize="sm" color="ink.500" textAlign="center">
                  {busqueda.trim() || incluirInactivos
                    ? "Probá con otro término de búsqueda o quitá los filtros."
                    : "Cargá tus laboratorios y distribuidores para poder registrar compras."}
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
                {consulta.data?.items.map((proveedor) => (
                  <Box
                    key={proveedor.id}
                    borderWidth="1px"
                    borderColor={proveedor.activo ? "ink.200" : "red.200"}
                    borderRadius="lg"
                    p="4"
                    bg={proveedor.activo ? "white" : "red.50"}
                    transition="box-shadow 0.15s ease, border-color 0.15s ease"
                    _hover={{
                      borderColor: proveedor.activo ? "brand.300" : "red.300",
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
                            if (puede("proveedores.editar"))
                              dialogo.abrirEditar(proveedor.id);
                          }}
                          cursor={
                            puede("proveedores.editar") ? "pointer" : "default"
                          }
                          _hover={
                            puede("proveedores.editar")
                              ? { color: "brand.700" }
                              : undefined
                          }
                        >
                          {proveedor.razonSocial}
                        </chakra.button>
                        <Text
                          fontSize="xs"
                          color="ink.500"
                          mt="1"
                          fontVariantNumeric="tabular-nums"
                        >
                          RUC {formatearRucProveedor(proveedor.documento)}
                        </Text>
                      </Box>
                      <Badge
                        colorPalette={proveedor.activo ? "success" : "red"}
                        variant="solid"
                        size="sm"
                        flexShrink={0}
                      >
                        {proveedor.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </Flex>

                    <Flex direction="column" gap="2.5" mt="4" color="ink.700">
                      <Flex align="center" gap="2">
                        <Building2
                          size={15}
                          color="var(--chakra-colors-ink-400)"
                        />
                        <Text fontSize="sm">
                          {proveedor.nombreFantasia ?? "Sin nombre de fantasía"}
                        </Text>
                      </Flex>
                      <Flex align="center" gap="2">
                        <Phone size={15} color="var(--chakra-colors-ink-400)" />
                        <Text fontSize="sm">
                          {proveedor.telefono ?? "Sin teléfono"}
                        </Text>
                      </Flex>
                      <Flex align="center" gap="2">
                        <Mail size={15} color="var(--chakra-colors-ink-400)" />
                        <Text fontSize="sm">
                          {proveedor.email ?? "Sin correo electrónico"}
                        </Text>
                      </Flex>
                      <Flex align="center" gap="2">
                        <UserRound
                          size={15}
                          color="var(--chakra-colors-ink-400)"
                        />
                        <Text fontSize="sm">
                          {proveedor.contactoNombre ?? "Sin contacto asignado"}
                        </Text>
                      </Flex>
                      <Flex align="center" gap="2">
                        <MapPin size={15} color="var(--chakra-colors-ink-400)" />
                        <Text fontSize="sm">
                          {[proveedor.ciudad, proveedor.departamento]
                            .filter(Boolean)
                            .join(", ") || "Sin ubicación"}
                        </Text>
                      </Flex>
                    </Flex>

                    {(puede("proveedores.editar") ||
                      (proveedor.activo
                        ? puede("proveedores.eliminar")
                        : puede("proveedores.editar"))) && (
                      <Flex
                        justify="flex-end"
                        gap="1"
                        mt="3"
                        pt="3"
                        borderTopWidth="1px"
                        borderColor="ink.100"
                      >
                        {puede("proveedores.editar") && (
                          <chakra.button
                            type="button"
                            onClick={() => dialogo.abrirEditar(proveedor.id)}
                            p="1.5"
                            borderRadius="md"
                            color="ink.500"
                            _hover={{ bg: "ink.100", color: "brand.600" }}
                            aria-label={`Editar ${proveedor.razonSocial}`}
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </chakra.button>
                        )}
                        {(proveedor.activo
                          ? puede("proveedores.eliminar")
                          : puede("proveedores.editar")) && (
                          <chakra.button
                            type="button"
                            onClick={() => confirmarBaja(proveedor)}
                            p="1.5"
                            borderRadius="md"
                            color="ink.500"
                            _hover={{
                              bg: proveedor.activo
                                ? "danger.subtle"
                                : "success.subtle",
                              color: proveedor.activo
                                ? "danger.600"
                                : "success.600",
                            }}
                            aria-label={
                              proveedor.activo
                                ? "Desactivar proveedor"
                                : "Reactivar proveedor"
                            }
                            title={proveedor.activo ? "Desactivar" : "Reactivar"}
                          >
                            {proveedor.activo ? (
                              <Trash2 size={16} />
                            ) : (
                              <RotateCcw size={16} />
                            )}
                          </chakra.button>
                        )}
                      </Flex>
                    )}
                  </Box>
                ))}
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
            singular="proveedor"
            plural="proveedores"
          />
        )}
      </Panel>

      <FormDialog
        abierto={dialogo.abierto}
        onClose={dialogo.cerrar}
        titulo={dialogo.editando ? "Editar proveedor" : "Nuevo proveedor"}
        descripcion={
          dialogo.editando
            ? "Modificá los datos de contacto y entrega."
            : "Registrá un laboratorio o distribuidor."
        }
        textoConfirmar={dialogo.editando ? "Guardar cambios" : "Registrar"}
        guardando={guardando}
        onConfirmar={() => {
          document
            .querySelector<HTMLFormElement>("#proveedor-form")
            ?.requestSubmit();
        }}
        bloquearCierre={guardando}
        ancho="lg"
      >
        {dialogo.editando && consultaDetalleProveedor.isLoading ? (
          <Flex align="center" justify="center" gap="3" py="10">
            <Spinner size="sm" color="brand.500" />
            <Text fontSize="sm" color="ink.500">
              Cargando datos completos del proveedor…
            </Text>
          </Flex>
        ) : dialogo.editando && consultaDetalleProveedor.isError ? (
          <Text role="alert" color="danger.600" fontSize="sm">
            No se pudieron cargar los datos del proveedor:{" "}
            {mensajeDeError(consultaDetalleProveedor.error)}
          </Text>
        ) : (
          <ProveedorForm
            proveedor={proveedorEditando}
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
    </Box>
  );
}

function obtenerDetallesError(
  error: unknown,
  erroresCampos: Partial<Record<keyof ProveedorFormValues, string>>,
): string[] | undefined {
  if (!(error instanceof ApiError) || !error.errors) return undefined;
  const erroresMostrados = new Set(Object.values(erroresCampos));
  return Object.values(error.errors)
    .flat()
    .filter((detalle) => !erroresMostrados.has(detalle));
}

function obtenerErroresProveedor(
  error: unknown,
): Partial<Record<keyof ProveedorFormValues, string>> {
  const campos: (keyof ProveedorFormValues)[] = [
    "documento",
    "razonSocial",
    "nombreFantasia",
    "email",
    "telefono",
    "direccion",
    "departamento",
    "ciudad",
    "barrio",
    "contactoNombre",
    "notas",
    "activo",
  ];

  return campos.reduce<Partial<Record<keyof ProveedorFormValues, string>>>(
    (errores, campo) => {
      const mensaje = errorDeCampo(error, campo);
      if (mensaje) errores[campo] = mensaje;
      return errores;
    },
    {},
  );
}