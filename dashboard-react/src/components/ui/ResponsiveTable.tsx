import { type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type Column<T> = {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  variant?: "primary" | "field" | "actions";
  headClassName?: string;
  cellClassName?: string;
};

type Selection<T> = {
  header: ReactNode;
  cell: (row: T) => ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  selection?: Selection<T>;
};

export default function ResponsiveTable<T>(props: Props<T>) {
  return (
    <>
      <DesktopTable {...props} />
      <MobileList {...props} />
    </>
  );
}

function DesktopTable<T>({ columns, rows, rowKey, empty, selection }: Props<T>) {
  const colSpan = columns.length + (selection ? 1 : 0);
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            {selection && <TableHead className="w-10">{selection.header}</TableHead>}
            {columns.map((col, i) => (
              <TableHead key={i} className={col.headClassName}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">
                {empty ?? "Nothing here yet."}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {selection && <TableCell>{selection.cell(row)}</TableCell>}
                {columns.map((col, i) => (
                  <TableCell key={i} className={col.cellClassName}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function MobileList<T>({ columns, rows, rowKey, empty, selection }: Props<T>) {
  if (rows.length === 0) {
    return (
      <p className="md:hidden text-center text-muted-foreground py-8">
        {empty ?? "Nothing here yet."}
      </p>
    );
  }

  const primary = columns.find((col) => col.variant === "primary");
  const fields = columns.filter((col) => (col.variant ?? "field") === "field");
  const actions = columns.filter((col) => col.variant === "actions");

  return (
    <div className="md:hidden space-y-3">
      {selection && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {selection.header} Select all
        </label>
      )}
      {rows.map((row) => (
        <div key={rowKey(row)} className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-start gap-2 font-medium">
            {selection?.cell(row)}
            {primary?.cell(row)}
          </div>
          {fields.map((col, i) => (
            <div key={i} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground shrink-0">{col.header}</span>
              <span className="text-right">{col.cell(row)}</span>
            </div>
          ))}
          {actions.map((col, i) => (
            <div key={i} className="pt-1">
              {col.cell(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
