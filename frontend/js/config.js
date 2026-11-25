// Server address. Override with ?server=https://… for testing.
const PROD = 'https://codenames-pulp-api.onrender.com'; // keep in sync with docs/PROTOCOL.md §1
const LOCAL = 'http://localhost:3000';
const override = new URLSearchParams(location.search).get('server');
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
export const SERVER_URL = override || (isLocal ? LOCAL : PROD);
