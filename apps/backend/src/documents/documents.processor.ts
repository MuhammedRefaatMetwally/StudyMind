import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as FormData from 'form-data';
import { PrismaService } from 'prisma/prisma.service';

@Processor('document-processing')
export class DocumentsProcessor {
  private readonly logger = new Logger(DocumentsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
  ) {}

  @Process('process-pdf')
  async handleProcessPdf(job: Job<{ documentId: string; filePath: string; userId: string }>) {
    const { documentId, filePath, userId } = job.data;

    this.logger.log(`Processing document ${documentId}`);

    try {
      // Send PDF to Python AI service for processing
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      formData.append('document_id', documentId);
      formData.append('user_id', userId);

      await firstValueFrom(
        this.httpService.post(
          `${process.env.AI_SERVICE_URL}/process-document`,
          formData,
          { headers: formData.getHeaders() },
        ),
      );

      // Update status to READY
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'READY' },
      });

      this.logger.log(`Document ${documentId} processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process document ${documentId}`, error);

      // Update status to FAILED
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      });
    } finally {
      // Always clean up the temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
}