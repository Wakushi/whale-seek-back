import { Inject, Injectable } from '@nestjs/common';
import { JsonRpcProvider } from 'ethers';

@Injectable()
export class ContractService {
  private _provider: JsonRpcProvider;

  constructor(
    @Inject('CONTRACT_CONFIG')
    private readonly config: { rpcUrl: string; privateKey: string },
  ) {
    this._provider = new JsonRpcProvider(config.rpcUrl);
  }

  public get provider() {
    return this._provider;
  }
}
