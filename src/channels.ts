export type ChannelId = "tva" | "telequebec" | "ici-tele" | "noovo";

export interface Channel {
  id: ChannelId;
  name: string;
  monogram: string;
  color: string;
  url: string;
  provider: string;
  requiresAccount: boolean;
}

// URL relevées le 2026-10-21 (voir spec d'architecture, section « Relevé des directs »).
export const CHANNELS: readonly Channel[] = [
  {
    id: "ici-tele",
    name: "ICI Télé",
    monogram: "ICI",
    color: "#e4002b",
    url: "https://ici.tou.tv/chaine/ici-tele-montreal",
    provider: "ICI TOU.TV",
    requiresAccount: true,
  },
  {
    id: "tva",
    name: "TVA",
    monogram: "TVA",
    color: "#0a66c2",
    url: "https://www.tvaplus.ca/tva/en-direct",
    provider: "TVA+",
    requiresAccount: false,
  },
  {
    id: "telequebec",
    name: "Télé-Québec",
    monogram: "TQ",
    color: "#ff6a13",
    url: "https://telequebec.tv/regarder/en-direct/telequebec",
    provider: "Télé-Québec",
    requiresAccount: false,
  },
  {
    id: "noovo",
    name: "Noovo",
    monogram: "NV",
    color: "#7a3ff2",
    url: "https://www.crave.ca/fr/live?channel=noovo&group=allchannels",
    provider: "Crave",
    requiresAccount: true,
  },
];

export const DEFAULT_ORDER: readonly ChannelId[] = CHANNELS.map((c) => c.id);

const BY_ID = new Map<ChannelId, Channel>(CHANNELS.map((c) => [c.id, c]));

export function channelById(id: ChannelId): Channel {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Chaîne inconnue : ${id}`);
  return c;
}

export function isChannelId(x: unknown): x is ChannelId {
  return typeof x === "string" && BY_ID.has(x as ChannelId);
}
