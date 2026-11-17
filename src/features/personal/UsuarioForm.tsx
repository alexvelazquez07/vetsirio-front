import {
  Box,
  Field,
  Flex,
  Grid,
  Input,
  NativeSelect,
  chakra,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import type { RolPersonal, UsuarioPersonal } from "@/types/dominio";
import { nombreRol } from "./personal.utils";
export interface UsuarioFormValues {
  nombre: string;
  apellido: string;
  email: string;
  rolId: number;
  cedula?: string;
  telefono?: string;
  especialidad?: string;
  registroProfesional?: string;
  colorAgenda?: string;
  horarioInicio?: string;
  horarioFin?: string;
  diasTrabajo?: number[];
  debeCambiarPassword?: boolean;
  password?: string;
}

type Errores = Partial<Record<keyof UsuarioFormValues, string>>;

const DIAS = [
  { valor: 1, etiqueta: "Lun" },
  { valor: 2, etiqueta: "Mar" },
  { valor: 3, etiqueta: "Mié" },
  { valor: 4, etiqueta: "Jue" },
  { valor: 5, etiqueta: "Vie" },
  { valor: 6, etiqueta: "Sáb" },
  { valor: 7, etiqueta: "Dom" },
];

const DIAS_POR_DEFECTO = [1, 2, 3, 4, 5];

function valoresDe(usuario?: UsuarioPersonal | null): UsuarioFormValues {
  if (!usuario) {
    return {
      nombre: "",
      apellido: "",
      email: "",
      rolId: 0,
      cedula: "",
      telefono: "",
      especialidad: "",
      registroProfesional: "",
      colorAgenda: "",
      horarioInicio: "",
      horarioFin: "",
      diasTrabajo: DIAS_POR_DEFECTO,
      debeCambiarPassword: true,
      password: "",
    };
  }

  return {
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    rolId: usuario.rol.id,
    cedula: usuario.cedula ?? "",
    telefono: usuario.telefono ?? "",
    especialidad: usuario.especialidad ?? "",
    registroProfesional: usuario.registroProfesional ?? "",
    colorAgenda: usuario.colorAgenda ?? "",
    horarioInicio: usuario.horarioInicio ?? "",
    horarioFin: usuario.horarioFin ?? "",
    diasTrabajo: usuario.diasTrabajo,
    debeCambiarPassword: usuario.debeCambiarPassword,
    password: "",
  };
}

export function UsuarioForm({
  usuario,
  roles,
  onGuardar,
  errorGeneral,
  erroresServidor,
  detallesServidor,
  formId = "usuario-form",
}: {
  usuario?: UsuarioPersonal | null;
  roles: RolPersonal[];
  onGuardar: (valores: UsuarioFormValues) => void;
  errorGeneral?: string | null;
  erroresServidor?: Errores;
  detallesServidor?: string[];
  formId?: string;
}) {
  const [valores, setValores] = useState<UsuarioFormValues>(() =>
    valoresDe(usuario),
  );
  const [errores, setErrores] = useState<Errores>({});

  useEffect(() => {
    setValores(valoresDe(usuario));
    setErrores({});
  }, [usuario]);

  const esEdicion = Boolean(usuario);

  function cambiar<K extends keyof UsuarioFormValues>(
    campo: K,
    nuevo: UsuarioFormValues[K],
  ) {
    setValores((previo) => ({ ...previo, [campo]: nuevo }));
    setErrores((previo) => ({ ...previo, [campo]: undefined }));
  }

  function alternarDia(dia: number) {
    const actuales = valores.diasTrabajo ?? [];
    const siguiente = actuales.includes(dia)
      ? actuales.filter((valor) => valor !== dia)
      : [...actuales, dia].sort((a, b) => a - b);

    cambiar("diasTrabajo", siguiente);
  }

  function validar(): boolean {
    const nuevos: Errores = {};

    if (valores.nombre.trim().length < 2) {
      nuevos.nombre = "El nombre es obligatorio.";
    }

    if (valores.apellido.trim().length < 2) {
      nuevos.apellido = "El apellido es obligatorio.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email.trim())) {
      nuevos.email = "Ingresá un correo válido.";
    }

    if (!valores.rolId) {
      nuevos.rolId = "Elegí un rol.";
    }

    const telefono = (valores.telefono ?? "").replace(/\D/g, "");
    if (telefono.length > 0 && (telefono.length < 7 || telefono.length > 15)) {
      nuevos.telefono = "Ingresá entre 7 y 15 dígitos.";
    }

    const password = valores.password ?? "";
    if (!esEdicion && !password) {
      nuevos.password = "Ingresá una contraseña inicial.";
    } else if (password.length > 200) {
      nuevos.password = "La contraseña es demasiado larga.";
    }

    const inicio = (valores.horarioInicio ?? "").trim();
    const fin = (valores.horarioFin ?? "").trim();

    if (inicio && !fin) {
      nuevos.horarioFin = "Indicá el horario de salida.";
    } else if (!inicio && fin) {
      nuevos.horarioInicio = "Indicá el horario de entrada.";
    } else if (inicio && fin && fin <= inicio) {
      nuevos.horarioFin = "La salida debe ser posterior a la entrada.";
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!validar()) return;

    onGuardar({
      nombre: valores.nombre.trim(),
      apellido: valores.apellido.trim(),
      email: valores.email.trim().toLowerCase(),
      rolId: valores.rolId,
      cedula: valores.cedula?.trim() ?? "",
      telefono: valores.telefono?.trim() ?? "",
      especialidad: valores.especialidad?.trim() ?? "",
      registroProfesional: valores.registroProfesional?.trim() ?? "",
      colorAgenda: valores.colorAgenda?.trim() ?? "",
      horarioInicio: valores.horarioInicio?.trim() ?? "",
      horarioFin: valores.horarioFin?.trim() ?? "",
      diasTrabajo: valores.diasTrabajo ?? [],
      debeCambiarPassword: valores.debeCambiarPassword,
      ...(valores.password ? { password: valores.password } : {}),
    });
  }

  const error = (campo: keyof UsuarioFormValues) =>
    campo in errores ? errores[campo] : erroresServidor?.[campo];

  return (
    <chakra.form id={formId} onSubmit={enviar} noValidate>
      {errorGeneral && (
        <Alert status="error" rounded="md" mb="4" title="No pudimos guardar los cambios">
          {errorGeneral}
          {detallesServidor && <ErroresApi detalles={detallesServidor} />}
        </Alert>
      )}

      <Separador>Datos personales</Separador>

      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
        <Campo etiqueta="Nombre" requerido error={error("nombre")}>
          <Input
            value={valores.nombre}
            onChange={(evento) => cambiar("nombre", evento.target.value)}
            placeholder="Ana"
            maxLength={100}
            autoFocus
          />
        </Campo>

        <Campo etiqueta="Apellido" requerido error={error("apellido")}>
          <Input
            value={valores.apellido}
            onChange={(evento) => cambiar("apellido", evento.target.value)}
            placeholder="Ramírez"
            maxLength={100}
          />
        </Campo>
      </Grid>

      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3" mt="4">
        <Campo etiqueta="Cédula" error={error("cedula")}>
          <Input
            value={valores.cedula ?? ""}
            onChange={(evento) => cambiar("cedula", evento.target.value)}
            placeholder="1234567"
            inputMode="numeric"
            maxLength={20}
          />
        </Campo>

        <Campo etiqueta="Teléfono" error={error("telefono")}>
          <Input
            value={valores.telefono ?? ""}
            onChange={(evento) => cambiar("telefono", evento.target.value)}
            placeholder="0981123456"
            inputMode="tel"
            maxLength={30}
          />
        </Campo>
      </Grid>

      <Box mt="4">
        <Campo etiqueta="Correo electrónico" requerido error={error("email")}>
          <Input
            type="email"
            value={valores.email}
            onChange={(evento) => cambiar("email", evento.target.value)}
            placeholder="ana@veterinaria.com"
            maxLength={150}
            autoComplete="off"
          />
        </Campo>
      </Box>

      <Separador>Acceso al sistema</Separador>

      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
        <Campo etiqueta="Rol" requerido error={error("rolId")}>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field
              value={valores.rolId || ""}
              onChange={(evento) =>
                cambiar("rolId", Number(evento.target.value))
              }
            >
              <option value="">Elegí un rol…</option>
              {roles.map((rol) => (
                <option key={rol.id} value={rol.id}>
                  {nombreRol(rol.nombre)}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Campo>

        <Campo
          etiqueta={esEdicion ? "Nueva contraseña" : "Contraseña inicial"}
          requerido={!esEdicion}
          error={error("password")}
          ayuda={
            esEdicion
              ? "Dejala vacía para conservar la contraseña actual. Si la cambiás, podés usar una clave temporal."
              : "Podés usar una clave temporal simple. El integrante deberá cambiarla al ingresar."
          }
        >
          <Input
            type="password"
            value={valores.password ?? ""}
            onChange={(evento) => cambiar("password", evento.target.value)}
            placeholder={esEdicion ? "Sin cambios" : "Contraseña temporal"}
            maxLength={200}
            autoComplete="new-password"
          />
        </Campo>
      </Grid>

      <Box mt="3">
        <Switch
          checked={valores.debeCambiarPassword ?? false}
          onCheckedChange={(detalle) =>
            cambiar("debeCambiarPassword", detalle.checked)
          }
        >
          Pedir que cambie la contraseña en el próximo ingreso
        </Switch>
      </Box>

      <Separador>Perfil profesional</Separador>

      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
        <Campo etiqueta="Especialidad" error={error("especialidad")}>
          <Input
            value={valores.especialidad ?? ""}
            onChange={(evento) => cambiar("especialidad", evento.target.value)}
            placeholder="Clínica de pequeños animales"
            maxLength={120}
          />
        </Campo>

        <Campo
          etiqueta="Registro profesional"
          error={error("registroProfesional")}
        >
          <Input
            value={valores.registroProfesional ?? ""}
            onChange={(evento) =>
              cambiar("registroProfesional", evento.target.value)
            }
            placeholder="MP 1234"
            maxLength={60}
          />
        </Campo>
      </Grid>

      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3" mt="4">
        <Campo etiqueta="Horario de entrada" error={error("horarioInicio")}>
          <Input
            type="time"
            value={valores.horarioInicio ?? ""}
            onChange={(evento) => cambiar("horarioInicio", evento.target.value)}
          />
        </Campo>

        <Campo etiqueta="Horario de salida" error={error("horarioFin")}>
          <Input
            type="time"
            value={valores.horarioFin ?? ""}
            onChange={(evento) => cambiar("horarioFin", evento.target.value)}
          />
        </Campo>
      </Grid>

      <Box mt="4">
        <Campo etiqueta="Días de trabajo" ayuda="Se usan para la agenda de citas.">
          <Flex gap="1.5" wrap="wrap">
            {DIAS.map((dia) => {
              const activo = (valores.diasTrabajo ?? []).includes(dia.valor);

              return (
                <chakra.button
                  key={dia.valor}
                  type="button"
                  onClick={() => alternarDia(dia.valor)}
                  px="3"
                  py="1.5"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={activo ? "brand.500" : "ink.200"}
                  bg={activo ? "brand.500" : "white"}
                  color={activo ? "white" : "ink.600"}
                  fontSize="sm"
                  fontWeight="medium"
                  aria-pressed={activo}
                  _hover={{
                    borderColor: activo ? "brand.600" : "ink.300",
                  }}
                >
                  {dia.etiqueta}
                </chakra.button>
              );
            })}
          </Flex>
        </Campo>
      </Box>

      <Box mt="4">
        <Campo
          etiqueta="Color en la agenda"
          error={error("colorAgenda")}
          ayuda="Opcional. Ayuda a distinguir a cada profesional en la agenda."
        >
          <Flex align="center" gap="2">
            <chakra.input
              type="color"
              value={valores.colorAgenda || "#0D9E87"}
              onChange={(evento) => cambiar("colorAgenda", evento.target.value)}
              w="12"
              h="9"
              p="0"
              borderWidth="1px"
              borderColor="ink.200"
              borderRadius="md"
              cursor="pointer"
              aria-label="Color en la agenda"
            />
            <Input
              value={valores.colorAgenda ?? ""}
              onChange={(evento) => cambiar("colorAgenda", evento.target.value)}
              placeholder="#0D9E87"
              maxLength={7}
              w="32"
            />
          </Flex>
        </Campo>
      </Box>
    </chakra.form>
  );
}

function ErroresApi({ detalles }: { detalles: string[] }) {
  if (detalles.length === 0) return null;

  return (
    <chakra.ul mt="1" pl="4" listStyleType="disc">
      {detalles.map((detalle) => (
        <chakra.li key={detalle}>{detalle}</chakra.li>
      ))}
    </chakra.ul>
  );
}

function Campo({
  etiqueta,
  requerido,
  error,
  ayuda,
  children,
}: {
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <Field.Root invalid={!!error} required={requerido}>
      <Field.Label fontSize="xs" fontWeight="medium" color="ink.800" mb="1">
        {etiqueta}
        {requerido && <Field.RequiredIndicator />}
      </Field.Label>
      {children}
      {error ? (
        <Field.ErrorText fontSize="xs" mt="0.5">
          {error}
        </Field.ErrorText>
      ) : ayuda ? (
        <Field.HelperText fontSize="xs" color="ink.500" mt="0.5">
          {ayuda}
        </Field.HelperText>
      ) : null}
    </Field.Root>
  );
}

function Separador({ children }: { children: React.ReactNode }) {
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
      <Box flex="1" h="1px" bg="ink.200" borderRadius="full" aria-hidden="true" />
    </Flex>
  );
}
