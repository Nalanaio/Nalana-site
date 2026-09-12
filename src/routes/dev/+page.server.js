export const prerender = false;

export function load({ setHeaders }) {
  setHeaders({ 'cache-control': 'no-store' });
  return {};
}
