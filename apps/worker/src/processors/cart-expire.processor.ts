import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

// TODO SIT-84: inject CartService and call expireStale()
@Processor('ecom-orders')
export class CartExpireProcessor extends WorkerHost {
  private readonly logger = new Logger(CartExpireProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name !== 'cart.expire') return;
    this.logger.log('cart.expire job fired — processor not yet implemented (SIT-84)');
  }
}
