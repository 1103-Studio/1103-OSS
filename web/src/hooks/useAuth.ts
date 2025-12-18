import { useState, useEffect } from 'react'

interface Credentials {
  accessKey: string
  secretKey: string
  endpoint: string
}

export function useAuth() {
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('oss_credentials')
    if (stored) {
      try {
        setCredentials(JSON.parse(stored))
      } catch {
        localStorage.removeItem('oss_credentials')
      }
    }
  }, [])

  const login = (creds: Credentials) => {
    localStorage.setItem('oss_credentials', JSON.stringify(creds))
    setCredentials(creds)
  }

  const logout = () => {
    localStorage.removeItem('oss_credentials')
    setCredentials(null)
  }

  return {
    credentials,
    isAuthenticated: !!credentials,
    login,
    logout,
  }
}
