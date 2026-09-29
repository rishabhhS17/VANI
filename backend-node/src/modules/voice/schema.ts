/** Voice command validation — mirrors VoiceCommandRequest in voice_routes.py. */
import { z } from "zod";

export const voiceCommandSchema = z.object({
  command: z.string().min(1).max(500),
});

export type VoiceCommandInput = z.infer<typeof voiceCommandSchema>;
