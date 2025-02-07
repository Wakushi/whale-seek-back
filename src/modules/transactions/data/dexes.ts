import { DEXProtocol } from "../entities/transaction.entity"

export const DEX_PROTOCOLS: DEXProtocol[] = [
  {
    name: 'Uniswap V3',
    routers: [
      '0x2626664c2603336E57B271c5C0b26F421741e481', // SwapRouter02
      '0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC', // Universal Router
    ],
  },
  {
    name: 'Uniswap V4',
    routers: [
      '0x6ff5693b99212da76ad316178a184ab56d299b43', // Universal Router
    ],
  },
  {
    name: 'BaseSwap',
    routers: [
      '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86', // Router
    ],
  },
  {
    name: 'Aerodrome',
    routers: [
      '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', // Router
    ],
  },
  {
    name: 'SushiSwap',
    routers: [
      '0x8c47ED459d3688Ca14d67CE84E053600fcB9EC31', // V3 Router
    ],
  },
  {
    name: 'Alienbase',
    routers: [
      '0x94cC0AaC535CCDB3C01d6787D6413C27ae39Bf77', // Router
    ],
  },
  {
    name: 'Pancakeswap',
    routers: [
      '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86', // SmartRouter
    ],
  },
  {
    name: 'Maverick',
    routers: [
      '0x32AED3Bce901DA12ca8489788F3A99fCE1056e14', // Router
    ],
  },
];
