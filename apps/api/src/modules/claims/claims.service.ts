import { eq, and, or, ilike, desc, asc, sql, count } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import type { Logger } from '../../lib/logger';
import { claims, claimTimeline, claimAttachments } from '@myhrvold/db/schema';
import type { CreateClaimInput, UpdateClaimInput, ListClaimsInput } from '@myhrvold/shared/validators';

export class ClaimsService {
  constructor(
    private db: Database,
    private log: Logger
  ) {}

  async generateClaimNumber(supplierShortCode: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `${supplierShortCode}-${year}${month}`;

    const lastClaim = await this.db.query.claims.findFirst({
      where: ilike(claims.claimNumber, `${prefix}%`),
      orderBy: [desc(claims.claimNumber)],
    });

    let sequence = 1;
    if (lastClaim) {
      const lastSequence = parseInt(lastClaim.claimNumber.split('-').pop() || '0', 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  async create(input: CreateClaimInput, userId: string) {
    const supplier = await this.db.query.suppliers.findFirst({
      where: eq(sql`id`, input.supplierId),
    });

    const claimNumber = await this.generateClaimNumber(supplier?.shortCode || 'UNK');
    const portalCode = this.generatePortalCode();

    const [claim] = await this.db.insert(claims).values({
      claimNumber,
      supplierPortalCode: portalCode,
      supplierId: input.supplierId,
      productId: input.productId,
      productNameText: input.productNameText,
      serialNumber: input.serialNumber,
      purchaseDate: input.purchaseDate,
      invoiceNumber: input.invoiceNumber,
      customerId: input.customerId,
      customerCompanyName: input.customerCompanyName,
      customerContactName: input.customerContactName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      customerPostalCode: input.customerPostalCode,
      customerCity: input.customerCity,
      problemDescription: input.problemDescription,
      category: input.category,
      priority: input.priority,
      status: 'new',
      createdById: userId,
    }).returning();

    await this.addTimelineEntry(claim.id, 'created', 'Reklamasjon opprettet', userId);

    this.log.info({ claimId: claim.id, claimNumber }, 'Claim created');

    return claim;
  }

  async list(input: ListClaimsInput) {
    const { page, limit, search, status, supplierId, priority, sortBy, sortOrder } = input;
    const offset = (page - 1) * limit;

    const conditions = [eq(claims.isDeleted, false)];

    if (status) {
      conditions.push(eq(claims.status, status));
    }
    if (supplierId) {
      conditions.push(eq(claims.supplierId, supplierId));
    }
    if (priority) {
      conditions.push(eq(claims.priority, priority));
    }
    if (search) {
      conditions.push(
        or(
          ilike(claims.claimNumber, `%${search}%`),
          ilike(claims.productNameText, `%${search}%`),
          ilike(claims.customerCompanyName, `%${search}%`)
        )!
      );
    }

    const orderColumn = claims[sortBy as keyof typeof claims] || claims.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc : desc;

    const result = await this.db.query.claims.findMany({
      where: and(...conditions),
      with: {
        supplier: true,
        customer: true,
      },
      orderBy: [orderDirection(orderColumn as any)],
      limit,
      offset,
    });

    return result;
  }

  async getById(id: string) {
    const claim = await this.db.query.claims.findFirst({
      where: and(eq(claims.id, id), eq(claims.isDeleted, false)),
      with: {
        supplier: true,
        product: true,
        customer: true,
        createdBy: true,
        assignedTo: true,
        attachments: true,
        timeline: {
          orderBy: [desc(claimTimeline.createdAt)],
        },
        parts: true,
      },
    });

    return claim;
  }

  async update(input: UpdateClaimInput, userId: string) {
    const { id, ...updateData } = input;

    const [updated] = await this.db
      .update(claims)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();

    if (input.status) {
      await this.addTimelineEntry(id, 'status_changed', `Status endret til ${input.status}`, userId);
    }

    return updated;
  }

  async getStats() {
    const stats = await this.db
      .select({
        status: claims.status,
        count: count(),
      })
      .from(claims)
      .where(eq(claims.isDeleted, false))
      .groupBy(claims.status);

    const result = {
      new: 0,
      inProgress: 0,
      pendingSupplier: 0,
      resolved: 0,
      total: 0,
    };

    for (const stat of stats) {
      result.total += Number(stat.count);
      switch (stat.status) {
        case 'new':
          result.new = Number(stat.count);
          break;
        case 'in_progress':
          result.inProgress = Number(stat.count);
          break;
        case 'pending_supplier':
          result.pendingSupplier = Number(stat.count);
          break;
        case 'resolved':
          result.resolved = Number(stat.count);
          break;
      }
    }

    return result;
  }

  private generatePortalCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private async addTimelineEntry(claimId: string, eventType: string, description: string, userId: string) {
    await this.db.insert(claimTimeline).values({
      claimId,
      eventType,
      description,
      createdById: userId,
    });
  }
}
