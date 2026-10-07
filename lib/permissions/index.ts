import type { UserRole } from '@/types/database'

export const roleLabels: Record<UserRole, string> = { OWNER: 'Dono', OPERATOR: 'Operador', ATTENDANT: 'Atendente', DEVELOPER: 'Desenvolvedor' }
export const managementRoles: UserRole[] = ['OWNER', 'OPERATOR', 'DEVELOPER']
export function canManage(role?: UserRole | null) { return role ? managementRoles.includes(role) : false }
