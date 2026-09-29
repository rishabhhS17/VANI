/** Voice analytics — mirrors get_voice_analytics in backend/routes/voice_routes.py. */
import { prisma } from "../../db.js";

export interface VoiceAnalytics {
  total_commands: number;
  success_rate: number;
  most_used_intents: { intent: string; count: number }[];
  recent_commands: unknown[];
  failed_commands: unknown[];
  parser_distribution: { rule: number; groq: number };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function getVoiceAnalytics(userId: string): Promise<VoiceAnalytics> {
  const total = await prisma.voiceLog.count({ where: { userId } });
  if (total === 0) {
    return {
      total_commands: 0,
      success_rate: 0,
      most_used_intents: [],
      recent_commands: [],
      failed_commands: [],
      parser_distribution: { rule: 0, groq: 0 },
    };
  }

  const successful = await prisma.voiceLog.count({
    where: { userId, success: true },
  });
  const success_rate = round1((successful / total) * 100);

  const intentGroups = await prisma.voiceLog.groupBy({
    by: ["intent"],
    where: { userId },
    _count: { intent: true },
    orderBy: { _count: { intent: "desc" } },
    take: 10,
  });
  const most_used_intents = intentGroups.map((g) => ({
    intent: g.intent,
    count: g._count.intent,
  }));

  const recent = await prisma.voiceLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const recent_commands = recent.map((d) => ({
    command: d.command,
    intent: d.intent,
    success: d.success,
    confidence: d.confidence,
    parser_used: d.parserUsed,
    created_at: d.createdAt.toISOString(),
  }));

  const failed = await prisma.voiceLog.findMany({
    where: { userId, success: false },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const failed_commands = failed.map((d) => ({
    command: d.command,
    intent: d.intent,
    created_at: d.createdAt.toISOString(),
  }));

  const parserGroups = await prisma.voiceLog.groupBy({
    by: ["parserUsed"],
    where: { userId },
    _count: { parserUsed: true },
  });
  const parser_distribution = { rule: 0, groq: 0 };
  for (const g of parserGroups) {
    if (g.parserUsed === "rule" || g.parserUsed === "groq") {
      parser_distribution[g.parserUsed] = g._count.parserUsed;
    }
  }

  return {
    total_commands: total,
    success_rate,
    most_used_intents,
    recent_commands,
    failed_commands,
    parser_distribution,
  };
}
