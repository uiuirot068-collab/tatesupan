/**
 * sessionStorage key used to ensure the "local-only works exist" safety
 * notice is shown at most once per login session. Cleared on SIGNED_OUT
 * (see AuthProvider) so it reappears on the next login.
 */
export const LOCAL_ONLY_NOTICE_SESSION_KEY = "tatespun:local-only-notice-shown";
