import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { TransactionService } from '@/lib/db';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateTime } from '@/lib/export-utils';
import { parseHistoryFilters } from '@/lib/validate';
import { errorResponse } from '@/lib/errors';
import { TRANSACTION_KIND_LABEL } from '@/lib/stock-labels';
import { Transaction } from '@/types';

export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'excel';
    const filters = parseHistoryFilters(searchParams);
    const transactions = await TransactionService.getHistory(filters);
    const kindLabel = (t: Transaction) => TRANSACTION_KIND_LABEL[t.kind ?? (t.type === 'in' ? 'masuk' : 'keluar_manual')];

    const stamp = new Date().toISOString().split('T')[0];

    // 1. Ekspor Format EXCEL (.xlsx) dengan Template Modern & Berwarna (ExcelJS)
    if (format === 'excel' || format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Warung Prapatan';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Riwayat Transaksi', {
        views: [{ showGridLines: true }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });

      // Kolom
      worksheet.columns = [
        { key: 'no', width: 7 },
        { key: 'date', width: 22 },
        { key: 'product', width: 28 },
        { key: 'category', width: 16 },
        { key: 'kind', width: 20 },
        { key: 'qty', width: 16 },
        { key: 'supplier', width: 24 },
        { key: 'note', width: 32 }
      ];

      // Row 1: Brand Title (Deep Navy)
      worksheet.mergeCells('A1:H1');
      const r1 = worksheet.getCell('A1');
      r1.value = 'WARUNG PRAPATAN';
      r1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      r1.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 34;

      // Row 2: Subtitle
      worksheet.mergeCells('A2:H2');
      const r2 = worksheet.getCell('A2');
      r2.value = 'LAPORAN RIWAYAT TRANSAKSI STOK (MASUK, KELUAR, KOREKSI)';
      r2.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF38BDF8' } };
      r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      r2.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 24;

      // Row 3: Meta Info
      worksheet.mergeCells('A3:H3');
      const r3 = worksheet.getCell('A3');
      const countMasuk = transactions.filter((t) => t.type === 'in').length;
      const countKeluar = transactions.filter((t) => t.type === 'out').length;
      r3.value = `Dicetak pada: ${formatDateTime(new Date().toISOString())}   |   Total: ${transactions.length} Transaksi (Masuk: ${countMasuk}, Keluar: ${countKeluar})`;
      r3.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
      r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      r3.alignment = { vertical: 'middle', horizontal: 'center' };
      r3.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
      worksheet.getRow(3).height = 22;

      // Row 4: Spacer
      worksheet.getRow(4).height = 10;

      // Row 5: Table Headers
      const headers = ['NO', 'TANGGAL & WAKTU', 'NAMA PRODUK', 'KATEGORI', 'JENIS TRANSAKSI', 'JUMLAH (PCS)', 'SUPPLIER', 'CATATAN'];
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
        const row = worksheet.getRow(6 + i);
        row.height = 22;
        const isEven = i % 2 === 0;
        const baseBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
        const isIn = t.type === 'in';
        const label = kindLabel(t);

        // No
        const c1 = row.getCell(1);
        c1.value = i + 1;
        c1.alignment = { vertical: 'middle', horizontal: 'center' };
        c1.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF64748B' } };
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c1.border = thinBorder;

        // Tanggal
        const c2 = row.getCell(2);
        c2.value = formatDateTime(t.created_at);
        c2.alignment = { vertical: 'middle', horizontal: 'center' };
        c2.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF334155' } };
        c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c2.border = thinBorder;

        // Nama Produk
        const c3 = row.getCell(3);
        c3.value = t.product?.name || `Produk #${t.product_id}`;
        c3.alignment = { vertical: 'middle', horizontal: 'left' };
        c3.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c3.border = thinBorder;

        // Kategori
        const c4 = row.getCell(4);
        c4.value = t.product?.category || '-';
        c4.alignment = { vertical: 'middle', horizontal: 'center' };
        c4.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
        c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c4.border = thinBorder;

        // Jenis Transaksi
        const c5 = row.getCell(5);
        c5.value = label;
        c5.alignment = { vertical: 'middle', horizontal: 'center' };
        c5.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: isIn ? 'FF065F46' : 'FF991B1B' } };
        c5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isIn ? 'FFECFDF5' : 'FFFEF2F2' } };
        c5.border = thinBorder;

        // Jumlah
        const c6 = row.getCell(6);
        c6.value = `${isIn ? '+' : '-'}${t.qty} ${t.product?.unit || 'pcs'}`;
        c6.alignment = { vertical: 'middle', horizontal: 'center' };
        c6.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: isIn ? 'FF059669' : 'FFDC2626' } };
        c6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c6.border = thinBorder;

        // Supplier
        const c7 = row.getCell(7);
        c7.value = isIn ? (t.supplier?.name || '-') : '—';
        c7.alignment = { vertical: 'middle', horizontal: 'left' };
        c7.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF1E293B' } };
        c7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c7.border = thinBorder;

        // Catatan
        const c8 = row.getCell(8);
        c8.value = t.note || '-';
        c8.alignment = { vertical: 'middle', horizontal: 'left' };
        c8.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF64748B' } };
        c8.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c8.border = thinBorder;
      });

      // Footer Row
      const endRow = 6 + transactions.length;
      const footerRow = worksheet.getRow(endRow);
      footerRow.height = 24;

      worksheet.mergeCells(`A${endRow}:D${endRow}`);
      const fTitle = worksheet.getCell(`A${endRow}`);
      fTitle.value = 'TOTAL KESELURUHAN CATATAN:';
      fTitle.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
      fTitle.alignment = { vertical: 'middle', horizontal: 'right' };
      fTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      fTitle.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } }
      };

      worksheet.mergeCells(`E${endRow}:H${endRow}`);
      const fVal = worksheet.getCell(`E${endRow}`);
      fVal.value = `${transactions.length} Aktivitas Transaksi (${countMasuk} Masuk, ${countKeluar} Keluar)`;
      fVal.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
      fVal.alignment = { vertical: 'middle', horizontal: 'left' };
      fVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      fVal.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `Laporan-Transaksi-Warung-Prapatan-${stamp}.xlsx`;

      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    // 2. Ekspor Format PDF (.pdf)
    if (format === 'pdf') {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Header Navy Deep
      doc.setFillColor(15, 23, 42); // slate-900 / navy
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('WARUNG PRAPATAN', 14, 16);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text('Laporan Riwayat Transaksi Stok (Masuk, Keluar, Koreksi)', 14, 23);
      doc.text(`Dicetak pada: ${formatDateTime(new Date().toISOString())}`, 14, 29);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.text(`Total Transaksi: ${transactions.length} record`, 14, 43);

      const tableData = transactions.map((t, index) => [
        index + 1,
        formatDateTime(t.created_at),
        t.product?.name || `ID #${t.product_id}`,
        kindLabel(t),
        t.type === 'in' ? `+${t.qty} ${t.product?.unit || 'pcs'}` : `-${t.qty} ${t.product?.unit || 'pcs'}`,
        t.type === 'in' ? (t.supplier?.name || '-') : '—',
        t.note || '-'
      ]);

      autoTable(doc, {
        startY: 48,
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
          cellPadding: 3
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 32 },
          2: { cellWidth: 38 },
          3: { halign: 'center', cellWidth: 24 },
          4: { halign: 'right', cellWidth: 20 },
          5: { cellWidth: 30 },
          6: { cellWidth: 'auto' }
        }
      });

      const pdfArrayBuffer = doc.output('arraybuffer');
      const filename = `Laporan-Transaksi-Warung-Prapatan-${stamp}.pdf`;

      return new NextResponse(Buffer.from(pdfArrayBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    return NextResponse.json({ error: 'Format tidak didukung' }, { status: 400 });
  } catch (error) {
    return errorResponse(error, 'Gagal mengekspor laporan');
  }
}
