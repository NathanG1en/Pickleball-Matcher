import { neonAuth } from "@/lib/auth/neon-server";

export const { GET, POST, PUT, DELETE, PATCH } = neonAuth.handler();
