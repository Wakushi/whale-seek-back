interface ContractDetails {
  decimal_place: number;
  contract_address: string;
}

export interface CoinGeckoTokenMetadata {
  id: string;
  symbol: string;
  name: string;
  contract_addresses: Record<string, ContractDetails> | null;
  market_cap_rank: number | null;
  genesis_date: Date | string | null;
  categories: string[];
  links: {
    website: string[];
    twitter: string | null;
    telegram: string | null;
    github: string[];
  };
  platforms: Record<string, string> | null;
  last_updated: Date | string;
  created_at: Date | string;
}
