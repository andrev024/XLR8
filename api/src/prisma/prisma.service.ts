import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async withPostgis<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (transaction) => {
      await transaction.$executeRaw`SET LOCAL search_path TO public, extensions`;
      return operation(transaction);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
