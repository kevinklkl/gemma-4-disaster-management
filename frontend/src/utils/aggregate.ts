import type { ApiMessage, ApiLocation, LocationCard, AggregatedItem, ItemSource } from "../types";

export const URGENCY_WEIGHT: Record<string, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

export function formatLocation(loc: ApiLocation): string {
  if (!loc) return "Unknown";
  if (typeof loc === "string") return loc;
  const parts = [loc.barangay, loc.city, loc.province].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown";
}

export function aggregateByLocation(messages: ApiMessage[]): LocationCard[] {
  const processed = messages.filter(m => m.extractedData);
  const groups = new Map<string, ApiMessage[]>();

  for (const msg of processed) {
    const loc = formatLocation(msg.extractedData?.location ?? null);
    if (loc === "Unknown") {
      groups.set(`__unknown_${msg.id}`, [msg]);
    } else {
      const existing = groups.get(loc);
      if (existing) existing.push(msg);
      else groups.set(loc, [msg]);
    }
  }

  const cards: LocationCard[] = [];

  for (const [key, msgs] of groups) {
    const isUnknown = key.startsWith("__unknown_");
    const location = isUnknown ? "Unknown" : key;

    let highestUrgency = "low";
    let totalPersons = 0;
    let oldestTime = "";
    const messageIds: string[] = [];
    const contents: string[] = [];
    const channelCounts = new Map<string, number>();
    const itemMap = new Map<string, AggregatedItem>();

    for (const msg of msgs) {
      const ed = msg.extractedData!;
      messageIds.push(msg.id);
      if (msg.content) contents.push(msg.content);

      if ((URGENCY_WEIGHT[ed.urgency] ?? 0) > (URGENCY_WEIGHT[highestUrgency] ?? 0)) {
        highestUrgency = ed.urgency;
      }
      totalPersons += ed.persons ?? 0;

      if (!oldestTime || msg.time < oldestTime) {
        oldestTime = msg.time;
      }

      const ch = msg.type || "sms";
      channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);

      for (let i = 0; i < ed.items.length; i++) {
        const item = ed.items[i];
        const canonical = item.canonical || item.name.toLowerCase();
        const unit = item.unit || "";
        const mapKey = `${canonical}|${unit}`;
        const packedQty = msg.packingState?.[String(i)] ?? 0;

        const source: ItemSource = {
          msgId: msg.id, itemIndex: i, qty: item.qty, packedQty,
        };

        if (itemMap.has(mapKey)) {
          const agg = itemMap.get(mapKey)!;
          if (item.qty != null) agg.totalQty = (agg.totalQty ?? 0) + item.qty;
          agg.totalPacked += packedQty;
          agg.sources.push(source);
        } else {
          itemMap.set(mapKey, {
            key: mapKey,
            name: item.name,
            canonical: item.canonical ?? null,
            unit: item.unit ?? null,
            totalQty: item.qty,
            totalPacked: packedQty,
            sources: [source],
          });
        }
      }
    }

    let topChannel = "sms";
    let topCount = 0;
    for (const [ch, count] of channelCounts) {
      if (count > topCount) { topChannel = ch; topCount = count; }
    }
    if (channelCounts.size > 1) topChannel = "mixed";

    cards.push({
      locationKey: key,
      location,
      urgency: highestUrgency,
      totalPersons,
      receivedAt: oldestTime,
      items: Array.from(itemMap.values()),
      messageIds,
      contents,
      channel: topChannel,
      isUnknownLocation: isUnknown,
      isSplitRemainder: false,
    });
  }

  return cards;
}

export function sortCards(cards: LocationCard[]): LocationCard[] {
  return [...cards].sort((a, b) => {
    const urgDiff = (URGENCY_WEIGHT[b.urgency] ?? 0) - (URGENCY_WEIGHT[a.urgency] ?? 0);
    if (urgDiff !== 0) return urgDiff;
    const aTime = a.receivedAt ? new Date(a.receivedAt).getTime() : Infinity;
    const bTime = b.receivedAt ? new Date(b.receivedAt).getTime() : Infinity;
    if (aTime !== bTime) return aTime - bTime;
    return b.items.length - a.items.length;
  });
}
