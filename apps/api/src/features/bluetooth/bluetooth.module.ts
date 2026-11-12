import { Module } from '@nestjs/common';
import { BluetoothController } from './bluetooth.controller.js';
import { BluetoothService } from './bluetooth.service.js';

@Module({ controllers: [BluetoothController], providers: [BluetoothService] })
export class BluetoothModule {}
