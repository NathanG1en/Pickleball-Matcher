import { z } from "zod";
import { entityIdSchema } from "./group";
export const partnerRequestContextSchema = z.object({ groupId: entityIdSchema, sessionId: entityIdSchema }).strict();
export const submitPartnerRequestSchema = partnerRequestContextSchema.extend({ partnerPlayerId: entityIdSchema });
export const cancelPartnerRequestSchema = partnerRequestContextSchema.extend({ requestId: entityIdSchema });
export const decidePartnerRequestSchema = cancelPartnerRequestSchema.extend({ decision: z.enum(["approved", "declined"]) });
