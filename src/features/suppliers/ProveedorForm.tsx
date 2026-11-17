import { Box, Button, Flex, Grid, chakra } from "@chakra-ui/react";
import { Building2, Mail, MapPin, Phone, StickyNote, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { CiudadInput } from "@/components/fields/CiudadInput";
import type { Proveedor } from "@/types/dominio";
import { formatearRucProveedor } from "./proveedores.utils";

export interface ProveedorFormValues {
  documento: string;
  razonSocial: string;
  nombreFantasia: string;
  email: string;
  telefono: string;
  direccion: string;
  departamento: string;
  ciudad: string;
  barrio: string;
  contactoNombre: string;
  notas: string;
  activo: boolean;
}

type Errores = Partial<Record<keyof ProveedorFormValues, string>>;

const VALORES_INICIALES: ProveedorFormValues = {
  documento: "",
  razonSocial: "",
  nombreFantasia: "",
  email: "",
  telefono: "",
  direccion: "",
  departamento: "",
  ciudad: "",
  barrio: "",
  contactoNombre: "",
  notas: "",
  activo: true,
};

/**
 * Formulario de proveedor.
 *
 * Mismo esqueleto que el de clientes, con los campos que un proveedor necesita
 * de verdad: a dónde se manda el pedido y a quién llamar dentro de la empresa.
 */
export function ProveedorForm({
  proveedor,
  onGuardar,
  errorGeneral,
  erroresServidor,
  detallesServidor,
  formId = "proveedor-form",
}: {
  proveedor?: Proveedor | null;
  onGuardar: (valores: ProveedorFormValues) => void;
  errorGeneral?: string | null;
  erroresServidor?: Errores;
  detallesServidor?: string[];
  formId?: string;
}) {
  const [valores, setValores] = useState<ProveedorFormValues>(VALORES_INICIALES);
  const [errores, setErrores] = useState<Errores>({});

  useEffect(() => {
    if (!proveedor) {
      setValores(VALORES_INICIALES);
      setErrores({});
      return;
    }

    setValores({
      documento: formatearRucProveedor(proveedor.documento),
      razonSocial: proveedor.razonSocial,
      nombreFantasia: proveedor.nombreFantasia ?? "",
      email: proveedor.email ?? "",
      telefono: proveedor.telefono ?? "",
      direccion: proveedor.direccion ?? "",
      departamento: proveedor.departamento ?? "",
      ciudad: proveedor.ciudad ?? "",
      barrio: proveedor.barrio ?? "",
      contactoNombre: proveedor.contactoNombre ?? "",
      notas: proveedor.notas ?? "",
      activo: proveedor.activo,
    });
    setErrores({});
  }, [proveedor]);

  function cambiar<K extends keyof ProveedorFormValues>(
    campo: K,
    nuevo: ProveedorFormValues[K],
  ) {
    setValores((previo) => ({ ...previo, [campo]: nuevo }));
    setErrores((previo) => ({ ...previo, [campo]: undefined }));
  }

  function validar(): boolean {
    const nuevos: Errores = {};
    const documento = valores.documento.replace(/[\s.-]/g, "");

    if (!documento) {
      nuevos.documento = "El RUC es obligatorio";
    } else if (!/^\d{8,11}$/.test(documento)) {
      nuevos.documento = "El RUC debe tener entre 8 y 11 dígitos";
    }

    if (valores.razonSocial.trim().length < 3) {
      nuevos.razonSocial = "La razón social es obligatoria";
    }

    const limitesTexto: Array<{
      campo: keyof ProveedorFormValues;
      valor: string;
      maximo: number;
      etiqueta: string;
    }> = [
      { campo: "nombreFantasia", valor: valores.nombreFantasia, maximo: 150, etiqueta: "El nombre de fantasía" },
      { campo: "direccion", valor: valores.direccion, maximo: 400, etiqueta: "La dirección" },
      { campo: "departamento", valor: valores.departamento, maximo: 80, etiqueta: "El departamento" },
      { campo: "ciudad", valor: valores.ciudad, maximo: 80, etiqueta: "La ciudad" },
      { campo: "barrio", valor: valores.barrio, maximo: 120, etiqueta: "El barrio" },
      { campo: "contactoNombre", valor: valores.contactoNombre, maximo: 120, etiqueta: "El contacto" },
      { campo: "notas", valor: valores.notas, maximo: 1000, etiqueta: "Las notas" },
    ];

    for (const { campo, valor, maximo, etiqueta } of limitesTexto) {
      if (valor.length > maximo) {
        nuevos[campo] = `${etiqueta} admite hasta ${maximo} caracteres`;
      }
    }

    if (valores.email.length > 254) {
      nuevos.email = "El correo admite hasta 254 caracteres";
    }

    if (valores.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email.trim())) {
      nuevos.email = "Ingresá un correo válido";
    }

    const telefono = valores.telefono.replace(/\D/g, "");
    if (telefono.length > 0 && (telefono.length < 7 || telefono.length > 15)) {
      nuevos.telefono = "Ingresá entre 7 y 15 dígitos";
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!validar()) return;

    onGuardar({
      ...valores,
      documento: valores.documento.replace(/[\s.-]/g, ""),
      razonSocial: valores.razonSocial.trim(),
      email: valores.email.trim().toLowerCase(),
    });
  }

  const error = (campo: keyof ProveedorFormValues) =>
    campo in errores ? errores[campo] : erroresServidor?.[campo];

  return (
    <chakra.form id={formId} onSubmit={enviar} noValidate>
      {errorGeneral && (
        <Alert status="error" rounded="md" mb="4">
          {errorGeneral}
          {detallesServidor && <ErroresApi detalles={detallesServidor} />}
        </Alert>
      )}

      <Separador
        accesorio={
          <Flex align="center" gap="2">
            <chakra.span fontSize="xs" fontWeight="medium" color="ink.500">
              Estado
            </chakra.span>
            <Flex gap="2">
              <Button
                type="button"
                size="sm"
                minW="20"
                variant={valores.activo ? "solid" : "outline"}
                colorPalette={valores.activo ? "success" : "gray"}
                aria-pressed={valores.activo}
                onClick={() => cambiar("activo", true)}
              >
                Activo
              </Button>
              <Button
                type="button"
                size="sm"
                minW="20"
                variant={!valores.activo ? "solid" : "outline"}
                colorPalette={!valores.activo ? "red" : "gray"}
                aria-pressed={!valores.activo}
                onClick={() => cambiar("activo", false)}
              >
                Inactivo
              </Button>
            </Flex>
          </Flex>
        }
      >
        Datos fiscales
      </Separador>

      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
        <CampoConIcono
          id="documento"
          label="RUC"
          placeholder="80012345-0"
          icono={<Building2 size={16} />}
          inputMode="numeric"
          required
          autoFocus
          maxLength={14}
          value={valores.documento}
          onChange={(valor) => cambiar("documento", valor)}
          onBlur={() =>
            cambiar("documento", formatearRucProveedor(valores.documento))
          }
          error={error("documento")}
        />
        <CampoConIcono
          id="razonSocial"
          label="Razón social"
          placeholder="Laboratorios del Sur S.A."
          icono={<Building2 size={16} />}
          required
          maxLength={200}
          value={valores.razonSocial}
          onChange={(valor) => cambiar("razonSocial", valor)}
          error={error("razonSocial")}
        />
      </Grid>

      <CampoConIcono
        id="nombreFantasia"
        label="Nombre de fantasía"
        placeholder="LabSur"
        icono={<Building2 size={16} />}
        maxLength={150}
        value={valores.nombreFantasia}
        onChange={(valor) => cambiar("nombreFantasia", valor)}
        helperText="Si es distinto de la razón social, como suele aparecer en las facturas."
      />

      <Separador>Contacto</Separador>

      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
        <CampoConIcono
          id="contactoNombre"
          label="Persona de contacto"
          placeholder="Lic. Ana Ramírez"
          icono={<UserRound size={16} />}
          maxLength={120}
          value={valores.contactoNombre}
          onChange={(valor) => cambiar("contactoNombre", valor)}
          helperText="A quién llamar cuando hay que hacer un pedido."
        />
        <CampoConIcono
          id="telefono"
          label="Teléfono"
          placeholder="0211234567"
          inputMode="tel"
          icono={<Phone size={16} />}
          maxLength={20}
          value={valores.telefono}
          onChange={(valor) => cambiar("telefono", valor)}
          error={error("telefono")}
        />
      </Grid>

      <CampoConIcono
        id="email"
        label="Correo electrónico"
        placeholder="pedidos@labsur.com"
        inputMode="email"
        icono={<Mail size={16} />}
        maxLength={254}
        value={valores.email}
        onChange={(valor) => cambiar("email", valor)}
        error={error("email")}
      />

      <Separador>Domicilio</Separador>

      <CampoConIcono
        id="direccion"
        label="Dirección"
        placeholder="Av. Eusebio Ayala km 4"
        icono={<MapPin size={16} />}
        maxLength={400}
        value={valores.direccion}
        onChange={(valor) => cambiar("direccion", valor)}
      />

      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
        <Box mb="4">
          <CiudadInput
            value={valores.ciudad}
            onChange={(ciudad, departamento) => {
              cambiar("departamento", departamento ?? "");
              cambiar("ciudad", ciudad);
            }}
            label="Ciudad"
            departamento={valores.departamento}
            maxLength={80}
            errorText={error("ciudad")}
          />
        </Box>
        <CampoConIcono
          id="barrio"
          label="Barrio"
          placeholder="Madalena"
          maxLength={120}
          value={valores.barrio}
          onChange={(valor) => cambiar("barrio", valor)}
        />
      </Grid>

      <Separador>Información adicional</Separador>
      <Campo id="notas" label="Notas internas">
        <Flex position="relative">
          <Box
            position="absolute"
            left="3"
            top="3"
            color="ink.400"
            pointerEvents="none"
            aria-hidden="true"
          >
            <StickyNote size={16} />
          </Box>
          <chakra.textarea
            id="notas"
            rows={3}
            maxLength={1000}
            minH="6rem"
            maxH="10rem"
            w="full"
            pl="9"
            pr="3"
            py="2.5"
            placeholder="Días de entrega, condiciones de pago…"
            value={valores.notas}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              cambiar("notas", e.target.value)
            }
            resize="vertical"
            fontSize="sm"
            lineHeight="1.6"
            bg="white"
            borderWidth="1px"
            borderColor="ink.200"
            borderRadius="md"
            _hover={{ borderColor: "ink.300" }}
            _focusVisible={{
              borderColor: "brand.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
            }}
          />
        </Flex>
      </Campo>

    </chakra.form>
  );
}

function ErroresApi({
  detalles,
}: {
  detalles: string[];
}) {
  if (detalles.length === 0) return null;

  return (
    <chakra.ul mt="1" pl="4" listStyleType="disc">
      {detalles.map((detalle) => (
        <chakra.li key={detalle}>{detalle}</chakra.li>
      ))}
    </chakra.ul>
  );
}

function CampoConIcono({
  id,
  label,
  value,
  onChange,
  placeholder,
  icono,
  inputMode = "text",
  required = false,
  autoFocus = false,
  maxLength,
  onBlur,
  error,
  helperText,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  icono?: React.ReactNode;
  inputMode?: "numeric" | "tel" | "email" | "text";
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  onBlur?: () => void;
  error?: string;
  helperText?: string;
}) {
  return (
    <Campo
      id={id}
      label={label}
      required={required}
      error={error}
      helperText={helperText}
    >
      <Flex align="center" position="relative">
        {icono && (
          <Box
            position="absolute"
            left="3"
            top="50%"
            transform="translateY(-50%)"
            color="ink.400"
            pointerEvents="none"
            aria-hidden="true"
          >
            {icono}
          </Box>
        )}
        <chakra.input
          id={id}
          inputMode={inputMode}
          placeholder={placeholder}
          pl={icono ? "9" : "3"}
          pr="3"
          h="10"
          w="full"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(e.target.value)
          }
          onBlur={onBlur}
          maxLength={maxLength}
          required={required}
          autoFocus={autoFocus}
          bg="white"
          borderWidth="1px"
          borderColor={error ? "danger.500" : "ink.200"}
          borderRadius="md"
          fontSize="sm"
          transition="border-color 0.15s ease, box-shadow 0.15s ease"
          _hover={{ borderColor: error ? "danger.500" : "ink.300" }}
          _focusVisible={{
            borderColor: error ? "danger.500" : "brand.500",
            boxShadow: error
              ? "0 0 0 1px var(--chakra-colors-danger-500)"
              : "0 0 0 1px var(--chakra-colors-brand-500)",
          }}
        />
      </Flex>
    </Campo>
  );
}

function Campo({
  id,
  label,
  required = false,
  error,
  helperText,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
}) {
  return (
    <Box mb="4">
      <chakra.label
        htmlFor={id}
        fontSize="sm"
        fontWeight="medium"
        color="ink.800"
        mb="1.5"
        display="block"
      >
        {label}
        {required && (
          <chakra.span
            aria-hidden="true"
            color="danger.600"
            ml="1"
            fontWeight="bold"
          >
            *
          </chakra.span>
        )}
      </chakra.label>

      {children}

      {error ? (
        <chakra.p fontSize="xs" color="danger.600" mt="1.5" fontWeight="medium">
          {error}
        </chakra.p>
      ) : helperText ? (
        <chakra.p fontSize="xs" color="ink.500" mt="1.5" lineHeight="1.5">
          {helperText}
        </chakra.p>
      ) : null}
    </Box>
  );
}

function Separador({
  children,
  accesorio,
}: {
  children: React.ReactNode;
  accesorio?: React.ReactNode;
}) {
  return (
    <Flex align="center" gap="3" mb="3.5" mt="5">
      <chakra.span
        fontSize="sm"
        fontWeight="semibold"
        color="ink.800"
        flexShrink={0}
      >
        {children}
      </chakra.span>
      <Box
        flex="1"
        h="1px"
        bg="ink.200"
        borderRadius="full"
        aria-hidden="true"
      />
      {accesorio}
    </Flex>
  );
}