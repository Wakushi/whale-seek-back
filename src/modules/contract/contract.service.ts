import { Inject, Injectable } from '@nestjs/common';
import { Contract, JsonRpcProvider } from 'ethers';
import {
  FACTORY_ABI,
  BASE_SEPOLIA_FACTORY_ADDRESS,
} from 'src/utils/constants/contract';
import { Address } from 'viem';

@Injectable()
export class ContractService {
  private _provider: JsonRpcProvider;
  private _factoryContract: Contract;

  constructor(
    @Inject('CONTRACT_CONFIG')
    private readonly config: { rpcUrl: string; privateKey: string },
  ) {
    this._provider = new JsonRpcProvider(config.rpcUrl);
    this._factoryContract = new Contract(
      BASE_SEPOLIA_FACTORY_ADDRESS,
      FACTORY_ABI,
      this._provider,
    );
  }

  public get provider() {
    return this._provider;
  }

  public async fetchAllTradingWallets(): Promise<Address[]> {
    try {
      const wallets = await this._factoryContract.getAllWallets();
      return Array.from(wallets).map((address: Address) => address);
    } catch (error) {
      console.error(`Failed to fetch trading wallets: ${error.message}`);
      return [];
    }
  }

  public async isContractAddress(address: string): Promise<boolean> {
    const bytecode = await this.provider.getCode(address);
    return bytecode !== '0x';
  }
}
