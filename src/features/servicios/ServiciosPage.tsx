import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  NativeSelect,
  Text,
  chakra,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Activity,
  Clock,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Stethoscope,
  Tags,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import {
  errorDeCampo,
  mensajeDeError,
  useDialogo,
} from "@/features/clients/clients.service";
import { formatMoneda } from "@/lib/formato";
import { ApiError } from "@/services/api";
import type { Servicio } from "@/types/dominio";
import { ServicioForm } from "./ServicioForm";
import {
  SERVICIOS_POR_PAGINA,
  type ServicioFormData,
  useActualizarServicio,
  useCategoriasServicio,
  useCrearServicio,
  useDesactivarServicio,
  useReactivarServicio,
  useServicioDetalle,
  useServicioResumen,
  useServicios,
} from "./servicios.service";

function TarjetaResumen({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  color = "brand",
}: {
  icono: typeof Activity;
  etiqueta: string;
  valor: string | number;
  detalle: string;
  color?: "brand" | "success" | "orange" | "red";
}) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p={{ base: "4", md: "5" }}
      boxShadow="sm"
    >
      <Flex align="flex-start" justify="space-between" gap="3">
        <Box minW="0">
          <Text
            fontSize="2xs"
            fontWeight="semibold"
            color="ink.500"
            textTransform="uppercase"
            letterSpacing="0.05em"
          >
            {etiqueta}
          </Text>
          <Text
            fontSize={{ base: "xl", md: "2xl" }}
            fontWeight="bold"
            color="ink.900"
            lineHeight="1.2"
            mt="1.5"
            fontVariantNumeric="tabular-nums"
          >
            {valor}
          </Text>
          <Text fontSize="xs" color="ink.500" mt="1">
            {detalle}
          </Text>
        </Box>
        <Flex
          align="center"
          justify="center"
          w="10"
          h="10"
          flexShrink={0}
          borderRadius="lg"
          bg={`${color}.subtle`}
          color={`${color}.600`}
        >
          <Icono size={20} />
        </Flex>
      </Flex>
    </Box>
  );
}

export function ServiciosPage() {
  const { puede } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [categoriaId, setCategoriaId] = useState<number | undefined>(undefined);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const { texto, setTexto, busqueda } = useBusquedaDiferida();
  const dialogo = useDialogo();

  const filtros = {
    busqueda,
    pagina,
    categoriaId,
    incluirInactivos,
  };

  const consulta = useServicios(filtros);
  const resumen = useServicioResumen();
  const categorias = useCategoriasServicio();
  const detalle = useServicioDetalle(dialogo.editando ? dialogo.id ?? undefined : undefined);
  const crear = useCrearServicio();
  const actualizar = useActualizarServicio();
  const desactivar = useDesactivarServicio();
  const reactivar = useReactivarServicio();

  const servicioEnListado = useMemo<Servicio | null>(() => {
    if (!dialogo.editando) return null;
    return consulta.data?.items.find((item) => item.id === dialogo.id) ?? null;
  }, [dialogo.editando, dialogo.id, consulta.data]);

  const servicioEditando = detalle.data ?? servicioEnListado;
  const guardando = crear.isPending || actualizar.isPending;
  const errorMutation = crear.error ?? actualizar.error;

  const columnas = useMemo<ColumnDef<Servicio>[]>(
    () => [
      {
        accessorKey: "codigo",
        header: "Código",
        cell: ({ row }) => (
          <chakra.span fontSize="sm" color="ink.600" fontFamily="mono">
            {row.original.codigo ?? "—"}
          </chakra.span>
        ),
      },
      {
        accessorKey: "nombre",
        header: "Servicio",
        cell: ({ row }) => (
          <Box>
            <chakra.span fontWeight="semibold" color="ink.900">
              {row.original.nombre}
            </chakra.span>
            {row.original.descripcion && (
              <chakra.span display="block" fontSize="xs" color="ink.500">
                {row.original.descripcion}
              </chakra.span>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "categoria.nombre",
        header: "Categoría",
        cell: ({ row }) =>
          row.original.categoria ? (
            <Badge colorPalette="brand" variant="subtle" size="sm">
              {row.original.categoria.nombre}
            </Badge>
          ) : (
            <Text fontSize="sm" color="ink.400">
              —
            </Text>
          ),
      },
      {
        accessorKey: "precio",
        header: "Precio",
        cell: ({ row }) => (
          <chakra.span fontWeight="medium" color="ink.900">
            {formatMoneda(Number(row.original.precio))}
          </chakra.span>
        ),
      },
      {
        accessorKey: "duracionMin",
        header: "Duración",
        cell: ({ row }) => (
          <Text fontSize="sm" color="ink.700">
            {row.original.duracionMin} min
          </Text>
        ),
      },
      {
        accessorKey: "activo",
        header: "Estado",
        cell: ({ row }) => (
          <Badge
            colorPalette={row.original.activo ? "success" : "gray"}
            variant="solid"
            size="sm"
          >
            {row.original.activo ? "Activo" : "Inactivo"}
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
            {puede("servicios.editar") && (
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
                aria-label={`Editar ${row.original.nombre}`}
                title="Editar"
              >
                <Pencil size={16} />
              </chakra.button>
            )}
            {(row.original.activo
              ? puede("servicios.eliminar")
              : puede("servicios.editar")) && (
              <chakra.button
                type="button"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  void alternarEstado(row.original);
                }}
                p="1.5"
                borderRadius="md"
                color="ink.500"
                _hover={{
                  bg: row.original.activo ? "danger.subtle" : "success.subtle",
                  color: row.original.activo ? "danger.600" : "success.600",
                }}
                aria-label={row.original.activo ? "Desactivar servicio" : "Reactivar servicio"}
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
    [puede, desactivar, reactivar],
  );

  async function alternarEstado(servicio: Servicio) {
    try {
      const respuesta = servicio.activo
        ? await desactivar.mutateAsync(servicio.id)
        : await reactivar.mutateAsync(servicio.id);
      toaster.success({
        title: servicio.activo ? "Servicio desactivado" : "Servicio reactivado",
        description: respuesta.mensaje,
      });
    } catch (error) {
      toaster.error({
        title: "No se pudo cambiar el estado",
        description: mensajeDeError(error),
      });
    }
  }

  function alGuardar(datos: ServicioFormData) {
    const esEdicion = dialogo.modo === "editar";
    const mutacion =
      dialogo.modo === "editar"
        ? actualizar.mutateAsync({ id: dialogo.id!, datos })
        : crear.mutateAsync(datos);

    mutacion
      .then(() => {
        toaster.success({
          title: esEdicion ? "Servicio actualizado" : "Servicio creado",
          description: datos.nombre,
        });
        dialogo.cerrar();
        if (!esEdicion) setPagina(1);
      })
      .catch(() => {
        // El error se muestra en el formulario.
      });
  }

  const accionesListado = (
    <Flex w="full" gap="3" align={{ base: "stretch", md: "center" }} wrap="wrap">
      <Flex position="relative" flex="1" minW={{ base: "full", md: "20rem" }}>
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
          placeholder="Buscar por nombre, código o categoría…"
          pl="9"
          h="10"
          w="full"
          bg="white"
          borderWidth="1px"
          borderColor="ink.200"
          borderRadius="md"
          fontSize="sm"
          _hover={{ borderColor: "ink.300" }}
          _focusVisible={{
            borderColor: "brand.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
          }}
        />
      </Flex>

      <NativeSelect.Root w={{ base: "full", md: "14rem" }}>
        <NativeSelect.Field
          value={categoriaId ?? ""}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const valor = e.target.value;
            setCategoriaId(valor ? Number(valor) : undefined);
            setPagina(1);
          }}
        >
          <option value="">Todas las categorías</option>
          {categorias.data?.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>

      <Button
        variant={incluirInactivos ? "subtle" : "outline"}
        size="sm"
        colorPalette={incluirInactivos ? "brand" : "gray"}
        onClick={() => {
          setIncluirInactivos((previo) => !previo);
          setPagina(1);
        }}
      >
        {incluirInactivos ? "Inactivos incluidos" : "Ver inactivos"}
      </Button>
    </Flex>
  );

  const erroresServidor = {
    codigo: errorDeCampo(errorMutation, "codigo"),
    nombre: errorDeCampo(errorMutation, "nombre"),
    descripcion: errorDeCampo(errorMutation, "descripcion"),
    categoriaId: errorDeCampo(errorMutation, "categoriaId"),
    precio: errorDeCampo(errorMutation, "precio"),
    duracionMin: errorDeCampo(errorMutation, "duracionMin"),
  };
  const detallesServidor = obtenerDetallesError(errorMutation, erroresServidor);

  return (
    <Box>
      <PageHeader
        titulo="Servicios"
        descripcion="Catálogo de servicios, precios y duraciones."
        acciones={
          puede("servicios.crear") ? (
            <Button colorPalette="brand" onClick={dialogo.abrirCrear}>
              <Plus size={17} /> Nuevo servicio
            </Button>
          ) : undefined
        }
      />

      <Grid
        templateColumns={{
          base: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          xl: "repeat(4, minmax(0, 1fr))",
        }}
        gap="3"
        mb="5"
      >
        <TarjetaResumen
          icono={Activity}
          etiqueta="Servicios activos"
          valor={resumen.data ? resumen.data.total : "—"}
          detalle={`${resumen.data?.categorias ?? 0} categorías en uso`}
        />
        <TarjetaResumen
          icono={Stethoscope}
          etiqueta="Requieren veterinario"
          valor={resumen.data ? resumen.data.requierenVeterinario : "—"}
          detalle="Servicios con profesional asignado"
          color="orange"
        />
        <TarjetaResumen
          icono={Clock}
          etiqueta="Duración promedio"
          valor={resumen.data ? `${resumen.data.duracionPromedio} min` : "—"}
          detalle="Tiempo medio por servicio"
          color="success"
        />
        <TarjetaResumen
          icono={Tags}
          etiqueta="Precio promedio"
          valor={resumen.data ? formatMoneda(resumen.data.precioPromedio) : "—"}
          detalle={`${resumen.data?.consumenInsumos ?? 0} consumen insumos`}
          color="brand"
        />
      </Grid>

      <Panel flush>
        <DataTable
          data={consulta.data?.items ?? []}
          columns={columnas}
          cargando={consulta.isLoading || consulta.isFetching}
          claveFila={(fila) => fila.id}
          hayBusqueda={Boolean(busqueda) || incluirInactivos || Boolean(categoriaId)}
          vacioTitulo="Todavía no hay servicios"
          vacioDetalle="Registrá tus servicios para usarlos en ventas y agenda."
          onFilaClick={(fila) =>
            puede("servicios.editar") ? dialogo.abrirEditar(fila.id) : undefined
          }
          acciones={accionesListado}
        />

        {consulta.data && (
          <Paginacion
            pagina={pagina}
            totalPaginas={consulta.data.totalPaginas}
            total={consulta.data.total}
            porPagina={SERVICIOS_POR_PAGINA}
            onCambioPagina={setPagina}
            singular="servicio"
            plural="servicios"
          />
        )}
      </Panel>

      <FormDialog
        abierto={dialogo.abierto}
        onClose={dialogo.cerrar}
        titulo={dialogo.editando ? "Editar servicio" : "Nuevo servicio"}
        descripcion={
          dialogo.editando
            ? "Modificá los datos del servicio."
            : "Registrá un nuevo servicio del catálogo."
        }
        textoConfirmar={dialogo.editando ? "Guardar cambios" : "Registrar"}
        guardando={guardando}
        onConfirmar={() => {
          document
            .querySelector<HTMLFormElement>("#servicio-form")
            ?.requestSubmit();
        }}
        bloquearCierre={guardando}
        ancho="lg"
      >
        {dialogo.editando && detalle.isLoading ? (
          <Flex align="center" justify="center" gap="3" py="10">
            <Text fontSize="sm" color="ink.500">
              Cargando datos del servicio…
            </Text>
          </Flex>
        ) : dialogo.editando && detalle.isError ? (
          <Text role="alert" color="danger.600" fontSize="sm">
            No se pudo cargar el servicio: {mensajeDeError(detalle.error)}
          </Text>
        ) : (
          <ServicioForm
            servicio={servicioEditando}
            categorias={categorias.data ?? []}
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
  erroresCampos: Partial<Record<string, string | undefined>>,
): string[] | undefined {
  if (!(error instanceof ApiError) || !error.errors) return undefined;
  const erroresMostrados = new Set(
    Object.values(erroresCampos).filter((valor): valor is string => Boolean(valor)),
  );
  const detalles = Object.values(error.errors)
    .flat()
    .filter((detalle) => !erroresMostrados.has(detalle));
  return detalles.length ? detalles : undefined;
}

// Alias para compatibilidad con convenciones singulares.
export { ServiciosPage as ServicioPage };
