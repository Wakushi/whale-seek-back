import { Injectable } from '@nestjs/common';
import { Address } from 'viem';
import { CoinbaseService } from '../coinbase/coinbase.service';

@Injectable()
export class AgentService {
  constructor(private readonly coinbaseService: CoinbaseService) {}
  public async askAgent(query: string, user: Address): Promise<string> {
    try {
      return await this.coinbaseService.askAgent(query, user);
    } catch (error) {
      return 'Something wrong happened, please try again.';
    }
  }
}
