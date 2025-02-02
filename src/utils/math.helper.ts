/**
 * Converts a hexadecimal balance to a readable decimal value.
 * @param hexBalance - The balance in hexadecimal.
 * @param decimals - The number of decimals for the token.
 * @returns The balance in token units.
 */
export function hexToDecimal(hexBalance: string, decimals: number): number {
  const decimalBalance = BigInt(hexBalance);
  return Number(decimalBalance) / Math.pow(10, decimals);
}
