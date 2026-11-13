import { Module } from '@nestjs/common';
import { TechFingerprintController } from './tech-fingerprint.controller.js';
import { TechFingerprintService } from './tech-fingerprint.service.js';

@Module({
  controllers: [TechFingerprintController],
  providers: [TechFingerprintService],
})
export class TechFingerprintModule {}
