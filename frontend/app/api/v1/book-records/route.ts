import { NextResponse } from 'next/server';

import { withErrorHandling, readJsonBody } from '@/server/http';
import { requireRole } from '@/server/auth/guards';
import { Role } from '@/server/constants';
import { bookRecordCreateSchema } from '@/server/bookRecords/schemas';
import * as bookRecordsService from '@/server/bookRecords/service';

export const GET = withErrorHandling(async (request) => {
  await requireRole(request, Role.IT_HEAD);
  const records = await bookRecordsService.listRecords();
  return NextResponse.json(records);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireRole(request, Role.IT_HEAD);
  const payload = bookRecordCreateSchema.parse(await readJsonBody(request));
  const record = await bookRecordsService.createRecord(user.id, payload);
  return NextResponse.json(record, { status: 201 });
});
