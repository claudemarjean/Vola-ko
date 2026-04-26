const GLOBAL_LOADER_ID = 'volako-global-loader';

function ensureGlobalLoader() {
  let loader = document.getElementById(GLOBAL_LOADER_ID);
  if (loader) {
    return loader;
  }

  loader = document.createElement('div');
  loader.id = GLOBAL_LOADER_ID;
  loader.className = 'volako-global-loader hidden';
  loader.innerHTML = `
    <div class="volako-global-loader__backdrop"></div>
    <div class="volako-global-loader__panel">
      <div class="volako-global-loader__ring"></div>
      <p>Chargement des donnees...</p>
    </div>
  `;

  document.body.appendChild(loader);
  return loader;
}

export function showGlobalLoader(message = 'Chargement des donnees...') {
  const loader = ensureGlobalLoader();
  const messageEl = loader.querySelector('p');
  if (messageEl) {
    messageEl.textContent = message;
  }

  loader.classList.remove('hidden');
}

export function hideGlobalLoader() {
  const loader = ensureGlobalLoader();
  loader.classList.add('hidden');
}

export async function withPageLoader(containerId, task) {
  const container = document.getElementById(containerId);
  if (container) {
    container.classList.add('volako-page-loading');
  }

  try {
    return await task();
  } finally {
    if (container) {
      container.classList.remove('volako-page-loading');
    }
  }
}

export function setButtonLoading(button, loading, label = 'Traitement...') {
  if (!button) {
    return;
  }

  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent;
  }

  if (loading) {
    button.disabled = true;
    button.classList.add('loading');
    button.textContent = label;
  } else {
    button.disabled = false;
    button.classList.remove('loading');
    if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
    }
  }
}

export function applySkeleton(containerId, skeletonType = 'list') {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  if (skeletonType === 'cards') {
    container.innerHTML = `
      <div class="volako-skeleton-card"></div>
      <div class="volako-skeleton-card"></div>
      <div class="volako-skeleton-card"></div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="volako-skeleton-line"></div>
    <div class="volako-skeleton-line"></div>
    <div class="volako-skeleton-line"></div>
    <div class="volako-skeleton-line"></div>
  `;
}
