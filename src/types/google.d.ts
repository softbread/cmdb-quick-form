/* Minimal type stubs for Google Identity Services + gapi */

declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken(config?: { prompt?: string }): void;
  }

  interface TokenResponse {
    access_token: string;
    error?: string;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
}

declare namespace gapi {
  function load(api: string, callback: () => void): void;
  namespace client {
    function init(config: { apiKey: string }): Promise<void>;
  }
}
