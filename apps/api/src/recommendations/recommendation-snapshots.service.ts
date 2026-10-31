import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { CampaignSignal } from '../database/entities/campaign-signal.entity'
import { Campaign } from '../database/entities/campaign.entity'
import { RecommendationSnapshotRow } from '../database/entities/recommendation-snapshot.entity'
import {
  buildRecommendationSnapshot,
  type RecommendationSnapshotPayload,
} from './recommendation-snapshot'

export const SNAPSHOT_TTL_TOKEN = Symbol('RECOMMENDATION_SNAPSHOT_TTL_MS')
export const SNAPSHOT_TTL_MS = 5 * 60_000
export const SNAPSHOT_REFRESH_DEBOUNCE_MS = 1_000
export const SNAPSHOT_SCOPE = 'global'

function parsePayload(raw: string): RecommendationSnapshotPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<RecommendationSnapshotPayload>
    if (
      parsed.schemaVersion !== 1 ||
      !Array.isArray(parsed.trending) ||
      !Array.isArray(parsed.affinities) ||
      typeof parsed.builtAt !== 'string'
    ) {
      return null
    }
    return parsed as RecommendationSnapshotPayload
  } catch {
    return null
  }
}

/**
 * Session-independent recommendation cache. A snapshot is loaded from the
 * database when it is still fresh, rebuilt on TTL expiry or explicit
 * invalidation, and then served from memory. One API instance rebuilds at most
 * once per debounce window; no external cache or worker is required.
 */
@Injectable()
export class RecommendationSnapshotsService implements OnModuleDestroy {
  private readonly logger = new Logger(RecommendationSnapshotsService.name)
  private cache: RecommendationSnapshotPayload | null = null
  private expiresAt = 0
  private forceRefresh = false
  private pending: Promise<RecommendationSnapshotPayload> | null = null
  private refreshTimer?: NodeJS.Timeout

  constructor(
    @InjectRepository(RecommendationSnapshotRow)
    private readonly snapshots: Repository<RecommendationSnapshotRow>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(CampaignSignal) private readonly signals: Repository<CampaignSignal>,
    @Inject(SNAPSHOT_TTL_TOKEN) private readonly ttlMs: number,
  ) {}

  async get(): Promise<RecommendationSnapshotPayload> {
    if (this.cache && Date.now() < this.expiresAt) return this.cache
    return this.sharedResolve()
  }

  /** Rebuild immediately. Used on first boot/tests and by the debounce timer. */
  async refreshNow(): Promise<RecommendationSnapshotPayload> {
    this.forceRefresh = true
    return this.sharedResolve()
  }

  /**
   * Marks the snapshot stale after a signal write. The rebuild is debounced in
   * the background; a request arriving first will resolve it synchronously
   * through `get()`.
   */
  invalidate(): void {
    this.cache = null
    this.expiresAt = 0
    this.forceRefresh = true
    if (this.refreshTimer) return

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined
      void this.refreshNow().catch((error: unknown) => {
        this.logger.warn(
          `Could not refresh recommendation snapshot: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        )
      })
    }, SNAPSHOT_REFRESH_DEBOUNCE_MS)
    this.refreshTimer.unref?.()
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    this.refreshTimer = undefined
  }

  private sharedResolve(): Promise<RecommendationSnapshotPayload> {
    if (!this.pending) {
      this.pending = this.resolve().finally(() => {
        this.pending = null
      })
    }
    return this.pending
  }

  private async resolve(): Promise<RecommendationSnapshotPayload> {
    if (!this.forceRefresh) {
      const row = await this.snapshots.findOne({ where: { scope: SNAPSHOT_SCOPE } })
      if (row && Date.now() - row.computedAt.getTime() < this.ttlMs) {
        const payload = parsePayload(row.payload)
        if (payload) {
          this.cache = payload
          this.expiresAt = Date.now() + this.ttlMs
          return payload
        }
      }
    }
    return this.buildAndStore()
  }

  private async buildAndStore(): Promise<RecommendationSnapshotPayload> {
    const now = new Date()
    const [campaigns, signals, existing] = await Promise.all([
      this.campaigns.find({
        where: { status: 'OPEN' },
        select: {
          slug: true,
          unitsCommitted: true,
          minimumUnits: true,
          closesAt: true,
        },
      }),
      this.loadSignals(),
      this.snapshots.findOne({
        where: { scope: SNAPSHOT_SCOPE },
        select: { version: true },
      }),
    ])

    const payload = buildRecommendationSnapshot({ campaigns, signals, now })
    const version = (existing?.version ?? 0) + 1
    await this.snapshots.upsert(
      {
        scope: SNAPSHOT_SCOPE,
        payload: JSON.stringify(payload),
        computedAt: now,
        version,
      },
      { conflictPaths: ['scope'] },
    )

    this.cache = payload
    this.expiresAt = Date.now() + this.ttlMs
    this.forceRefresh = false
    this.logger.debug(
      `Recommendation snapshot v${version}: ${payload.campaignCount} campaigns, ${payload.signalCount} signals, ${payload.affinities.length} affinity edges.`,
    )
    return payload
  }

  private async loadSignals(): Promise<
    Array<{ userId: string; campaignSlug: string; weight: number }>
  > {
    const rows = await this.signals
      .createQueryBuilder('signal')
      .innerJoin('signal.campaign', 'campaign')
      .select('signal.user_id', 'userId')
      .addSelect('campaign.slug', 'campaignSlug')
      .addSelect('signal.weight', 'weight')
      .getRawMany<{ userId: string; campaignSlug: string; weight: string | number }>()

    return rows.map((row) => ({
      userId: row.userId,
      campaignSlug: row.campaignSlug,
      weight: Number(row.weight),
    }))
  }
}
