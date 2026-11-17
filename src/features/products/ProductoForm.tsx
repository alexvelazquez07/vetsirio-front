import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  IconButton,
  Input,
  NativeSelect,
  Spinner,
  Stack,
  Tabs,
  Text,
  Textarea,
  chakra,
} from "@chakra-ui/react";
import {
  BadgeCheck,
  Barcode,
  Beaker,
  Boxes,
  Camera,
  FlaskConical,
  ImagePlus,
  Package,
  Pill,
  ShieldAlert,
  Tag,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { MoneyInput } from "@/components/fields/MoneyInput";
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import {
  mensajeDeError,
  useCrearProveedor,
} from "@/features/clients/clients.service";
import {
  ProveedorForm,
  type ProveedorFormValues,
} from "@/features/suppliers/ProveedorForm";
import { formatMoneda } from "@/lib/formato";
import { api, urlDeArchivo } from "@/services/api";
import type {
  CategoriaProducto,
  Producto,
  RespuestaUpload,
} from "@/types/dominio";
import {
  ESPECIES_DESTINO,
  UNIDADES_MEDIDA,
  estadoStockProducto,
  type ProductoFormData,
  type ProveedorProducto,
} from "./products.service";

export interface ProductoFormValues {
  codigo: string;
  nombre: string;
  descripcion: string;
  codigoBarras: string;
  codigoSifen: string;
  categoriaId: string;
  proveedorId: string;
  marca: string;
  laboratorio: string;
  principioActivo: string;
  concentracion: string;
  presentacion: string;
  especieDestino: string;
  registroSenacsa: string;
  ubicacion: string;
  unidadMedida: string;
  esMedicamento: boolean;
  esControlado: boolean;
  requiereReceta: boolean;
  requiereLote: boolean;
  precioVenta: number | null;
  precioCosto: number | null;
  porcentajeIva: string;
  stockMinimo: string;
  fotoUrl: string;
  activo: boolean;
}

type Errores = Partial<Record<keyof ProductoFormValues, string>>;

type ProductoFormProps = {
  producto?: Producto | null;
  categorias?: CategoriaProducto[];
  proveedores?: ProveedorProducto[];
  onGuardar: (datos: ProductoFormData) => void;
  errorGeneral?: string | null;
  erroresServidor?: Errores;
};

const VALORES_INICIALES: ProductoFormValues = {
  codigo: "",
  nombre: "",
  descripcion: "",
  codigoBarras: "",
  codigoSifen: "",
  categoriaId: "",
  proveedorId: "",
  marca: "",
  laboratorio: "",
  principioActivo: "",
  concentracion: "",
  presentacion: "",
  especieDestino: "",
  registroSenacsa: "",
  ubicacion: "",
  unidadMedida: "unidad",
  esMedicamento: false,
  esControlado: false,
  requiereReceta: false,
  requiereLote: true,
  precioVenta: 0,
  precioCosto: 0,
  porcentajeIva: "5",
  stockMinimo: "0",
  fotoUrl: "",
  activo: true,
};

const TIPOS_FOTO = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
]);

const MAX_FOTO_BYTES = 5 * 1024 * 1024;

const ID_FORMULARIO = "producto-form";
const ID_PROVEEDOR_RAPIDO = "proveedor-rapido-form";

const CATEGORIAS_SIN_CONTROL = [
  "accesorio",
  "juguete",
  "collar",
  "plato",
  "comedero",
  "bebedero",
  "cama",
  "transportadora",
];

function categoriaControlaLote(nombre: string): boolean {
  const normalizado = nombre.trim().toLowerCase();
  return !CATEGORIAS_SIN_CONTROL.some((palabra) => normalizado.includes(palabra));
}

type TabProducto = "general" | "clinica" | "precios" | "inventario";

const TAB_POR_CAMPO: Record<keyof ProductoFormValues, TabProducto> = {
  codigo: "general",
  nombre: "general",
  descripcion: "general",
  codigoBarras: "general",
  codigoSifen: "general",
  categoriaId: "general",
  proveedorId: "general",
  marca: "general",
  laboratorio: "general",
  fotoUrl: "general",
  activo: "general",
  esMedicamento: "clinica",
  esControlado: "clinica",
  requiereReceta: "clinica",
  principioActivo: "clinica",
  concentracion: "clinica",
  presentacion: "clinica",
  especieDestino: "clinica",
  registroSenacsa: "clinica",
  precioVenta: "precios",
  precioCosto: "precios",
  porcentajeIva: "precios",
  unidadMedida: "precios",
  stockMinimo: "inventario",
  ubicacion: "inventario",
  requiereLote: "inventario",
};

const ID_POR_CAMPO: Partial<Record<keyof ProductoFormValues, string>> = {
  nombre: "producto-nombre",
  codigo: "producto-codigo",
  codigoBarras: "producto-barras",
  codigoSifen: "producto-sifen",
  categoriaId: "producto-categoria",
  proveedorId: "producto-proveedor",
  marca: "producto-marca",
  laboratorio: "producto-laboratorio",
  descripcion: "producto-descripcion",
  principioActivo: "producto-principio",
  concentracion: "producto-concentracion",
  presentacion: "producto-presentacion",
  especieDestino: "producto-especie",
  registroSenacsa: "producto-senacsa",
  precioCosto: "producto-costo",
  precioVenta: "producto-venta",
  porcentajeIva: "producto-iva",
  unidadMedida: "producto-unidad",
  stockMinimo: "producto-stock-minimo",
  ubicacion: "producto-ubicacion",
};

function contarErroresPorTab(errores: Errores): Record<TabProducto, number> {
  const conteo: Record<TabProducto, number> = {
    general: 0,
    clinica: 0,
    precios: 0,
    inventario: 0,
  };

  (Object.keys(errores) as (keyof ProductoFormValues)[]).forEach((campo) => {
    if (errores[campo]) conteo[TAB_POR_CAMPO[campo]] += 1;
  });

  return conteo;
}

function aNumero(valor: string): number {
  const numero = Number(valor.replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

function numeroATexto(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  return String(valor);
}

function TabBoton({
  valor,
  icono: Icono,
  etiqueta,
  errores,
}: {
  valor: TabProducto;
  icono: typeof Package;
  etiqueta: string;
  errores: number;
}) {
  return (
    <Tabs.Trigger
      value={valor}
      flex="1"
      minW="max-content"
      gap="2"
      px={{ base: "2.5", sm: "3" }}
      py="2"
      borderRadius="md"
      fontSize={{ base: "xs", sm: "sm" }}
      fontWeight="medium"
      color="ink.600"
      _selected={{ bg: "white", color: "brand.700", shadow: "sm" }}
      _hover={{ color: "ink.900" }}
    >
      <Box display={{ base: "none", md: "inline-flex" }}>
        <Icono size={16} />
      </Box>
      {etiqueta}
      {errores > 0 && (
        <Badge
          colorPalette="red"
          variant="solid"
          size="xs"
          borderRadius="full"
          aria-label={`${errores} errores`}
        >
          {errores}
        </Badge>
      )}
    </Tabs.Trigger>
  );
}

function Campo({
  id,
  etiqueta,
  requerido,
  error,
  ayuda,
  anchoCompleto,
  children,
}: {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  anchoCompleto?: boolean;
  children: ReactNode;
}) {
  return (
    <Box gridColumn={anchoCompleto ? "1 / -1" : undefined}>
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
    </Box>
  );
}

function Interruptor({
  titulo,
  descripcion,
  activo,
  onCambiar,
  icono: Icono,
}: {
  titulo: string;
  descripcion: string;
  activo: boolean;
  onCambiar: (valor: boolean) => void;
  icono: typeof Pill;
}) {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap="3"
      p="3"
      borderWidth="1px"
      borderColor={activo ? "brand.200" : "ink.200"}
      bg={activo ? "brand.50" : "white"}
      borderRadius="lg"
      transition="background 0.15s ease, border-color 0.15s ease"
    >
      <Flex align="flex-start" gap="3" minW="0">
        <Flex
          align="center"
          justify="center"
          w="8"
          h="8"
          flexShrink={0}
          borderRadius="md"
          bg={activo ? "brand.100" : "ink.100"}
          color={activo ? "brand.700" : "ink.500"}
        >
          <Icono size={16} />
        </Flex>
        <Box minW="0">
          <Text fontSize="sm" fontWeight="medium" color="ink.900">
            {titulo}
          </Text>
          <Text fontSize="xs" color="ink.500" mt="0.5" lineHeight="1.5">
            {descripcion}
          </Text>
        </Box>
      </Flex>
      <Switch
        checked={activo}
        onCheckedChange={(detalle) => onCambiar(detalle.checked === true)}
        colorPalette="brand"
        flexShrink={0}
        aria-label={titulo}
      />
    </Flex>
  );
}

function FotoProducto({
  url,
  nombre,
  onCambiar,
  onAmpliar,
}: {
  url: string;
  nombre: string;
  onCambiar: (url: string) => void;
  onAmpliar: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const src = urlDeArchivo(url);

  async function subir(archivo?: File) {
    if (!archivo) return;
    setError("");

    if (!TIPOS_FOTO.has(archivo.type)) {
      setError("Usá una imagen JPG, PNG, WEBP, GIF, AVIF o BMP.");
      if (input.current) input.current.value = "";
      return;
    }

    if (archivo.size > MAX_FOTO_BYTES) {
      setError("La imagen no puede superar los 5 MB.");
      if (input.current) input.current.value = "";
      return;
    }

    const datos = new FormData();
    datos.append("archivo", archivo);
    setSubiendo(true);

    try {
      const respuesta = await api.post<RespuestaUpload>("/uploads", datos, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onCambiar(respuesta.data.data.url);
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo subir la imagen. Intentá nuevamente.",
      );
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  const borde = error ? "danger.300" : arrastrando ? "brand.400" : "ink.300";

  return (
    <Box
      borderWidth="1.5px"
      borderStyle={src ? "solid" : "dashed"}
      borderColor={borde}
      borderRadius="xl"
      bg="white"
      overflow="hidden"
      transition="border-color 0.15s ease, background 0.15s ease"
      onDragOver={(evento) => {
        evento.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(evento) => {
        evento.preventDefault();
        setArrastrando(false);
        void subir(evento.dataTransfer.files[0]);
      }}
    >
      <Box
        position="relative"
        w="full"
        aspectRatio="4 / 3"
        bg={arrastrando ? "brand.50" : "ink.50"}
        overflow="hidden"
      >
        {src ? (
          <chakra.button
            type="button"
            onClick={onAmpliar}
            aria-label="Ampliar imagen del producto"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="full"
            h="full"
            cursor="zoom-in"
          >
            <chakra.img
              src={src}
              alt={nombre ? `Imagen de ${nombre}` : "Imagen del producto"}
              w="full"
              h="full"
              objectFit="contain"
              p="2"
            />
          </chakra.button>
        ) : (
          <chakra.button
            type="button"
            onClick={() => input.current?.click()}
            disabled={subiendo}
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap="2"
            w="full"
            h="full"
            color="brand.600"
            cursor="pointer"
            _hover={{ color: "brand.700", bg: "brand.50" }}
          >
            <ImagePlus size={32} />
            <Text fontSize="sm" fontWeight="semibold">
              Subir imagen
            </Text>
            <Text fontSize="2xs" color="ink.500">
              Arrastrá o hacé clic
            </Text>
          </chakra.button>
        )}

        {src && (
          <Flex position="absolute" top="2" right="2" gap="1">
            <Button
              type="button"
              size="xs"
              variant="outline"
              bg="white"
              borderColor="ink.200"
              w="7"
              h="7"
              minW="7"
              p="0"
              title="Cambiar imagen"
              aria-label="Cambiar imagen"
              onClick={() => input.current?.click()}
              disabled={subiendo}
            >
              <Upload size={13} />
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              bg="white"
              borderColor="ink.200"
              colorPalette="red"
              w="7"
              h="7"
              minW="7"
              p="0"
              title="Quitar imagen"
              aria-label="Quitar imagen"
              onClick={() => onCambiar("")}
              disabled={subiendo}
            >
              <Trash2 size={13} />
            </Button>
          </Flex>
        )}

        {subiendo && (
          <Flex
            position="absolute"
            inset="0"
            align="center"
            justify="center"
            bg="whiteAlpha.800"
          >
            <Stack align="center" gap="2">
              <Spinner size="md" color="brand.500" />
              <Text fontSize="2xs" color="ink.600">
                Subiendo…
              </Text>
            </Stack>
          </Flex>
        )}
      </Box>

      <Box px="2.5" py="1.5" borderTopWidth="1px" borderColor="ink.100">
        {error ? (
          <Text role="alert" fontSize="2xs" color="danger.600">
            {error}
          </Text>
        ) : (
          <Text fontSize="2xs" color="ink.500">
            JPG, PNG o WEBP · máx. 5 MB
          </Text>
        )}
      </Box>

      <chakra.input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp"
        display="none"
        onChange={(evento) => void subir(evento.target.files?.[0])}
      />
    </Box>
  );
}

function VistaPrevia({
  valores,
  stockActual,
  categoria,
  proveedor,
}: {
  valores: ProductoFormValues;
  stockActual: number;
  categoria?: CategoriaProducto;
  proveedor?: ProveedorProducto;
}) {
  const minimo = aNumero(valores.stockMinimo);
  const estado = estadoStockProducto({
    stockActual,
    stockMinimo: minimo,
  });
  const precio = valores.precioVenta ?? 0;
  const costo = valores.precioCosto ?? 0;
  const margen = costo > 0 ? ((precio - costo) / costo) * 100 : null;

  return (
    <Box
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p="4"
      bg="white"
    >
      <Flex align="center" gap="2" mb="2">
        <Camera size={15} color="var(--chakra-colors-ink-400)" />
        <Text fontSize="xs" fontWeight="semibold" color="ink.600">
          Vista previa del catálogo
        </Text>
      </Flex>

      <Text fontWeight="bold" color="ink.900" lineHeight="1.3">
        {valores.nombre.trim() || "Nombre del producto"}
      </Text>
      <Text fontSize="xs" color="ink.500" mt="0.5">
        {valores.marca.trim() || valores.laboratorio.trim() || "Sin marca"}
      </Text>

      <Flex gap="1.5" wrap="wrap" mt="3">
        {categoria ? (
          <Badge colorPalette="brand" variant="subtle" size="sm">
            {categoria.nombre}
          </Badge>
        ) : (
          <Badge colorPalette="gray" variant="subtle" size="sm">
            Sin categoría
          </Badge>
        )}
        {valores.esMedicamento && (
          <Badge colorPalette="purple" variant="subtle" size="sm">
            Medicamento
          </Badge>
        )}
        {valores.esControlado && (
          <Badge colorPalette="red" variant="subtle" size="sm">
            Controlado
          </Badge>
        )}
      </Flex>

      <Flex align="flex-end" justify="space-between" gap="3" mt="4">
        <Box>
          <Text fontSize="xs" color="ink.500">
            Precio de venta
          </Text>
          <Text
            fontSize="lg"
            fontWeight="bold"
            color="ink.900"
            fontVariantNumeric="tabular-nums"
          >
            {formatMoneda(precio)}
          </Text>
        </Box>
        <Badge
          colorPalette={
            estado === "disponible"
              ? "success"
              : estado === "bajo"
                ? "warning"
                : "red"
          }
          variant="solid"
          size="sm"
        >
          {estado === "disponible"
            ? "Con stock"
            : estado === "bajo"
              ? "Stock bajo"
              : "Agotado"}
        </Badge>
      </Flex>

      <Box mt="3" pt="3" borderTopWidth="1px" borderColor="ink.100">
        <Text fontSize="xs" color="ink.500">
          {proveedor
            ? `Proveedor: ${proveedor.nombreMostrable ?? proveedor.razonSocial}`
            : "Sin proveedor asignado"}
        </Text>
        {margen !== null && (
          <Text fontSize="xs" color="ink.500" mt="0.5">
            Margen sobre costo:{" "}
            <chakra.span fontWeight="semibold" color="brand.700">
              {margen.toFixed(1)}%
            </chakra.span>
          </Text>
        )}
      </Box>
    </Box>
  );
}

export function ProductoForm({
  producto,
  categorias = [],
  proveedores = [],
  onGuardar,
  errorGeneral,
  erroresServidor,
}: ProductoFormProps) {
  const [valores, setValores] = useState<ProductoFormValues>(VALORES_INICIALES);
  const [errores, setErrores] = useState<Errores>({});
  const [proveedorAbierto, setProveedorAbierto] = useState(false);
  const [tabActivo, setTabActivo] = useState<TabProducto>("general");
  const [vistaPreviaAbierta, setVistaPreviaAbierta] = useState(false);
  const [verFoto, setVerFoto] = useState(false);
  const { puede } = useAuth();
  const crearProveedor = useCrearProveedor();
  const queryClient = useQueryClient();

  const esEdicion = Boolean(producto);

  useEffect(() => {
    setTabActivo("general");
    setVistaPreviaAbierta(false);
    setVerFoto(false);

    if (!producto) {
      setValores(VALORES_INICIALES);
      setErrores({});
      return;
    }

    setValores({
      codigo: producto.codigo ?? "",
      nombre: producto.nombre ?? "",
      descripcion: producto.descripcion ?? "",
      codigoBarras: producto.codigoBarras ?? "",
      codigoSifen: producto.codigoSifen ?? "",
      categoriaId: producto.categoria?.id ? String(producto.categoria.id) : "",
      proveedorId: producto.proveedor?.id ? String(producto.proveedor.id) : "",
      marca: producto.marca ?? "",
      laboratorio: producto.laboratorio ?? "",
      principioActivo: producto.principioActivo ?? "",
      concentracion: producto.concentracion ?? "",
      presentacion: producto.presentacion ?? "",
      especieDestino: producto.especieDestino ?? "",
      registroSenacsa: producto.registroSenacsa ?? "",
      ubicacion: producto.ubicacion ?? "",
      unidadMedida: producto.unidadMedida ?? "unidad",
      esMedicamento: producto.esMedicamento ?? false,
      esControlado: producto.esControlado ?? false,
      requiereReceta: producto.requiereReceta ?? false,
      requiereLote: producto.requiereLote ?? true,
      precioVenta: Number(producto.precioVenta) || 0,
      precioCosto: Number(producto.precioCosto) || 0,
      porcentajeIva: String(producto.porcentajeIva ?? 5),
      stockMinimo: numeroATexto(producto.stockMinimo),
      fotoUrl: producto.fotoUrl ?? "",
      activo: producto.activo ?? true,
    });
    setErrores({});
  }, [producto]);

  function cambiar<K extends keyof ProductoFormValues>(
    campo: K,
    nuevo: ProductoFormValues[K],
  ) {
    setValores((previo) => ({ ...previo, [campo]: nuevo }));
    setErrores((previo) => ({ ...previo, [campo]: undefined }));
  }

  function enfocarCampo(campo: keyof ProductoFormValues) {
    const id = ID_POR_CAMPO[campo];
    if (!id) return;

    window.requestAnimationFrame(() => {
      const contenedor = document.getElementById(id);
      const control = contenedor?.matches("input, textarea, select, button")
        ? contenedor
        : contenedor?.querySelector<HTMLElement>(
            "input, textarea, select, button",
          );

      control?.focus();
    });
  }

  function validar(): boolean {
    const nuevos: Errores = {};

    if (valores.nombre.trim().length < 2) {
      nuevos.nombre = "Escribí al menos 2 caracteres.";
    }

    if ((valores.precioVenta ?? 0) < 0) {
      nuevos.precioVenta = "El precio no puede ser negativo.";
    }
    if ((valores.precioCosto ?? 0) < 0) {
      nuevos.precioCosto = "El costo no puede ser negativo.";
    }
    if (aNumero(valores.stockMinimo) < 0) {
      nuevos.stockMinimo = "El stock mínimo no puede ser negativo.";
    }
    if (valores.esControlado && !valores.esMedicamento) {
      nuevos.esControlado = "Marcá primero que el producto es un medicamento.";
    }

    const camposConError = Object.keys(nuevos) as (keyof ProductoFormValues)[];
    if (camposConError.length > 0) {
      const primerCampo = camposConError[0];
      setTabActivo(TAB_POR_CAMPO[primerCampo]);
      enfocarCampo(primerCampo);
    }

    setErrores(nuevos);
    return camposConError.length === 0;
  }

  function enviar() {
    if (!validar()) return;

    const datos: ProductoFormData = {
      codigo: valores.codigo.trim() || undefined,
      nombre: valores.nombre.trim(),
      descripcion: valores.descripcion.trim() || null,
      codigoBarras: valores.codigoBarras.trim() || null,
      codigoSifen: valores.codigoSifen.trim() || null,
      categoriaId: valores.categoriaId ? Number(valores.categoriaId) : null,
      proveedorId: valores.proveedorId ? Number(valores.proveedorId) : null,
      marca: valores.marca.trim() || null,
      laboratorio: valores.laboratorio.trim() || null,
      principioActivo: valores.principioActivo.trim() || null,
      concentracion: valores.concentracion.trim() || null,
      presentacion: valores.presentacion.trim() || null,
      especieDestino: valores.especieDestino.trim() || null,
      registroSenacsa: valores.registroSenacsa.trim() || null,
      ubicacion: valores.ubicacion.trim() || null,
      unidadMedida: valores.unidadMedida,
      esMedicamento: valores.esMedicamento,
      esControlado: valores.esControlado,
      requiereReceta: valores.requiereReceta,
      requiereLote: valores.requiereLote,
      requiereVencimiento: valores.requiereLote,
      precioVenta: valores.precioVenta ?? 0,
      precioCosto: valores.precioCosto ?? 0,
      porcentajeIva: Number(valores.porcentajeIva),
      stockMinimo: aNumero(valores.stockMinimo),
      fotoUrl: valores.fotoUrl,
      activo: valores.activo,
    };

    onGuardar(datos);
  }

  function guardarProveedorRapido(datos: ProveedorFormValues) {
    crearProveedor
      .mutateAsync({
        documento: datos.documento.trim(),
        razonSocial: datos.razonSocial.trim(),
        nombreFantasia: datos.nombreFantasia.trim() || undefined,
        email: datos.email.trim() || undefined,
        telefono: datos.telefono.trim() || undefined,
        direccion: datos.direccion.trim() || undefined,
        departamento: datos.departamento.trim() || undefined,
        ciudad: datos.ciudad.trim() || undefined,
        barrio: datos.barrio.trim() || undefined,
        contactoNombre: datos.contactoNombre.trim() || undefined,
        notas: datos.notas.trim() || undefined,
      })
      .then((proveedor) => {
        setProveedorId(String(proveedor.id));
        setProveedorAbierto(false);
        void queryClient.invalidateQueries({
          queryKey: ["productos", "proveedores"],
        });
        toaster.success({
          title: "Proveedor registrado",
          description:
            proveedor.nombreMostrable ??
            proveedor.razonSocial ??
            "Ya está disponible en el producto.",
        });
      })
      .catch((error) => {
        console.error(mensajeDeError(error));
      });
  }

  function setProveedorId(id: string) {
    cambiar("proveedorId", id);
  }

  const categoriaSeleccionada = categorias.find(
    (categoria) => String(categoria.id) === valores.categoriaId,
  );
  const proveedorSeleccionado = proveedores.find(
    (proveedor) => String(proveedor.id) === valores.proveedorId,
  );
  const stockActual = esEdicion
    ? Number(producto?.stockActual ?? 0)
    : 0;

  const erroresMostrados: Errores = { ...erroresServidor, ...errores };
  const erroresPorTab = contarErroresPorTab(erroresMostrados);
  const firmaErroresServidor = (
    Object.keys(erroresServidor ?? {}) as (keyof ProductoFormValues)[]
  )
    .filter((campo) => erroresServidor?.[campo])
    .join("|");

  useEffect(() => {
    if (!firmaErroresServidor) return;

    const primerCampo = firmaErroresServidor.split(
      "|",
    )[0] as keyof ProductoFormValues;
    setTabActivo(TAB_POR_CAMPO[primerCampo]);
  }, [firmaErroresServidor]);

  const costo = valores.precioCosto ?? 0;
  const venta = valores.precioVenta ?? 0;
  const ganancia = venta - costo;

  return (
    <>
      <chakra.form
        id={ID_FORMULARIO}
        noValidate
        onSubmit={(evento: React.FormEvent) => {
          evento.preventDefault();
          enviar();
        }}
      >
        <Flex
          align="center"
          justify="space-between"
          gap="3"
          px="3"
          py="2"
          mb="3"
          borderWidth="1px"
          borderColor={valores.activo ? "success.200" : "ink.200"}
          bg={valores.activo ? "success.subtle" : "ink.50"}
          borderRadius="lg"
        >
          <Flex align="center" gap="2" minW="0">
            <Box
              w="2"
              h="2"
              borderRadius="full"
              bg={valores.activo ? "success.500" : "ink.400"}
              flexShrink={0}
            />
            <Text fontSize="sm" fontWeight="medium" color="ink.800">
              {valores.activo ? "Producto activo" : "Producto inactivo"}
            </Text>
            <Text
              fontSize="xs"
              color="ink.500"
              display={{ base: "none", md: "block" }}
              truncate
            >
              {valores.activo
                ? "Visible en ventas y catálogo"
                : "Oculto en ventas y catálogo"}
            </Text>
          </Flex>
          <Switch
            checked={valores.activo}
            onCheckedChange={(detalle) =>
              cambiar("activo", detalle.checked === true)
            }
            colorPalette="brand"
            flexShrink={0}
            aria-label="Producto activo"
          />
        </Flex>

        <Tabs.Root
          value={tabActivo}
          onValueChange={(detalle) =>
            setTabActivo(detalle.value as TabProducto)
          }
          variant="plain"
        >
          <Tabs.List
            position="sticky"
            top="0"
            zIndex="2"
            bg="ink.50"
            p="1"
            borderRadius="lg"
            gap="1"
            overflowX="auto"
            mb="5"
          >
            <TabBoton
              valor="general"
              icono={Package}
              etiqueta="General"
              errores={erroresPorTab.general}
            />
            <TabBoton
              valor="clinica"
              icono={FlaskConical}
              etiqueta="Clínica"
              errores={erroresPorTab.clinica}
            />
            <TabBoton
              valor="precios"
              icono={Wallet}
              etiqueta="Precios"
              errores={erroresPorTab.precios}
            />
            <TabBoton
              valor="inventario"
              icono={Boxes}
              etiqueta="Inventario"
              errores={erroresPorTab.inventario}
            />
          </Tabs.List>

          <Grid
            templateColumns={{ base: "1fr", lg: "18rem minmax(0, 1fr)" }}
            gap="5"
            alignItems="start"
          >
            <Stack
              gap="4"
              display={{
                base: tabActivo === "general" ? "flex" : "none",
                lg: "flex",
              }}
            >
              <FotoProducto
                url={valores.fotoUrl}
                nombre={valores.nombre}
                onCambiar={(url) => cambiar("fotoUrl", url)}
                onAmpliar={() => setVerFoto(true)}
              />

              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setVistaPreviaAbierta((abierta) => !abierta)}
              >
                <Camera size={14} />
                {vistaPreviaAbierta ? "Ocultar" : "Vista previa"}
              </Button>

              {vistaPreviaAbierta && (
                <VistaPrevia
                  valores={valores}
                  stockActual={stockActual}
                  categoria={categoriaSeleccionada}
                  proveedor={proveedorSeleccionado}
                />
              )}
            </Stack>

            <Box minW="0">
              <Tabs.Content value="general" pt="0">
                <Stack gap="4">
                  <Grid
                    templateColumns={{
                      base: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    }}
                    gap="4"
                  >
                    <Campo
                      id="producto-nombre"
                      etiqueta="Nombre del producto"
                      requerido
                      error={erroresMostrados.nombre}
                      anchoCompleto
                    >
                      <Input
                        value={valores.nombre}
                        onChange={(evento) =>
                          cambiar("nombre", evento.target.value)
                        }
                        placeholder="Ej.: Amoxicilina 250 mg"
                        autoFocus
                      />
                    </Campo>

                    <Campo
                      id="producto-codigo"
                      etiqueta="Código interno (SKU)"
                      ayuda="Si lo dejás vacío se genera automáticamente."
                      error={erroresMostrados.codigo}
                    >
                      <Input
                        value={valores.codigo}
                        onChange={(evento) =>
                          cambiar("codigo", evento.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
                        }
                        placeholder="Ej.: MED-001"
                        fontFamily="mono"
                      />
                    </Campo>

                    <Campo
                      id="producto-barras"
                      etiqueta="Código de barras"
                      ayuda="Escanealo con el lector o escribilo a mano."
                      error={erroresMostrados.codigoBarras}
                    >
                      <Input
                        value={valores.codigoBarras}
                        onChange={(evento) =>
                          cambiar("codigoBarras", evento.target.value)
                        }
                        placeholder="Ej.: 7891234567890"
                        fontFamily="mono"
                      />
                    </Campo>

                    <Campo id="producto-categoria" etiqueta="Categoría">
                      <NativeSelect.Root>
                        <NativeSelect.Field
                          value={valores.categoriaId}
                          onChange={(evento) => {
                            const categoriaId = evento.target.value;
                            const categoria = categorias.find(
                              (item) => String(item.id) === categoriaId,
                            );
                            cambiar("categoriaId", categoriaId);

                            if (categoria) {
                              cambiar(
                                "requiereLote",
                                categoriaControlaLote(categoria.nombre),
                              );
                            }
                          }}
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

                    <Campo
                      id="producto-proveedor"
                      etiqueta="Proveedor"
                      ayuda="Podés registrar uno nuevo sin salir del formulario."
                    >
                      <Flex gap="2">
                        <NativeSelect.Root flex="1">
                          <NativeSelect.Field
                            value={valores.proveedorId}
                            onChange={(evento) =>
                              cambiar("proveedorId", evento.target.value)
                            }
                          >
                            <option value="">Sin proveedor</option>
                            {proveedores.map((proveedor) => (
                              <option key={proveedor.id} value={proveedor.id}>
                                {proveedor.nombreMostrable ??
                                  proveedor.razonSocial}
                              </option>
                            ))}
                          </NativeSelect.Field>
                          <NativeSelect.Indicator />
                        </NativeSelect.Root>

                        {puede("proveedores.crear") && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            flexShrink={0}
                            onClick={() => setProveedorAbierto(true)}
                          >
                            <Tag size={15} /> Nuevo
                          </Button>
                        )}
                      </Flex>
                    </Campo>

                    <Campo id="producto-marca" etiqueta="Marca">
                      <Input
                        value={valores.marca}
                        onChange={(evento) =>
                          cambiar("marca", evento.target.value)
                        }
                        placeholder="Ej.: Bayer"
                      />
                    </Campo>

                    <Campo id="producto-laboratorio" etiqueta="Laboratorio">
                      <Input
                        value={valores.laboratorio}
                        onChange={(evento) =>
                          cambiar("laboratorio", evento.target.value)
                        }
                        placeholder="Ej.: Richmond"
                      />
                    </Campo>

                    <Campo
                      id="producto-sifen"
                      etiqueta="Código SIFEN"
                      ayuda="Solo si tu facturación electrónica lo requiere."
                    >
                      <Input
                        value={valores.codigoSifen}
                        onChange={(evento) =>
                          cambiar("codigoSifen", evento.target.value)
                        }
                        placeholder="Opcional"
                        fontFamily="mono"
                      />
                    </Campo>

                    <Campo
                      id="producto-descripcion"
                      etiqueta="Descripción"
                      ayuda="Indicaciones, composición o cualquier detalle útil."
                      anchoCompleto
                    >
                      <Textarea
                        value={valores.descripcion}
                        onChange={(evento) =>
                          cambiar("descripcion", evento.target.value)
                        }
                        placeholder="Describí el producto, su uso y presentación."
                        rows={3}
                      />
                    </Campo>
                  </Grid>

                </Stack>
              </Tabs.Content>

              <Tabs.Content value="clinica" pt="0">
                <Stack gap="4">
                  <Interruptor
                    titulo="Es medicamento"
                    descripcion="Se incluye en recetas y control de stock clínico."
                    activo={valores.esMedicamento}
                    onCambiar={(valor) => {
                      cambiar("esMedicamento", valor);
                      if (!valor) {
                        cambiar("esControlado", false);
                        cambiar("requiereReceta", false);
                      }
                    }}
                    icono={Pill}
                  />

                  {valores.esMedicamento ? (
                    <>
                      <Grid
                        templateColumns={{
                          base: "1fr",
                          sm: "repeat(2, minmax(0, 1fr))",
                        }}
                        gap="3"
                      >
                        <Interruptor
                          titulo="Requiere receta"
                          descripcion="Se exige una prescripción veterinaria para venderlo."
                          activo={valores.requiereReceta}
                          onCambiar={(valor) =>
                            cambiar("requiereReceta", valor)
                          }
                          icono={BadgeCheck}
                        />
                        <Interruptor
                          titulo="Producto controlado"
                          descripcion="Marcalo si está sujeto a registro especial."
                          activo={valores.esControlado}
                          onCambiar={(valor) => cambiar("esControlado", valor)}
                          icono={ShieldAlert}
                        />
                      </Grid>

                      {erroresMostrados.esControlado && (
                        <Text role="alert" fontSize="xs" color="danger.600">
                          {erroresMostrados.esControlado}
                        </Text>
                      )}

                      <Grid
                        templateColumns={{
                          base: "1fr",
                          sm: "repeat(2, minmax(0, 1fr))",
                        }}
                        gap="4"
                      >
                        <Campo
                          id="producto-principio"
                          etiqueta="Principio activo"
                          ayuda="Ej.: Amoxicilina trihidrato."
                        >
                          <Input
                            value={valores.principioActivo}
                            onChange={(evento) =>
                              cambiar("principioActivo", evento.target.value)
                            }
                            placeholder="Ej.: Ivermectina"
                            disabled={!valores.esMedicamento}
                          />
                        </Campo>

                        <Campo
                          id="producto-concentracion"
                          etiqueta="Concentración"
                          ayuda="Ej.: 250 mg / 5 ml."
                        >
                          <Input
                            value={valores.concentracion}
                            onChange={(evento) =>
                              cambiar("concentracion", evento.target.value)
                            }
                            placeholder="Ej.: 50 mg/ml"
                            disabled={!valores.esMedicamento}
                          />
                        </Campo>

                        <Campo
                          id="producto-presentacion"
                          etiqueta="Presentación"
                        >
                          <Input
                            value={valores.presentacion}
                            onChange={(evento) =>
                              cambiar("presentacion", evento.target.value)
                            }
                            placeholder="Ej.: Frasco de 100 ml"
                          />
                        </Campo>

                        <Campo id="producto-especie" etiqueta="Especie destino">
                          <NativeSelect.Root>
                            <NativeSelect.Field
                              value={valores.especieDestino}
                              onChange={(evento) =>
                                cambiar("especieDestino", evento.target.value)
                              }
                            >
                              <option value="">Sin especificar</option>
                              {ESPECIES_DESTINO.map((especie) => (
                                <option key={especie} value={especie}>
                                  {especie}
                                </option>
                              ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Campo>

                        <Campo
                          id="producto-senacsa"
                          etiqueta="Registro SENACSA"
                          ayuda="Número de registro sanitario, si aplica."
                        >
                          <Input
                            value={valores.registroSenacsa}
                            onChange={(evento) =>
                              cambiar("registroSenacsa", evento.target.value)
                            }
                            placeholder="Ej.: 12345"
                            fontFamily="mono"
                          />
                        </Campo>
                      </Grid>
                    </>
                  ) : (
                    <Flex
                      align="flex-start"
                      gap="3"
                      p="4"
                      borderWidth="1px"
                      borderColor="ink.200"
                      borderRadius="lg"
                      bg="ink.50"
                    >
                      <Pill
                        size={18}
                        color="var(--chakra-colors-ink-400)"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <Box>
                        <Text fontSize="sm" fontWeight="medium" color="ink.800">
                          Este producto no está marcado como medicamento
                        </Text>
                        <Text
                          fontSize="xs"
                          color="ink.600"
                          mt="1"
                          lineHeight="1.5"
                        >
                          Activá “Es medicamento” para cargar principio activo,
                          concentración, presentación y registro sanitario.
                        </Text>
                      </Box>
                    </Flex>
                  )}

                </Stack>
              </Tabs.Content>

              <Tabs.Content value="precios" pt="0">
                <Stack gap="4">
                  <Grid
                    templateColumns={{
                      base: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    }}
                    gap="4"
                  >
                    <Box>
                      <MoneyInput
                        id="producto-costo"
                        label="Precio de costo"
                        value={valores.precioCosto}
                        onChange={(valor) => cambiar("precioCosto", valor)}
                        placeholder="0"
                        errorText={erroresMostrados.precioCosto}
                      />
                    </Box>

                    <Box>
                      <MoneyInput
                        id="producto-venta"
                        label="Precio de venta"
                        value={valores.precioVenta}
                        onChange={(valor) => cambiar("precioVenta", valor)}
                        placeholder="0"
                        errorText={erroresMostrados.precioVenta}
                      />
                    </Box>

                    <Campo id="producto-iva" etiqueta="IVA">
                      <NativeSelect.Root>
                        <NativeSelect.Field
                          value={valores.porcentajeIva}
                          onChange={(evento) =>
                            cambiar("porcentajeIva", evento.target.value)
                          }
                        >
                          <option value="5">5 % — general</option>
                          <option value="10">
                            10 % — bienes de uso humano
                          </option>
                          <option value="0">Exento</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Campo>

                    <Campo id="producto-unidad" etiqueta="Unidad de medida">
                      <NativeSelect.Root>
                        <NativeSelect.Field
                          value={valores.unidadMedida}
                          onChange={(evento) =>
                            cambiar("unidadMedida", evento.target.value)
                          }
                        >
                          {UNIDADES_MEDIDA.map((unidad) => (
                            <option key={unidad} value={unidad}>
                              {unidad}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Campo>

                    <Box
                      gridColumn="1 / -1"
                      p="4"
                      borderRadius="lg"
                      bg={ganancia >= 0 ? "success.subtle" : "danger.subtle"}
                      borderWidth="1px"
                      borderColor={ganancia >= 0 ? "success.100" : "danger.100"}
                    >
                      <Flex
                        align="center"
                        justify="space-between"
                        gap="3"
                        wrap="wrap"
                      >
                        <Flex align="center" gap="3">
                          <Flex
                            align="center"
                            justify="center"
                            w="9"
                            h="9"
                            borderRadius="lg"
                            bg="white"
                            color={ganancia >= 0 ? "success.600" : "danger.600"}
                          >
                            <Beaker size={18} />
                          </Flex>
                          <Box>
                            <Text
                              fontSize="sm"
                              fontWeight="semibold"
                              color="ink.900"
                            >
                              {ganancia >= 0
                                ? "Ganancia por unidad"
                                : "Vendés por debajo del costo"}
                            </Text>
                            <Text fontSize="xs" color="ink.600" mt="0.5">
                              {costo > 0
                                ? `Margen de ${(((venta - costo) / costo) * 100).toFixed(1)} % sobre el costo`
                                : "Cargá el costo para calcular el margen."}
                            </Text>
                          </Box>
                        </Flex>
                        <Text
                          fontSize="xl"
                          fontWeight="bold"
                          color={ganancia >= 0 ? "success.700" : "danger.700"}
                          fontVariantNumeric="tabular-nums"
                        >
                          {formatMoneda(ganancia)}
                        </Text>
                      </Flex>
                    </Box>
                  </Grid>
                </Stack>
              </Tabs.Content>

              <Tabs.Content value="inventario" pt="0">
                <Stack gap="4">
                  <Interruptor
                    titulo="Controla lote y vencimiento"
                    descripcion="Activalo para medicamentos y alimentos. Si lo desactivás, las compras y la carga inicial solo pedirán cantidad."
                    activo={valores.requiereLote}
                    onCambiar={(valor) => cambiar("requiereLote", valor)}
                    icono={Barcode}
                  />

                  <Grid
                    templateColumns={{
                      base: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    }}
                    gap="4"
                  >
                    <Campo
                      id="producto-stock-minimo"
                      etiqueta="Stock mínimo"
                      ayuda="Te avisamos cuando el stock llegue a este valor."
                      error={erroresMostrados.stockMinimo}
                    >
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valores.stockMinimo}
                        onChange={(evento) =>
                          cambiar("stockMinimo", evento.target.value)
                        }
                        fontVariantNumeric="tabular-nums"
                      />
                    </Campo>

                    {esEdicion ? (
                      <Box
                        p="3.5"
                        borderWidth="1px"
                        borderColor="ink.200"
                        borderRadius="lg"
                        bg="ink.50"
                      >
                        <Text fontSize="sm" fontWeight="medium" color="ink.800">
                          Stock actual:{" "}
                          {numeroATexto(stockActual) || "0"}{" "}
                          {valores.unidadMedida}
                        </Text>
                        <Text
                          fontSize="xs"
                          color="ink.500"
                          mt="1"
                          lineHeight="1.5"
                        >
                          Para mover el stock usá “Ajustar stock” desde la ficha
                          del producto. Así queda registrado el movimiento.
                        </Text>
                      </Box>
                    ) : (
                      <Alert status="info" rounded="md" title="El stock se carga aparte">
                        El producto se crea con stock 0. Después registrá las
                        unidades y sus lotes desde “Carga inicial de stock” o con
                        una factura de compra.
                      </Alert>
                    )}

                    <Campo
                      id="producto-ubicacion"
                      etiqueta="Ubicación en depósito"
                      ayuda="Estante, heladera o caja donde se guarda."
                      anchoCompleto
                    >
                      <Input
                        value={valores.ubicacion}
                        onChange={(evento) =>
                          cambiar("ubicacion", evento.target.value)
                        }
                        placeholder="Ej.: Estante A3"
                      />
                    </Campo>
                  </Grid>
                </Stack>
              </Tabs.Content>
            </Box>
          </Grid>
        </Tabs.Root>

        {errorGeneral && (
          <Alert status="error" title="No se pudo guardar el producto">
            {errorGeneral}
          </Alert>
        )}
      </chakra.form>

      <DialogRoot
        open={proveedorAbierto}
        onOpenChange={(detalle) => {
          if (!detalle.open) setProveedorAbierto(false);
        }}
        size="cover"
      >
        <DialogContent maxW="44rem" borderRadius="lg" overflow="hidden" p="0">
          <DialogHeader
            px="6"
            pt="5"
            pb="4"
            bg="brand.800"
            borderBottomWidth="1px"
            borderColor="brand.900"
          >
            <DialogTitle fontSize="lg" fontWeight="bold" color="white">
              Nuevo proveedor
            </DialogTitle>
            <Text fontSize="sm" color="brand.100" mt="1">
              Se registra y queda seleccionado en este producto.
            </Text>
          </DialogHeader>

          <DialogBody
            px="6"
            py="5"
            maxH="calc(100dvh - 15rem)"
            overflowY="auto"
          >
            <ProveedorForm
              onGuardar={guardarProveedorRapido}
              formId={ID_PROVEEDOR_RAPIDO}
              errorGeneral={
                crearProveedor.isError
                  ? mensajeDeError(crearProveedor.error)
                  : null
              }
            />
          </DialogBody>

          <DialogFooter
            px="6"
            py="4"
            borderTopWidth="1px"
            borderColor="ink.200"
            gap="2"
            bg="ink.50"
          >
            <Button
              variant="ghost"
              onClick={() => setProveedorAbierto(false)}
              disabled={crearProveedor.isPending}
            >
              Cancelar
            </Button>
            <Button
              colorPalette="brand"
              loading={crearProveedor.isPending}
              loadingText="Guardando…"
              onClick={() => {
                document
                  .querySelector<HTMLFormElement>(`#${ID_PROVEEDOR_RAPIDO}`)
                  ?.requestSubmit();
              }}
            >
              Registrar proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={verFoto}
        onOpenChange={({ open }) => setVerFoto(open)}
        size="xl"
      >
        <DialogContent maxW="min(92vw, 56rem)" p="4">
          <DialogHeader
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="3"
          >
            <Box minW="0">
              <DialogTitle truncate>
                {valores.nombre || "Imagen del producto"}
              </DialogTitle>
            </Box>
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              borderRadius="full"
              onClick={() => setVerFoto(false)}
              aria-label="Cerrar vista ampliada"
              title="Cerrar"
            >
              <X size={18} />
            </IconButton>
          </DialogHeader>
          <DialogBody>
            {valores.fotoUrl && (
              <chakra.img
                src={urlDeArchivo(valores.fotoUrl)}
                alt={`Imagen ampliada de ${valores.nombre || "el producto"}`}
                w="full"
                maxH="75vh"
                objectFit="contain"
                borderRadius="md"
              />
            )}
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
