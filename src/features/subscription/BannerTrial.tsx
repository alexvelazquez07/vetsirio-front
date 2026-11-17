import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/auth.store";
import { formatFecha } from "@/lib/formato";

/**
 * Aviso de suscripción.
 *
 * Tres niveles, y sólo se muestran los que aportan información:
 *  · Zona de aviso: cuántos días quedan. Aparece sobre el contenido, sin
 *    bloquear nada.
 *  · Expirado: ya no puede escribir. Va arriba y es insistsente, porque el
 *    siguiente paso es claro.
 *  · Suspendido: un administrador lo decidió, con un motivo. Distinguir este
 *    caso del vencimiento importa: uno se arregla pagando, el otro hablando
 *    con soporte.
 *
 * Nunca tapa el contenido con un modal. Si el usuario tiene 5 días de trial,
 *    una ventana-emerg bloqueando la pantalla cada vez que entra sería
 *   -fastidiar al cliente al que se intenta convencer de pagar.
 */
export function BannerTrial() {
  const { estadoSuscripcion, puede } = useAuth();

  if (!estadoSuscripcion) return null;

  // El plan y los precios son información del dueño de la veterinaria. A
  // recepción, peluquería o veterinarios no les mostramos ni el banner ni el
  // enlace a la pantalla de planes.
  if (!puede("suscripcion.ver")) return null;

  const { enTrial, expirado, suspendida, diasRestantes, enZonaDeAviso, motivoBloqueo, venceEn } =
    estadoSuscripcion;

  if (suspendida) {
    return (
      <Banner
        tono="danger"
        titulo="Tu cuenta está suspendida"
        detalle={motivoBloqueo ?? "Contactá al soporte para regularizar tu situación."}
        accion={{ texto: "Contactar soporte", href: "/suscripcion" }}
      />
    );
  }

  if (expirado) {
    return (
      <Banner
        tono="danger"
        titulo={
          enTrial
            ? "Tu período de prueba terminó"
            : "Tu suscripción venció"
        }
        detalle={
          motivoBloqueo ??
          "Activá un plan para volver a guardar datos. Podés seguir consultando y exportando tu información."
        }
        accion={{ texto: "Ver planes", href: "/suscripcion" }}
      />
    );
  }

  // Plan pago por vencer: mismo aviso, distinto matiz.
  if (!enTrial && enZonaDeAviso && diasRestantes !== null) {
    return (
      <Banner
        tono="warning"
        titulo={`Tu plan vence en ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}`}
        detalle={`El ${formatFecha(venceEn)}. Renová para no interrumpir la atención.`}
        accion={{ texto: "Renovar", href: "/suscripcion" }}
      />
    );
  }

  if (enTrial && enZonaDeAviso && diasRestantes !== null) {
    return (
      <Banner
        tono="warning"
        titulo={`Te quedan ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"} de prueba`}
        detalle="Ajustá tus servicios y cargá tu stock mientras tanto: esos datos se conservan al activar un plan."
        accion={{ texto: "Conocer planes", href: "/suscripcion" }}
      />
    );
  }

  return null;
}

function Banner({
  tono,
  titulo,
  detalle,
  accion,
}: {
  tono: "warning" | "danger";
  titulo: string;
  detalle: string;
  accion: { texto: string; href: string };
}) {
  const esquema = tono === "danger" ? "danger" : "warning";

  return (
    <Flex
      align={{ base: "flex-start", sm: "center" }}
      justify="space-between"
      gap="3"
      wrap="wrap"
      bg={`${esquema}.subtle`}
      borderBottomWidth="1px"
      borderColor={`${esquema}.muted`}
      px={{ base: "4", md: "6", xl: "8" }}
      py="3"
    >
      <Box>
        <Text fontSize="sm" fontWeight="semibold" color={`${esquema}.fg`}>
          {titulo}
        </Text>
        <Text fontSize="xs" color="ink.600" mt="0.5">
          {detalle}
        </Text>
      </Box>

      <Link to={accion.href}>
        <Button size="sm" colorPalette={esquema} variant="solid" flexShrink={0}>
          {accion.texto}
        </Button>
      </Link>
    </Flex>
  );
}