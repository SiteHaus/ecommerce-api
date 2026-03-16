import { Module } from '@nestjs/common';

// TODO SIT-80: wire InventoryHandlerController (@MessagePattern inventory.get, inventory.adjust, inventory.availability)
// TODO SIT-81: wire reservation patterns (inventory.reserve, inventory.release, inventory.commit)

@Module({})
export class InventoryHandlersModule {}
