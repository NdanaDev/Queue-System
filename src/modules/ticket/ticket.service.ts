import type { PrismaClient } from "../../generated/prisma/client";
import { HttpError } from "../../common/http-error";
import { isUniqueConstraintViolation } from "../../common/prisma-errors";
import * as ticketRepository from "./ticket.repository";
import type { CreateTicketBody } from "./ticket.schema";

export async function createTicket(
  prisma: PrismaClient,
  input: CreateTicketBody,
) {
  const queue = await ticketRepository.findQueueById(prisma, input.queueId);
  if (!queue) {
    throw new HttpError(404, "Queue not found");
  }
  if (queue.status !== "OPEN") {
    throw new HttpError(409, "Queue is not open");
  }

  const offering = await ticketRepository.findBranchServiceCategory(
    prisma,
    queue.branchId,
    queue.serviceCategoryId,
  );
  if (!offering || !offering.isActive) {
    throw new HttpError(
      409,
      "Branch does not currently offer this service category",
    );
  }

  const customer = await ticketRepository.findCustomerById(
    prisma,
    input.customerId,
  );
  if (!customer) {
    throw new HttpError(404, "Customer not found");
  }

  // A pre-check for a clean 409 in the common case. It is not sufficient by
  // itself: two requests for the same customer could both pass this check
  // before either commits. The partial unique index applied in migration
  // 20260722123745 is the real guarantee — the catch below is what makes
  // that race safe instead of a 500.
  const existingActiveTicket =
    await ticketRepository.findActiveTicketForCustomer(
      prisma,
      input.customerId,
    );
  if (existingActiveTicket) {
    throw new HttpError(409, "Customer already has an active ticket");
  }

  try {
    return await ticketRepository.createTicket(prisma, {
      queueId: queue.id,
      customerId: customer.id,
      serviceCategoryId: queue.serviceCategoryId,
      priorityFlag: customer.priorityFlag,
    });
  } catch (err) {
    if (isUniqueConstraintViolation(err, "Ticket_customerId_active_key")) {
      throw new HttpError(409, "Customer already has an active ticket");
    }
    throw err;
  }
}

export async function getTicketById(prisma: PrismaClient, id: string) {
  const ticket = await ticketRepository.findTicketById(prisma, id);
  if (!ticket) {
    throw new HttpError(404, "Ticket not found");
  }

  const isActive = ticketRepository.ACTIVE_TICKET_STATUSES.includes(
    ticket.status,
  );
  const position = isActive
    ? await ticketRepository.countTicketsAhead(prisma, ticket)
    : null;

  return { ticket, position };
}
