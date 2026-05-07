import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const supabase = getServiceSupabase();

    // Get total count
    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true });

    // Get sessions with candidate info and reports
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        *,
        candidates(*),
        reports(*)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    // Calculate analytics
    const { data: allReports } = await supabase
      .from('reports')
      .select('scores, final_score');

    const analytics = calculateAnalytics(allReports || []);

    return NextResponse.json({
      success: true,
      sessions: sessions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      analytics,
    });

  } catch (error) {
    console.error('Admin sessions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

function calculateAnalytics(reports) {
  if (!reports || reports.length === 0) {
    return {
      totalInterviews: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      scoreDistribution: { excellent: 0, good: 0, average: 0, poor: 0 },
      weakAreas: [],
      strongAreas: [],
    };
  }

  const scores = reports.map(r => r.final_score || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Score distribution
  const distribution = {
    excellent: scores.filter(s => s >= 80).length,
    good: scores.filter(s => s >= 60 && s < 80).length,
    average: scores.filter(s => s >= 40 && s < 60).length,
    poor: scores.filter(s => s < 40).length,
  };

  // Calculate area averages
  const areaScores = {};
  const areaCounts = {};
  
  reports.forEach(report => {
    if (report.scores && typeof report.scores === 'object') {
      for (const [key, value] of Object.entries(report.scores)) {
        if (value && typeof value.score === 'number') {
          areaScores[key] = (areaScores[key] || 0) + value.score;
          areaCounts[key] = (areaCounts[key] || 0) + 1;
        }
      }
    }
  });

  const areaAverages = Object.entries(areaScores).map(([key, total]) => ({
    area: key,
    average: total / (areaCounts[key] || 1),
  }));

  areaAverages.sort((a, b) => a.average - b.average);
  
  const weakAreas = areaAverages.slice(0, 3).map(a => ({
    area: a.area,
    averageScore: parseFloat(a.average.toFixed(1)),
  }));

  const strongAreas = areaAverages.slice(-3).reverse().map(a => ({
    area: a.area,
    averageScore: parseFloat(a.average.toFixed(1)),
  }));

  return {
    totalInterviews: reports.length,
    averageScore: parseFloat(avgScore.toFixed(1)),
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    scoreDistribution: distribution,
    weakAreas,
    strongAreas,
  };
}
