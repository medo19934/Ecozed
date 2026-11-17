'use client';

import type { ClassroomDto, Paginated, StaffListItem } from '@latif/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api-client';

export const useClasses = (enabled = true) =>
  useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassroomDto[]>('/classes'), enabled });

/** Active staff for pickers (teachers in class forms). */
export const useStaffOptions = (enabled = true) =>
  useQuery({
    queryKey: ['staff', 'options'],
    enabled,
    queryFn: () => api.get<Paginated<StaffListItem>>('/staff?pageSize=100&status=ACTIVE'),
    select: (p) => p.items,
  });
