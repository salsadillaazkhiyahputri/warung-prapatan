import { NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { TransactionService } from '@/lib/db';

export async function GET() {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const stats = await TransactionService.getDashboardSummary();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Gagal memuat ringkasan dashboard' }, { status: 500 });
  }
}
