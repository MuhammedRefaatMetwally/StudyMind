import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('document-processing') private documentQueue: Queue,
  ) {}

  async uploadDocument(userId: string, file: Express.Multer.File) {
    // 1. Save document record to DB immediately
    const document = await this.prisma.document.create({
      data: {
        name: file.originalname,
        size: file.size,
        status: 'PROCESSING',
        userId,
      },
    });

    // 2. Push job to queue — non-blocking
    await this.documentQueue.add('process-pdf', {
      documentId: document.id,
      filePath: file.path,
      userId,
    });

    return document;
  }

  async getUserDocuments(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        size: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getDocument(documentId: string, userId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) throw new NotFoundException('Document not found');

    // Security check — users can only access their own documents
    if (document.userId !== userId) throw new ForbiddenException('Access denied');

    return document;
  }

  async deleteDocument(documentId: string, userId: string) {
    const document = await this.getDocument(documentId, userId);

    await this.prisma.document.delete({
      where: { id: document.id },
    });

    return { message: 'Document deleted successfully' };
  }
}