import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

// TODO SIT-92: inject EmailService and send order confirmation email
@Processor('ecom:notifications')
export class OrderConfirmedProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderConfirmedProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name !== 'order.confirmed') return;
    this.logger.log('order.confirmed job fired — processor not yet implemented (SIT-92)');
  }
}
