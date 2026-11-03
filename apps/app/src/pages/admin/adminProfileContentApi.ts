import { api } from '../../utils/apiClient';
import {
  PROFILE_CONTENT_BASE,
  type AdminGuidance,
  type AdminProfileTemplate,
  type AdminTaxonomyTerm,
} from './profileContentTypes';

/** The platform-admin profile content endpoints, in one place for the three screens. */
export const adminProfileContentApi = {
  templates: () => api.get<AdminProfileTemplate[]>(`${PROFILE_CONTENT_BASE}/templates`),
  updateTemplate: (key: string, body: Record<string, unknown>) =>
    api.patch<AdminProfileTemplate>(`${PROFILE_CONTENT_BASE}/templates/${encodeURIComponent(key)}`, body),
  guidance: () => api.get<{ guidance: AdminGuidance }>(`${PROFILE_CONTENT_BASE}/guidance`),
  updateGuidance: (body: { guidance: AdminGuidance; reason?: string | null }) =>
    api.patch<{ guidance: AdminGuidance }>(`${PROFILE_CONTENT_BASE}/guidance`, body),
  taxonomy: () => api.get<AdminTaxonomyTerm[]>(`${PROFILE_CONTENT_BASE}/taxonomy`),
  createTaxonomy: (body: { kind: string; label: string; key?: string; sortOrder?: number; reason?: string | null }) =>
    api.post<AdminTaxonomyTerm>(`${PROFILE_CONTENT_BASE}/taxonomy`, body),
  updateTaxonomy: (id: string, body: Record<string, unknown>) =>
    api.patch<AdminTaxonomyTerm>(`${PROFILE_CONTENT_BASE}/taxonomy/${id}`, body),
  reorderTaxonomy: (body: { kind: string; ids: string[]; reason?: string | null }) =>
    api.put<AdminTaxonomyTerm[]>(`${PROFILE_CONTENT_BASE}/taxonomy/reorder`, body),
};