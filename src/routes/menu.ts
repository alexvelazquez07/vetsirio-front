import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeDollarSign,
  Banknote,
  Boxes,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  HeartPulse,
  Home,
  PackagePlus,
  PawPrint,
  Receipt,
  Scissors,
  Settings,
  ShieldCheck,
  Stethoscope,
  Store,
  Syringe,
  Truck,
  UserCog,
  Users,
  UserSquare2,
} from "lucide-react";

/**
 * Estructura del menú.
 *
 * Un solo archivo define la navegación completa, así el sidebar, la barra
 * lateral móvil, los breadcrumbs y los permisos se generan del mismo origen.
 * Agregar un módulo es agregar un objeto acá: si queda fuera de este archivo,
 * queda fuera de la interfaz.
 */

export interface ItemMenu {
  etiqueta: string;
  ruta: string;
  icono: LucideIcon;
  /** Permiso requerido. Si falta, cualquiera autenticado entra. */
  permiso?: string;
  /** Oculta el ítem del sidebar sin quitar el acceso por URL. */
  oculto?: boolean;
}

export interface GrupoMenu {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  items: ItemMenu[];
}

export const MENU: GrupoMenu[] = [
  {
    id: "general",
    etiqueta: "General",
    icono: Home,
    items: [
      { etiqueta: "Inicio", ruta: "/", icono: Home, permiso: "panel.ver" },
      { etiqueta: "Agenda", ruta: "/agenda", icono: CalendarDays, permiso: "citas.ver" },
    ],
  },
  {
    id: "atencion",
    etiqueta: "Atención al cliente",
    icono: UserSquare2,
    items: [
      { etiqueta: "Clientes", ruta: "/clientes", icono: Users, permiso: "clientes.ver" },
      {
        etiqueta: "Pacientes",
        ruta: "/pacientes",
        icono: PawPrint,
        permiso: "pacientes.ver",
      },
      {
        etiqueta: "Consultas",
        ruta: "/consultas",
        icono: Stethoscope,
        permiso: "consultas.ver",
      },
    ],
  },
  {
    id: "clinico",
    etiqueta: "Clínico",
    icono: HeartPulse,
    items: [
      {
        etiqueta: "Vacunaciones",
        ruta: "/vacunaciones",
        icono: Syringe,
        permiso: "vacunaciones.ver",
      },
      {
        etiqueta: "Tratamientos",
        ruta: "/tratamientos",
        icono: ClipboardList,
        permiso: "tratamientos.ver",
      },
      {
        etiqueta: "Grooming",
        ruta: "/grooming",
        icono: Scissors,
        permiso: "grooming.ver",
      },
    ],
  },
  {
    id: "comercial",
    etiqueta: "Comercial",
    icono: Store,
    items: [
      {
        etiqueta: "Ventas",
        ruta: "/ventas",
        icono: Receipt,
        permiso: "ventas.ver",
      },
      { etiqueta: "Servicios", ruta: "/servicios", icono: Activity, permiso: "servicios.ver" },
    ],
  },
  {
    id: "inventario",
    etiqueta: "Inventario",
    icono: Boxes,
    items: [
      {
        etiqueta: "Productos",
        ruta: "/productos",
        icono: Boxes,
        permiso: "productos.ver",
      },
      {
        etiqueta: "Carga inicial",
        ruta: "/inventario/carga-inicial",
        icono: PackagePlus,
        permiso: "stock.ajustar",
      },
      {
        etiqueta: "Proveedores",
        ruta: "/proveedores",
        icono: Truck,
        permiso: "proveedores.ver",
      },
      {
        etiqueta: "Compras",
        ruta: "/compras",
        icono: FileSpreadsheet,
        permiso: "facturas.ver",
      },
    ],
  },
  {
    id: "finanzas",
    etiqueta: "Finanzas",
    icono: Banknote,
    items: [
      { etiqueta: "Caja", ruta: "/caja", icono: Banknote, permiso: "caja.ver" },
      {
        etiqueta: "Egresos",
        ruta: "/egresos",
        icono: CreditCard,
        permiso: "caja.egresos",
      },
      {
        etiqueta: "Facturación",
        ruta: "/facturacion",
        icono: BadgeDollarSign,
        permiso: "facturas.ver",
      },
    ],
  },
  {
    id: "gestion",
    etiqueta: "Gestión",
    icono: UserCog,
    items: [
      { etiqueta: "Personal", ruta: "/personal", icono: UserCog, permiso: "usuarios.ver" },
      {
        etiqueta: "Configuración",
        ruta: "/configuracion",
        icono: Settings,
        permiso: "configuracion.ver",
      },
    ],
  },
  {
    id: "plataforma",
    etiqueta: "VetSirio",
    icono: ShieldCheck,
    items: [
      {
        etiqueta: "Panel global",
        ruta: "/admin",
        icono: ShieldCheck,
        permiso: "__superadmin__",
      },
    ],
  },
];

/**
 * Aplana el menú a una lista de rutas, para el buscador de comandos.
 * Se usa el atajo "Ctrl+K" o "/", que es lo que la gente ya espera de las
 * herramientas profesionales.
 */
export interface ResultadoBusqueda {
  etiqueta: string;
  ruta: string;
  grupo: string;
  icono: LucideIcon;
  permiso?: string;
}

export function aplanarMenu(menu: GrupoMenu[] = MENU): ResultadoBusqueda[] {
  return menu.flatMap((grupo) =>
    grupo.items
      .filter((item) => !item.oculto)
      .map((item) => ({
        etiqueta: item.etiqueta,
        ruta: item.ruta,
        grupo: grupo.etiqueta,
        icono: item.icono,
        permiso: item.permiso,
      })),
  );
}