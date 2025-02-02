import { Inject, Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class ContractService {
  private _provider: ethers.JsonRpcProvider;

  constructor(
    @Inject('CONTRACT_CONFIG')
    private readonly config: { rpcUrl: string; privateKey: string },
  ) {
    this._provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  public get provider() {
    return this._provider;
  }
}
