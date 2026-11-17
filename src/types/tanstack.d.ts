import type { ColumnMeta } from "@tanstack/react-table";

/**
 * Metadatos de columna que usa el DataTable.
 *
 * Declarar `align` acá tipa `columnDef.meta?.align` en todas las columnas del
 * proyecto. Sin este augmentation, hay que castear cada acceso y el compilador
 * deja de avisar cuando una columna se alinea mal.
 */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Alineación de la celda: por defecto izquierda. */
    align?: "left" | "center" | "right";
    /**
     * Oculta la columna en la vista de tarjetas del móvil.
     * Se usa para las columnas de metadatos que ya están en el título.
     */
    ocultaEnMovil?: boolean;
    /** No permite ordenar por esta columna. */
    sinOrden?: boolean;
  }
}

/** Reexportado para que los demás archivos no importen de tanstack directo. */
export type { ColumnMeta };
export type RowData = Record<string, unknown>;