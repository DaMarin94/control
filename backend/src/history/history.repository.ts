import { Injectable } from '@nestjs/common';
import { HistoryAction, HistoryTargetKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HistorySnapshot } from './history.types';

/** Máximo de entradas vigentes por movimiento (RF-HIST-005). */
export const MAX_ENTRIES_PER_MOVEMENT = 5;

/** Vencimiento de una entrada de historial, en milisegundos (RF-HIST-005 — 31 días). */
export const RETENTION_MS = 31 * 24 * 60 * 60 * 1000;

export interface HistoryEntryRow {
  id: string;
  userId: string;
  targetKind: HistoryTargetKind;
  targetId: string;
  action: HistoryAction;
  snapshot: HistorySnapshot;
  createdAt: Date;
}

@Injectable()
export class HistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    targetKind: HistoryTargetKind,
    targetId: string,
    action: HistoryAction,
    snapshot: HistorySnapshot,
  ): Promise<HistoryEntryRow> {
    const row = await this.prisma.historyEntry.create({
      data: {
        userId,
        targetKind,
        targetId,
        action,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    return row as unknown as HistoryEntryRow;
  }

  /** Todas las entradas vigentes del usuario, cronológico ascendente (más antigua primero). */
  async findAllForUserAsc(userId: string): Promise<HistoryEntryRow[]> {
    const rows = await this.prisma.historyEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows as unknown as HistoryEntryRow[];
  }

  async findById(id: string): Promise<HistoryEntryRow | null> {
    const row = await this.prisma.historyEntry.findUnique({ where: { id } });
    return row as unknown as HistoryEntryRow | null;
  }

  /**
   * Entradas de un mismo movimiento (stack LIFO), cronológico ascendente.
   * Clave: (userId, targetKind, targetId) — RN-024.
   */
  async findChainAsc(
    userId: string,
    targetKind: HistoryTargetKind,
    targetId: string,
  ): Promise<HistoryEntryRow[]> {
    const rows = await this.prisma.historyEntry.findMany({
      where: { userId, targetKind, targetId },
      orderBy: { createdAt: 'asc' },
    });
    return rows as unknown as HistoryEntryRow[];
  }

  /** Entradas vencidas (más de RETENTION_MS) de un usuario. */
  async findExpiredForUser(userId: string, cutoff: Date): Promise<HistoryEntryRow[]> {
    const rows = await this.prisma.historyEntry.findMany({
      where: { userId, createdAt: { lt: cutoff } },
    });
    return rows as unknown as HistoryEntryRow[];
  }

  /** Ids de las entradas más antiguas de un movimiento por encima del tope de retención. */
  async findOverflowIds(
    userId: string,
    targetKind: HistoryTargetKind,
    targetId: string,
    keep: number,
  ): Promise<string[]> {
    const rows = await this.prisma.historyEntry.findMany({
      where: { userId, targetKind, targetId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (rows.length <= keep) return [];
    return rows.slice(0, rows.length - keep).map((r) => r.id);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.historyEntry.delete({ where: { id } }).catch(() => undefined);
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.historyEntry.deleteMany({ where: { id: { in: ids } } });
  }
}
