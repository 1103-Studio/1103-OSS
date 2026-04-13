export const PERM_USER_MANAGE = 'user:manage'
export const PERM_CREDENTIAL_MANAGE = 'credential:manage'
export const PERM_ROLE_MANAGE = 'role:manage'
export const PERM_BUCKET_MANAGE = 'bucket:manage'
export const PERM_BUCKET_ASSIGN = 'bucket:assign'
export const PERM_BUCKET_QUOTA = 'bucket:quota'
export const PERM_BUCKET_TRAFFIC = 'bucket:traffic'
export const PERM_BUCKET_POLICY = 'bucket:policy'
export const PERM_TICKET_CREATE = 'ticket:create'
export const PERM_TICKET_READ = 'ticket:read'
export const PERM_TICKET_MANAGE = 'ticket:manage'
export const PERM_SUBSCRIPTION_MANAGE = 'subscription:manage'
export const PERM_SUBSCRIPTION_READ = 'subscription:read'
export const PERM_REDEMPTION_MANAGE = 'redemption:manage'

export const MIGRATION_PAGE_PERMISSIONS = [PERM_BUCKET_MANAGE]

export const TICKET_PAGE_PERMISSIONS = [
  PERM_TICKET_CREATE,
  PERM_TICKET_READ,
  PERM_TICKET_MANAGE,
]

export const IAM_PAGE_PERMISSIONS = [
  PERM_USER_MANAGE,
  PERM_CREDENTIAL_MANAGE,
  PERM_ROLE_MANAGE,
  PERM_BUCKET_MANAGE,
  PERM_BUCKET_ASSIGN,
  PERM_BUCKET_QUOTA,
  PERM_BUCKET_TRAFFIC,
  PERM_BUCKET_POLICY,
  PERM_SUBSCRIPTION_MANAGE,
  PERM_SUBSCRIPTION_READ,
  PERM_REDEMPTION_MANAGE,
]
