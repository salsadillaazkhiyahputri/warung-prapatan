import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction } from '@/types';

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

/**
 * Ekspor data transaksi ke file Excel (.xlsx) dengan Template Modern & Berwarna (ExcelJS)
 */
export async function exportTransactionsToExcel(transactions: Transaction[], filename?: string) {
  const now = new Date();
  const stamp = now.toISOString().split('T')[0];
  const finalFilename = filename || `Laporan-Transaksi-Warung-Prapatan-${stamp}.xlsx`;
  const printDate = formatDateTime(now.toISOString());

  const countMasuk = transactions.filter(t => t.type === 'in').length;
  const countKeluar = transactions.filter(t => t.type === 'out').length;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Warung Prapatan';
  workbook.created = now;

  const worksheet = workbook.addWorksheet('Laporan Transaksi', {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  // Lebar Kolom
  worksheet.columns = [
    { key: 'no', width: 7 },
    { key: 'date', width: 22 },
    { key: 'product', width: 28 },
    { key: 'category', width: 16 },
    { key: 'type', width: 18 },
    { key: 'qty', width: 15 },
    { key: 'unit', width: 12 },
    { key: 'supplier', width: 24 },
    { key: 'note', width: 34 }
  ];

  // Row 1: Header Brand
  worksheet.mergeCells('A1:I1');
  const r1 = worksheet.getCell('A1');
  r1.value = 'WARUNG PRAPATAN';
  r1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  r1.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 34;

  // Row 2: Subtitle Dokumen
  worksheet.mergeCells('A2:I2');
  const r2 = worksheet.getCell('A2');
  r2.value = 'LAPORAN RIWAYAT TRANSAKSI STOK BARANG';
  r2.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF38BDF8' } };
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  r2.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 24;

  // Row 3: Meta Info
  worksheet.mergeCells('A3:I3');
  const r3 = worksheet.getCell('A3');
  r3.value = `Tanggal Cetak: ${printDate}   |   Total: ${transactions.length} Transaksi (Masuk: ${countMasuk}, Keluar: ${countKeluar})`;
  r3.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  r3.alignment = { vertical: 'middle', horizontal: 'center' };
  r3.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  worksheet.getRow(3).height = 22;

  // Row 4: Spasi Kosong
  worksheet.getRow(4).height = 10;

  // Row 5: Header Tabel
  const headers = [
    'NO',
    'TANGGAL & WAKTU',
    'NAMA PRODUK',
    'KATEGORI',
    'JENIS TRANSAKSI',
    'JUMLAH',
    'SATUAN',
    'SUPPLIER',
    'CATATAN'
  ];
  const headerRow = worksheet.getRow(5);
  headerRow.height = 26;
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  const thinBorder = {
    top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } }
  };

  transactions.forEach((t, i) => {
    const rowIndex = 6 + i;
    const row = worksheet.getRow(rowIndex);
    row.height = 22;

    const isEven = i % 2 === 0;
    const baseBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
    const isIn = t.type === 'in';

    // No
    const c1 = row.getCell(1);
    c1.value = i + 1;
    c1.alignment = { vertical: 'middle', horizontal: 'center' };
    c1.font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c1.border = thinBorder;

    // Tanggal
    const c2 = row.getCell(2);
    c2.value = formatDateTime(t.created_at);
    c2.alignment = { vertical: 'middle', horizontal: 'center' };
    c2.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c2.border = thinBorder;

    // Nama Produk
    const c3 = row.getCell(3);
    c3.value = t.product?.name || `Produk #${t.product_id}`;
    c3.alignment = { vertical: 'middle', horizontal: 'left' };
    c3.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c3.border = thinBorder;

    // Kategori
    const c4 = row.getCell(4);
    c4.value = t.product?.category || '-';
    c4.alignment = { vertical: 'middle', horizontal: 'center' };
    c4.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
    c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c4.border = thinBorder;

    // Jenis
    const c5 = row.getCell(5);
    c5.value = isIn ? 'Masuk (+)' : 'Keluar (-)';
    c5.alignment = { vertical: 'middle', horizontal: 'center' };
    c5.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: isIn ? 'FF065F46' : 'FF991B1B' } };
    c5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isIn ? 'FFECFDF5' : 'FFFEF2F2' } };
    c5.border = thinBorder;

    // Jumlah
    const c6 = row.getCell(6);
    c6.value = isIn ? `+${t.qty}` : `-${t.qty}`;
    c6.alignment = { vertical: 'middle', horizontal: 'right' };
    c6.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isIn ? 'FF059669' : 'FFDC2626' } };
    c6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c6.border = thinBorder;

    // Satuan
    const c7 = row.getCell(7);
    c7.value = t.product?.unit || 'pcs';
    c7.alignment = { vertical: 'middle', horizontal: 'center' };
    c7.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF64748B' } };
    c7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c7.border = thinBorder;

    // Supplier
    const c8 = row.getCell(8);
    c8.value = isIn ? (t.supplier?.name || '-') : '—';
    c8.alignment = { vertical: 'middle', horizontal: 'left' };
    c8.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
    c8.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c8.border = thinBorder;

    // Catatan
    const c9 = row.getCell(9);
    c9.value = t.note || '-';
    c9.alignment = { vertical: 'middle', horizontal: 'left' };
    c9.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF64748B' } };
    c9.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
    c9.border = thinBorder;
  });

  // Footer Row
  const endRowIndex = 6 + transactions.length;
  const footerRow = worksheet.getRow(endRowIndex);
  footerRow.height = 24;

  worksheet.mergeCells(`A${endRowIndex}:E${endRowIndex}`);
  const fTitle = worksheet.getCell(`A${endRowIndex}`);
  fTitle.value = 'TOTAL KESELURUHAN CATATAN:';
  fTitle.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  fTitle.alignment = { vertical: 'middle', horizontal: 'right' };
  fTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  fTitle.border = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } }
  };

  worksheet.mergeCells(`F${endRowIndex}:I${endRowIndex}`);
  const fVal = worksheet.getCell(`F${endRowIndex}`);
  fVal.value = `${transactions.length} Aktivitas Transaksi (${countMasuk} Masuk, ${countKeluar} Keluar)`;
  fVal.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  fVal.alignment = { vertical: 'middle', horizontal: 'left' };
  fVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  fVal.border = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  });

  triggerBrowserDownload(blob, finalFilename);
}

/**
 * Ekspor data transaksi ke file PDF (.pdf) Landscape Elegan & Profesional
 */
export function exportTransactionsToPDF(transactions: Transaction[], filename?: string) {
  const now = new Date();
  const stamp = now.toISOString().split('T')[0];
  const finalFilename = filename || `Laporan-Transaksi-Warung-Prapatan-${stamp}.pdf`;
  const printDate = formatDateTime(now.toISOString());

  const countMasuk = transactions.filter(t => t.type === 'in').length;
  const countKeluar = transactions.filter(t => t.type === 'out').length;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Header Deep Navy (Lebar A4 Landscape = 297mm)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 28, 'F');

  // Brand Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('WARUNG PRAPATAN', 14, 12);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(56, 189, 248);
  doc.text('SISTEM MANAJEMEN STOK & INVENTARIS TOKO', 14, 19);

  // Document Title & Print Meta
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN RIWAYAT TRANSAKSI', 283, 12, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Dicetak: ${printDate}  |  Total: ${transactions.length} Catatan`, 283, 19, { align: 'right' });

  // KPI Info Cards (Y: 32 to Y: 43)
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 32, 60, 11, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL TRANSAKSI', 18, 36.5);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${transactions.length} Catatan`, 18, 41);

  doc.setFillColor(236, 253, 245);
  doc.roundedRect(78, 32, 60, 11, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70);
  doc.setFont('helvetica', 'normal');
  doc.text('TRANSAKSI MASUK (+)', 82, 36.5);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(`${countMasuk} Aktivitas`, 82, 41);

  doc.setFillColor(254, 242, 242);
  doc.roundedRect(142, 32, 60, 11, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(153, 27, 27);
  doc.setFont('helvetica', 'normal');
  doc.text('TRANSAKSI KELUAR (-)', 146, 36.5);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text(`${countKeluar} Aktivitas`, 146, 41);

  const tableData = transactions.map((t, index) => [
    index + 1,
    formatDateTime(t.created_at),
    t.product?.name || `Produk #${t.product_id}`,
    t.product?.category || '-',
    t.type === 'in' ? 'Masuk (+)' : 'Keluar (-)',
    t.type === 'in' ? `+${t.qty}` : `-${t.qty}`,
    t.product?.unit || 'pcs',
    t.type === 'in' ? (t.supplier?.name || '-') : '—',
    t.note || '-'
  ]);

  autoTable(doc, {
    startY: 47,
    head: [['No', 'Tanggal & Waktu', 'Nama Produk', 'Kategori', 'Jenis', 'Jumlah', 'Satuan', 'Supplier', 'Catatan']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: 3
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 32 },
      2: { halign: 'left', cellWidth: 44, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 16 },
      7: { halign: 'left', cellWidth: 34 },
      8: { halign: 'left', cellWidth: 'auto' }
    },
    didParseCell: function(data) {
      if (data.section === 'body') {
        if (data.column.index === 4) {
          if (String(data.cell.raw).includes('Masuk')) {
            data.cell.styles.fillColor = [236, 253, 245];
            data.cell.styles.textColor = [6, 95, 70];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.fillColor = [254, 242, 242];
            data.cell.styles.textColor = [153, 27, 27];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 5) {
          if (String(data.cell.raw).startsWith('+')) {
            data.cell.styles.textColor = [5, 150, 105];
          } else {
            data.cell.styles.textColor = [220, 38, 38];
          }
        }
      }
    },
    didDrawPage: function(data) {
      const pageCount = (doc.internal as any).getNumberOfPages();
      const pageCurrent = data.pageNumber;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(14, 200, 283, 200);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('Dokumen resmi Sistem Manajemen Stok Warung Prapatan', 14, 204);
      doc.text(`Halaman ${pageCurrent} dari ${pageCount}`, 283, 204, { align: 'right' });
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
