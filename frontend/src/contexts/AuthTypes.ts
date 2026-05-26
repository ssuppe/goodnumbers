// file: frontend/src/contexts/AuthTypes.ts
import { type GlucoseUnit } from "@goodnumbers/types";

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  agreementsSigned?: boolean;
  nightscoutUrl?: string | null;
  preferredUnits?: GlucoseUnit;
  nightscoutTokenLast3?: string | null;
  rssToken?: string;
}
