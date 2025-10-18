// file: frontend/src/contexts/AuthTypes.ts
import { type GlucoseUnit } from "@goodnumbers/common";

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  agreementsSigned?: boolean;
  nightscoutUrl?: string | null;
  preferredUnits?: GlucoseUnit;
  nightscoutTokenLast3?: string | null;
}
