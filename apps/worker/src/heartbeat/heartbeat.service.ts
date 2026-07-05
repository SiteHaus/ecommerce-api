import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Pushes a liveness heartbeat to Lighthaus (SiteHaus monitoring). The worker
 * has no HTTP surface to poll, so Lighthaus watches for these pushes instead:
 * its `commerce-worker` heartbeat monitor goes down after 3 minutes of
 * silence. We beat every 60s so a single dropped request never pages anyone.
 *
 * Both env vars optional — without them (local dev) the pusher stays off.
 */
@Injectable()
export class HeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HeartbeatService.name);
  private timer: NodeJS.Timeout | null = null;

  static readonly INTERVAL_MS = 60_000;
  static readonly SERVICE_NAME = "commerce-worker";

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>("LIGHTHAUS_HEARTBEAT_URL");
    const secret = this.config.get<string>("LIGHTHAUS_HEARTBEAT_SECRET");
    if (!url || !secret) {
      this.logger.log("Lighthaus heartbeat disabled (LIGHTHAUS_HEARTBEAT_* not set)");
      return;
    }

    void this.beat(url, secret);
    this.timer = setInterval(() => void this.beat(url, secret), HeartbeatService.INTERVAL_MS);
    // Never keep the process alive just to heartbeat.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One push. Failures are logged and swallowed — monitoring must never take the worker down. */
  async beat(url: string, secret: string): Promise<void> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ service: HeartbeatService.SERVICE_NAME }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Lighthaus heartbeat rejected: HTTP ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(
        `Lighthaus heartbeat failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
