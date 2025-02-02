import { Injectable } from '@nestjs/common';
import { TokensService } from '../tokens/tokens.services';
import { AlchemyService } from '../alchemy/alchemy.service';
import { Address } from 'viem';
import { BlockExplorerService } from '../block-explorer/block-explorer.service';
import { ContractService } from '../contract/contract.service';
import { Transaction } from '../block-explorer/entities/transaction.type';
import { isDexContract } from 'src/utils/source-code.helper';
import { Wallet } from '../tokens/entities/token.type';

@Injectable()
export class AnalysisService {
  constructor(
    private readonly alchemyService: AlchemyService,
    private readonly tokenService: TokensService,
    private readonly blockExplorerService: BlockExplorerService,
    private readonly contractService: ContractService,
  ) {}

  // We create some pre-worked data to then pass to the agent because here we
  // want to have a uniformed data set to begin with (The agent would maybe skip one step
  // between two wallet and therefore our results will be biased)
  // The goal is to gather as much data as possible for each wallet to see if it's worth tracking
  // Should return an analysis with a score
  public async analyseWallet(wallet: Address): Promise<void> {
    try {
      const walletHoldings: Wallet =
        await this.alchemyService.getTokenBalances(wallet);

      const transactions = await this.analyseTransactions(wallet);
    } catch (error) {
      console.error('Error analysing wallet: ', error);
    }
  }

  public async analyseTransactions(wallet: Address): Promise<Transaction[]> {
    const transactions =
      await this.blockExplorerService.fetchBaseTransactionByWallet({
        walletAddress: wallet,
        startDate: new Date('2025-01-01'),
        endDate: new Date(),
      });

    const transactionsByContract: Map<string, Transaction[]> = new Map();

    transactions.forEach((transaction) => {
      const interactedAddress =
        transaction.from === wallet ? transaction.to : transaction.from;

      if (!this.isContract(interactedAddress)) return;

      if (!transactionsByContract.has(interactedAddress)) {
        transactionsByContract.set(interactedAddress, [transaction]);
        return;
      }

      transactionsByContract.set(interactedAddress, [
        ...transactionsByContract.get(interactedAddress),
        transaction,
      ]);
    });

    for (const [contract, _] of transactionsByContract.entries()) {
      const sourceCode = await this.blockExplorerService.fetchSourceCode(
        contract as Address,
      );

      if (!sourceCode) continue;

      const dexAnalysis = isDexContract(sourceCode);

      console.log(`DEX analysis for ${contract}: `, dexAnalysis);
    }

    return transactions;
  }

  async isContract(address: string) {
    const code = await this.contractService.provider.getCode(address);
    return code !== '0x';
  }
}
