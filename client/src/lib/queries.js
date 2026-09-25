import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api.js';

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard') });
export const useAccounts = () => useQuery({ queryKey: ['accounts'], queryFn: () => api.get('/accounts') });
export const useTransfers = () => useQuery({ queryKey: ['transfers'], queryFn: () => api.get('/accounts/transfers') });
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories'), staleTime: 60_000 });
export const useContacts = (q) => useQuery({ queryKey: ['contacts', q || ''], queryFn: () => api.get('/contacts', { q }), placeholderData: (p) => p });
export const useContact = (id) => useQuery({ queryKey: ['contact', id], queryFn: () => api.get(`/contacts/${id}`), enabled: Boolean(id) });
export const useDues = (params) => useQuery({ queryKey: ['dues', params], queryFn: () => api.get('/dues', params), placeholderData: (p) => p });
export const useDue = (id) => useQuery({ queryKey: ['due', id], queryFn: () => api.get(`/dues/${id}`), enabled: Boolean(id) });
export const useAging = () => useQuery({ queryKey: ['aging'], queryFn: () => api.get('/dues/aging') });
export const useTransactions = (params) => useQuery({ queryKey: ['transactions', params], queryFn: () => api.get('/transactions', params), placeholderData: (p) => p });
export const useSuggestions = () => useQuery({ queryKey: ['suggestions'], queryFn: () => api.get('/transactions/suggestions'), staleTime: 60_000 });
export const useBudgets = (month) => useQuery({ queryKey: ['budgets', month], queryFn: () => api.get('/budgets', { month }), placeholderData: (p) => p });
export const useGoals = () => useQuery({ queryKey: ['goals'], queryFn: () => api.get('/goals') });
export const useGoal = (id) => useQuery({ queryKey: ['goal', id], queryFn: () => api.get(`/goals/${id}`), enabled: Boolean(id) });
export const useRecurring = () => useQuery({ queryKey: ['recurring'], queryFn: () => api.get('/recurring') });
export const useReport = (name, params) => useQuery({ queryKey: ['report', name, params], queryFn: () => api.get(`/reports/${name}`, params), placeholderData: (p) => p });

// Almost every write changes balances somewhere, so refresh money views broadly.
const MONEY_KEYS = ['dashboard', 'accounts', 'transactions', 'budgets', 'dues', 'due', 'aging', 'contacts', 'contact', 'goals', 'goal', 'recurring', 'report', 'transfers', 'suggestions'];

export function useSave(fn, { success, onSuccess, keys = MONEY_KEYS } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (success) toast.success(typeof success === 'function' ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useCategoryMap() {
  const { data = [] } = useCategories();
  return Object.fromEntries(data.map((c) => [c.id, c]));
}
