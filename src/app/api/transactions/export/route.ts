import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { TransactionService } from '@/lib/db';
import * as XLSX from 'xlsx';
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

    // 1. Ekspor Format EXCEL (.xlsx)
    if (format === 'excel' || format === 'xlsx') {
      const rows = transactions.map((t, index) => ({
        'No': index + 1,
        'Tanggal & Waktu': formatDateTime(t.created_at),
        'Nama Produk': t.product?.name || `Produk #${t.product_id}`,
        'Kategori': t.product?.category || '-',
        'Jenis Transaksi': kindLabel(t),
        'Jumlah (pcs)': `${t.type === 'in' ? '+' : '-'}${t.qty} ${t.product?.unit || 'pcs'}`,
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
        { wch: 18 },
        { wch: 14 },
        { wch: 22 },
        { wch: 28 }
      ];

      const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const filename = `Laporan-Transaksi-Warung-Prapatan-${stamp}.xlsx`;

      return new NextResponse(buf, {
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
