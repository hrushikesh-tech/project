import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AccountType, Prisma } from "@amdox/db";
import {
  JournalEntryStatus,
  PeriodClosedException,
  PostedEntryImmutableException,
  UnbalancedEntryException,
} from "@amdox/types";
import { ClsService } from "nestjs-cls";
import { FxRatesService } from "./fx-rates.service";
import { serializeFinanceValue } from "./finance.serialization";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { CreateFiscalPeriodDto } from "./dto/create-fiscal-period.dto";
import { CreateIntercompanyTransferDto } from "./dto/create-intercompany-transfer.dto";
import {
  CreateJournalEntryDto,
  CreateJournalLineDto,
  ReverseJournalEntryDto,
} from "./dto/create-journal-entry.dto";
import { CreateLegalEntityDto } from "./dto/create-legal-entity.dto";
import {
  FxRateQueryDto,
  JournalEntryQueryDto,
  ReportQueryDto,
} from "./dto/finance-query.dto";

type TenantDb = Prisma.TransactionClient;

type PreparedJournalLine = {
  accountId: string;
  debit: bigint;
  credit: bigint;
  transactionDebit: bigint;
  transactionCredit: bigint;
  currency: string;
  fxRate: Prisma.Decimal;
  description: string | null;
};

type RawStatementRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debitMinor: bigint;
  creditMinor: bigint;
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly fxRatesService: FxRatesService,
  ) {}

  async listLegalEntities() {
    this.requireTenantId();
    return serializeFinanceValue(
      await this.prisma.tenant.legalEntity.findMany({
        where: { deletedAt: null },
        orderBy: [{ code: "asc" }],
      }),
    );
  }

  async createLegalEntity(dto: CreateLegalEntityDto) {
    const tenantId = this.requireTenantId();
    return serializeFinanceValue(
      await this.prisma.tenant.legalEntity.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          baseCurrency: dto.baseCurrency.trim().toUpperCase(),
          tenant: {
            connect: { id: tenantId },
          },
          isActive: dto.isActive ?? true,
        },
      }),
    );
  }

  async listAccounts(legalEntityId: string) {
    await this.ensureLegalEntityExists(legalEntityId);
    return serializeFinanceValue(
      await this.prisma.tenant.account.findMany({
        where: { legalEntityId },
        include: {
          parent: true,
          legalEntity: true,
        },
        orderBy: [{ code: "asc" }],
      }),
    );
  }

  async createAccount(dto: CreateAccountDto) {
    const tenantId = this.requireTenantId();
    await this.ensureLegalEntityExists(dto.legalEntityId);

    if (dto.parentId) {
      const parent = await this.prisma.tenant.account.findFirst({
        where: { id: dto.parentId },
      });
      if (!parent || parent.legalEntityId !== dto.legalEntityId) {
        throw new BadRequestException(
          "Parent account must exist in the same legal entity.",
        );
      }
    }

    return serializeFinanceValue(
      await this.prisma.tenant.account.create({
        data: {
          tenantId,
          legalEntityId: dto.legalEntityId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          type: dto.type,
          parentId: dto.parentId ?? null,
          isActive: dto.isActive ?? true,
          currency: (dto.currency ?? "INR").trim().toUpperCase(),
        },
        include: {
          parent: true,
          legalEntity: true,
        },
      }),
    );
  }

  async listFiscalPeriods(legalEntityId: string) {
    await this.ensureLegalEntityExists(legalEntityId);
    return serializeFinanceValue(
      await this.prisma.tenant.fiscalPeriod.findMany({
        where: { legalEntityId },
        orderBy: [{ startDate: "asc" }],
      }),
    );
  }

  async createFiscalPeriod(dto: CreateFiscalPeriodDto) {
    const tenantId = this.requireTenantId();
    await this.ensureLegalEntityExists(dto.legalEntityId);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate >= endDate) {
      throw new BadRequestException(
        "Fiscal period endDate must be after startDate.",
      );
    }

    return serializeFinanceValue(
      await this.prisma.tenant.fiscalPeriod.create({
        data: {
          tenantId,
          legalEntityId: dto.legalEntityId,
          name: dto.name.trim(),
          startDate,
          endDate,
        },
      }),
    );
  }

  async closeFiscalPeriod(periodId: string, closedBy?: string) {
    const period = await this.prisma.tenant.fiscalPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) {
      throw new NotFoundException("Fiscal period not found.");
    }

    return serializeFinanceValue(
      await this.prisma.tenant.fiscalPeriod.update({
        where: { id: periodId },
        data: {
          isClosed: true,
          closedAt: new Date(),
          closedBy: closedBy ?? "system",
        },
      }),
    );
  }

  async listJournalEntries(query: JournalEntryQueryDto) {
    await this.ensureLegalEntityExists(query.legalEntityId);

    return serializeFinanceValue(
      await this.prisma.tenant.journalEntry.findMany({
        where: {
          legalEntityId: query.legalEntityId,
          periodId: query.periodId,
          status: query.status,
        },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
          legalEntity: true,
          period: true,
          originalEntry: true,
          reversalEntry: true,
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
    );
  }

  async createJournalEntry(dto: CreateJournalEntryDto) {
    return serializeFinanceValue(
      await this.withTenantTransaction(async (db) => {
        const legalEntity = await this.getLegalEntityOrThrow(
          db,
          dto.legalEntityId,
        );
        const period = await this.getPeriodOrThrow(db, dto.periodId);

        if (period.legalEntityId !== dto.legalEntityId) {
          throw new BadRequestException(
            "Journal period must belong to the same legal entity.",
          );
        }

        const preparedLines = await this.prepareJournalLines(
          db,
          legalEntity,
          new Date(dto.date),
          dto.lines,
        );
        this.assertBalanced(preparedLines);

        return this.createJournalEntryRecord(db, {
          legalEntityId: dto.legalEntityId,
          periodId: dto.periodId,
          date: new Date(dto.date),
          description: dto.description.trim(),
          status: JournalEntryStatus.DRAFT,
          entryNumber: this.createEntryNumber("JE"),
          lines: preparedLines,
        });
      }),
    );
  }

  async postJournalEntry(journalEntryId: string, postedBy?: string) {
    return serializeFinanceValue(
      await this.withTenantTransaction(async (db) => {
        const entry = await db.journalEntry.findFirst({
          where: {
            id: journalEntryId,
            tenantId: this.requireTenantId(),
            deletedAt: null,
          },
          include: { lines: true, period: true, legalEntity: true },
        });
        if (!entry) {
          throw new NotFoundException("Journal entry not found.");
        }

        if (entry.status === JournalEntryStatus.POSTED) {
          return entry;
        }

        if (entry.status === JournalEntryStatus.REVERSED) {
          throw new PostedEntryImmutableException(
            "Reversed journal entries cannot be re-posted.",
          );
        }

        this.ensurePeriodOpen(entry.period);
        this.assertBalanced(
          entry.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            transactionDebit: line.transactionDebit,
            transactionCredit: line.transactionCredit,
            currency: line.currency,
            fxRate: line.fxRate,
            description: line.description,
          })),
        );

        return db.journalEntry.update({
          where: { id: journalEntryId },
          data: {
            status: JournalEntryStatus.POSTED,
            postedAt: new Date(),
            postedBy: postedBy ?? "system",
          },
          include: {
            lines: {
              include: { account: true },
            },
            legalEntity: true,
            period: true,
          },
        });
      }),
    );
  }

  async updateDraftJournalDescription(
    journalEntryId: string,
    description: string,
  ) {
    return this.withTenantTransaction(async (db) => {
      const entry = await db.journalEntry.findFirst({
        where: {
          id: journalEntryId,
          tenantId: this.requireTenantId(),
          deletedAt: null,
        },
      });

      if (!entry) {
        throw new NotFoundException("Journal entry not found.");
      }
      this.ensureEntryEditable(entry.status as JournalEntryStatus);

      return db.journalEntry.update({
        where: { id: journalEntryId },
        data: { description },
      });
    });
  }

  async reverseJournalEntry(
    journalEntryId: string,
    dto: ReverseJournalEntryDto,
    postedBy?: string,
  ) {
    return serializeFinanceValue(
      await this.withTenantTransaction(async (db) => {
        const entry = await db.journalEntry.findFirst({
          where: {
            id: journalEntryId,
            tenantId: this.requireTenantId(),
            deletedAt: null,
          },
          include: {
            lines: true,
            period: true,
            reversalEntry: true,
            legalEntity: true,
          },
        });
        if (!entry) {
          throw new NotFoundException("Journal entry not found.");
        }
        if (entry.status !== JournalEntryStatus.POSTED) {
          throw new PostedEntryImmutableException(
            "Only posted entries can be reversed.",
          );
        }
        if (entry.reversalEntry) {
          throw new PostedEntryImmutableException(
            "This journal entry has already been reversed.",
          );
        }

        const targetPeriodId = dto.periodId ?? entry.periodId;
        const targetPeriod = await this.getPeriodOrThrow(db, targetPeriodId);
        if (targetPeriod.legalEntityId !== entry.legalEntityId) {
          throw new BadRequestException(
            "Reversal period must belong to the same legal entity.",
          );
        }
        this.ensurePeriodOpen(targetPeriod);

        const reversal = await this.createJournalEntryRecord(db, {
          legalEntityId: entry.legalEntityId,
          periodId: targetPeriodId,
          date: dto.reversalDate ? new Date(dto.reversalDate) : new Date(),
          description:
            dto.description?.trim() || `Reversal of ${entry.entryNumber}`,
          status: JournalEntryStatus.POSTED,
          entryNumber: this.createEntryNumber("REV"),
          postedAt: new Date(),
          postedBy: postedBy ?? "system",
          originalEntryId: entry.id,
          lines: entry.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.credit,
            credit: line.debit,
            transactionDebit: line.transactionCredit,
            transactionCredit: line.transactionDebit,
            currency: line.currency,
            fxRate: line.fxRate,
            description: line.description,
          })),
        });

        await db.journalEntry.update({
          where: { id: entry.id },
          data: { status: JournalEntryStatus.REVERSED },
        });

        return reversal;
      }),
    );
  }

  async createAndPostJournalEntryForTenant(
    tenantId: string,
    dto: CreateJournalEntryDto,
    postedBy?: string,
  ) {
    return serializeFinanceValue(
      await this.prisma.$transaction(async (db) => {
        const legalEntity = await this.getLegalEntityOrThrow(
          db,
          dto.legalEntityId,
          tenantId,
        );
        const period = await this.getPeriodOrThrow(db, dto.periodId, tenantId);

        if (period.legalEntityId !== dto.legalEntityId) {
          throw new BadRequestException(
            "Journal period must belong to the same legal entity.",
          );
        }
        this.ensurePeriodOpen(period);

        const preparedLines = await this.prepareJournalLinesForTenant(
          db,
          tenantId,
          legalEntity,
          new Date(dto.date),
          dto.lines,
        );
        this.assertBalanced(preparedLines);

        return this.createJournalEntryRecord(db, {
          tenantId,
          legalEntityId: dto.legalEntityId,
          periodId: dto.periodId,
          date: new Date(dto.date),
          description: dto.description.trim(),
          status: JournalEntryStatus.POSTED,
          entryNumber: this.createEntryNumber("PAY"),
          postedAt: new Date(),
          postedBy: postedBy ?? "system",
          lines: preparedLines,
        });
      }),
    );
  }

  async reverseJournalEntryForTenant(
    tenantId: string,
    journalEntryId: string,
    dto: ReverseJournalEntryDto,
    postedBy?: string,
  ) {
    return serializeFinanceValue(
      await this.prisma.$transaction(async (db) => {
        const entry = await db.journalEntry.findFirst({
          where: {
            id: journalEntryId,
            tenantId,
            deletedAt: null,
          },
          include: {
            lines: true,
            period: true,
            reversalEntry: true,
            legalEntity: true,
          },
        });
        if (!entry) {
          throw new NotFoundException("Journal entry not found.");
        }
        if (entry.status !== JournalEntryStatus.POSTED) {
          throw new PostedEntryImmutableException(
            "Only posted entries can be reversed.",
          );
        }
        if (entry.reversalEntry) {
          throw new PostedEntryImmutableException(
            "This journal entry has already been reversed.",
          );
        }

        const targetPeriodId = dto.periodId ?? entry.periodId;
        const targetPeriod = await this.getPeriodOrThrow(
          db,
          targetPeriodId,
          tenantId,
        );
        if (targetPeriod.legalEntityId !== entry.legalEntityId) {
          throw new BadRequestException(
            "Reversal period must belong to the same legal entity.",
          );
        }
        this.ensurePeriodOpen(targetPeriod);

        const reversal = await this.createJournalEntryRecord(db, {
          tenantId,
          legalEntityId: entry.legalEntityId,
          periodId: targetPeriodId,
          date: dto.reversalDate ? new Date(dto.reversalDate) : new Date(),
          description:
            dto.description?.trim() || `Reversal of ${entry.entryNumber}`,
          status: JournalEntryStatus.POSTED,
          entryNumber: this.createEntryNumber("PAY-REV"),
          postedAt: new Date(),
          postedBy: postedBy ?? "system",
          originalEntryId: entry.id,
          lines: entry.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.credit,
            credit: line.debit,
            transactionDebit: line.transactionCredit,
            transactionCredit: line.transactionDebit,
            currency: line.currency,
            fxRate: line.fxRate,
            description: line.description,
          })),
        });

        await db.journalEntry.update({
          where: { id: entry.id },
          data: { status: JournalEntryStatus.REVERSED },
        });

        return reversal;
      }),
    );
  }

  async getFxRate(query: FxRateQueryDto) {
    const tenantId = this.requireTenantId();
    const effectiveDate = query.effectiveDate
      ? new Date(query.effectiveDate)
      : new Date();
    const rate = await this.fxRatesService.getRate({
      tenantId,
      baseCurrency: query.baseCurrency.toUpperCase(),
      targetCurrency: query.targetCurrency.toUpperCase(),
      effectiveDate,
    });

    return {
      tenantId,
      baseCurrency: query.baseCurrency.toUpperCase(),
      targetCurrency: query.targetCurrency.toUpperCase(),
      effectiveDate: effectiveDate.toISOString(),
      rate: rate.toString(),
    };
  }

  async getTrialBalance(query: ReportQueryDto) {
    const rows = await this.getStatementRows(query);
    const report = rows.map((row) => ({
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      debitMinor: row.debitMinor.toString(),
      creditMinor: row.creditMinor.toString(),
      netMinor: (row.debitMinor - row.creditMinor).toString(),
    }));

    const totalDebit = rows.reduce((sum, row) => sum + row.debitMinor, 0n);
    const totalCredit = rows.reduce((sum, row) => sum + row.creditMinor, 0n);

    return {
      legalEntityId: query.legalEntityId,
      periodStart: query.startDate,
      periodEnd: query.endDate,
      rows: report,
      totalDebitMinor: totalDebit.toString(),
      totalCreditMinor: totalCredit.toString(),
    };
  }

  async getBalanceSheet(query: ReportQueryDto) {
    const rows = await this.getStatementRows(query);
    const assets = this.buildStatementCategory(rows, [AccountType.ASSET]);
    const liabilities = this.buildStatementCategory(rows, [
      AccountType.LIABILITY,
    ]);
    const equity = this.buildStatementCategory(rows, [AccountType.EQUITY]);

    return {
      legalEntityId: query.legalEntityId,
      periodStart: query.startDate,
      periodEnd: query.endDate,
      assets: assets.lines,
      liabilities: liabilities.lines,
      equity: equity.lines,
      totalAssetsMinor: assets.total.toString(),
      totalLiabilitiesMinor: liabilities.total.toString(),
      totalEquityMinor: equity.total.toString(),
    };
  }

  async getIncomeStatement(query: ReportQueryDto) {
    const rows = await this.getStatementRows(query);
    const revenues = this.buildStatementCategory(rows, [AccountType.REVENUE]);
    const expenses = this.buildStatementCategory(rows, [AccountType.EXPENSE]);

    return {
      legalEntityId: query.legalEntityId,
      periodStart: query.startDate,
      periodEnd: query.endDate,
      revenues: revenues.lines,
      expenses: expenses.lines,
      totalRevenueMinor: revenues.total.toString(),
      totalExpenseMinor: expenses.total.toString(),
      netIncomeMinor: (revenues.total - expenses.total).toString(),
    };
  }

  async createIntercompanyTransfer(
    dto: CreateIntercompanyTransferDto,
    postedBy?: string,
  ) {
    return serializeFinanceValue(
      await this.withTenantTransaction(async (db) => {
        if (dto.sourceLegalEntityId === dto.destinationLegalEntityId) {
          throw new BadRequestException(
            "Intercompany transfers require two different legal entities.",
          );
        }

        const sourceEntity = await this.getLegalEntityOrThrow(
          db,
          dto.sourceLegalEntityId,
        );
        const destinationEntity = await this.getLegalEntityOrThrow(
          db,
          dto.destinationLegalEntityId,
        );
        const sourcePeriod = await this.getPeriodOrThrow(
          db,
          dto.sourcePeriodId,
        );
        const destinationPeriod = await this.getPeriodOrThrow(
          db,
          dto.destinationPeriodId,
        );
        this.ensurePeriodOpen(sourcePeriod);
        this.ensurePeriodOpen(destinationPeriod);

        if (sourcePeriod.legalEntityId !== sourceEntity.id) {
          throw new BadRequestException(
            "Source period must belong to the source legal entity.",
          );
        }
        if (destinationPeriod.legalEntityId !== destinationEntity.id) {
          throw new BadRequestException(
            "Destination period must belong to the destination legal entity.",
          );
        }

        const sourceAccounts = await this.getAccountMap(db, [
          dto.sourceClearingAccountId,
          ...dto.lines.map((line) => line.sourceAccountId),
        ]);
        const destinationAccounts = await this.getAccountMap(db, [
          dto.destinationClearingAccountId,
          ...dto.lines.map((line) => line.destinationAccountId),
        ]);

        this.ensureAccountsBelongToEntity(
          sourceAccounts,
          sourceEntity.id,
          "All source accounts must belong to the source legal entity.",
        );
        this.ensureAccountsBelongToEntity(
          destinationAccounts,
          destinationEntity.id,
          "All destination accounts must belong to the destination legal entity.",
        );

        const sourceLines: PreparedJournalLine[] = [];
        const destinationLines: PreparedJournalLine[] = [];
        const totalTransactionAmount = BigInt(
          dto.lines.reduce((sum, line) => sum + line.amountMinor, 0),
        );
        let totalSource = 0n;
        let totalDestination = 0n;

        for (const line of dto.lines) {
          const sourcePrepared = await this.prepareJournalLineAmount(
            sourceEntity.baseCurrency,
            dto.currency,
            new Date(dto.transactionDate),
            BigInt(line.amountMinor),
          );
          const destinationPrepared = await this.prepareJournalLineAmount(
            destinationEntity.baseCurrency,
            dto.currency,
            new Date(dto.transactionDate),
            BigInt(line.amountMinor),
          );

          sourceLines.push({
            accountId: line.sourceAccountId,
            debit: 0n,
            credit: sourcePrepared.baseAmount,
            transactionDebit: 0n,
            transactionCredit: BigInt(line.amountMinor),
            currency: dto.currency.toUpperCase(),
            fxRate: sourcePrepared.fxRate,
            description: line.description ?? dto.description,
          });
          destinationLines.push({
            accountId: line.destinationAccountId,
            debit: destinationPrepared.baseAmount,
            credit: 0n,
            transactionDebit: BigInt(line.amountMinor),
            transactionCredit: 0n,
            currency: dto.currency.toUpperCase(),
            fxRate: destinationPrepared.fxRate,
            description: line.description ?? dto.description,
          });

          totalSource += sourcePrepared.baseAmount;
          totalDestination += destinationPrepared.baseAmount;
        }

        const sourceClearingRate = await this.fxRatesService.getRate({
          tenantId: this.requireTenantId(),
          baseCurrency: dto.currency.toUpperCase(),
          targetCurrency: sourceEntity.baseCurrency.toUpperCase(),
          effectiveDate: new Date(dto.transactionDate),
        });
        const destinationClearingRate = await this.fxRatesService.getRate({
          tenantId: this.requireTenantId(),
          baseCurrency: dto.currency.toUpperCase(),
          targetCurrency: destinationEntity.baseCurrency.toUpperCase(),
          effectiveDate: new Date(dto.transactionDate),
        });

        sourceLines.unshift({
          accountId: dto.sourceClearingAccountId,
          debit: totalSource,
          credit: 0n,
          transactionDebit: totalTransactionAmount,
          transactionCredit: 0n,
          currency: dto.currency.toUpperCase(),
          fxRate: sourceClearingRate,
          description: dto.description,
        });

        destinationLines.push({
          accountId: dto.destinationClearingAccountId,
          debit: 0n,
          credit: totalDestination,
          transactionDebit: 0n,
          transactionCredit: totalTransactionAmount,
          currency: dto.currency.toUpperCase(),
          fxRate: destinationClearingRate,
          description: dto.description,
        });

        this.assertBalanced(sourceLines);
        this.assertBalanced(destinationLines);

        const sourceEntry = await this.createJournalEntryRecord(db, {
          legalEntityId: sourceEntity.id,
          periodId: sourcePeriod.id,
          date: new Date(dto.transactionDate),
          description: `${dto.description} (source)`,
          status: JournalEntryStatus.POSTED,
          entryNumber: this.createEntryNumber("ICT-SRC"),
          postedAt: new Date(),
          postedBy: postedBy ?? "system",
          lines: sourceLines,
        });

        const destinationEntry = await this.createJournalEntryRecord(db, {
          legalEntityId: destinationEntity.id,
          periodId: destinationPeriod.id,
          date: new Date(dto.transactionDate),
          description: `${dto.description} (destination)`,
          status: JournalEntryStatus.POSTED,
          entryNumber: this.createEntryNumber("ICT-DST"),
          postedAt: new Date(),
          postedBy: postedBy ?? "system",
          lines: destinationLines,
        });

        const transfer = await db.intercompanyTransfer.create({
          data: {
            tenantId: this.requireTenantId(),
            transferNumber: this.createEntryNumber("ICT"),
            description: dto.description,
            transactionDate: new Date(dto.transactionDate),
            currency: dto.currency.toUpperCase(),
            sourceLegalEntityId: sourceEntity.id,
            destinationLegalEntityId: destinationEntity.id,
            sourceEntryId: sourceEntry.id,
            destinationEntryId: destinationEntry.id,
            totalAmount: totalTransactionAmount,
          },
          include: {
            sourceLegalEntity: true,
            destinationLegalEntity: true,
            sourceEntry: {
              include: { lines: true },
            },
            destinationEntry: {
              include: { lines: true },
            },
          },
        });

        return transfer;
      }),
    );
  }

  private async getStatementRows(
    query: ReportQueryDto,
  ): Promise<RawStatementRow[]> {
    await this.ensureLegalEntityExists(query.legalEntityId);

    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    if (startDate > endDate) {
      throw new BadRequestException("Report startDate must be before endDate.");
    }

    const lines = await this.prisma.tenant.journalLine.findMany({
      where: {
        journalEntry: {
          legalEntityId: query.legalEntityId,
          date: {
            gte: startDate,
            lte: endDate,
          },
          status: {
            in: [JournalEntryStatus.POSTED, JournalEntryStatus.REVERSED],
          },
        },
      },
      include: {
        account: true,
      },
    });

    const rowMap = new Map<string, RawStatementRow>();

    for (const line of lines) {
      const existing = rowMap.get(line.accountId) ?? {
        accountId: line.accountId,
        accountCode: line.account.code,
        accountName: line.account.name,
        accountType: line.account.type,
        debitMinor: 0n,
        creditMinor: 0n,
      };

      existing.debitMinor += line.debit;
      existing.creditMinor += line.credit;
      rowMap.set(line.accountId, existing);
    }

    return [...rowMap.values()].sort((left, right) =>
      left.accountCode.localeCompare(right.accountCode),
    );
  }

  private buildStatementCategory(
    rows: RawStatementRow[],
    allowedTypes: AccountType[],
  ) {
    const lines = rows
      .filter((row) => allowedTypes.includes(row.accountType))
      .map((row) => ({
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        amountMinor: this.accountBalanceForStatement(
          row.accountType,
          row.debitMinor,
          row.creditMinor,
        ),
      }))
      .filter((row) => row.amountMinor !== 0n);

    return {
      lines: lines.map((line) => ({
        ...line,
        amountMinor: line.amountMinor.toString(),
      })),
      total: lines.reduce((sum, line) => sum + line.amountMinor, 0n),
    };
  }

  private accountBalanceForStatement(
    type: AccountType,
    debit: bigint,
    credit: bigint,
  ) {
    if (type === AccountType.ASSET || type === AccountType.EXPENSE) {
      return debit - credit;
    }

    return credit - debit;
  }

  private async prepareJournalLines(
    db: TenantDb,
    legalEntity: { id: string; baseCurrency: string },
    effectiveDate: Date,
    lines: CreateJournalLineDto[],
  ) {
    const accounts = await this.getAccountMap(
      db,
      lines.map((line) => line.accountId),
    );
    this.ensureAccountsBelongToEntity(
      accounts,
      legalEntity.id,
      "All journal lines must reference accounts from the same legal entity.",
    );

    return Promise.all(
      lines.map(async (line) => {
        const transactionDebit = BigInt(line.debitAmountMinor ?? 0);
        const transactionCredit = BigInt(line.creditAmountMinor ?? 0);

        if (
          (transactionDebit === 0n && transactionCredit === 0n) ||
          (transactionDebit > 0n && transactionCredit > 0n)
        ) {
          throw new BadRequestException(
            "Each journal line must have either a debit or a credit amount, but not both.",
          );
        }

        const preparedAmount = await this.prepareJournalLineAmount(
          legalEntity.baseCurrency,
          (line.currency ?? legalEntity.baseCurrency).toUpperCase(),
          effectiveDate,
          transactionDebit > 0n ? transactionDebit : transactionCredit,
        );

        return {
          accountId: line.accountId,
          debit: transactionDebit > 0n ? preparedAmount.baseAmount : 0n,
          credit: transactionCredit > 0n ? preparedAmount.baseAmount : 0n,
          transactionDebit,
          transactionCredit,
          currency: preparedAmount.currency,
          fxRate: preparedAmount.fxRate,
          description: line.description?.trim() ?? null,
        } satisfies PreparedJournalLine;
      }),
    );
  }

  private async prepareJournalLinesForTenant(
    db: TenantDb,
    tenantId: string,
    legalEntity: { id: string; baseCurrency: string },
    effectiveDate: Date,
    lines: CreateJournalLineDto[],
  ) {
    const accounts = await this.getAccountMap(
      db,
      lines.map((line) => line.accountId),
      tenantId,
    );
    this.ensureAccountsBelongToEntity(
      accounts,
      legalEntity.id,
      "All journal lines must reference accounts from the same legal entity.",
    );

    return Promise.all(
      lines.map(async (line) => {
        const transactionDebit = BigInt(line.debitAmountMinor ?? 0);
        const transactionCredit = BigInt(line.creditAmountMinor ?? 0);

        if (
          (transactionDebit === 0n && transactionCredit === 0n) ||
          (transactionDebit > 0n && transactionCredit > 0n)
        ) {
          throw new BadRequestException(
            "Each journal line must have either a debit or a credit amount, but not both.",
          );
        }

        const preparedAmount = await this.prepareJournalLineAmount(
          legalEntity.baseCurrency,
          (line.currency ?? legalEntity.baseCurrency).toUpperCase(),
          effectiveDate,
          transactionDebit > 0n ? transactionDebit : transactionCredit,
          tenantId,
        );

        return {
          accountId: line.accountId,
          debit: transactionDebit > 0n ? preparedAmount.baseAmount : 0n,
          credit: transactionCredit > 0n ? preparedAmount.baseAmount : 0n,
          transactionDebit,
          transactionCredit,
          currency: preparedAmount.currency,
          fxRate: preparedAmount.fxRate,
          description: line.description?.trim() ?? null,
        } satisfies PreparedJournalLine;
      }),
    );
  }

  private async prepareJournalLineAmount(
    entityBaseCurrency: string,
    lineCurrency: string,
    effectiveDate: Date,
    transactionAmount: bigint,
    tenantId = this.requireTenantId(),
  ) {
    const normalizedCurrency = lineCurrency.toUpperCase();
    const fxRate =
      normalizedCurrency === entityBaseCurrency
        ? new Prisma.Decimal(1)
        : await this.fxRatesService.getRate({
            tenantId,
            baseCurrency: normalizedCurrency,
            targetCurrency: entityBaseCurrency.toUpperCase(),
            effectiveDate,
          });

    return {
      currency: normalizedCurrency,
      fxRate,
      baseAmount: this.convertMinorAmount(transactionAmount, fxRate),
    };
  }

  private assertBalanced(lines: PreparedJournalLine[]) {
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0n);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0n);

    if (totalDebit !== totalCredit) {
      throw new UnbalancedEntryException();
    }
  }

  private ensureEntryEditable(status: JournalEntryStatus) {
    if (
      status === JournalEntryStatus.POSTED ||
      status === JournalEntryStatus.REVERSED
    ) {
      throw new PostedEntryImmutableException();
    }
  }

  private ensurePeriodOpen(period: { isClosed: boolean }) {
    if (period.isClosed) {
      throw new PeriodClosedException();
    }
  }

  private async createJournalEntryRecord(
    db: TenantDb,
    params: {
      tenantId?: string;
      legalEntityId: string;
      periodId: string;
      date: Date;
      description: string;
      status: JournalEntryStatus;
      entryNumber: string;
      lines: PreparedJournalLine[];
      postedAt?: Date;
      postedBy?: string;
      originalEntryId?: string;
    },
  ) {
    return db.journalEntry.create({
      data: {
        tenantId: params.tenantId ?? this.requireTenantId(),
        legalEntityId: params.legalEntityId,
        periodId: params.periodId,
        date: params.date,
        description: params.description,
        status: params.status,
        entryNumber: params.entryNumber,
        postedAt: params.postedAt,
        postedBy: params.postedBy,
        originalEntryId: params.originalEntryId,
        lines: {
          create: params.lines.map((line) => ({
            tenantId: params.tenantId ?? this.requireTenantId(),
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            transactionDebit: line.transactionDebit,
            transactionCredit: line.transactionCredit,
            currency: line.currency,
            fxRate: line.fxRate,
            description: line.description,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
        legalEntity: true,
        period: true,
        originalEntry: true,
        reversalEntry: true,
      },
    });
  }

  private async withTenantTransaction<T>(
    callback: (db: TenantDb) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      return callback(tx);
    });
  }

  private requireTenantId() {
    const tenantId = this.cls.get("tenantId");

    if (!tenantId || tenantId === "*") {
      throw new ForbiddenException(
        "Finance endpoints require a tenant-scoped request context.",
      );
    }
    return tenantId;
  }

  private async ensureLegalEntityExists(legalEntityId: string) {
    const legalEntity = await this.prisma.tenant.legalEntity.findFirst({
      where: {
        id: legalEntityId,
        deletedAt: null,
      },
    });
    if (!legalEntity) {
      throw new NotFoundException("Legal entity not found.");
    }
    return legalEntity;
  }

  private async getLegalEntityOrThrow(
    db: TenantDb,
    legalEntityId: string,
    tenantId = this.requireTenantId(),
  ) {
    const legalEntity = await db.legalEntity.findFirst({
      where: {
        id: legalEntityId,
        tenantId,
        deletedAt: null,
      },
    });
    if (!legalEntity) {
      throw new NotFoundException("Legal entity not found.");
    }
    return legalEntity;
  }

  private async getPeriodOrThrow(
    db: TenantDb,
    periodId: string,
    tenantId = this.requireTenantId(),
  ) {
    const period = await db.fiscalPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        deletedAt: null,
      },
    });
    if (!period) {
      throw new NotFoundException("Fiscal period not found.");
    }
    return period;
  }

  private async getAccountMap(
    db: TenantDb,
    accountIds: string[],
    tenantId = this.requireTenantId(),
  ) {
    const ids = [...new Set(accountIds)];
    const accounts = await db.account.findMany({
      where: {
        tenantId,
        deletedAt: null,
        id: {
          in: ids,
        },
      },
    });

    if (accounts.length !== ids.length) {
      throw new NotFoundException("One or more accounts could not be found.");
    }

    return new Map(accounts.map((account) => [account.id, account]));
  }

  private ensureAccountsBelongToEntity(
    accounts: Map<string, { legalEntityId: string }>,
    legalEntityId: string,
    message: string,
  ) {
    for (const account of accounts.values()) {
      if (account.legalEntityId !== legalEntityId) {
        throw new BadRequestException(message);
      }
    }
  }

  private convertMinorAmount(amount: bigint, fxRate: Prisma.Decimal) {
    if (amount === 0n) {
      return 0n;
    }

    const converted = new Prisma.Decimal(amount.toString())
      .mul(fxRate)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

    return BigInt(converted.toFixed(0));
  }

  private createEntryNumber(prefix: string) {
    return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
  }
}
