import { create } from 'zustand';
import type { FilterState } from '../components/shared/FilterModal';

const EMPTY_FILTERS: FilterState = {
  venueTypes: [], regions: [], countries: [], genres: [], disciplines: [], months: [],
};

type DiscoverStore = {
  filters: FilterState;
  search: string;
  activeTab: string;
  setFilters: (f: FilterState) => void;
  setSearch: (s: string) => void;
  resetFilters: () => void;
  setActiveTab: (tab: string) => void;
};

export const useDiscoverStore = create<DiscoverStore>((set) => ({
  filters: EMPTY_FILTERS,
  search: '',
  activeTab: 'discover',
  setFilters: (filters) => set({ filters }),
  setSearch: (search) => set({ search }),
  resetFilters: () => set({ filters: EMPTY_FILTERS, search: '' }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
