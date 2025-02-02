interface DexAnalysisResult {
  isDex: boolean;
  confidence: number;
  detectedPatterns: string[];
  possibleProtocol?: string;
}

export function isDexContract(sourceCode: string): DexAnalysisResult {
  const sourceCodeLower = sourceCode.toLowerCase();
  const patterns = {
    functionPatterns: [
      'swap',
      'addliquidity',
      'removeliquidity',
      'getamountsout',
      'getamountsin',
      'createpair',
      '_swap',
      'exacttokensin',
      'exacttokensout',
      'exactethin',
      'exactethout',
    ],

    statePatterns: [
      'liquiditypool',
      'pair',
      'factory',
      'router',
      'amm',
      'k=',
      'constant product',
      'invariant',
    ],

    protocolPatterns: {
      uniswap: ['uniswap', 'univ2', 'uniswapv2', 'uniswapv3'],
      pancakeswap: ['pancake', 'pancakeswap', 'cakeswap'],
      sushiswap: ['sushi', 'sushiswap'],
      curve: ['curve', 'curvefi', 'stableswap'],
    },
  };

  let detectedPatterns: string[] = [];
  let functionMatches = 0;
  let stateMatches = 0;

  patterns.functionPatterns.forEach((pattern) => {
    if (sourceCodeLower.includes(pattern)) {
      functionMatches++;
      detectedPatterns.push(`Function: ${pattern}`);
    }
  });

  patterns.statePatterns.forEach((pattern) => {
    if (sourceCodeLower.includes(pattern)) {
      stateMatches++;
      detectedPatterns.push(`State: ${pattern}`);
    }
  });

  const totalPossibleMatches =
    patterns.functionPatterns.length + patterns.statePatterns.length;
  const matches = functionMatches + stateMatches;
  let confidence = (matches / totalPossibleMatches) * 100;

  let possibleProtocol: string | undefined;
  let maxProtocolMatches = 0;

  Object.entries(patterns.protocolPatterns).forEach(
    ([protocol, protocolPatterns]) => {
      const protocolMatches = protocolPatterns.filter((pattern) =>
        sourceCodeLower.includes(pattern),
      ).length;

      if (protocolMatches > maxProtocolMatches) {
        maxProtocolMatches = protocolMatches;
        possibleProtocol = protocol;
        confidence += 20;
      }
    },
  );

  confidence = Math.min(Math.max(confidence, 0), 100);

  const isDex =
    confidence > 40 && (functionMatches >= 2 || maxProtocolMatches > 0);

  return {
    isDex,
    confidence: Math.round(confidence),
    detectedPatterns,
    possibleProtocol,
  };
}
