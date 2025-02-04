export function getDateFromBlock(blockHex: string): number {
  const referenceBlock = 24500000;
  const referenceTimestamp = new Date('2024-01-01T00:00:00Z').getTime() / 1000;

  const blockNum = parseInt(blockHex, 16);
  const blockDiff = blockNum - referenceBlock;
  const timeDiff = blockDiff * 2; 
  const timestamp = referenceTimestamp + timeDiff;

  return timestamp;
}
