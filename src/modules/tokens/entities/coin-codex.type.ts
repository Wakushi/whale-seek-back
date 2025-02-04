export interface CoinCodexCsvDailyMetrics {
  Start: string;
  End: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  'Market Cap': number;
}

// From https://coincodex.com/apps/coincodex/cache/all_coins.json
export interface CoinCodexBaseTokenData {
  symbol: string;
  display_symbol: string;
  name: string;
  aliases: string;
  shortname: string;
  last_price_usd: number;
  market_cap_rank: number;
  volume_rank: number;
  price_change_1H_percent: number;
  price_change_1D_percent: number;
  price_change_7D_percent: number;
  price_change_30D_percent: number;
  price_change_90D_percent: number;
  price_change_180D_percent: number;
  price_change_365D_percent: number;
  price_change_3Y_percent: number;
  price_change_5Y_percent: number;
  price_change_ALL_percent: number;
  price_change_YTD_percent: number;
  volume_24_usd: number;
  display: string;
  trading_since: string;
  supply: number;
  last_update: string;
  ico_end: string;
  include_supply: string;
  use_volume: string;
  growth_all_time: string;
  ccu_slug: string;
  image_id: string;
  image_t: number;
  market_cap_usd: number;
  categories: number[];
}

export type SupplyMetrics = {
  name: string;
  fully_diluted_valuation: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number | null;
  supply_ratio: number;
};

export interface TokenInitialData {
  date: string;
  price_usd: string;
  price_btc: string;
  price_eth: string;
}

export interface TokenATHData {
  ath_usd: number;
  ath_usd_date: string;
  ath_btc: number;
  ath_btc_date: string;
  ath_eth: number;
  ath_eth_date: string;
}

export interface TokenATLData {
  atl_usd: number;
  atl_usd_date: string;
  atl_btc: number;
  atl_btc_date: string;
  atl_eth: number;
  atl_eth_date: string;
}

export interface TokenSocialLink {
  name: string;
  value: string;
  label: string;
  coincodex_socials_id: number;
}

export interface TokenSocials {
  Explorer: string;
  Twitter?: string;
  GitHub?: string;
  Reddit?: string;
  Telegram?: string;
  YouTube?: string;
  Blog?: string;
  Explorer1?: string;
  Discord?: string;
  Email?: string;
  Email1?: string;
  Email2?: string;
  Explorer2?: string;
  Explorer3?: string;
  Explorer4?: string;
  [key: string]: string | undefined;
}

export interface CoinCodexTokenData {
  symbol: string;
  coin_name: string;
  shortname: string;
  slug: string;
  display_symbol: string;
  display: string;
  release_date: string;
  ico_price: number;
  today_open: number;
  market_cap_rank: number;
  volume_rank: number;
  description: string;
  price_high_24_usd: number;
  price_low_24_usd: number;
  start: string;
  end: string;
  is_promoted: null | boolean;
  message: string;
  website: string;
  whitepaper: string;
  total_supply: string;
  supply: number;
  platform: string;
  how_to_buy_url: string | null;
  last_price_usd: number;
  price_change_1H_percent: number;
  price_change_1D_percent: number;
  price_change_7D_percent: number;
  price_change_30D_percent: number;
  price_change_90D_percent: number;
  price_change_180D_percent: number;
  price_change_365D_percent: number;
  price_change_3Y_percent: number;
  price_change_5Y_percent: number;
  price_change_ALL_percent: number;
  price_change_YTD_percent: number;
  volume_24_usd: number;
  trading_since: string;
  stages_start: string;
  stages_end: string;
  include_supply: string;
  use_volume: string;
  ath_usd: number;
  ath_date: string;
  not_trading_since: string;
  last_update: string;
  cycle_low_usd: number;
  cycle_high_usd: number;
  cycle_low_date: string;
  cycle_high_date: string;
  image_id: string;
  image_t: string;
  total_total_supply: string;
  initial_data: TokenInitialData;
  ath_data: TokenATHData;
  atl_data: TokenATLData;
  social: TokenSocials;
  socials: TokenSocialLink[];
}

export interface CoinCodexCsvDailyMetrics {
  Start: string;
  End: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  'Market Cap': number;
}

// From https://coincodex.com/apps/coincodex/cache/all_coins.json
export interface CoinCodexBaseTokenData {
  symbol: string;
  display_symbol: string;
  name: string;
  aliases: string;
  shortname: string;
  last_price_usd: number;
  market_cap_rank: number;
  volume_rank: number;
  price_change_1H_percent: number;
  price_change_1D_percent: number;
  price_change_7D_percent: number;
  price_change_30D_percent: number;
  price_change_90D_percent: number;
  price_change_180D_percent: number;
  price_change_365D_percent: number;
  price_change_3Y_percent: number;
  price_change_5Y_percent: number;
  price_change_ALL_percent: number;
  price_change_YTD_percent: number;
  volume_24_usd: number;
  display: string;
  trading_since: string;
  supply: number;
  last_update: string;
  ico_end: string;
  include_supply: string;
  use_volume: string;
  growth_all_time: string;
  ccu_slug: string;
  image_id: string;
  image_t: number;
  market_cap_usd: number;
  categories: number[];
}
