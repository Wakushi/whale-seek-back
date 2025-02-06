import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Whale } from './entities/whale.entity';
import { Collection } from '../supabase/entities/collections';

@Injectable()
export class WhalesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(): Promise<Whale[]> {
    return this.supabaseService.getAll<Whale>(Collection.WHALE_INFO);
  }
}