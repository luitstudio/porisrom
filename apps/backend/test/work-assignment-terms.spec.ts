import { activeMarketplaceFixture } from "./active-marketplace-fixture";
import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";

import { CreateWorkAssignmentDto } from "../src/work-assignments/dto/create-work-assignment.dto";
import { ReviseWorkAssignmentDto } from "../src/work-assignments/dto/revise-work-assignment.dto";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  tomorrowDateKey,
} from "../src/work-assignments/dto/work-assignment-terms";
import { WorkAssignmentsService } from "../src/work-assignments/work-assignments.service";
import type { PrismaService } from "../src/prisma/prisma.service";

function isoDateFromKey(dateKey: string) {
  return `${dateKey}T00:00:00.000Z`;
}

function todayKey() {
  return dateKeyInTimeZone(new Date());
}

async function validateCreate(input: object) {
  return validate(plainToInstance(CreateWorkAssignmentDto, input));
}

async function validateRevise(input: object) {
  return validate(plainToInstance(ReviseWorkAssignmentDto, input));
}

describe("work assignment term validation", () => {
  it.each([0, -1])("rejects create budget %s", async (budgetAmount) => {
    const errors = await validateCreate({
      title: "Assignment",
      description: "Description",
      budgetAmount,
    });

    expect(errors.some((error) => error.property === "budgetAmount")).toBe(true);
  });

  it("accepts create budget of ₹1", async () => {
    const errors = await validateCreate({
      title: "Assignment",
      description: "Description",
      budgetAmount: 1,
    });

    expect(errors).toHaveLength(0);
  });

  it.each([
    ["yesterday", () => addDaysToDateKey(todayKey(), -1)],
    ["today", todayKey],
  ])("rejects %s due dates", async (_label, dateKey) => {
    const errors = await validateCreate({
      title: "Assignment",
      description: "Description",
      budgetAmount: 1,
      dueDate: isoDateFromKey(dateKey()),
    });

    expect(errors.some((error) => error.property === "dueDate")).toBe(true);
  });

  it("accepts tomorrow as the minimum due date", async () => {
    const errors = await validateCreate({
      title: "Assignment",
      description: "Description",
      budgetAmount: 1,
      dueDate: isoDateFromKey(tomorrowDateKey()),
    });

    expect(errors).toHaveLength(0);
  });

  it("applies the same budget and date rules to revisions", async () => {
    await expect(validateRevise({ action: "revise", budgetAmount: 0 })).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: "budgetAmount" })]),
    );
    await expect(validateRevise({ action: "revise", dueDate: isoDateFromKey(todayKey()) })).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: "dueDate" })]),
    );
  });
});

describe("work assignment service term guards", () => {
  it("rejects invalid create terms before writing", async () => {
    const prisma = { db: { $transaction: vi.fn() } } as unknown as PrismaService;
    const service = new WorkAssignmentsService(prisma);

    await expect(service.create("client-1", "conversation-1", {
      title: "Assignment",
      description: "Description",
      budgetAmount: 0,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid future revisions without rewriting an assignment", async () => {
    const transaction = vi.fn();
    const prisma = {
      db: {
        $transaction: transaction,
        workAssignment: {
          findUnique: vi.fn().mockResolvedValue({
            id: "assignment-1",
            createdById: "client-1",
            status: "modification_requested",
            conversation: { connection: { requesterId: "client-1", receiverId: "freelancer-1" } },
          }),
        },
      },
    } as unknown as PrismaService;
    const service = new WorkAssignmentsService(prisma);

    await expect(service.revise("client-1", "assignment-1", {
      action: "revise",
      budgetAmount: 0,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("preserves existing invalid historical terms when a revision does not submit new invalid terms", async () => {
    const tx = {
      ...activeMarketplaceFixture(),
      workAssignment: { update: vi.fn(), findUnique: vi.fn().mockResolvedValue({ status: "modification_requested", cancelRequestedById: null, updatedAt: new Date("2026-10-22T00:00:00Z") }) },
      workAssignmentEvent: { create: vi.fn() },
    };
    const transaction = vi.fn((callback: (client: typeof tx) => unknown) => callback(tx));
    const prisma = {
      db: {
        $transaction: transaction,
        workAssignment: {
          findUnique: vi.fn()
            .mockResolvedValueOnce({
              id: "assignment-1",
              createdById: "client-1",
              status: "modification_requested",
              budgetAmount: 0,
              cancelRequestedById: null, updatedAt: new Date("2026-10-22T00:00:00Z"),
              dueDate: new Date("2026-01-01T00:00:00.000Z"),
              conversation: { connection: { requesterId: "client-1", receiverId: "freelancer-1" } },
            })
            .mockResolvedValueOnce(null),
        },
      },
    } as unknown as PrismaService;
    const service = new WorkAssignmentsService(prisma);

    await service.revise("client-1", "assignment-1", {
      action: "revise",
      title: "Scope update",
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(tx.workAssignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { status: "proposed", title: "Scope update" },
    });
  });
});
