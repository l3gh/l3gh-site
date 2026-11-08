// Staged gallery: the existing /gallery/ stays live until the backend is ready.
const MEDIA_ORIGIN = 'https://media.l3gh.com';
const grid = document.getElementById('gallery');
const status = document.getElementById('status');
const retry = document.getElementById('retry');
const viewer = document.getElementById('viewer');
const image = document.getElementById('viewer-image');
const previous = document.getElementById('previous');
const next = document.getElementById('next');
let items = [];
let selected = 0;

function mediaURL(value) {
  const url = new URL(value, MEDIA_ORIGIN);
  if (url.origin !== MEDIA_ORIGIN || !url.pathname.startsWith('/media/')) {
    throw new Error('Unexpected media URL');
  }
  return url.href;
}

function show(index) {
  selected = index;
  const item = items[index];
  image.src = mediaURL(item.image_url);
  image.alt = item.alt || item.title;
  document.getElementById('viewer-title').textContent = item.title;
  document.getElementById('viewer-caption').textContent = item.caption;
  previous.disabled = index === 0;
  next.disabled = index === items.length - 1;
  if (!viewer.open) {
    viewer.showModal();
    document.body.classList.add('viewer-open');
    document.getElementById('close').focus();
  }
}

async function load() {
  status.textContent = 'Loading pictures…';
  retry.hidden = true;
  grid.replaceChildren();
  try {
    const response = await fetch(`${MEDIA_ORIGIN}/api/gallery`, {
      credentials: 'omit', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Gallery unavailable');
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('Invalid gallery');
    // Validate the entire response before rendering, so failures leave no partial grid.
    for (const item of data.items) {
      if (typeof item.title !== 'string' || typeof item.caption !== 'string') throw new Error('Invalid entry');
      mediaURL(item.image_url);
      mediaURL(item.thumbnail_url);
    }
    items = data.items;
    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      const figure = document.createElement('figure');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'image-button';
      button.setAttribute('aria-label', `Open ${item.title}`);
      const thumbnail = document.createElement('img');
      thumbnail.src = mediaURL(item.thumbnail_url);
      thumbnail.alt = item.alt || item.title;
      thumbnail.loading = 'lazy';
      thumbnail.decoding = 'async';
      button.append(thumbnail);
      button.addEventListener('click', () => show(index));
      const caption = document.createElement('figcaption');
      const title = document.createElement('h2');
      title.textContent = item.title;
      const description = document.createElement('p');
      description.textContent = item.caption;
      caption.append(title, description);
      figure.append(button, caption);
      fragment.append(figure);
    });
    grid.append(fragment);
    status.textContent = items.length ? '' : 'No pictures published yet. Check back soon.';
  } catch {
    items = [];
    status.textContent = 'The gallery is unavailable right now. Please try again.';
    retry.hidden = false;
  }
}

retry.addEventListener('click', load);
previous.addEventListener('click', () => selected > 0 && show(selected - 1));
next.addEventListener('click', () => selected < items.length - 1 && show(selected + 1));
document.getElementById('close').addEventListener('click', () => viewer.close());
viewer.addEventListener('close', () => document.body.classList.remove('viewer-open'));
viewer.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' && selected > 0) { event.preventDefault(); show(selected - 1); }
  if (event.key === 'ArrowRight' && selected < items.length - 1) { event.preventDefault(); show(selected + 1); }
});
load();
