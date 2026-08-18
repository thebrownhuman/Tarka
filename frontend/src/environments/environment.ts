// Dev/default environment. The browser (not the container) makes these calls,
// so `localhost` + the published BACKEND_PORT works regardless of Docker
// networking between containers. Real multi-host deployment config is
// Feature 7 (Deployment) - out of scope here.
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api/v1',
};
