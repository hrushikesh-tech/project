export type LedgerAccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE';

export class UnbalancedEntryException extends Error {
  constructor(message = 'Journal entry must be balanced before it can be created or posted.') {
    super(message);
    this.name = 'UnbalancedEntryException';
  }
}

export class PeriodClosedException extends Error {
  constructor(message = 'Cannot post a journal entry into a closed fiscal period.') {
    super(message);
    this.name = 'PeriodClosedException';
  }
}

export class PostedEntryImmutableException extends Error {
  constructor(message = 'Posted journal entries are immutable. Reverse them instead of editing them.') {
    super(message);
    this.name = 'PostedEntryImmutableException';
  }
}

export class MissingFxRateException extends Error {
  constructor(message = 'FX rate not available for the requested currency pair and date.') {
    super(message);
    this.name = 'MissingFxRateException';
  }
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: LedgerAccountType;
  debitMinor: bigint;
  creditMinor: bigint;
  netMinor: bigint;
}

export interface TrialBalanceReport {
  legalEntityId: string;
  periodStart: string;
  periodEnd: string;
  rows: TrialBalanceRow[];
  totalDebitMinor: bigint;
  totalCreditMinor: bigint;
}

export interface StatementLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  amountMinor: bigint;
}

export interface BalanceSheetReport {
  legalEntityId: string;
  periodStart: string;
  periodEnd: string;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  totalAssetsMinor: bigint;
  totalLiabilitiesMinor: bigint;
  totalEquityMinor: bigint;
}

export interface IncomeStatementReport {
  legalEntityId: string;
  periodStart: string;
  periodEnd: string;
  revenues: StatementLine[];
  expenses: StatementLine[];
  totalRevenueMinor: bigint;
  totalExpenseMinor: bigint;
  netIncomeMinor: bigint;
}
