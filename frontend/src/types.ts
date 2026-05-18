export type ApiLocation =
  | string
  | { barangay?: string | null; city?: string | null; province?: string | null }
  | null;

export type ApiExtractedItem = {
  name: string;
  qty: number | null;
  canonical?: string | null;
  category?: string | null;
  raw_text?: string | null;
  unit?: string | null;
};

export type ApiMessage = {
  id: string;
  type: string;
  source: string;
  time: string;
  content: string;
  status: string;
  packingState: Record<string, number>;
  extractedData: {
    location: ApiLocation;
    urgency: string;
    persons: number;
    items: ApiExtractedItem[];
    reply_needed?: boolean;
    reply_draft?: string | null;
  } | null;
  replyNeeded?: boolean;
  replyDraft?: string | null;
  assignedTo?: number | null;
  ticketStatus?: string | null;
};

export type ItemSource = {
  msgId: string;
  itemIndex: number;
  qty: number | null;
  packedQty: number;
};

export type AggregatedItem = {
  key: string;
  name: string;
  canonical: string | null;
  category: string | null;
  unit: string | null;
  totalQty: number | null;
  totalPacked: number;
  sources: ItemSource[];
};

export type LocationCard = {
  locationKey: string;
  location: string;
  urgency: string;
  totalPersons: number;
  receivedAt: string;
  items: AggregatedItem[];
  messageIds: string[];
  contents: string[];
  channel: string;
  isUnknownLocation: boolean;
  isSplitRemainder: boolean;
};
