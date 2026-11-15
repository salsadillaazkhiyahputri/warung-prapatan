import { NextRequest, NextResponse } from 'next/server';
import { TransactionService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateTime } from '@/lib/export-utils';
import {
  dateRange,
  optionalId,
  neutralizeExcelFormula,
  getTransactionLabel,
  BusinessError
} from '@/lib/validate';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'excel';
    const startDateParam = searchParams.get('startDate') || undefined;
    const endDateParam = searchParams.get('endDate') || undefined;
    const prodIdParam = searchParams.get('productId');
    const typeParam = searchParams.get('type');

    // Validasi ketat rentang tanggal kalender
    const { startDate, endDate } = dateRange(startDateParam, endDateParam);
    const productId = optionalId(prodIdParam, 'ID produk');
    const type = typeParam === 'in' || typeParam === 'out' ? typeParam : undefined;

    const transactions = await TransactionService.getHistory({
      startDate,
      endDate,
      productId: productId ?? undefined,
      type
    });

    const now = new Date();
    const stamp = now.toISOString().split('T')[0];
    const printDate = formatDateTime(now.toISOString());
    let periodText = 'Semua Riwayat';
    if (startDate && endDate) {
      periodText = `${startDate} s.d. ${endDate}`;
    } else if (startDate) {
      periodText = `Mulai ${startDate}`;
    } else if (endDate) {
      periodText = `Hingga ${endDate}`;
    }

    const countMasuk = transactions.filter(t => t.type === 'in').length;
    const countKeluar = transactions.filter(t => t.type === 'out').length;

    // 1. Ekspor Format EXCEL (.xlsx)
    if (format === 'excel' || format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Warung Prapatan';
      workbook.created = now;

      const worksheet = workbook.addWorksheet('Laporan Transaksi', {
        views: [{ showGridLines: true }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });

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

      // Row 1: Header Utama Brand
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
      r3.value = `Tanggal Cetak: ${printDate}   |   Periode: ${periodText}   |   Total: ${transactions.length} Transaksi (Masuk: ${countMasuk}, Keluar: ${countKeluar})`;
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
      });

      // Data Rows
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
        const label = getTransactionLabel(t.type, t.source);
        const isIn = t.type === 'in';

        // 1. No
        const c1 = row.getCell(1);
        c1.value = i + 1;
        c1.alignment = { vertical: 'middle', horizontal: 'center' };
        c1.font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c1.border = thinBorder;

        // 2. Tanggal & Waktu
        const c2 = row.getCell(2);
        c2.value = t.tanggal_wib || formatDateTime(t.created_at);
        c2.alignment = { vertical: 'middle', horizontal: 'center' };
        c2.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
        c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c2.border = thinBorder;

        // 3. Nama Produk (Netralkan Formula Excel)
        const c3 = row.getCell(3);
        c3.value = neutralizeExcelFormula(t.product_name || `Produk #${t.product_id}`);
        c3.alignment = { vertical: 'middle', horizontal: 'left' };
        c3.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c3.border = thinBorder;

        // 4. Kategori
        const c4 = row.getCell(4);
        c4.value = neutralizeExcelFormula(t.category || '-');
        c4.alignment = { vertical: 'middle', horizontal: 'center' };
        c4.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
        c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c4.border = thinBorder;

        // 5. Jenis Transaksi
        const c5 = row.getCell(5);
        c5.value = label;
        c5.alignment = { vertical: 'middle', horizontal: 'center' };
        c5.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: isIn ? 'FF065F46' : 'FF991B1B' } };
        c5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isIn ? 'FFECFDF5' : 'FFFEF2F2' } };
        c5.border = thinBorder;

        // 6. Jumlah
        const c6 = row.getCell(6);
        c6.value = isIn ? `+${t.qty}` : `-${t.qty}`;
        c6.alignment = { vertical: 'middle', horizontal: 'right' };
        c6.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isIn ? 'FF059669' : 'FFDC2626' } };
        c6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c6.border = thinBorder;

        // 7. Satuan
        const c7 = row.getCell(7);
        c7.value = 'pcs';
        c7.alignment = { vertical: 'middle', horizontal: 'center' };
        c7.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF64748B' } };
        c7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c7.border = thinBorder;

        // 8. Supplier (Netralkan Formula Excel)
        const c8 = row.getCell(8);
        c8.value = isIn ? neutralizeExcelFormula(t.supplier_name || '-') : '—';
        c8.alignment = { vertical: 'middle', horizontal: 'left' };
        c8.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF334155' } };
        c8.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c8.border = thinBorder;

        // 9. Catatan (Netralkan Formula Excel)
        const c9 = row.getCell(9);
        c9.value = neutralizeExcelFormula(t.note || '-');
        c9.alignment = { vertical: 'middle', horizontal: 'left' };
        c9.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
        c9.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        c9.border = thinBorder;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Laporan-Transaksi-${stamp}.xlsx"`
        }
      });
    }

    // 2. Ekspor Format PDF
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header Background Navy
    doc.setFillColor(15, 23, 42); // #0F172A
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('WARUNG PRAPATAN', 14, 11);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(56, 189, 248); // Sky blue
    doc.text('LAPORAN RIWAYAT TRANSAKSI STOK BARANG', 14, 18);

    doc.setTextColor(203, 213, 225);
    doc.setFontSize(8);
    doc.text(`Dicetak: ${printDate} | Periode: ${periodText}`, 297 - 14, 15, { align: 'right' });

    const tableRows = transactions.map((t, idx) => {
      const isIn = t.type === 'in';
      const label = getTransactionLabel(t.type, t.source);
      return [
        idx + 1,
        t.tanggal_wib || formatDateTime(t.created_at),
        neutralizeExcelFormula(t.product_name || `Produk #${t.product_id}`),
        neutralizeExcelFormula(t.category || '-'),
        label,
        isIn ? `+${t.qty} pcs` : `-${t.qty} pcs`,
        isIn ? neutralizeExcelFormula(t.supplier_name || '-') : '—',
        neutralizeExcelFormula(t.note || '-')
      ];
    });

    autoTable(doc, {
      startY: 30,
      head: [['No', 'Tanggal & Waktu', 'Produk', 'Kategori', 'Jenis', 'Jumlah', 'Supplier', 'Catatan']],
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 32 },
        2: { fontStyle: 'bold', cellWidth: 42 },
        3: { halign: 'center', cellWidth: 26 },
        4: { halign: 'center', cellWidth: 28 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
        6: { cellWidth: 36 },
        7: { cellWidth: 'auto' }
      }
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Laporan-Transaksi-${stamp}.pdf"`
      }
    });
  } catch (err: any) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error generating report:', err);
    return NextResponse.json({ error: 'Gagal mengunduh laporan' }, { status: 500 });
  }
}
