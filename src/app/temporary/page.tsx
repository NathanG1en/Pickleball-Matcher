import { getActivePlayerAccountId } from "@/app/actions/action-context";
import { TemporaryGroupClient } from "@/components/temporary/temporary-group-client";

export default async function TemporaryGroupPage() {
  const accountId = await getActivePlayerAccountId();
  return <TemporaryGroupClient accountId={accountId} />;
}
