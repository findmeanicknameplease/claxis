/**
 * ENTERPRISE STRIPE CUSTOMER UTILITIES
 * Systematic solution for TypeScript noUncheckedIndexedAccess compliance
 * Centralizes customer lookup patterns to eliminate "possibly undefined" errors
 */

import { stripe } from '@/lib/stripe/config';
import Stripe from 'stripe';

/**
 * Type predicate for non-empty arrays
 * Solves the core TypeScript issue with noUncheckedIndexedAccess
 */
export function hasCustomers(customers: Stripe.Customer[]): customers is [Stripe.Customer, ...Stripe.Customer[]] {
  return customers.length > 0;
}

/**
 * Find existing Stripe customer by email
 * @param email - Customer email address
 * @returns Customer object or null if not found
 */
export async function findStripeCustomer(email: string): Promise<Stripe.Customer | null> {
  try {
    const response = await stripe.customers.list({
      email,
      limit: 1,
    });

    // Use type predicate to properly narrow the array type
    if (!hasCustomers(response.data)) {
      return null;
    }

    // TypeScript now knows response.data[0] is definitely a Stripe.Customer
    return response.data[0];
  } catch (error) {
    console.error('Error finding Stripe customer:', error);
    throw error;
  }
}

/**
 * Find or create Stripe customer by email
 * @param email - Customer email address
 * @param metadata - Optional customer metadata
 * @returns Customer object (always exists)
 */
export async function findOrCreateStripeCustomer(
  email: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  const existingCustomer = await findStripeCustomer(email);
  
  if (existingCustomer) {
    return existingCustomer;
  }

  // Create new customer
  const newCustomer = await stripe.customers.create({
    email,
    metadata,
  });

  return newCustomer;
}

/**
 * Get customer with validation for API routes
 * Throws standardized errors for consistent API responses
 */
export async function getValidatedStripeCustomer(email: string): Promise<Stripe.Customer> {
  const customer = await findStripeCustomer(email);
  
  if (!customer) {
    throw new CustomerNotFoundError(`No Stripe customer found for email: ${email}`);
  }
  
  return customer;
}

/**
 * Custom error for customer not found scenarios
 * Enables consistent error handling across API routes
 */
export class CustomerNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerNotFoundError';
  }
}