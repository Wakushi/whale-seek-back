import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { MOCK_TRANSACTION } from './MOCK_TRANSACTION';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll() {
    return this.transactionsService.findAll();
  }

  @Post()
  @HttpCode(200)
  async testTrade() {
    return this.transactionsService.copyTransaction(MOCK_TRANSACTION);
  }
}
