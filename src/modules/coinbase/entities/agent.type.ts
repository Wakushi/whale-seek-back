export enum Agent {
  GENERAL = 'GENERAL',
  TRANSACTION_ANALYST = 'TRANSACTION_ANALYST',
}

export type TransactionAnalystResult = { analysis: string; score: number };
