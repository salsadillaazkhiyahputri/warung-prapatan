import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, Product, Supplier } from '@/types';

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatDateOnly(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return isoString;
  }
}

export interface TransactionFilterMeta {
  periodText?: string;
  productText?: string;
  typeText?: string;
}

/**
 * 1. Ekspor Riwayat Transaksi ke Excel (.xlsx)
 */
export function exportTransactionsToExcel(
  transactions: Transaction[],
  filters?: TransactionFilterMeta,
  filename?: string
) {
  const stamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `Laporan-Transaksi-Warung-Prapatan-${stamp}.xlsx`;

  const rows = transactions.map((t, index) => ({
    'No': index + 1,
    'Tanggal & Waktu': formatDateTime(t.created_at),
    'Nama Produk': t.product?.name || `Produk #${t.product_id}`,
    'Kategori': t.product?.category || '-',
    'Jenis Transaksi': t.type === 'in' ? 'Masuk' : 'Keluar',
    'Jumlah (Satuan)': `${t.type === 'in' ? '+' : '-'}${t.qty} ${t.product?.unit || 'pcs'}`,
    'Supplier': t.type === 'in' ? (t.supplier?.name || '-') : '—',
    'Catatan': t.note || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Transaksi');

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 26 },
    { wch: 15 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 30 }
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  });

  triggerBrowserDownload(blob, finalFilename);
}

/**
 * 2. Ekspor Riwayat Transaksi ke PDF (.pdf)
 */
export function exportTransactionsToPDF(
  transactions: Transaction[],
  filters?: TransactionFilterMeta,
  filename?: string
) {
  const stamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `Laporan-Transaksi-Warung-Prapatan-${stamp}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Header Deep Navy solid
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('WARUNG PRAPATAN', 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Laporan Riwayat Transaksi Keluar & Masuk Barang', 14, 22);

  // Filter Sub-info
  const filterParts = [];
  if (filters?.periodText) filterParts.push(`Periode: ${filters.periodText}`);
  if (filters?.productText && filters.productText !== 'Semua Produk') filterParts.push(`Produk: ${filters.productText}`);
  if (filters?.typeText && filters.typeText !== 'Semua') filterParts.push(`Jenis: ${filters.typeText}`);
  const filterSummary = filterParts.length > 0 ? filterParts.join(' | ') : 'Semua Data Transaksi';

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${filterSummary}  •  Dicetak: ${formatDateTime(new Date().toISOString())}`, 14, 29);

  // Summary Metrics Bar
  const totalMasuk = transactions.filter(t => t.type === 'in').reduce((acc, t) => acc + t.qty, 0);
  const totalKeluar = transactions.filter(t => t.type === 'out').reduce((acc, t) => acc + t.qty, 0);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Transaksi: ${transactions.length} record    |    Total Masuk: +${totalMasuk} item    |    Total Keluar: -${totalKeluar} item`, 14, 45);

  const tableData = transactions.map((t, index) => [
    index + 1,
    formatDateTime(t.created_at),
    t.product?.name || `ID #${t.product_id}`,
    t.type === 'in' ? 'Masuk' : 'Keluar',
    t.type === 'in' ? `+${t.qty} ${t.product?.unit || 'pcs'}` : `-${t.qty} ${t.product?.unit || 'pcs'}`,
    t.type === 'in' ? (t.supplier?.name || '-') : '—',
    t.note || '-'
  ]);

  autoTable(doc, {
    startY: 50,
    head: [['No', 'Tanggal', 'Nama Produk', 'Jenis', 'Jumlah', 'Supplier', 'Catatan']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 32 },
      2: { cellWidth: 42 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 22 },
      5: { cellWidth: 30 },
      6: { cellWidth: 'auto' }
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'Masuk') {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [220, 38, 38]; // red-600
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: function (data) {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Halaman ${data.pageNumber} - Dokumen Resmi Warung Prapatan`,
        14,
        doc.internal.pageSize.height - 8
      );
    }
  });

  const pdfBlob = doc.output('blob');
  triggerBrowserDownload(pdfBlob, finalFilename);
}

/**
 * 3. Ekspor Data Produk / Katalog Stok ke Excel (.xlsx)
 */
export function exportProductsToExcel(products: Product[], filename?: string) {
  const stamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `Katalog-Produk-Warung-Prapatan-${stamp}.xlsx`;

  const rows = products.map((p, index) => {
    const isLow = p.stock_current <= p.stock_minimum;
    const status = p.stock_current === 0 ? 'Habis' : isLow ? 'Menipis' : 'Aman';
    return {
      'No': index + 1,
      'Nama Produk': p.name,
      'Kategori': p.category,
      'Satuan Eceran': p.unit,
      'Isi per Karton': p.qty_per_karton ? `${p.qty_per_karton} ${p.unit}/dus` : '—',
      'Stok Saat Ini': p.stock_current,
      'Batas Minimum Stok': p.stock_minimum,
      'Status Stok': status
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Katalog Produk');

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 }
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  });

  triggerBrowserDownload(blob, finalFilename);
}

/**
 * 4. Ekspor Data Produk / Katalog Stok ke PDF (.pdf)
 */
export function exportProductsToPDF(products: Product[], filename?: string) {
  const stamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `Katalog-Produk-Warung-Prapatan-${stamp}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Deep Navy Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('WARUNG PRAPATAN', 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Katalog & Daftar Stok Barang Toko', 14, 22);

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dicetak: ${formatDateTime(new Date().toISOString())}`, 14, 29);

  const lowCount = products.filter(p => p.stock_current <= p.stock_minimum).length;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Produk: ${products.length} barang    |    Stok Menipis / Perlu Restock: ${lowCount} barang`, 14, 43);

  const tableData = products.map((p, index) => {
    const isLow = p.stock_current <= p.stock_minimum;
    const status = p.stock_current === 0 ? 'Habis' : isLow ? 'Menipis' : 'Aman';
    return [
      index + 1,
      p.name,
      p.category,
      p.unit,
      p.qty_per_karton ? `${p.qty_per_karton} ${p.unit}` : '—',
      p.stock_current,
      p.stock_minimum,
      status
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [['No', 'Nama Produk', 'Kategori', 'Satuan', 'Per Karton', 'Stok', 'Batas Min', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 46 },
      2: { cellWidth: 26 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 18 },
      6: { halign: 'right', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 20 }
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 7) {
        if (data.cell.raw === 'Aman') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: function (data) {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Halaman ${data.pageNumber} - Dokumen Resmi Warung Prapatan`,
        14,
        doc.internal.pageSize.height - 8
      );
    }
  });

  const pdfBlob = doc.output('blob');
  triggerBrowserDownload(pdfBlob, finalFilename);
}

/**
 * 5. Ekspor Data Supplier ke Excel (.xlsx)
 */
export function exportSuppliersToExcel(suppliers: Supplier[], filename?: string) {
  const stamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `Daftar-Supplier-Warung-Prapatan-${stamp}.xlsx`;

  const rows = suppliers.map((s, index) => ({
    'No': index + 1,
    'Nama Supplier': s.name,
    'Jumlah Transaksi Masuk': s.transaction_count ?? 0,
    'Terakhir Masuk': s.last_restock_date ? formatDateOnly(s.last_restock_date) : 'Belum Ada',
    'Terdaftar Sejak': formatDateOnly(s.created_at)
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Supplier');

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 }
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  });

  triggerBrowserDownload(blob, finalFilename);
}

/**
 * 6. Ekspor Data Supplier ke PDF (.pdf)
 */
export function exportSuppliersToPDF(suppliers: Supplier[], filename?: string) {
  const stamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `Daftar-Supplier-Warung-Prapatan-${stamp}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('WARUNG PRAPATAN', 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Daftar Rekanan Supplier & Riwayat Pasokan', 14, 22);

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dicetak: ${formatDateTime(new Date().toISOString())}`, 14, 29);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Rekanan Supplier: ${suppliers.length} pemasok`, 14, 43);

  const tableData = suppliers.map((s, index) => [
    index + 1,
    s.name,
    s.transaction_count ?? 0,
    s.last_restock_date ? formatDateOnly(s.last_restock_date) : '-',
    formatDateOnly(s.created_at)
  ]);

  autoTable(doc, {
    startY: 48,
    head: [['No', 'Nama Supplier', 'Jml Transaksi', 'Terakhir Masuk', 'Terdaftar Sejak']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 65 },
      2: { halign: 'center', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 38 },
      4: { halign: 'center', cellWidth: 38 }
    },
    didDrawPage: function (data) {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Halaman ${data.pageNumber} - Dokumen Resmi Warung Prapatan`,
        14,
        doc.internal.pageSize.height - 8
      );
    }
  });

  const pdfBlob = doc.output('blob');
  triggerBrowserDownload(pdfBlob, finalFilename);
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 200);
}
