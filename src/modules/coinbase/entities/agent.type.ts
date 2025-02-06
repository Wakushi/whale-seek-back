export enum Agent {
  GENERAL = 'GENERAL',
  TRANSACTION_ANALYST = 'TRANSACTION_ANALYST',
  TRADING = 'TRADING',
}

export type TransactionAnalystResult = { analysis: string; score: number };
