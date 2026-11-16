import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { OpnameService } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { requiredId } from '@/lib/validate';

interface RouteContext {
  params: Promise<{ id: string }>;
}