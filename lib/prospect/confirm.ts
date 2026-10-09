// Confirm-step state for the business match. The card is chosen here; only a confirmed
// place id is allowed to start analysis. Alternates are capped at four.

export type PlaceCard = {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  category: string;
  rating: number | null;
  reviewCount: number | null;
  website: string;
};

export type ConfirmState = {
  step: "search" | "confirm" | "confirmed";
  selected: PlaceCard | null;
  alternates: PlaceCard[];
  showingAlternates: boolean;
};

export const MAX_ALTERNATES = 4;

export function startSearch(): ConfirmState {
  return { step: "search", selected: null, alternates: [], showingAlternates: false };
}

export function showMatch(primary: PlaceCard, alternates: PlaceCard[]): ConfirmState {
  const rest = alternates.filter((card) => card.placeId !== primary.placeId).slice(0, MAX_ALTERNATES);
  return { step: "confirm", selected: primary, alternates: rest, showingAlternates: false };
}

export function showAlternates(state: ConfirmState): ConfirmState {
  if (state.step !== "confirm" || state.alternates.length === 0) return state;
  return { ...state, showingAlternates: true };
}

export function pickAlternate(state: ConfirmState, placeId: string): ConfirmState {
  if (state.step !== "confirm" || !state.selected) return state;
  const next = state.alternates.find((card) => card.placeId === placeId);
  if (!next) return state;
  const alternates = [state.selected, ...state.alternates.filter((card) => card.placeId !== placeId)].slice(0, MAX_ALTERNATES);
  return { step: "confirm", selected: next, alternates, showingAlternates: false };
}

export function confirmSelected(state: ConfirmState): ConfirmState {
  if (state.step !== "confirm" || !state.selected) return state;
  return { ...state, step: "confirmed", showingAlternates: false };
}

// The person can return to the matched card from a later step without losing the choice.
export function backToConfirm(state: ConfirmState): ConfirmState {
  if (!state.selected) return startSearch();
  return { ...state, step: "confirm", showingAlternates: false };
}

export function editSearch(state: ConfirmState): ConfirmState {
  return { ...state, step: "search", showingAlternates: false };
}

export function analysisAllowed(row: { place_id: string | null; place_confirmed: number }): boolean {
  return row.place_confirmed === 1 && Boolean(row.place_id);
}
