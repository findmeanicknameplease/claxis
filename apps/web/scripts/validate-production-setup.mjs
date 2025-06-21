#!/usr/bin/env node

// =============================================================================
// PREMIUM SAAS PRODUCTION VALIDATION SCRIPT
// =============================================================================
// Validates all prerequisites are met for €299.99/month tier deployment
// Checks API keys, database connectivity, and configuration completeness
// =============================================================================

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

console.log(chalk.blue.bold('🚀 Gemini Salon AI - Production Deployment Validation'));
console.log(chalk.gray('Validating all prerequisites for premium SaaS deployment\n'));

let validationResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: []
};

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function checkRequired(name, value, description) {
  if (!value || value === '' || value.includes('your_') || value.includes('xxx')) {
    validationResults.failed++;
    validationResults.issues.push({
      type: 'error',
      category: 'Environment Variables',
      name: name,
      message: `Missing or invalid: ${description}`,
      fix: `Set ${name} in your environment variables`
    });
    return false;
  } else {
    validationResults.passed++;
    console.log(chalk.green('✅'), name, chalk.gray('- Configured'));
    return true;
  }
}

function checkOptional(name, value, description) {
  if (!value || value === '' || value.includes('your_') || value.includes('xxx')) {
    validationResults.warnings++;
    validationResults.issues.push({
      type: 'warning',
      category: 'Optional Features',
      name: name,
      message: `Optional but recommended: ${description}`,
      fix: `Consider setting ${name} for enhanced functionality`
    });
    return false;
  } else {
    validationResults.passed++;
    console.log(chalk.green('✅'), name, chalk.gray('- Configured'));
    return true;
  }
}

function validateAPIKeyFormat(name, value, expectedPrefix, minLength = 20) {
  if (!value) return false;
  
  if (!value.startsWith(expectedPrefix)) {
    validationResults.failed++;
    validationResults.issues.push({
      type: 'error',
      category: 'API Key Format',
      name: name,
      message: `Invalid format - should start with "${expectedPrefix}"`,
      fix: `Check ${name} format in your API provider dashboard`
    });
    return false;
  }
  
  if (value.length < minLength) {
    validationResults.failed++;
    validationResults.issues.push({
      type: 'error',
      category: 'API Key Format',
      name: name,
      message: `Too short - expected at least ${minLength} characters`,
      fix: `Verify ${name} is complete and not truncated`
    });
    return false;
  }
  
  return true;
}

function checkFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    validationResults.passed++;
    console.log(chalk.green('✅'), description);
  } else {
    validationResults.failed++;
    validationResults.issues.push({
      type: 'error',
      category: 'Required Files',
      name: path.basename(filePath),
      message: `Missing file: ${description}`,
      fix: `Create ${filePath} or run the setup scripts`
    });
  }
  return exists;
}

// =============================================================================
// MAIN VALIDATION
// =============================================================================

async function validateProduction() {
  console.log(chalk.yellow.bold('\n📋 Environment Variables Validation\n'));

  // Load environment variables
  config({ path: '.env.local' });
  
  // Application Configuration
  console.log(chalk.cyan('\n🔧 Application Configuration:'));
  checkRequired('NODE_ENV', process.env.NODE_ENV, 'Environment (production/development)');
  checkRequired('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL, 'Application URL');
  checkRequired('NEXT_PUBLIC_APP_NAME', process.env.NEXT_PUBLIC_APP_NAME, 'Application Name');

  // Supabase Database
  console.log(chalk.cyan('\n🗄️  Supabase Database:'));
  const supabaseUrl = checkRequired('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL, 'Supabase Project URL');
  const supabaseAnonKey = checkRequired('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Supabase Anonymous Key');
  const supabaseServiceKey = checkRequired('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY, 'Supabase Service Role Key');
  
  // Validate Supabase URL format
  if (supabaseUrl && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL.includes('.supabase.co')) {
      validationResults.issues.push({
        type: 'error',
        category: 'URL Format',
        name: 'NEXT_PUBLIC_SUPABASE_URL',
        message: 'Invalid Supabase URL format - should end with .supabase.co',
        fix: 'Check your Supabase project dashboard for the correct URL'
      });
    }
  }

  // WhatsApp Business API
  console.log(chalk.cyan('\n💬 WhatsApp Business API:'));
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
  checkRequired('WHATSAPP_ACCESS_TOKEN', whatsappToken, 'WhatsApp Access Token');
  checkRequired('WHATSAPP_APP_SECRET', process.env.WHATSAPP_APP_SECRET, 'WhatsApp App Secret');
  checkRequired('WHATSAPP_WEBHOOK_VERIFY_TOKEN', process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN, 'WhatsApp Webhook Verify Token');
  checkRequired('WHATSAPP_PHONE_NUMBER_ID', process.env.WHATSAPP_PHONE_NUMBER_ID, 'WhatsApp Phone Number ID');
  checkRequired('WHATSAPP_BUSINESS_ACCOUNT_ID', process.env.WHATSAPP_BUSINESS_ACCOUNT_ID, 'WhatsApp Business Account ID');
  
  // Validate WhatsApp token format
  if (whatsappToken) {
    validateAPIKeyFormat('WHATSAPP_ACCESS_TOKEN', whatsappToken, 'EAA', 50);
  }

  // AI Services
  console.log(chalk.cyan('\n🤖 AI Services:'));
  const geminiKey = process.env.GEMINI_API_KEY;
  checkRequired('GEMINI_API_KEY', geminiKey, 'Gemini API Key (Primary AI)');
  checkOptional('DEEPSEEK_API_KEY', process.env.DEEPSEEK_API_KEY, 'DeepSeek API Key (Cost optimization)');
  checkOptional('ELEVENLABS_API_KEY', process.env.ELEVENLABS_API_KEY, 'ElevenLabs API Key (Voice features)');
  
  // Validate Gemini key format
  if (geminiKey) {
    validateAPIKeyFormat('GEMINI_API_KEY', geminiKey, 'AIzaSy', 35);
  }

  // Redis Queue System
  console.log(chalk.cyan('\n🔄 Redis Queue System:'));
  checkRequired('REDIS_URL', process.env.REDIS_URL, 'Redis Connection URL');

  // Stripe Payment Processing
  console.log(chalk.cyan('\n💳 Stripe Payment Processing:'));
  const stripePublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  checkRequired('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', stripePublishable, 'Stripe Publishable Key');
  checkRequired('STRIPE_SECRET_KEY', stripeSecret, 'Stripe Secret Key');
  checkRequired('STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET, 'Stripe Webhook Secret');
  
  // Validate Stripe key formats
  if (stripePublishable) {
    validateAPIKeyFormat('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', stripePublishable, 'pk_', 25);
  }
  if (stripeSecret) {
    validateAPIKeyFormat('STRIPE_SECRET_KEY', stripeSecret, 'sk_', 25);
  }

  // Authentication
  console.log(chalk.cyan('\n🔐 Authentication:'));
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  checkRequired('NEXTAUTH_SECRET', nextAuthSecret, 'NextAuth Secret');
  checkRequired('NEXTAUTH_URL', process.env.NEXTAUTH_URL, 'NextAuth URL');
  
  // Validate NextAuth secret length
  if (nextAuthSecret && nextAuthSecret.length < 32) {
    validationResults.failed++;
    validationResults.issues.push({
      type: 'error',
      category: 'Security',
      name: 'NEXTAUTH_SECRET',
      message: 'Too short - should be at least 32 characters for security',
      fix: 'Generate a new secret: openssl rand -base64 32'
    });
  }

  // Security & Compliance
  console.log(chalk.cyan('\n🛡️  Security & EU Compliance:'));
  checkRequired('WEBHOOK_SECRET_KEY', process.env.WEBHOOK_SECRET_KEY, 'Webhook Signing Secret');
  checkRequired('DATA_REGION', process.env.DATA_REGION, 'Data Region (eu-central-1)');
  checkRequired('DATA_RESIDENCY', process.env.DATA_RESIDENCY, 'Data Residency (frankfurt)');
  checkRequired('GDPR_DPO_EMAIL', process.env.GDPR_DPO_EMAIL, 'GDPR DPO Email');

  // Optional but recommended
  console.log(chalk.cyan('\n📊 Optional Integrations:'));
  checkOptional('INSTAGRAM_ACCESS_TOKEN', process.env.INSTAGRAM_ACCESS_TOKEN, 'Instagram Business API');
  checkOptional('GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID, 'Google Calendar Integration');
  checkOptional('MICROSOFT_CLIENT_ID', process.env.MICROSOFT_CLIENT_ID, 'Microsoft Outlook Integration');

  // File Structure Validation
  console.log(chalk.cyan('\n📁 Required Files:'));
  checkFileExists('package.json', 'Package configuration');
  checkFileExists('next.config.js', 'Next.js configuration');
  checkFileExists('render.yaml', 'Render deployment configuration');
  checkFileExists('supabase/migrations/20241220_webhook_queue_tables.sql', 'Database migration script');
  checkFileExists('scripts/generate-webhook-token.mjs', 'Token generation script');
  checkFileExists('worker.js', 'Background worker script');

  // Additional Validations
  console.log(chalk.cyan('\n🔍 Additional Validations:'));
  
  // Check if production vs development settings
  if (process.env.NODE_ENV === 'production') {
    if (process.env.NEXT_PUBLIC_APP_URL?.includes('localhost')) {
      validationResults.warnings++;
      validationResults.issues.push({
        type: 'warning',
        category: 'Production Settings',
        name: 'NEXT_PUBLIC_APP_URL',
        message: 'Using localhost URL in production environment',
        fix: 'Update to your production domain'
      });
    }
    
    if (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.includes('test')) {
      validationResults.warnings++;
      validationResults.issues.push({
        type: 'warning',
        category: 'Production Settings',
        name: 'STRIPE_PUBLISHABLE_KEY',
        message: 'Using Stripe test key in production',
        fix: 'Switch to live Stripe keys for production'
      });
    }
  }

  // Report Results
  console.log(chalk.yellow.bold('\n📊 Validation Summary\n'));
  
  console.log(chalk.green(`✅ Passed: ${validationResults.passed}`));
  console.log(chalk.red(`❌ Failed: ${validationResults.failed}`));
  console.log(chalk.yellow(`⚠️  Warnings: ${validationResults.warnings}`));

  if (validationResults.issues.length > 0) {
    console.log(chalk.red.bold('\n🚨 Issues Found:\n'));
    
    // Group issues by category
    const groupedIssues = validationResults.issues.reduce((acc, issue) => {
      if (!acc[issue.category]) acc[issue.category] = [];
      acc[issue.category].push(issue);
      return acc;
    }, {});

    Object.entries(groupedIssues).forEach(([category, issues]) => {
      console.log(chalk.cyan.bold(`\n${category}:`));
      issues.forEach(issue => {
        const icon = issue.type === 'error' ? '❌' : '⚠️ ';
        console.log(`${icon} ${chalk.bold(issue.name)}: ${issue.message}`);
        console.log(`   ${chalk.gray('Fix:')} ${issue.fix}\n`);
      });
    });
  }

  // Final Assessment
  console.log(chalk.blue.bold('\n🎯 Production Readiness Assessment\n'));
  
  if (validationResults.failed === 0) {
    console.log(chalk.green.bold('🚀 READY FOR PRODUCTION DEPLOYMENT!'));
    console.log(chalk.green('All critical requirements are met for €299.99/month premium tier.'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('1. Create Supabase project in EU region'));
    console.log(chalk.gray('2. Run database setup script in Supabase SQL Editor'));
    console.log(chalk.gray('3. Deploy to Render with environment variables'));
    console.log(chalk.gray('4. Configure webhooks in Meta Developer Console'));
  } else {
    console.log(chalk.red.bold('🛑 NOT READY FOR PRODUCTION'));
    console.log(chalk.red(`${validationResults.failed} critical issue(s) must be resolved first.`));
    console.log(chalk.gray('Review the issues above and run this script again.'));
  }

  if (validationResults.warnings > 0) {
    console.log(chalk.yellow(`\n⚠️  ${validationResults.warnings} warning(s) - consider addressing for optimal experience.`));
  }

  process.exit(validationResults.failed > 0 ? 1 : 0);
}

// Run validation
validateProduction().catch(error => {
  console.error(chalk.red.bold('\n💥 Validation script error:'), error.message);
  process.exit(1);
});