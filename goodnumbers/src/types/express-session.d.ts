import 'cookie-session';

declare module 'cookie-session' {
  interface SessionData {
    is_authorized?: boolean;
  }
}
