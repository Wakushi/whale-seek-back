import { Injectable, Logger } from '@nestjs/common';
import * as Papa from 'papaparse';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class CsvService {
  private readonly logger = new Logger(CsvService.name);

  /**
   * Gets historical token data from a local CSV file
   * @param fileName Name of the CSV file in the data directory
   * @returns Processed historical data
   */
  public async getHistoricalTokenData(fileName: string): Promise<any[]> {
    const filePath = path.join(process.cwd(), fileName);

    const requiredColumns = [
      'Start',
      'End',
      'Open',
      'High',
      'Low',
      'Close',
      'Volume',
      'Market Cap',
    ];

    const data = await this.extractLocalCsv(filePath);

    if (!this.validateCsvStructure(data, requiredColumns)) {
      throw new Error('Invalid CSV structure for historical token data');
    }

    return data;
  }

  /**
   * Reads and processes a local CSV file
   * @param filePath Path to the CSV file (relative to project root or absolute)
   * @returns Promise with the parsed CSV data
   */
  private async extractLocalCsv(filePath: string): Promise<any[]> {
    try {
      const csvData = await fs.readFile(filePath, 'utf-8');

      const parsedData = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(csvData, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              this.logger.warn(
                'CSV parsing encountered errors:',
                results.errors,
              );
            }
            resolve(results.data);
          },
          error: (error) => {
            reject(error);
          },
        });
      });

      return parsedData;
    } catch (error) {
      this.logger.error(`Failed to extract CSV data: ${error.message}`);
      throw new Error(`CSV extraction failed: ${error.message}`);
    }
  }

  /**
   * Validates the CSV data structure matches expected format
   * @param data Parsed CSV data
   * @param requiredColumns Array of required column names
   * @returns boolean indicating if data is valid
   */
  private validateCsvStructure(
    data: any[],
    requiredColumns: string[],
  ): boolean {
    if (!data || data.length === 0) {
      this.logger.error('CSV data is empty');
      return false;
    }

    const firstRow = data[0];
    const missingColumns = requiredColumns.filter(
      (column) => !(column in firstRow),
    );

    if (missingColumns.length > 0) {
      this.logger.error(
        `CSV is missing required columns: ${missingColumns.join(', ')}`,
      );
      return false;
    }

    return true;
  }
}
