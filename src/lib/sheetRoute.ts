import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function useSheetRoute(sheetId: string, open: boolean, onClose: () => void): void {
  const navigate = useNavigate()
  const location = useLocation()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const locationRef = useRef(location)
  locationRef.current = location
  const openRef = useRef(open)
  openRef.current = open
  const pushedRef = useRef(false)
  const pushedPathnameRef = useRef<string | null>(null)
  const pushGenRef = useRef(0)
  const sawParamRef = useRef(false)

  useEffect(() => {
    if (open && !pushedRef.current) {
      pushedRef.current = true
      pushedPathnameRef.current = location.pathname
      pushGenRef.current += 1
      const sp = new URLSearchParams(location.search)
      sp.set('sheet', sheetId)
      navigate({ search: `?${sp.toString()}` }, { replace: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheetId, navigate])

  useEffect(() => {
    if (!open || !pushedRef.current) return
    const sp = new URLSearchParams(location.search)
    if (sp.get('sheet') === sheetId) {
      sawParamRef.current = true
      return
    }
    if (sawParamRef.current) {
      pushedRef.current = false
      pushedPathnameRef.current = null
      sawParamRef.current = false
      onCloseRef.current()
    }
  }, [location, open, sheetId])

  useEffect(() => {
    if (!open && pushedRef.current) {
      pushedRef.current = false
      sawParamRef.current = false
      const gen = pushGenRef.current
      const pushedPath = pushedPathnameRef.current
      pushedPathnameRef.current = null
      const t = setTimeout(() => {
        if (openRef.current || pushGenRef.current !== gen) return
        const now = locationRef.current
        if (now.pathname !== pushedPath) return
        const sp = new URLSearchParams(now.search)
        if (sp.get('sheet') !== sheetId) return
        sp.delete('sheet')
        const s = sp.toString()
        navigate({ search: s ? `?${s}` : '' }, { replace: true })
      }, 50)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheetId, navigate])
}
