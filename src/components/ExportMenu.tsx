import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportToCSV,
  exportToPDF,
  type ExportColumn,
} from "@/lib/export-table";
import { toast } from "sonner";

interface ExportMenuProps<T> {
  /** Base file name (sans extension/timestamp). */
  filenameBase: string;
  /** PDF document title. */
  title: string;
  /** Optional subtitle / filter summary shown under the PDF title. */
  subtitle?: string;
  /** Column definitions (header + accessor). */
  columns: ExportColumn<T>[];
  /** Already-filtered rows. */
  rows: T[];
  /** Optional label for the trigger button. */
  label?: string;
  /** Trigger size. */
  size?: "default" | "sm" | "lg";
  /** Disable trigger (e.g. while loading). */
  disabled?: boolean;
}

export function ExportMenu<T>({
  filenameBase,
  title,
  subtitle,
  columns,
  rows,
  label = "Ekspor",
  size = "sm",
  disabled,
}: ExportMenuProps<T>) {
  const isEmpty = rows.length === 0;

  const handleCSV = () => {
    if (isEmpty) return toast.info("Tidak ada data untuk diekspor");
    exportToCSV({ filenameBase, columns, rows });
    toast.success(`CSV diunduh (${rows.length} baris)`);
  };

  const handlePDF = () => {
    if (isEmpty) return toast.info("Tidak ada data untuk diekspor");
    exportToPDF({ filenameBase, title, subtitle, columns, rows });
    toast.success(`PDF diunduh (${rows.length} baris)`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={disabled}
          className="shrink-0"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {rows.length} baris (terfilter)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCSV} disabled={isEmpty}>
          <FileSpreadsheet className="h-4 w-4" />
          <span>Unduh CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDF} disabled={isEmpty}>
          <FileText className="h-4 w-4" />
          <span>Unduh PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
