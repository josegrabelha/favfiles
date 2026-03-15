function normalizeFilter(filter) {
  const value = typeof filter === 'string' ? filter.trim() : '';
  return value || '*';
}

function splitPatterns(filter) {
  return normalizeFilter(filter)
    .split(/[;,]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function wildcardToRegExp(pattern) {
  const source = escapeRegExp(pattern)
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${source}$`, 'i');
}

function fileMatchesFilter(name, filter) {
  return splitPatterns(filter).some(pattern => wildcardToRegExp(pattern).test(name));
}

module.exports = {
  normalizeFilter,
  fileMatchesFilter,
};
