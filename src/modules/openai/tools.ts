import { Alchemy } from 'alchemy-sdk';

export class WalletTools {
  constructor(private readonly alchemy: Alchemy) {}

  getTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'getWalletBalance',
          description: 'Obtient le solde ETH d\'une adresse Ethereum',
          function: this.getWalletBalance.bind(this),
          parameters: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                description: 'L\'adresse Ethereum à vérifier'
              }
            },
            required: ['address']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getTokenBalances',
          description: 'Obtient les soldes des tokens ERC20 d\'une adresse Ethereum',
          function: this.getTokenBalances.bind(this),
          parameters: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                description: 'L\'adresse Ethereum à vérifier'
              }
            },
            required: ['address']
          }
        }
      }
    ];
  }

  private async getWalletBalance(args: { address: string }): Promise<string> {
    try {
      const { address } = args;
      if (!this.isValidEthereumAddress(address)) {
        throw new Error('Adresse Ethereum invalide');
      }

      const balanceWei = await this.alchemy.core.getBalance(address);
      const balanceEth = Number(balanceWei) / Math.pow(10, 18);
      
      return `Le solde ETH de l'adresse ${address} est de ${balanceEth.toFixed(4)} ETH`;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération du solde ETH: ${error.message}`);
    }
  }

  private async getTokenBalances(args: { address: string }): Promise<string> {
    try {
      const { address } = args;
      if (!this.isValidEthereumAddress(address)) {
        throw new Error('Adresse Ethereum invalide');
      }

      const balances = await this.alchemy.core.getTokenBalances(address);
      
      const nonZeroBalances = balances.tokenBalances.filter(
        token => token.tokenBalance !== '0'
      );

      if (nonZeroBalances.length === 0) {
        return `Aucun token ERC20 trouvé pour l'adresse ${address}`;
      }

      const tokenDetails = await Promise.all(
        nonZeroBalances.map(async (token) => {
          const metadata = await this.alchemy.core.getTokenMetadata(token.contractAddress);
          const balance = Number(token.tokenBalance) / Math.pow(10, metadata.decimals);
          return `${balance.toFixed(4)} ${metadata.symbol}`;
        })
      );

      return `Tokens trouvés pour ${address}:\n${tokenDetails.join('\n')}`;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des tokens: ${error.message}`);
    }
  }

  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}