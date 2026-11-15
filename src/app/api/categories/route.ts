import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ProductService } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const categories = await ProductService.getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Gagal mengambil kategori' }, { status: 500 });
  }
}

