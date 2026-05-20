const hash = decodeURIComponent(location.hash.slice(1))
if (hash) {
  document.getElementById('profile-name').textContent = hash
}
