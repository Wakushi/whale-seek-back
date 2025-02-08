import {
	Controller,
	Get,
	Param,
	Query,
	BadRequestException,
	InternalServerErrorException,
  } from '@nestjs/common';
  import { Network } from 'alchemy-sdk';
  import { Address } from 'viem';
  import { AlchemyService } from './alchemy.service';
  
  @Controller('alchemy')
  export class AlchemyController {
	constructor(private readonly alchemyService: AlchemyService) {}
  
	@Get('balances/:address')
	async getTokenBalances(
	  @Param('address') address: string,
	  @Query('chain') chain?: string
	) {
	  if (!address) {
		throw new BadRequestException('Missing wallet address');
	  }
  
	  try {
		return await this.alchemyService.getTokenBalances(
		  address as Address,
		  (chain as Network) || Network.BASE_MAINNET
		);
	  } catch (error) {
		console.error('Error in getTokenBalances:', error);
  
		if (error instanceof BadRequestException) {
		  throw error;
		}
  
		throw new InternalServerErrorException(
		  'An unexpected error occurred while processing your request'
		);
	  }
	}
  }