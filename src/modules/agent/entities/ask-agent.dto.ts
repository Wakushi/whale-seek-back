import { Address } from 'viem';
import { IsString, IsEthereumAddress, IsNotEmpty } from 'class-validator';

export class AskAgentDto {
  @IsString()
  @IsNotEmpty({ message: 'Query is required' })
  query: string;

  @IsEthereumAddress({ message: 'Invalid Ethereum address' })
  @IsNotEmpty({ message: 'User address is required' })
  account: Address;
}
