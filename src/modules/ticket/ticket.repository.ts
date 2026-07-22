import type { PrismaClient, Ticket } from "../../generated/prisma/client";
import { TicketStatus } from "../../generated/prisma/client";

export const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.WAITING,
  TicketStatus.CALLED,
  TicketStatus.IN_SERVICE,
];

export function findQueueById(prisma: PrismaClient, queueId: string) {
  return prisma.queue.findUnique({ where: { id: queueId } });
}

export function findBranchServiceCategory(
  prisma: PrismaClient,
  branchId: string,
  serviceCategoryId: string,
) {
  return prisma.branchServiceCategory.findUnique({
    where: { branchId_serviceCategoryId: { branchId, serviceCategoryId } },
  });
}

export function findCustomerById(prisma: PrismaClient, customerId: string) {
  return prisma.customer.findUnique({ where: { id: customerId } });
}

export function findActiveTicketForCustomer(
  prisma: PrismaClient,
  customerId: string,
) {
  return prisma.ticket.findFirst({
    where: { customerId, status: { in: ACTIVE_TICKET_STATUSES } },
  });
}

export function findTicketById(prisma: PrismaClient, id: string) {
  return prisma.ticket.findUnique({ where: { id } });
}

export function createTicket(
  prisma: PrismaClient,
  data: {
    queueId: string;
    customerId: string;
    serviceCategoryId: string;
    priorityFlag: boolean;
  },
) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.create({ data });

    await tx.auditLog.create({
      data: {
        entityType: "Ticket",
        entityId: ticket.id,
        action: "TICKET_CREATED",
      },
    });

    return ticket;
  });
}

// Implements schema.md decision #2: position isn't stored, it's computed at
// read time as "how many active tickets in this queue sort ahead of me"
// under ORDER BY priorityFlag DESC, createdAt ASC.
export function countTicketsAhead(
  prisma: PrismaClient,
  ticket: Pick<Ticket, "id" | "queueId" | "priorityFlag" | "createdAt">,
) {
  const base = {
    queueId: ticket.queueId,
    status: { in: ACTIVE_TICKET_STATUSES },
    id: { not: ticket.id },
  };

  if (ticket.priorityFlag) {
    return prisma.ticket.count({
      where: {
        ...base,
        priorityFlag: true,
        createdAt: { lt: ticket.createdAt },
      },
    });
  }

  return prisma.ticket.count({
    where: {
      ...base,
      OR: [
        { priorityFlag: true },
        { priorityFlag: false, createdAt: { lt: ticket.createdAt } },
      ],
    },
  });
}
