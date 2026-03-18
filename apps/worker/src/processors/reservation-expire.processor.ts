import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

// TODO SIT-82: inject ReservationService and call expireStale()
@Processor('ecom:inventory')
export class ReservationExpireProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationExpireProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name !== 'reservation.expire') return;
    this.logger.log('reservation.expire job fired — processor not yet implemented (SIT-82)');
  }
}
