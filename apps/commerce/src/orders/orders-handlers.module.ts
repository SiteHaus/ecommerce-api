import { Module } from '@nestjs/common';

// TODO SIT-89: wire OrdersHandlerController (@MessagePattern orders.get, orders.list)
// TODO SIT-90: wire admin patterns (orders.admin.list, orders.admin.get)
// TODO SIT-91: wire action patterns (orders.admin.ship)

@Module({})
export class OrdersHandlersModule {}
