
const GATEWAY_SEEN_KEY = 'kasirquh.gatewaySeen.v1'

export function markGatewaySeen() {
  try {
    localStorage.setItem(GATEWAY_SEEN_KEY, '1')
  } catch {
  }
}

export function clearGatewaySeen() {
  try {
    localStorage.removeItem(GATEWAY_SEEN_KEY)
  } catch {
  }
}
