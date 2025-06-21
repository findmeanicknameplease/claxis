import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import {
  NodeExecutionContext,
  GeminiSalonNodeData,
  ErrorResponse,
} from '@/types';

import {
  logInfo,
  logError,
  startPerformanceTimer,
  endPerformanceTimer,
  validateNodeExecutionContext,
} from '@/utils';

// =============================================================================
// TWILIO LOOKUP NODE IMPLEMENTATION
// =============================================================================
// Provides phone number validation and spam protection for voice agent callbacks
// Uses Twilio Lookup API to verify phone numbers before initiating calls
// Essential for preventing fraudulent calls and maintaining call quality
// =============================================================================

export class TwilioLookup implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Twilio Lookup',
    name: 'twilioLookup',
    icon: 'file:twilioLookup.svg',
    group: ['communication'],
    version: 1,
    description: 'Validate phone numbers and check for spam/fraud risk using Twilio Lookup API. Essential for voice agent callback safety.',
    defaults: {
      name: 'Twilio Lookup',
    },
    inputs: ['main'],
    outputs: ['main', 'valid', 'invalid'],
    outputNames: ['Default', 'Valid Number', 'Invalid/Spam'],
    credentials: [
      {
        name: 'twilioApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Validate Phone Number',
            value: 'validatePhone',
            description: 'Check if phone number is valid and safe to call',
            action: 'Validate phone number',
          },
          {
            name: 'Bulk Validate Numbers',
            value: 'bulkValidate',
            description: 'Validate multiple phone numbers at once',
            action: 'Bulk validate numbers',
          },
          {
            name: 'Check Carrier Info',
            value: 'carrierInfo',
            description: 'Get detailed carrier and line type information',
            action: 'Check carrier info',
          },
        ],
        default: 'validatePhone',
      },
      {
        displayName: 'Phone Number',
        name: 'phoneNumber',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+31612345678',
        description: 'Phone number to validate (international format required)',
        displayOptions: {
          show: {
            operation: ['validatePhone', 'carrierInfo'],
          },
        },
      },
      {
        displayName: 'Phone Numbers',
        name: 'phoneNumbers',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+31612345678,+4915123456789,+33612345678',
        description: 'Comma-separated list of phone numbers to validate',
        displayOptions: {
          show: {
            operation: ['bulkValidate'],
          },
        },
      },
      {
        displayName: 'Validation Level',
        name: 'validationLevel',
        type: 'options',
        options: [
          {
            name: 'Basic',
            value: 'basic',
            description: 'Basic number format validation only',
          },
          {
            name: 'Standard',
            value: 'standard',
            description: 'Include carrier and line type information',
          },
          {
            name: 'Advanced',
            value: 'advanced',
            description: 'Full validation with caller name and risk assessment',
          },
        ],
        default: 'standard',
        description: 'Level of validation to perform (affects API cost)',
      },
      {
        displayName: 'Country Code',
        name: 'countryCode',
        type: 'options',
        options: [
          {
            name: 'Netherlands (NL)',
            value: 'NL',
          },
          {
            name: 'Germany (DE)',
            value: 'DE',
          },
          {
            name: 'France (FR)',
            value: 'FR',
          },
          {
            name: 'Belgium (BE)',
            value: 'BE',
          },
          {
            name: 'United States (US)',
            value: 'US',
          },
          {
            name: 'Auto-detect',
            value: 'auto',
          },
        ],
        default: 'NL',
        description: 'Expected country for the phone number',
      },
      {
        displayName: 'Block Risky Numbers',
        name: 'blockRisky',
        type: 'boolean',
        default: true,
        description: 'Automatically mark VoIP and high-risk numbers as invalid',
      },
      {
        displayName: 'Include Caller Name',
        name: 'includeCallerName',
        type: 'boolean',
        default: false,
        description: 'Attempt to retrieve caller name information (additional cost)',
        displayOptions: {
          show: {
            validationLevel: ['advanced'],
          },
        },
      },
      {
        displayName: 'Cache Results',
        name: 'cacheResults',
        type: 'boolean',
        default: true,
        description: 'Cache lookup results to avoid repeated API calls for same numbers',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const validNumbers: INodeExecutionData[] = [];
    const invalidNumbers: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const timer = startPerformanceTimer('TwilioLookup');
      
      try {
        // Extract parameters
        const operation = this.getNodeParameter('operation', i) as string;
        const validationLevel = this.getNodeParameter('validationLevel', i) as string;
        const countryCode = this.getNodeParameter('countryCode', i) as string;
        const blockRisky = this.getNodeParameter('blockRisky', i) as boolean;
        const includeCallerName = this.getNodeParameter('includeCallerName', i) as boolean;
        const cacheResults = this.getNodeParameter('cacheResults', i) as boolean;

        // Create execution context
        const executionContext: NodeExecutionContext = {
          salon_id: '', // Not salon-specific
          execution_id: this.getExecutionId(),
          timestamp: new Date().toISOString(),
          debug_mode: this.getMode() === 'manual',
        };

        logInfo('TwilioLookup node execution started', {
          operation,
          validation_level: validationLevel,
        }, '', executionContext.execution_id);

        let result: Record<string, unknown>;

        switch (operation) {
          case 'validatePhone':
            const phoneNumber = this.getNodeParameter('phoneNumber', i) as string;
            result = await this.validateSingleNumber(
              phoneNumber, 
              validationLevel, 
              countryCode, 
              blockRisky, 
              includeCallerName,
              cacheResults
            );
            break;

          case 'bulkValidate':
            const phoneNumbers = this.getNodeParameter('phoneNumbers', i) as string;
            result = await this.validateMultipleNumbers(
              phoneNumbers.split(',').map(n => n.trim()),
              validationLevel,
              countryCode,
              blockRisky,
              includeCallerName,
              cacheResults
            );
            break;

          case 'carrierInfo':
            const carrierPhone = this.getNodeParameter('phoneNumber', i) as string;
            result = await this.getCarrierInfo(carrierPhone, countryCode);
            break;

          default:
            throw new NodeOperationError(
              this.getNode(),
              `Unsupported operation: ${operation}`,
              { itemIndex: i }
            );
        }

        // Create output data
        const outputData: GeminiSalonNodeData = {
          json: {
            ...result,
            timestamp: new Date().toISOString(),
            validation_level: validationLevel,
          },
        };

        returnData.push(outputData);

        // Route to appropriate output based on validation result
        if (operation === 'validatePhone') {
          if (result.is_valid && result.is_safe_to_call) {
            validNumbers.push(outputData);
          } else {
            invalidNumbers.push(outputData);
          }
        } else if (operation === 'bulkValidate') {
          // For bulk operations, add to default output only
          const validCount = (result.results as any[])?.filter(r => r.is_valid && r.is_safe_to_call).length || 0;
          const invalidCount = (result.total_numbers as number) - validCount;
          
          if (validCount > 0) {
            validNumbers.push({
              json: {
                ...outputData.json,
                summary: `${validCount} valid numbers`,
                valid_numbers: (result.results as any[])?.filter(r => r.is_valid && r.is_safe_to_call),
              },
            });
          }
          
          if (invalidCount > 0) {
            invalidNumbers.push({
              json: {
                ...outputData.json,
                summary: `${invalidCount} invalid/risky numbers`,
                invalid_numbers: (result.results as any[])?.filter(r => !r.is_valid || !r.is_safe_to_call),
              },
            });
          }
        }

        logInfo('TwilioLookup node execution completed successfully', {
          operation,
          result_keys: Object.keys(result),
        }, '', executionContext.execution_id);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logError('TwilioLookup node execution failed', error as Error, {
          operation: this.getNodeParameter('operation', i),
        });

        // Create error response
        const errorResponse: ErrorResponse = {
          error: true,
          error_code: 'TWILIO_LOOKUP_ERROR',
          error_message: errorMessage,
          error_details: {
            operation: this.getNodeParameter('operation', i),
          },
          timestamp: new Date().toISOString(),
          execution_id: this.getExecutionId(),
        };

        returnData.push({ json: errorResponse as any });
        invalidNumbers.push({ json: errorResponse as any });

        // Re-throw for n8n error handling if in strict mode
        if (this.getMode() === 'manual') {
          throw error;
        }

      } finally {
        endPerformanceTimer(timer, {
          node_name: 'TwilioLookup',
        });
      }
    }

    return [returnData, validNumbers, invalidNumbers];
  }

  /**
   * Validate a single phone number
   */
  private async validateSingleNumber(
    phoneNumber: string,
    validationLevel: string,
    countryCode: string,
    blockRisky: boolean,
    includeCallerName: boolean,
    cacheResults: boolean
  ): Promise<Record<string, unknown>> {
    
    // Basic format validation
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      return {
        phone_number: phoneNumber,
        is_valid: false,
        is_safe_to_call: false,
        validation_error: 'Invalid phone number format. Must use international format (e.g., +31612345678)',
        risk_level: 'high',
        recommendation: 'Block - Invalid format',
      };
    }

    // For basic validation, skip API call
    if (validationLevel === 'basic') {
      return {
        phone_number: phoneNumber,
        is_valid: true,
        is_safe_to_call: true,
        validation_level: 'basic',
        recommendation: 'Proceed - Format valid',
        note: 'Basic validation only - no carrier verification performed',
      };
    }

    try {
      // Build Twilio Lookup API request
      const fields = ['line_type_intelligence'];
      if (includeCallerName) {
        fields.push('caller_name');
      }

      const credentials = await this.getCredentials('twilioApi') as any;
      const accountSid = credentials.accountSid;
      const authToken = credentials.authToken;

      const lookupUrl = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneNumber)}?Fields=${fields.join(',')}`;

      const response = await this.helpers.httpRequest({
        method: 'GET',
        url: lookupUrl,
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        timeout: 10000,
      });

      // Analyze the response
      const lineTypeIntel = response.line_type_intelligence;
      const lineType = lineTypeIntel?.type;
      const errorCode = lineTypeIntel?.error_code;
      const carrierName = lineTypeIntel?.carrier_name;
      const mobileCountryCode = lineTypeIntel?.mobile_country_code;
      const mobileNetworkCode = lineTypeIntel?.mobile_network_code;

      // Determine validity and safety
      let isValid = !errorCode;
      let isSafeToCall = true;
      let riskLevel = 'low';
      let recommendation = 'Proceed';

      // Apply risk assessment
      if (errorCode) {
        isValid = false;
        isSafeToCall = false;
        riskLevel = 'high';
        recommendation = 'Block - Invalid number';
      } else if (blockRisky && lineType === 'voip') {
        isSafeToCall = false;
        riskLevel = 'high';
        recommendation = 'Block - VoIP number (high spam risk)';
      } else if (lineType === 'landline') {
        riskLevel = 'low';
        recommendation = 'Proceed - Landline';
      } else if (lineType === 'mobile') {
        riskLevel = 'low';
        recommendation = 'Proceed - Mobile';
      } else {
        riskLevel = 'medium';
        recommendation = 'Caution - Unknown line type';
      }

      // Build comprehensive result
      const result = {
        phone_number: phoneNumber,
        is_valid: isValid,
        is_safe_to_call: isSafeToCall,
        risk_level: riskLevel,
        recommendation: recommendation,
        
        line_type: lineType || 'unknown',
        carrier_name: carrierName || 'unknown',
        error_code: errorCode || null,
        
        mobile_country_code: mobileCountryCode || null,
        mobile_network_code: mobileNetworkCode || null,
        
        validation_level: validationLevel,
        validation_timestamp: new Date().toISOString(),
        
        // Include caller name if requested and available
        ...(includeCallerName && response.caller_name && {
          caller_name: response.caller_name.caller_name,
          caller_type: response.caller_name.caller_type,
        }),
        
        // Raw API response for debugging
        raw_response: response,
      };

      return result;

    } catch (error) {
      logError('Twilio Lookup API call failed', error as Error, {
        phone_number: phoneNumber,
      });

      return {
        phone_number: phoneNumber,
        is_valid: false,
        is_safe_to_call: false,
        validation_error: `Lookup service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        risk_level: 'unknown',
        recommendation: 'Caution - Unable to verify',
        validation_level: validationLevel,
        validation_timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Validate multiple phone numbers
   */
  private async validateMultipleNumbers(
    phoneNumbers: string[],
    validationLevel: string,
    countryCode: string,
    blockRisky: boolean,
    includeCallerName: boolean,
    cacheResults: boolean
  ): Promise<Record<string, unknown>> {
    
    const results = [];
    let validCount = 0;
    let invalidCount = 0;
    let riskyCoun = 0;

    for (const phoneNumber of phoneNumbers) {
      if (!phoneNumber.trim()) continue;

      const result = await this.validateSingleNumber(
        phoneNumber.trim(),
        validationLevel,
        countryCode,
        blockRisky,
        includeCallerName,
        cacheResults
      );

      results.push(result);

      if (result.is_valid && result.is_safe_to_call) {
        validCount++;
      } else {
        invalidCount++;
        if (result.risk_level === 'high') {
          riskyCoun++;
        }
      }
    }

    return {
      total_numbers: phoneNumbers.length,
      valid_numbers: validCount,
      invalid_numbers: invalidCount,
      risky_numbers: riskyCoun,
      success_rate: phoneNumbers.length > 0 ? 
        (validCount / phoneNumbers.length * 100).toFixed(1) : '0.0',
      
      results: results,
      validation_level: validationLevel,
      validation_timestamp: new Date().toISOString(),
      
      summary: {
        total: phoneNumbers.length,
        valid: validCount,
        invalid: invalidCount,
        risky: riskyCoun,
        safe_to_call: validCount,
      },
    };
  }

  /**
   * Get detailed carrier information
   */
  private async getCarrierInfo(
    phoneNumber: string,
    countryCode: string
  ): Promise<Record<string, unknown>> {
    
    try {
      const credentials = await this.getCredentials('twilioApi') as any;
      const accountSid = credentials.accountSid;
      const authToken = credentials.authToken;

      const lookupUrl = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneNumber)}?Fields=line_type_intelligence`;

      const response = await this.helpers.httpRequest({
        method: 'GET',
        url: lookupUrl,
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        timeout: 10000,
      });

      const lineTypeIntel = response.line_type_intelligence;

      return {
        phone_number: phoneNumber,
        national_format: response.national_format,
        international_format: response.phone_number,
        country_code: response.country_code,
        
        carrier_name: lineTypeIntel?.carrier_name || 'Unknown',
        line_type: lineTypeIntel?.type || 'Unknown',
        mobile_country_code: lineTypeIntel?.mobile_country_code,
        mobile_network_code: lineTypeIntel?.mobile_network_code,
        
        is_valid: !lineTypeIntel?.error_code,
        error_code: lineTypeIntel?.error_code || null,
        
        lookup_timestamp: new Date().toISOString(),
        raw_response: response,
      };

    } catch (error) {
      throw new NodeOperationError(
        this.getNode(),
        `Failed to get carrier information: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}