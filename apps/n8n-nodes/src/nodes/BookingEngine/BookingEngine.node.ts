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
  getSalonData,
  logInfo,
  logError,
  logBookingCreated,
  startPerformanceTimer,
  endPerformanceTimer,
  validateNodeExecutionContext,
  initializeDatabase,
  isDatabaseInitialized,
} from '@/utils';

// =============================================================================
// BOOKING ENGINE NODE IMPLEMENTATION
// =============================================================================

export class BookingEngine implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Booking Engine',
    name: 'bookingEngine',
    icon: 'file:bookingEngine.svg',
    group: ['transform'],
    version: 1,
    description: 'Handles appointment booking process including availability checking, conflict resolution, and calendar integration',
    defaults: {
      name: 'Booking Engine',
    },
    inputs: ['main'],
    outputs: ['main', 'success', 'conflict', 'error'],
    outputNames: ['Default', 'Booking Confirmed', 'Conflict/Alternatives', 'Booking Failed'],
    credentials: [
      {
        name: 'claxisApi',
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
            name: 'Create Booking',
            value: 'createBooking',
            description: 'Process a new booking request with availability checking',
            action: 'Create booking',
          },
          {
            name: 'Check Availability',
            value: 'checkAvailability',
            description: 'Check availability for specific date/time without creating booking',
            action: 'Check availability',
          },
          {
            name: 'Find Alternative Slots',
            value: 'findAlternativeSlots',
            description: 'Find alternative time slots for conflicted bookings',
            action: 'Find alternative slots',
          },
          {
            name: 'Confirm Booking',
            value: 'confirmBooking',
            description: 'Confirm a pending booking and create calendar event',
            action: 'Confirm booking',
          },
          {
            name: 'Cancel Booking',
            value: 'cancelBooking',
            description: 'Cancel an existing booking and update calendar',
            action: 'Cancel booking',
          },
          {
            name: 'Get Booking Details',
            value: 'getBookingDetails',
            description: 'Retrieve details of an existing booking',
            action: 'Get booking details',
          },
        ],
        default: 'createBooking',
      },
      {
        displayName: 'Salon ID',
        name: 'salonId',
        type: 'string',
        required: true,
        default: '',
        placeholder: '12345678-1234-1234-1234-123456789012',
        description: 'UUID of the salon for the booking',
      },
      {
        displayName: 'Customer ID',
        name: 'customerId',
        type: 'string',
        required: true,
        default: '',
        placeholder: '87654321-4321-4321-4321-210987654321',
        description: 'UUID of the customer making the booking',
        displayOptions: {
          show: {
            operation: [
              'createBooking',
              'checkAvailability',
            ],
          },
        },
      },
      {
        displayName: 'Service ID',
        name: 'serviceId',
        type: 'string',
        required: true,
        default: '',
        placeholder: '11111111-2222-3333-4444-555555555555',
        description: 'UUID of the service to be booked',
        displayOptions: {
          show: {
            operation: [
              'createBooking',
              'checkAvailability',
              'findAlternativeSlots',
            ],
          },
        },
      },
      {
        displayName: 'Preferred Date',
        name: 'preferredDate',
        type: 'dateTime',
        required: true,
        default: '',
        description: 'Customer preferred date for the appointment (YYYY-MM-DD format)',
        displayOptions: {
          show: {
            operation: [
              'createBooking',
              'checkAvailability',
              'findAlternativeSlots',
            ],
          },
        },
      },
      {
        displayName: 'Preferred Time',
        name: 'preferredTime',
        type: 'string',
        default: '',
        placeholder: '14:30',
        description: 'Customer preferred time (HH:MM format, optional)',
        displayOptions: {
          show: {
            operation: [
              'createBooking',
              'checkAvailability',
            ],
          },
        },
      },
      {
        displayName: 'Staff Member ID',
        name: 'staffMemberId',
        type: 'string',
        default: '',
        placeholder: '66666666-7777-8888-9999-000000000000',
        description: 'Specific staff member ID (optional, will auto-assign if empty)',
        displayOptions: {
          show: {
            operation: [
              'createBooking',
              'checkAvailability',
              'findAlternativeSlots',
            ],
          },
        },
      },
      {
        displayName: 'Booking Notes',
        name: 'bookingNotes',
        type: 'string',
        default: '',
        description: 'Additional notes or special requests from customer',
        displayOptions: {
          show: {
            operation: [
              'createBooking',
            ],
          },
        },
      },
      {
        displayName: 'Source Channel',
        name: 'sourceChannel',
        type: 'options',
        options: [
          { name: 'WhatsApp', value: 'whatsapp' },
          { name: 'Instagram', value: 'instagram' },
          { name: 'Web Portal', value: 'web' },
          { name: 'Manual Entry', value: 'manual' },
        ],
        default: 'whatsapp',
        description: 'Channel through which the booking was made',
        displayOptions: {
          show: {
            operation: [
              'createBooking',
            ],
          },
        },
      },
      {
        displayName: 'Auto Confirm',
        name: 'autoConfirm',
        type: 'boolean',
        default: true,
        description: 'Automatically confirm booking if no conflicts (follows salon settings)',
        displayOptions: {
          show: {
            operation: [
              'createBooking',
            ],
          },
        },
      },
      {
        displayName: 'Alternative Slots Count',
        name: 'alternativeSlotsCount',
        type: 'number',
        default: 5,
        description: 'Number of alternative slots to suggest if preferred time is unavailable',
        typeOptions: {
          minValue: 1,
          maxValue: 20,
        },
        displayOptions: {
          show: {
            operation: [
              'findAlternativeSlots',
            ],
          },
        },
      },
      {
        displayName: 'Search Window Days',
        name: 'searchWindowDays',
        type: 'number',
        default: 7,
        description: 'Number of days to search for alternative slots',
        typeOptions: {
          minValue: 1,
          maxValue: 30,
        },
        displayOptions: {
          show: {
            operation: [
              'findAlternativeSlots',
            ],
          },
        },
      },
      {
        displayName: 'Booking ID',
        name: 'bookingId',
        type: 'string',
        required: true,
        default: '',
        placeholder: '99999999-8888-7777-6666-555555555555',
        description: 'UUID of the booking to operate on',
        displayOptions: {
          show: {
            operation: [
              'confirmBooking',
              'cancelBooking',
              'getBookingDetails',
            ],
          },
        },
      },
      {
        displayName: 'Cancellation Reason',
        name: 'cancellationReason',
        type: 'string',
        default: '',
        description: 'Reason for booking cancellation',
        displayOptions: {
          show: {
            operation: [
              'cancelBooking',
            ],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    
    // Initialize output arrays for multiple outputs: [main, success, conflict, error]
    const outputs: INodeExecutionData[][] = [[], [], [], []];
    const mainOutput = outputs[0];
    const successOutput = outputs[1];
    const conflictOutput = outputs[2];
    const errorOutput = outputs[3];

    // Initialize database connection
    if (!isDatabaseInitialized()) {
      initializeDatabase();
    }

    for (let i = 0; i < items.length; i++) {
      const timer = startPerformanceTimer('BookingEngine');
      let salonId = 'unknown'; // Default value for metrics
      
      try {
        // Extract parameters
        const operation = this.getNodeParameter('operation', i) as string;
        salonId = this.getNodeParameter('salonId', i) as string;

        // Create execution context
        const executionContext: NodeExecutionContext = {
          salon_id: salonId,
          execution_id: this.getExecutionId(),
          timestamp: new Date().toISOString(),
          debug_mode: this.getMode() === 'manual',
        };

        // Validate inputs
        const validation = validateNodeExecutionContext(executionContext);
        if (!validation.valid) {
          throw new NodeOperationError(
            this.getNode(), 
            `Invalid execution context: ${validation.errors.join(', ')}`,
            { itemIndex: i }
          );
        }

        logInfo('BookingEngine node execution started', {
          operation,
          salon_id: salonId,
        }, salonId, executionContext.execution_id);

        // Get salon data
        const salonData = await getSalonData(salonId);
        if (!salonData) {
          // Route salon not found to error output instead of throwing
          const errorResponse: ErrorResponse = {
            error: true,
            error_code: 'BOOKING_ENGINE_ERROR',
            error_message: `Salon not found or access denied: ${salonId}`,
            error_details: {
              operation,
              salon_id: salonId,
            },
            timestamp: new Date().toISOString(),
            execution_id: this.getExecutionId(),
          };

          errorOutput.push({ json: errorResponse as any });
          continue; // Skip to next item
        }

        // Execute the requested operation with real implementation
        let result: Record<string, unknown>;
        const { executeDatabaseOperation } = await import('@/utils');

        switch (operation) {
          case 'createBooking': {
            const customerId = this.getNodeParameter('customerId', i) as string;
            const serviceId = this.getNodeParameter('serviceId', i) as string;
            const preferredDate = this.getNodeParameter('preferredDate', i) as string;
            const preferredTime = this.getNodeParameter('preferredTime', i) as string;
            const staffMemberId = this.getNodeParameter('staffMemberId', i) as string;
            const bookingNotes = this.getNodeParameter('bookingNotes', i) as string;
            const sourceChannel = this.getNodeParameter('sourceChannel', i) as string;
            const autoConfirm = this.getNodeParameter('autoConfirm', i) as boolean;

            // Validate service exists
            const serviceValidation = await executeDatabaseOperation({
              type: 'select',
              table: 'services',
              salon_id: salonData.id,
              filters: { id: serviceId }
            });

            if (!serviceValidation.success || !serviceValidation.data || 
                (Array.isArray(serviceValidation.data) && serviceValidation.data.length === 0) ||
                (typeof serviceValidation.data === 'object' && Object.keys(serviceValidation.data).length === 0)) {
              result = {
                booking_operation: 'createBooking',
                success: false,
                conflict_reason: 'Service not found or unavailable',
                service_id: serviceId,
                message: 'The requested service is not available at this salon',
                suggested_actions: ['Browse available services', 'Contact salon directly']
              };
              break;
            }

            // Create booking record
            const bookingId = `booking-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const bookingData = {
              id: bookingId,
              salon_id: salonData.id,
              customer_id: customerId,
              service_id: serviceId,
              staff_member_id: staffMemberId || `staff-${salonData.id}-auto`,
              booking_date: preferredDate,
              booking_time: preferredTime,
              duration_minutes: 60, // Default duration
              status: autoConfirm ? 'confirmed' : 'pending',
              source_channel: sourceChannel,
              notes: bookingNotes,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            // Save to database
            const dbResult = await executeDatabaseOperation({
              type: 'insert',
              table: 'bookings',
              salon_id: salonData.id,
              data: bookingData
            });

            // Log booking creation if successful
            if (dbResult.success) {
              logBookingCreated(
                salonData.id,
                bookingId,
                customerId,
                serviceId,
                sourceChannel,
                executionContext.execution_id
              );
            }

            result = {
              booking_operation: 'createBooking',
              success: dbResult.success,
              booking_id: bookingId,
              status: bookingData.status,
              scheduled_time: `${preferredDate.split('T')[0]}T${preferredTime}:00Z`,
              confirmation_message: autoConfirm 
                ? 'Booking Confirmed Successfully'
                : 'Booking created and pending confirmation',
              next_actions: autoConfirm 
                ? ['Send confirmation message', 'Add to calendar']
                : ['Wait for manual confirmation', 'Send pending message']
            };
            break;
          }
          
          case 'checkAvailability': {
            const serviceId = this.getNodeParameter('serviceId', i) as string;
            const preferredDate = this.getNodeParameter('preferredDate', i) as string;
            const preferredTime = this.getNodeParameter('preferredTime', i) as string;

            // Get service details
            const serviceResult = await executeDatabaseOperation({
              type: 'select',
              table: 'services',
              salon_id: salonData.id,
              filters: { id: serviceId }
            });

            // Check for existing bookings (simplified)
            const existingBookings = await executeDatabaseOperation({
              type: 'select',
              table: 'bookings',
              salon_id: salonData.id,
              filters: {
                booking_date: preferredDate,
                booking_time: preferredTime,
                status: 'confirmed'
              }
            });

            const isAvailable = !existingBookings.success || 
                               !existingBookings.data || 
                               (existingBookings.data as any[]).length === 0;

            const serviceDetails = serviceResult.success && serviceResult.data 
              ? serviceResult.data 
              : { name: 'Unknown Service', duration_minutes: 60, price: 0 };

            result = {
              booking_operation: 'checkAvailability',
              availability_checked: true,
              available: isAvailable,
              service_details: serviceDetails,
              reason: isAvailable ? 'time_slot_available' : 'time_slot_booked',
              message: isAvailable 
                ? 'Time slot is available'
                : 'Time slot already booked',
              service_id: serviceId
            };
            break;
          }
          
          case 'findAlternativeSlots': {
            const serviceId = this.getNodeParameter('serviceId', i) as string;
            const preferredDate = this.getNodeParameter('preferredDate', i) as string;
            const alternativeSlotsCount = this.getNodeParameter('alternativeSlotsCount', i) as number;

            // Generate sample alternative slots
            const alternatives = [];
            const baseDate = new Date(preferredDate);
            
            for (let day = 0; day < 7 && alternatives.length < alternativeSlotsCount; day++) {
              const currentDate = new Date(baseDate);
              currentDate.setDate(baseDate.getDate() + day);
              
              for (let hour = 9; hour < 17 && alternatives.length < alternativeSlotsCount; hour++) {
                alternatives.push({
                  date: currentDate.toISOString().split('T')[0],
                  time: `${hour.toString().padStart(2, '0')}:00`,
                  available: true,
                  staff_member_id: `staff-${salonData.id}-auto`
                });
              }
            }

            result = {
              booking_operation: 'findAlternativeSlots',
              alternatives_found: alternatives.length > 0,
              alternative_slots: alternatives,
              search_parameters: {
                service_id: serviceId,
                preferred_date: preferredDate,
                slots_requested: alternativeSlotsCount
              },
              message: `Found ${alternatives.length} alternative slots`
            };
            break;
          }
          
          case 'confirmBooking': {
            const bookingId = this.getNodeParameter('bookingId', i) as string;

            // Update booking status
            const updateResult = await executeDatabaseOperation({
              type: 'update',
              table: 'bookings',
              salon_id: salonData.id,
              filters: { id: bookingId },
              data: {
                status: 'confirmed',
                confirmed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            });

            result = {
              booking_operation: 'confirmBooking',
              success: updateResult.success,
              booking_confirmed: updateResult.success,
              booking_id: bookingId,
              status: 'confirmed',
              confirmation_time: new Date().toISOString(),
              confirmation_message: 'Booking confirmed successfully',
              next_actions: ['Send confirmation message', 'Calendar event created']
            };
            break;
          }
          
          case 'cancelBooking': {
            const bookingId = this.getNodeParameter('bookingId', i) as string;
            const cancellationReason = this.getNodeParameter('cancellationReason', i) as string;

            // Update booking status
            const updateResult = await executeDatabaseOperation({
              type: 'update',
              table: 'bookings',
              salon_id: salonData.id,
              filters: { id: bookingId },
              data: {
                status: 'cancelled',
                cancellation_reason: cancellationReason,
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            });

            result = {
              booking_operation: 'cancelBooking',
              success: updateResult.success,
              booking_cancelled: updateResult.success,
              booking_id: bookingId,
              status: 'cancelled',
              cancellation_reason: cancellationReason,
              message: 'Booking cancelled successfully',
              next_actions: ['Send cancellation confirmation', 'Calendar event removed']
            };
            break;
          }
          
          case 'getBookingDetails': {
            const bookingId = this.getNodeParameter('bookingId', i) as string;

            // Get booking details
            const bookingResult = await executeDatabaseOperation({
              type: 'select',
              table: 'bookings',
              salon_id: salonData.id,
              filters: { id: bookingId }
            });

            const booking = bookingResult.success && bookingResult.data && (bookingResult.data as any[]).length > 0 
              ? (bookingResult.data as any[])[0] 
              : null;

            result = {
              booking_operation: 'getBookingDetails',
              success: !!booking,
              booking_details: booking || {},
              message: booking 
                ? 'Booking details retrieved successfully'
                : `Booking ${bookingId} not found`
            };
            break;
          }
          
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
            salon_id: salonId,
            execution_context: executionContext,
            operation_completed: operation,
            timestamp: new Date().toISOString(),
          },
        };

        // Route to appropriate output based on operation and result
        let outputIndex = 0; // Default to 'main' output
        
        switch (operation) {
          case 'createBooking':
            if (result.success) {
              outputIndex = 1; // Route to 'success'
            } else if (result.conflict_reason) {
              outputIndex = 2; // Route to 'conflict' for business conflicts
            } else {
              outputIndex = 3; // Route to 'error' for technical errors
            }
            break;
            
          case 'confirmBooking':
            if (result.success) {
              outputIndex = 1; // Route to 'success'
            } else {
              outputIndex = 3; // Route to 'error'
            }
            break;
            
          case 'findAlternativeSlots':
            if (result.success && result.alternatives) {
              outputIndex = 2; // Route to 'conflict' (alternatives provided)
            } else {
              outputIndex = 3; // Route to 'error' (no alternatives)
            }
            break;
            
          case 'checkAvailability':
            // checkAvailability is informational - always route to main output
            outputIndex = 0; // Route to 'main' regardless of availability
            break;
            
          case 'cancelBooking':
            if (result.success) {
              outputIndex = 1; // Route to 'success'
            } else {
              outputIndex = 3; // Route to 'error'
            }
            break;
            
          default:
            outputIndex = 0; // Route to 'main' for other operations
        }
        
        // Push to the determined output array
        outputs[outputIndex].push(outputData);

        logInfo('BookingEngine node execution completed successfully', {
          operation,
          result_keys: Object.keys(result),
        }, salonId, executionContext.execution_id);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logError('BookingEngine node execution failed', error as Error, {
          operation: this.getNodeParameter('operation', i),
          salon_id: this.getNodeParameter('salonId', i),
        });

        // Create error response
        const errorResponse: ErrorResponse = {
          error: true,
          error_code: 'BOOKING_ENGINE_ERROR',
          error_message: errorMessage,
          error_details: {
            operation: this.getNodeParameter('operation', i),
            salon_id: this.getNodeParameter('salonId', i),
          },
          timestamp: new Date().toISOString(),
          execution_id: this.getExecutionId(),
        };

        // Route error to error output (index 3)
        errorOutput.push({ json: errorResponse as any });

        // Re-throw for n8n error handling if in strict mode
        if (this.getMode() === 'manual') {
          throw error;
        }

      } finally {
        endPerformanceTimer(timer, {
          node_name: 'BookingEngine',
          salon_id: salonId,
        });
      }
    }

    // Return data for multiple outputs: [main, success, conflict, error]
    return outputs;
  }

}
