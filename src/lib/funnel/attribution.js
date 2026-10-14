const ALLOWED = /^[a-zA-Z0-9_-]{1,64}$/;
export function cleanAttribution(searchParams) {
  const result = {};
  for (const [key, query] of [['source', 'utm_source'], ['medium', 'utm_medium'], ['campaign', 'utm_campaign']]) {
    const value = searchParams.get(query);
    if (value && ALLOWED.test(value) && !/@|https?:|\d{7,}/i.test(value)) result[key] = value;
  }
  return result;
}
