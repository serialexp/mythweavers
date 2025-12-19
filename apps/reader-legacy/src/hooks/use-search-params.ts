import { useMemo } from 'react'
import { useSearch } from 'wouter'

export const useSearchParams = () => {
  const search = useSearch()
  return useMemo(() => {
    const params = new URLSearchParams(search)
    return params
  }, [search])
}
