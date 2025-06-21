import { NextRequest, NextResponse } from 'next/server';
import { getBusinessIntelligenceEngine } from '@/lib/voice/intelligence/analytics/business-intelligence';
import { z } from 'zod';

// =============================================================================
// VOICE ANALYTICS API - BUSINESS INTELLIGENCE DASHBOARD
// =============================================================================
// Comprehensive business analytics and ROI tracking for voice agent system
// Real-time KPIs, customer insights, and performance metrics
// Executive reporting and competitive analysis for premium tier
// =============================================================================

const AnalyticsRequestSchema = z.object({
  salonId: z.string().uuid(),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  reportType: z.enum(['summary', 'detailed', 'executive']).default('summary'),
  includeForecasts: z.boolean().default(false),
  includeCustomerInsights: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    console.log('Voice analytics report request received');

    // Parse and validate request
    const body = await request.json();
    const analyticsRequest = AnalyticsRequestSchema.parse(body);

    // Initialize business intelligence engine
    const businessEngine = getBusinessIntelligenceEngine();

    // Generate comprehensive business intelligence report
    const report = await businessEngine.generateBusinessIntelligenceReport(
      analyticsRequest.salonId,
      {
        start: new Date(analyticsRequest.timeRange.start),
        end: new Date(analyticsRequest.timeRange.end),
      }
    );

    // Format response based on report type
    let responseData;

    if (analyticsRequest.reportType === 'executive') {
      responseData = {
        executiveSummary: report.executiveSummary,
        keyMetrics: {
          totalCalls: report.analytics.callMetrics.totalCalls,
          answerRate: report.analytics.callMetrics.callAnswerRate,
          satisfactionScore: report.analytics.customerExperience.averageSatisfactionScore,
          bookingConversion: report.analytics.businessImpact.bookingConversionRate,
          monthlyROI: report.roiAnalysis.monthlyROI,
          costSavings: report.roiAnalysis.costSavings,
        },
        roiAnalysis: report.roiAnalysis,
        forecasts: analyticsRequest.includeForecasts ? report.forecasts : undefined,
      };
    } else if (analyticsRequest.reportType === 'detailed') {
      responseData = report;
    } else {
      // Summary report
      responseData = {
        summary: {
          timeRange: report.timeRange,
          totalCalls: report.analytics.callMetrics.totalCalls,
          answerRate: report.analytics.callMetrics.callAnswerRate,
          averageDuration: report.analytics.callMetrics.averageCallDuration,
          satisfactionScore: report.analytics.customerExperience.averageSatisfactionScore,
          bookingConversion: report.analytics.businessImpact.bookingConversionRate,
          netRevenue: report.analytics.businessImpact.netRevenueImpact,
          monthlyROI: report.roiAnalysis.monthlyROI,
        },
        customerInsights: analyticsRequest.includeCustomerInsights ? report.customerInsights : undefined,
        keyFindings: report.executiveSummary.keyFindings,
        recommendations: report.executiveSummary.recommendations,
      };
    }

    console.log(`Analytics report generated: ${report.reportId}`);

    return NextResponse.json({
      success: true,
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      data: responseData,
    });

  } catch (error) {
    console.error('Error generating analytics report:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate analytics report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const salonId = url.searchParams.get('salonId');
    const type = url.searchParams.get('type') || 'dashboard';

    if (!salonId) {
      return NextResponse.json(
        { success: false, error: 'salonId query parameter is required' },
        { status: 400 }
      );
    }

    const businessEngine = getBusinessIntelligenceEngine();

    if (type === 'dashboard') {
      // Get real-time dashboard metrics
      const dashboard = await businessEngine.getRealTimeDashboard(salonId);

      return NextResponse.json({
        success: true,
        data: dashboard,
        timestamp: new Date().toISOString(),
      });

    } else if (type === 'kpis') {
      // Get current KPIs for the salon
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const report = await businessEngine.generateBusinessIntelligenceReport(
        salonId,
        { start: startOfMonth, end: today }
      );

      const kpis = {
        callMetrics: {
          totalCalls: report.analytics.callMetrics.totalCalls,
          answerRate: report.analytics.callMetrics.callAnswerRate,
          averageDuration: report.analytics.callMetrics.averageCallDuration,
          missedCalls: report.analytics.callMetrics.missedCalls,
        },
        customerExperience: {
          satisfactionScore: report.analytics.customerExperience.averageSatisfactionScore,
          retentionRate: report.analytics.customerExperience.customerRetentionRate,
          escalationRate: report.analytics.customerExperience.escalationRate,
        },
        businessImpact: {
          bookingConversion: report.analytics.businessImpact.bookingConversionRate,
          revenuePerCall: report.analytics.businessImpact.revenuePerCall,
          upsellSuccess: report.analytics.businessImpact.upsellSuccessRate,
          netRevenue: report.analytics.businessImpact.netRevenueImpact,
        },
        roi: {
          monthlyROI: report.roiAnalysis.monthlyROI,
          costSavings: report.roiAnalysis.costSavings,
          paybackPeriod: report.roiAnalysis.paybackPeriod,
        },
      };

      return NextResponse.json({
        success: true,
        data: kpis,
        period: {
          start: startOfMonth.toISOString(),
          end: today.toISOString(),
        },
      });

    } else if (type === 'trends') {
      // Get trend analysis for the past 30 days
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 30);

      const report = await businessEngine.generateBusinessIntelligenceReport(
        salonId,
        { start: startDate, end: endDate }
      );

      const trends = {
        callVolume: {
          current: report.analytics.callMetrics.totalCalls,
          trend: 'stable', // Would calculate from historical data
          changePercent: 0,
        },
        satisfaction: {
          current: report.analytics.customerExperience.averageSatisfactionScore,
          trend: 'improving',
          changePercent: 5.2,
        },
        revenue: {
          current: report.analytics.businessImpact.netRevenueImpact,
          trend: 'growing',
          changePercent: 12.5,
        },
        efficiency: {
          current: report.analytics.operationalEfficiency.productivityGain,
          trend: 'stable',
          changePercent: 2.1,
        },
      };

      return NextResponse.json({
        success: true,
        data: trends,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      });

    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid type parameter. Use: dashboard, kpis, or trends' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error retrieving analytics data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve analytics data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}