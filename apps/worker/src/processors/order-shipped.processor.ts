import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

// TODO SIT-93: inject EmailService and send order shipped email
@Processor('ecom-notifications')
export class OrderShippedProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderShippedProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name !== 'order.shipped') return;
    this.logger.log('order.shipped job fired — processor not yet implemented (SIT-93)');
  }
}
