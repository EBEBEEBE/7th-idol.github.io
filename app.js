const params = new URLSearchParams(location.search);
const SUPPORTED_CONTENT_SCHEMA = 1;
const configuredContentBase = globalThis.T7S_CONTENT_BASE
  || document.querySelector('meta[name="t7s-content-base"]')?.content
  || '';
const contentBaseInput = params.get('content') || params.get('catalog') || configuredContentBase || '../content';
const CONTENT_BASE = new URL(contentBaseInput, location.href).toString().replace(/\/+$/, '');
const state = { contentManifest: null, character: null, characterIndex: [], assets: new Map(), entities: [], filter: 'card', sort: 'id', sortReverse: false, expressionFilter: 'all', advExpression: {}, cardFilters: { rarity: [], limited: [], type: [] }, indexFilters: { search: '', month: '', blood: '', type: '' } };

const categoryLabels = { card: 'category.card', adv: 'category.adv', ing: 'category.ing', sd: 'category.sd', photo: 'category.photo', character_ui: 'category.character_ui', character_name: 'category.character_name', live_ui: 'category.live_ui', gacha: 'category.gacha', gifthall: 'category.gifthall' };
const pages = [
  { id: 'card', labelKey: 'page.card', categories: ['card'] },
  { id: 'adv', labelKey: 'page.adv', categories: ['adv'] },
  { id: 'misc', labelKey: 'page.misc', categories: ['gacha', 'gifthall', 'character_name', 'ing', 'live_ui', 'character_ui', 'photo'] },
];
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dataUrl = path => {
  // Older generated ADV metadata used ../generated/... paths. In the split
  // content layout those derived resources live directly under content/;
  // normalize the legacy reference at the frontend boundary.
  const normalized = String(path || '').replace(/^(?:\.\.\/)+generated\//, '').replace(/^\/+/, '');
  return new URL(normalized, `${CONTENT_BASE}/`).toString();
};

async function fetchJson(path, optional = false) {
  const response = await fetch(dataUrl(path));
  if (!response.ok) { if (optional) return null; throw Error(`Content request failed: ${response.status} (${path})`); }
  return response.json();
}

async function loadContentManifest() {
  let manifest;
  try {
    manifest = await fetchJson('manifest.json');
  } catch (error) {
    // Keep the source-tree development path usable while new deployments use
    // the required manifest-backed dist/content contract.
    const legacy = params.has('catalog') || /\/all_catalog\/?$/.test(new URL(CONTENT_BASE).pathname);
    if (!legacy) throw error;
    state.contentManifest = {
      schema_version: SUPPORTED_CONTENT_SCHEMA,
      catalog: { characters: 'characters.json', character_template: 'characters/{character_id}.json' },
    };
    return;
  }
  const schemaVersion = Number(manifest?.schema_version);
  if (schemaVersion !== SUPPORTED_CONTENT_SCHEMA) {
    throw new Error(t('ui.unsupported_content_schema', { version: manifest?.schema_version ?? '?' }));
  }
  if (!manifest?.catalog?.characters) throw new Error(t('ui.invalid_content_manifest'));
  state.contentManifest = manifest;
}

function characterCatalogPath(characterId) {
  const template = state.contentManifest?.catalog?.character_template;
  if (template) return template.replace('{character_id}', String(characterId).padStart(3, '0'));
  return `catalog/characters/${String(characterId).padStart(3, '0')}.json`;
}

const characterCardMCache = new Map();

function characterManifestPath(characterId) {
  const entry = state.characterIndex.find(item => Number(item.character_id) === Number(characterId));
  return entry?.path || characterCatalogPath(characterId);
}

async function characterCardMThumbnails(characterId) {
  if (!characterCardMCache.has(characterId)) {
    characterCardMCache.set(characterId, fetchJson(characterManifestPath(characterId), true).then(character => {
      const paths = (character?.assets || [])
        .filter(asset => asset.family === 'card_m' && (asset.thumbnail || asset.path))
        .sort((a, b) => String(a.asset_id || a.path).localeCompare(String(b.asset_id || b.path), undefined, { numeric: true }))
        .map(asset => asset.thumbnail || asset.path);
      return [...new Set(paths)];
    }).catch(() => []));
  }
  const candidates = await characterCardMCache.get(characterId);
  const sample = [...candidates];
  for (let index = sample.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [sample[index], sample[swap]] = [sample[swap], sample[index]];
  }
  return sample.slice(0, 8);
}

function setupCharacterIndexEffects() {
  document.querySelectorAll('#character-index-grid a[data-character-id]').forEach(link => {
    const image = link.querySelector('img');
    if (!image) return;
    const primary = image.src;
    let slides = [];
    let pointerX = null;
    let session = 0;
    let current = -1;

    const showSlideAt = clientX => {
      if (!slides.length) return;
      const bounds = link.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(0.999999, (clientX - bounds.left) / Math.max(1, bounds.width)));
      const slide = Math.min(slides.length - 1, Math.floor(ratio * slides.length));
      if (slide === current) return;
      current = slide;
      image.src = dataUrl(slides[slide]);
    };

    link.addEventListener('mouseenter', async () => {
      const thisSession = ++session;
      slides = await characterCardMThumbnails(link.dataset.characterId);
      if (thisSession !== session || !link.matches(':hover')) return;
      slides.forEach(path => { const preload = new Image(); preload.src = dataUrl(path); });
      if (pointerX !== null) showSlideAt(pointerX);
    });
    link.addEventListener('mousemove', event => {
      pointerX = event.clientX;
      showSlideAt(pointerX);
    });
    link.addEventListener('mouseleave', () => {
      session += 1;
      slides = [];
      pointerX = null;
      current = -1;
      image.src = primary;
    });
  });
}

async function loadLegacy() {
  applyTranslations();
  const character = await fetchJson('characters/031.json');
  const adv = await fetchJson('adv_entities.json', true) || { entities: [] };
  state.character = character;
  for (const asset of character.assets || []) state.assets.set(asset.asset_id, asset);
  state.entities = [...(character.entities || []), ...(adv.entities || [])];
  setupCharacterHeroArtwork(character);
  setupProfilePanel(character);
  state.filter = pages.find(page => state.entities.some(entity => page.categories.includes(entity.category)))?.id || 'card';
  $('#character-hero').hidden = false;
  $('#section-name').textContent = t('page.index');
  $('#section-stats').textContent = '';
  $('#character-name').textContent = character.english_name || character.character_name || `Character ${character.character_id}`;
  $('#character-meta').textContent = [character.character_name, character.affiliation, character.cv].filter(Boolean).join(' · ');
  $('#character-stats').textContent = `${state.entities.length} gallery items · ${characterPhysicalAssetCount(character)} physical assets`;
  setupCardFilters();
  renderFilters(); render();
}

function characterName(character) {
  return character.english_name || character.character_name || `Character ${character.character_id}`;
}

function characterSearchText(character) {
  return [
    character.english_name,
    character.character_name,
    character.first_name,
    character.nickname,
    character.sort_name,
    character.character_id,
  ].filter(value => value !== null && value !== undefined && String(value).trim())
    .map(value => String(value).toLocaleLowerCase())
    .join("\n");
}

function characterPhysicalAssetCount(character) {
  const declared = Number(character.physical_asset_count);
  return Number.isInteger(declared) && declared >= 0 ? declared : (character.assets || []).length;
}

function setupCharacterHeroArtwork(character) {
  const characterId = String(Number(character.character_id)).padStart(3, '0');
  const assets = character.assets || [];
  const ing = assets.find(asset => asset.family === 'ing_character' && asset.asset_id === `ing_character_${characterId}_l.png`);
  const gacha = assets.find(asset => asset.family === 'gacha_character' && asset.asset_id === `Gacha_CharaName_P_${characterId}.png`);
  const hero = $('#character-hero');
  const gachaImage = $('#character-hero-gacha');

  hero.classList.toggle('has-ing-background', Boolean(ing?.path));
  hero.classList.toggle('has-gacha-name', Boolean(gacha?.path));
  if (ing?.path) hero.style.setProperty('--character-hero-ing-image', `url("${dataUrl(ing.path)}")`);
  else hero.style.removeProperty('--character-hero-ing-image');

  gachaImage.hidden = !gacha?.path;
  if (gacha?.path) gachaImage.src = dataUrl(gacha.path);
  else gachaImage.removeAttribute('src');
}

function characterBirthMonth(character) {
  const raw = Number(character.birth_month);
  if (Number.isInteger(raw) && raw === 0) return 0;
  const normalized = Number(character.birth_month_number);
  if (Number.isInteger(normalized) && normalized >= 1 && normalized <= 12) return normalized;
  if (Number.isInteger(raw) && raw >= 1 && raw <= 12) return raw;
  return Number.isInteger(normalized) ? normalized : null;
}

function characterBloodType(character) {
  const id = character.blood_type_id ?? character.blood_type;
  if (String(id) === '0') return t('profile.blood_type.na');
  return character.blood_type_name || character.blood_type || character.blood_type_id || '';
}

function characterRoute(characterId) {
  const url = new URL(location.href);
  url.searchParams.set('character', String(characterId));
  return `${url.pathname}${url.search}${url.hash}`;
}

function indexRoute() {
  const url = new URL(location.href);
  url.searchParams.delete('character');
  return `${url.pathname}${url.search}${url.hash}`;
}

function showLoadError(error) {
  $('#grid').innerHTML = `<p class="empty">${esc(t('ui.unable_load', { message: error.message }))}</p>`;
}

function navigateCharacter(characterId, section = state.filter) {
  const id = Number(characterId);
  if (!Number.isInteger(id)) return;
  history.pushState({}, '', characterRoute(id));
  loadCharacter(id, section).catch(showLoadError);
}

function navigateIndex() {
  history.pushState({}, '', indexRoute());
  loadRoute().catch(showLoadError);
}

async function loadRoute() {
  const requestedValue = new URLSearchParams(location.search).get('character');
  const requested = requestedValue === null || requestedValue === '' ? null : Number(requestedValue);
  if (Number.isInteger(requested) && requested > 0) {
    await loadCharacter(requested, state.filter);
  } else if (state.characterIndex.length > 1) {
    renderCharacterIndex();
  } else {
    await loadCharacter(state.characterIndex[0]?.character_id || 31, state.filter);
  }
}

async function loadCharacter(characterId, previousFilter = 'card') {
  const indexEntry = state.characterIndex.find(item => Number(item.character_id) === Number(characterId));
  const character = await fetchJson(indexEntry?.path || characterCatalogPath(characterId));
  const adv = character.adv_entities ? { entities: character.adv_entities } : await fetchJson('adv_entities.json', true) || { entities: [] };
  state.character = character;
  state.assets.clear();
  for (const asset of character.assets || []) state.assets.set(asset.asset_id, asset);
  state.entities = [...(character.entities || []), ...(adv.entities || [])];
  setupCharacterHeroArtwork(character);
  setupProfilePanel(character);
  state.filter = pages.some(page => page.id === previousFilter && state.entities.some(entity => page.categories.includes(entity.category)))
    ? previousFilter
    : pages.find(page => state.entities.some(entity => page.categories.includes(entity.category)))?.id || 'card';
  $('#toolbar').hidden = false;
  $('#character-hero').hidden = false;
  $('#section-name').textContent = t('page.index');
  $('#section-stats').textContent = `${state.characterIndex.length} ${t('ui.all_characters')}`;
  $('#character-name').textContent = characterName(character);
  $('#character-meta').textContent = [character.character_name, character.affiliation, character.cv].filter(Boolean).join(' · ');
  $('#character-stats').textContent = `${state.entities.length} gallery items · ${characterPhysicalAssetCount(character)} physical assets`;
  renderCharacterNavigation(character.character_id);
  setupCardFilters();
  renderFilters();
  render();
}

function renderCharacterNavigation(currentId) {
  const nav = $('#character-navigation');
  const switchButton = $('#header-switch-character');
  const switcher = $('#character-switcher-popover');
  nav.hidden = false;
  switchButton.hidden = false;
  const currentIndex = state.characterIndex.findIndex(item => Number(item.character_id) === Number(currentId));
  const previous = currentIndex > 0 ? state.characterIndex[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < state.characterIndex.length - 1 ? state.characterIndex[currentIndex + 1] : null;
  nav.innerHTML = `<a class="button secondary character-nav-button character-nav-back" href="${esc(indexRoute())}"><img src="assets/back.png" alt=""><span>${esc(t('ui.back_to_characters'))}</span></a><button class="button secondary character-nav-button" id="previous-character" type="button"${previous ? '' : ' disabled'}><span class="character-nav-arrow" aria-hidden="true">←</span><span>${esc(t('ui.previous_character'))}</span></button><button class="button secondary character-nav-button" id="next-character" type="button"${next ? '' : ' disabled'}><span>${esc(t('ui.next_character'))}</span><span class="character-nav-arrow" aria-hidden="true">→</span></button>`;
  nav.querySelector('a').onclick = event => { event.preventDefault(); navigateIndex(); };
  $('#previous-character').onclick = () => previous && navigateCharacter(previous.character_id);
  $('#next-character').onclick = () => next && navigateCharacter(next.character_id);
  const search = $('#character-switch-search');
  search.placeholder = t('ui.search_characters');
  const list = $('#character-switch-list');
  switcher.ontoggle = () => {
    const isOpen = switcher.matches(':popover-open');
    switchButton.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) search.focus({ preventScroll: true });
  };
  switchButton.onclick = () => {
    const rect = switchButton.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    const maxHeight = Math.min(420, window.innerHeight - 24);
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
    const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - maxHeight - 12));
    switcher.style.width = `${width}px`;
    switcher.style.left = `${left}px`;
    switcher.style.top = `${top}px`;
  };
  const renderChoices = () => {
    const query = search.value.trim().toLocaleLowerCase();
    list.innerHTML = state.characterIndex.filter(item => !query || characterSearchText(item).includes(query))
      .map(item => `<button type="button" class="character-switch-choice" data-character-id="${esc(item.character_id)}"><img loading="lazy" src="${esc(dataUrl(item.thumbnail || ''))}" alt=""><span>${esc(characterName(item))}</span><small>#${esc(item.character_id)}</small></button>`).join('') || `<p class="empty">${esc(t('ui.character_index_empty'))}</p>`;
    list.querySelectorAll('[data-character-id]').forEach(button => button.onclick = () => navigateCharacter(button.dataset.characterId));
  };
  search.oninput = renderChoices;
  renderChoices();
}

function characterIndexTypeLabel(item) {
  return item.character_type_name || item.character_type_id || 'Unresolved';
}

function renderCharacterIndex() {
  state.character = null;
  $('#character-hero').hidden = true;
  $('#header-switch-character').hidden = true;
  const switcher = $('#character-switcher-popover');
  if (switcher.matches(':popover-open')) switcher.hidePopover();
  $('#toolbar').hidden = true;
  $('#card-filters').hidden = true;
  $('#character-navigation').hidden = true;
  const profileButton = $('#profile-open');
  if (profileButton) profileButton.hidden = true;
  $('#section-name').textContent = t('page.index');
  $('#section-stats').textContent = `${state.characterIndex.length} ${t('ui.all_characters')}`;
  $('#grid').className = 'character-index-page';
  const months = [...new Set(state.characterIndex.map(characterBirthMonth).filter(Number.isInteger))].sort((a, b) => a - b);
  const bloodTypes = [...new Set(state.characterIndex.map(characterBloodType).filter(Boolean))].sort();
  const types = [...new Map(state.characterIndex.filter(item => item.character_type_id).map(item => [String(item.character_type_id), characterIndexTypeLabel(item)]))].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  $('#grid').innerHTML = `<section class="character-index"><div class="character-index-tools"><label><span>${esc(t('ui.search_characters'))}</span><input id="character-index-search" type="search" placeholder="${esc(t('ui.search_characters'))}"></label><label><span>${esc(t('ui.birth_month'))}</span><select id="character-index-month"><option value="">${esc(t('ui.any'))}</option>${months.map(month => `<option value="${month}">${esc(month === 0 ? t('profile.month.unknown') : t(`profile.month.${month}`))}</option>`).join('')}</select></label><label><span>${esc(t('ui.blood_type'))}</span><select id="character-index-blood"><option value="">${esc(t('ui.any'))}</option>${bloodTypes.map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join('')}</select></label><label><span>${esc(t('ui.character_type'))}</span><select id="character-index-type"><option value="">${esc(t('ui.any'))}</option>${types.map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join('')}</select></label></div><div id="character-index-grid" class="character-grid"></div></section>`;
  const search = $('#character-index-search');
  const month = $('#character-index-month');
  const blood = $('#character-index-blood');
  const type = $('#character-index-type');
  const renderResults = () => {
    state.indexFilters = { search: search.value, month: month.value, blood: blood.value, type: type.value };
    const query = state.indexFilters.search.trim().toLocaleLowerCase();
    const matches = state.characterIndex.filter(item => {
      const itemBlood = characterBloodType(item);
      return (!query || characterSearchText(item).includes(query)) &&
        (!state.indexFilters.month || String(characterBirthMonth(item)) === state.indexFilters.month) &&
        (!state.indexFilters.blood || itemBlood === state.indexFilters.blood) &&
        (!state.indexFilters.type || String(item.character_type_id) === state.indexFilters.type);
    });
    $('#character-index-grid').innerHTML = matches.map(item => `<a class="character-index-card" data-character-id="${esc(item.character_id)}" href="${esc(characterRoute(item.character_id))}"><img class="character-index-thumbnail${item.thumbnail_display === 'face' ? ' face-focus' : ''}" loading="lazy" src="${esc(dataUrl(item.thumbnail || ''))}" alt="${esc(characterName(item))}"><span>${esc(characterName(item))}</span><small>#${esc(item.character_id)}</small></a>`).join('') || `<p class="empty">${esc(t('ui.character_index_empty'))}</p>`;
    $('#character-index-grid').querySelectorAll('[data-character-id]').forEach(link => link.onclick = event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigateCharacter(link.dataset.characterId, 'card');
    });
    setupCharacterIndexEffects();
  };
  [search, month, blood, type].forEach(input => input.oninput = renderResults);
  renderResults();
}

async function loadMultiCharacter() {
  applyTranslations();
  await loadContentManifest();
  const index = await fetchJson(state.contentManifest.catalog.characters);
  state.characterIndex = (Array.isArray(index) ? index : index?.characters || [])
    .filter(item => Number.isInteger(Number(item.character_id)))
    .sort((a, b) => Number(a.character_id) - Number(b.character_id));
  await loadRoute();
}

window.addEventListener('popstate', () => loadRoute().catch(showLoadError));

function setupProfilePanel(character) {
  if (character.profile_available === false) {
    const trigger = $('#profile-open');
    if (trigger) trigger.hidden = true;
    const existingPanel = $('#profile-dialog');
    if (existingPanel?.open) existingPanel.close();
    return;
  }
  let panel = $('#profile-dialog');
  if (!panel) {
    panel = document.createElement('dialog');
    panel.id = 'profile-dialog';
    panel.className = 'profile-dialog';
    document.body.append(panel);
    const trigger = document.createElement('button');
    trigger.id = 'profile-open'; trigger.className = 'profile-open'; trigger.type = 'button';
    $('#character-name').after(trigger);
    trigger.onclick = () => panel.showModal();
  }
  $('#profile-open').hidden = false;
  const characterId = Number(character.character_id);
  const photos = (character.assets || []).filter(asset => asset.family === '7th_photo_idol' && asset.character_ids?.includes(characterId));
  const cardImages = (character.assets || []).filter(asset => asset.family === 'card_chara' && asset.character_ids?.includes(characterId));
  const images = photos.length ? photos : [...cardImages].sort(() => Math.random() - 0.5).slice(0, 3);
  const has = key => character[key] !== undefined && character[key] !== null && character[key] !== '';
  const rows = [
    ['character_id', has('character_id') ? character.character_id : null],
    ['character_full_name', [character.character_name, character.english_name].filter(Boolean).join(' / ') || null],
    ['sort_name', has('sort_name') ? character.sort_name : null],
    ['first_name', has('first_name') ? character.first_name : null],
    ['nickname', has('nickname') ? character.nickname : null],
    ['affiliation', has('affiliation') ? character.affiliation : null],
    ['cv', has('cv') ? character.cv : null],
    ['birthday', has('birthday') ? (() => { const month = characterBirthMonth(character); const monthLabel = month === 0 ? t('profile.month.unknown') : Number.isInteger(month) ? t(`profile.month.${month}`) : ''; const day = String(character.birthday) === '0' ? '' : character.birthday; const constellation = character.constellation && String(character.constellation) !== '0' ? ` [${character.constellation}]` : ''; return `${monthLabel}${day ? ` ${day}` : ''}${constellation}`.trim() || null; })() : null],
    ['blood_type', has('blood_type_id') || has('blood_type') || has('blood_type_name') ? characterBloodType(character) : null],
    ['age', has('age') ? character.age : null],
    ['height_weight', has('height') || has('weight') ? `${has('height') ? `${character.height}cm` : '—'} / ${has('weight') ? `${character.weight}kg` : '—'}` : null],
    ['three_sizes', has('bust') || has('waist') || has('hips') ? `${has('bust') ? `${character.bust}${has('cup') ? ` (${character.cup})` : ''}` : '—'} / ${has('waist') ? character.waist : '—'} / ${has('hips') ? character.hips : '—'}` : null],
    ['favorite', has('favorite') ? character.favorite : null],
    ['special_ability', has('special_ability') ? character.special_ability : null],
  ];
  const profile = rows.filter(([, value]) => value !== null).map(([key, value]) => `<div class="profile-row"><dt>${esc(t(`profile.field.${key}`))}</dt><dd>${esc(value)}</dd></div>`).join('');
  panel.innerHTML = `<button id="profile-close" class="close" type="button" aria-label="${esc(t('profile.close'))}">×</button><div class="profile-panel"><div class="profile-media"><div class="profile-image-frame"><button id="profile-previous" class="profile-nav previous" type="button" aria-label="Previous profile image">‹</button><img id="profile-image" loading="lazy" alt="${esc(character.english_name || character.character_name || 'Character profile')}"><button id="profile-next" class="profile-nav next" type="button" aria-label="Next profile image">›</button></div><p id="profile-image-caption" class="profile-image-caption"></p></div><section class="profile-info"><h2>${esc(t('profile.title'))}</h2><dl>${profile || `<p class="empty">${esc(t('profile.no_data'))}</p>`}</dl></section></div>`;
  $('#profile-open').textContent = t('profile.open');
  $('#profile-close').onclick = () => panel.close();
  panel.onclick = event => { if (event.target === panel) panel.close(); };
  let index = 0;
  const image = $('#profile-image'); const caption = $('#profile-image-caption'); const previous = $('#profile-previous'); const next = $('#profile-next');
  const update = () => {
    const current = images[index];
    image.hidden = !current;
    if (current) { image.src = dataUrl(current.path); caption.textContent = photos.length ? `${t('profile.photo_source')} ${index + 1} / ${images.length}` : `${t('profile.fallback_source')} ${index + 1} / ${images.length}`; }
    previous.disabled = !current || index === 0; next.disabled = !current || index === images.length - 1;
  };
  previous.onclick = () => { if (index > 0) { index -= 1; update(); } };
  next.onclick = () => { if (index < images.length - 1) { index += 1; update(); } };
  update();
}

function setupCardFilters() {
  const toggle = $('#card-filters-toggle');
  const content = $('#card-filters-content');
  toggle.onclick = () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    content.hidden = expanded;
  };
  const cards = state.entities.filter(entity => entity.category === 'card');
  const fill = (selector, key, values, label) => {
    $(selector).innerHTML = values.map(value => `<label><input type="checkbox" data-card-filter="${key}" value="${esc(value)}"> ${esc(label(value))}</label>`).join('');
    $(selector).querySelectorAll('input').forEach(input => input.onchange = () => {
      state.cardFilters[key] = [...$(selector).querySelectorAll('input:checked')].map(item => item.value);
      render();
    });
  };
  fill('#rarity-filter', 'rarity', [...new Set(cards.map(card => card.metadata?.rarity_id).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), value => cardFieldValue('rarity_id', value));
  fill('#type-filter', 'type', [...new Set(cards.map(card => card.metadata?.card_type_id).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), value => cardFieldValue('card_type_id', value));
  $('#limited-filter').querySelectorAll('input').forEach(input => input.onchange = () => {
    state.cardFilters.limited = [...$('#limited-filter').querySelectorAll('input:checked')].map(item => item.value);
    render();
  });
  $('#clear-card-filters').onclick = () => { state.cardFilters = { rarity: [], limited: [], type: [] }; document.querySelectorAll('[data-card-filter], #limited-filter input').forEach(input => { input.checked = false; }); render(); };
}

function renderFilters() {
  const counts = new Map(pages.map(page => [page.id, state.entities.filter(entity => page.categories.includes(entity.category)).length]));
  $('#filters').innerHTML = pages.filter(page => counts.get(page.id)).map(page => `<button class="filter ${page.id === state.filter ? 'active' : ''}" data-filter="${page.id}">${t(page.labelKey)} <small>${counts.get(page.id)}</small></button>`).join('');
  document.querySelectorAll('[data-filter]').forEach(button => { button.onclick = () => { state.filter = button.dataset.filter; renderFilters(); render(); }; });
  $('#adv-options').hidden = state.filter !== 'adv';
  document.querySelector('.sort').hidden = state.filter !== 'card';
  $('#sort-direction').hidden = state.filter !== 'card';
  $('#card-filters').hidden = state.filter !== 'card';
}

function assetForPath(path) { return [...state.assets.values()].find(asset => asset.path === path); }
function cardThumbnail(entity) {
  const cardLargePath = entity.representations?.card_l;
  const cardLarge = cardLargePath ? assetForPath(cardLargePath) : null;
  return cardLarge?.thumbnail || cardLargePath || entity.primary_thumbnail || entity.primary_media;
}
function title(entity) {
  if (entity.category === 'card') return entity.metadata?.card_name || `Card ${entity.entity_id.replace('card:', '')}`;
  if (entity.category === 'adv') return `ADV ${entity.metadata?.adv_base_key || entity.entity_id.replace('adv:', '')}`;
  return entity.metadata?.title || entity.entity_id.replace(/^(asset:|adv:)/, '');
}
function numericId(entity) { const match = entity.entity_id.match(/(\d+)(?!.*\d)/); return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER; }
function sorted(list) {
  return list.sort((a, b) => {
    let result;
    if (state.sort === 'rarity') result = Number(b.metadata?.rarity_id || 0) - Number(a.metadata?.rarity_id || 0) || numericId(a) - numericId(b);
    else if (state.sort === 'name') result = String(a.metadata?.card_name || '').localeCompare(String(b.metadata?.card_name || '')) || numericId(a) - numericId(b);
    else if (state.sort === 'type') result = Number(a.metadata?.card_type_id || 0) - Number(b.metadata?.card_type_id || 0) || numericId(a) - numericId(b);
    else if (state.sort === 'limited') result = Number(b.metadata?.limited_flg || 0) - Number(a.metadata?.limited_flg || 0) || numericId(a) - numericId(b);
    else if (state.sort === 'release') result = Number(b.metadata?.start_time || 0) - Number(a.metadata?.start_time || 0) || numericId(a) - numericId(b);
    else result = numericId(a) - numericId(b) || title(a).localeCompare(title(b));
    return state.sortReverse ? -result : result;
  });
}
function tileSubtitle(entity) {
  if (entity.category === 'card') return [`${t('ui.card')} ${entity.entity_id.replace('card:', '')}`, entity.metadata?.rarity_id ? `${t('ui.rarity')} ${cardFieldValue('rarity_id', entity.metadata.rarity_id)}` : ''].filter(Boolean).join(' · ');
  if (entity.category === 'adv') return `${entity.metadata?.available_expression_ids?.length || 0} expressions`;
  return t(categoryLabels[entity.category] || entity.category);
}
function visibleEntities() {
  const page = pages.find(item => item.id === state.filter);
  return sorted(state.entities.filter(entity => {
    if (!page?.categories.includes(entity.category)) return false;
    if (entity.category !== 'card') return true;
    const metadata = entity.metadata || {};
    return (!state.cardFilters.rarity.length || state.cardFilters.rarity.includes(String(metadata.rarity_id))) &&
      (!state.cardFilters.limited.length || state.cardFilters.limited.includes(String(metadata.limited_flg))) &&
      (!state.cardFilters.type.length || state.cardFilters.type.includes(String(metadata.card_type_id)));
  }));
}
function renderTile(entity) {
  const asset = assetForPath(entity.primary_media);
  const thumb = entity.category === 'card' ? cardThumbnail(entity) : entity.primary_thumbnail || asset?.thumbnail || entity.primary_media;
  return `<article class="tile" tabindex="0" data-entity="${esc(entity.entity_id)}"><img loading="lazy" src="${esc(dataUrl(thumb))}" alt="${esc(title(entity))}"><div class="tile-body"><div class="tile-title">${esc(title(entity))}</div><div class="tile-sub">${esc(tileSubtitle(entity))}</div></div></article>`;
}
function miscFamily(entity) { return Object.keys(entity.representations || {})[0] || ''; }
function renderMiscSections(entities) {
  const groups = [
    { title: 'Character UI', sections: [
      { title: 'Character Name', items: entities.filter(entity => miscFamily(entity) === 'character_name') },
      { title: 'Character Menu', items: entities.filter(entity => miscFamily(entity) === 'chara_menu') },
      { title: 'Live UI', items: entities.filter(entity => entity.category === 'live_ui' || miscFamily(entity) === 'pvp_live_bg_name') },
      { title: 'Other Character UI', items: entities.filter(entity => entity.category === 'character_ui' && !['character_name', 'chara_menu', 'pvp_live_bg_name'].includes(miscFamily(entity))) },
    ] },
    { title: 'Gift Hall', items: entities.filter(entity => entity.category === 'gifthall') },
    { title: 'Gacha', items: entities.filter(entity => entity.category === 'gacha') },
    { title: 'Photo', items: entities.filter(entity => entity.category === 'photo') },
    { title: 'SD', items: entities.filter(entity => entity.category === 'sd') },
    { title: 'ING', items: entities.filter(entity => entity.category === 'ing') },
  ];
  return groups.filter(group => group.sections ? group.sections.some(section => section.items.length) : group.items.length).map(group => {
    if (!group.sections) return `<section class="misc-section"><h2>${esc(group.title)}</h2><div class="grid misc-grid">${group.items.map(renderTile).join('')}</div></section>`;
    return `<section class="misc-section"><h2>${esc(group.title)}</h2>${group.sections.filter(section => section.items.length).map(section => `<div class="misc-subsection"><h3>${esc(section.title)}</h3><div class="grid misc-grid">${section.items.map(renderTile).join('')}</div></div>`).join('')}</section>`;
  }).join('') || `<p class="empty">${t('ui.no_items')}</p>`;
}
function render() {
  const entities = visibleEntities();
  $('#grid').className = `grid ${state.filter === 'card' ? 'cards-grid' : state.filter === 'misc' ? 'misc-layout' : ''}`;
  $('#grid').innerHTML = state.filter === 'misc' ? renderMiscSections(entities) : entities.map(renderTile).join('') || `<p class="empty">${t('ui.no_items')}</p>`;
  document.querySelectorAll('[data-entity]').forEach(tile => { const open = () => showDetail(tile.dataset.entity); tile.onclick = open; tile.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }; });
}

async function showDetail(id) {
  const entity = state.entities.find(item => item.entity_id === id); if (!entity) return;
  ensureDetailNavigation();
  if (entity.category === 'adv') {
    const bodyPath = entity.representations?.body || '';
    const folder = bodyPath.slice(0, bodyPath.lastIndexOf('/'));
    const metadata = folder ? await fetchJson(`${folder}/metadata.json`, true) : null;
    if (metadata) entity.metadata = { ...(entity.metadata || {}), ...metadata };
  }
  $('#detail-dialog').classList.toggle('card-dialog', entity.category === 'card');
  $('#detail-content').innerHTML = entity.category === 'adv' ? renderAdvDetail(entity) : entity.category === 'card' ? renderCardDetail(entity) : renderGenericDetail(entity);
  $('#detail-dialog').showModal();
  updateDetailNavigation(entity);
  ensureAdvNavigation();
  updateAdvNavigation(entity);
  if (entity.category === 'adv') setupAdvViewer(entity);
  if (entity.category === 'card') setupCardDetail(entity);
}
function ensureDetailNavigation() {
  if ($('#previous-card')) return;
  for (const [id, label, direction] of [['previous-card', 'Previous card', 'previous'], ['next-card', 'Next card', 'next']]) {
    const button = document.createElement('button');
    button.id = id; button.className = `detail-nav ${direction}`; button.type = 'button'; button.setAttribute('aria-label', label); button.textContent = direction === 'previous' ? '‹' : '›';
    $('#detail-dialog').append(button);
  }
}
function updateDetailNavigation(entity) {
  const previous = $('#previous-card'); const next = $('#next-card');
  if (!previous || !next) return;
  const cards = visibleEntities().filter(item => item.category === 'card');
  const index = cards.findIndex(item => item.entity_id === entity.entity_id);
  const isCard = entity.category === 'card' && index >= 0;
  previous.hidden = !isCard; next.hidden = !isCard;
  previous.disabled = !isCard || index === 0;
  next.disabled = !isCard || index === cards.length - 1;
  previous.onclick = () => { if (index > 0) showDetail(cards[index - 1].entity_id); };
  next.onclick = () => { if (index >= 0 && index < cards.length - 1) showDetail(cards[index + 1].entity_id); };
}
function ensureAdvNavigation() {
  if ($('#previous-adv')) return;
  for (const [id, label, direction] of [['previous-adv', 'Previous ADV base', 'previous'], ['next-adv', 'Next ADV base', 'next']]) {
    const button = document.createElement('button');
    button.id = id; button.className = `detail-nav adv-nav ${direction}`; button.type = 'button'; button.setAttribute('aria-label', label); button.textContent = direction === 'previous' ? '‹' : '›';
    $('#detail-dialog').append(button);
  }
}
function updateAdvNavigation(entity) {
  const previous = $('#previous-adv'); const next = $('#next-adv');
  if (!previous || !next) return;
  const bases = visibleEntities().filter(item => item.category === 'adv');
  const index = bases.findIndex(item => item.entity_id === entity.entity_id);
  const isAdv = entity.category === 'adv' && index >= 0;
  previous.hidden = !isAdv; next.hidden = !isAdv;
  previous.disabled = !isAdv || index === 0; next.disabled = !isAdv || index === bases.length - 1;
  previous.onclick = () => { if (index > 0) showDetail(bases[index - 1].entity_id); };
  next.onclick = () => { if (index >= 0 && index < bases.length - 1) showDetail(bases[index + 1].entity_id); };
}

function renderGenericDetail(entity) {
  const metadata = Object.entries(entity.metadata || {}).filter(([, value]) => value !== '' && value != null).map(([key, value]) => `<span><b>${esc(cardFieldLabel(key))}</b> ${esc(cardFieldValue(key, value))}</span>`).join('');
  const reps = Object.entries(entity.representations || {}).map(([family, path]) => `<figure class="representation"><a href="${esc(dataUrl(path))}" download><img loading="lazy" src="${esc(dataUrl(path))}" alt="${esc(family)}"></a><figcaption>${esc(family)}</figcaption></figure>`).join('');
  const cardParameters = entity.category === 'card' ? `<section class="parameter-panel"><h3>${t('ui.card_parameters')}</h3><pre>${esc(JSON.stringify({ card_id: entity.entity_id.replace('card:', ''), character_ids: entity.character_ids, ...(entity.metadata || {}) }, null, 2))}</pre></section>` : '';
  return `<div class="detail-head"><p class="eyebrow">${esc(t(categoryLabels[entity.category] || entity.category))}</p><h2>${esc(title(entity))}</h2><div class="detail-meta">${metadata}</div></div><div class="representations">${reps || `<p class="empty">${t('ui.no_representations')}</p>`}</div>${cardParameters}`;
}

function cardValueLabel(key, value) {
  const labels = { limited_flg: 'Limited', sign_flg: 'Signed' };
  if (key === 'limited_flg' || key === 'sign_flg') return `${labels[key]}: ${String(value) === '1' ? 'Yes' : 'No'}`;
  return `${key.replaceAll('_', ' ')}: ${value}`;
}

function cardDetailFieldValue(key, value) {
  if (key !== 'start_time') return cardFieldValue(key, value);

  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp === 0) return '';

  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(LOCALE === 'ja' ? 'ja-JP' : 'en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function renderCardDetailLegacy(entity) {
  const preferredOrder = ['card_l', '7th_photo_idol', 'card_chara', 'card_chara_face'];
  const representations = Object.entries(entity.representations || {}).sort(([familyA], [familyB]) => {
    const rankA = preferredOrder.indexOf(familyA);
    const rankB = preferredOrder.indexOf(familyB);
    return (rankA < 0 ? preferredOrder.length : rankA) - (rankB < 0 ? preferredOrder.length : rankB);
  });
  const initial = representations.find(([family]) => family === 'card_l') || representations[0];
  const mainPath = initial?.[1] || '';
  const thumbnails = representations.map(([family, path]) => {
    const asset = assetForPath(path);
    const thumb = asset?.thumbnail || path;
    return `<button class="variant-thumb ${family === initial?.[0] ? 'active' : ''}" data-card-variant="${esc(family)}" data-card-path="${esc(path)}" data-card-thumb="${esc(thumb)}"><img loading="lazy" src="${esc(dataUrl(thumb))}" alt="${esc(family)}"><span>${esc(family)}</span></button>`;
  }).join('');
  const detailInfo = Object.entries(entity.metadata || {})
    .filter(([key, value]) => !['card_messages', 'card_message', 'card_message_type', 'card_message_id'].includes(key) && !(key === 'start_time' && Number(value) === 0))
    .map(([key, value]) => `<div class="info-row"><dt>${esc(cardFieldLabel(key))}</dt><dd>${esc(cardDetailFieldValue(key, value))}</dd></div>`)
    .join('');
  const messages = Array.isArray(entity.metadata?.card_messages) ? entity.metadata.card_messages : [];
  const messageContent = messages.length ? messages.map(message => `<article class="card-message"><h3>${esc(t('ui.message_type'))} ${esc(message.message_type)}</h3><p>${esc(message.message || '—')}</p></article>`).join('') : `<p class="empty">${esc(t('ui.no_card_messages'))}</p>`;
  return `<div class="card-detail"><section class="card-media"><div class="card-main-image"><img id="card-main-image" src="${esc(dataUrl(mainPath))}" alt="${esc(title(entity))}"><div class="card-image-actions"><button id="open-card-viewer" class="button">${t('ui.view_larger')}</button><a id="card-download" class="button secondary" href="${esc(dataUrl(mainPath))}" download>${t('ui.download')}</a></div></div><div class="variant-picker" aria-label="Card representations">${thumbnails}</div></section><section class="card-info"><p class="eyebrow">${t('ui.card').toUpperCase()} ${esc(entity.entity_id.replace('card:', ''))}</p><h2>${esc(title(entity))}</h2><div class="card-info-tabs" role="tablist"><button type="button" class="card-info-tab active" role="tab" aria-selected="true" aria-controls="card-details-panel" data-card-info-tab="card-details-panel">${esc(t('ui.details'))}</button><button type="button" class="card-info-tab" role="tab" aria-selected="false" aria-controls="card-messages-panel" data-card-info-tab="card-messages-panel">${esc(t('ui.card_messages'))}</button></div><section id="card-details-panel" class="card-info-panel" role="tabpanel"><dl>${detailInfo}</dl></section><section id="card-messages-panel" class="card-info-panel" role="tabpanel" hidden>${messageContent}</section></section></div>`;
}

function renderCardDetail(entity) {
  const messages = (Array.isArray(entity.metadata?.card_messages) ? entity.metadata.card_messages : []).filter(message => {
    const value = String(message.message ?? '').trim();
    return value && value !== '0';
  });
  const messageContent = messages.length
    ? messages.map(message => `<article class="card-message"><h3>${esc(t(`ui.card_message_type.${message.message_type}`))}</h3><p>${esc(message.message)}</p></article>`).join('')
    : `<p class="empty">${esc(t('ui.no_card_messages'))}</p>`;
  return renderCardDetailLegacy(entity).replace(
    /<section id="card-messages-panel"[^>]*>[\s\S]*?<\/section>/,
    `<section id="card-messages-panel" class="card-info-panel" role="tabpanel" hidden>${messageContent}</section>`,
  );
}

function setupCardDetail(entity) {
  document.querySelectorAll('[data-card-info-tab]').forEach(tab => tab.onclick = () => {
    document.querySelectorAll('[data-card-info-tab]').forEach(item => { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', String(item === tab)); });
    document.querySelectorAll('.card-info-panel').forEach(panel => { panel.hidden = panel.id !== tab.dataset.cardInfoTab; });
  });
  const openViewer = () => {
    const image = $('#card-main-image');
    $('#card-image-title').textContent = title(entity);
    $('#card-image-viewer').src = image.src;
    $('#card-image-viewer').alt = image.alt;
    $('#card-image-mode').value = 'fit';
    applyViewerZoom(1);
    $('#card-image-dialog').showModal();
  };
  $('#open-card-viewer').onclick = openViewer;
  $('#card-main-image').onclick = openViewer;
  $('#card-main-image').style.cursor = 'zoom-in';
  document.querySelectorAll('[data-card-variant]').forEach(button => button.onclick = () => {
    $('#card-main-image').src = dataUrl(button.dataset.cardPath);
    $('#card-download').href = dataUrl(button.dataset.cardPath);
    document.querySelectorAll('[data-card-variant]').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
  });
}

let viewerZoom = 1;
function applyViewerZoom(value) {
  viewerZoom = Math.max(.25, Math.min(4, value));
  $('#card-image-viewer').style.transform = `scale(${viewerZoom})`;
  $('#zoom-level').textContent = `${Math.round(viewerZoom * 100)}%`;
  $('#card-image-mode').value = viewerZoom === 1 ? 'fit' : 'zoom';
}
$('#close-card-image').onclick = () => $('#card-image-dialog').close();
$('#card-image-dialog').onclick = event => { if (event.target === event.currentTarget) event.currentTarget.close(); };
$('#card-image-mode').onchange = event => applyViewerZoom(event.target.value === 'fit' ? 1 : viewerZoom === 1 ? 1.5 : viewerZoom);
$('#zoom-out').onclick = () => applyViewerZoom(viewerZoom - .25);
$('#zoom-in').onclick = () => applyViewerZoom(viewerZoom + .25);

function advExpressions(entity) {
  const expressions = Object.entries(entity.representations || {}).filter(([key]) => key.startsWith('face_')).map(([key, path]) => ({ id: key.slice(5), path, preview: entity.representation_thumbnails?.[key] || entity.metadata?.expressions?.find(item => String(item.id) === key.slice(5))?.preview_thumbnail }));
  if (state.expressionFilter === 'referenced') { const referenced = new Set((entity.metadata?.expressions || []).filter(item => item.story_referenced).map(item => String(item.id))); return expressions.filter(item => referenced.has(item.id)); }
  return expressions;
}
function renderAdvDetailLegacy(entity) {
  const expressions = advExpressions(entity);
  const options = expressions.map(item => `<option value="${esc(item.id)}">Expression ${esc(item.id)}</option>`).join('');
  return `<div class="detail-head"><p class="eyebrow">ADV BASE / BODY</p><h2>${esc(title(entity))}</h2><div class="detail-meta">${esc(entity.metadata?.adv_namespace || '')} · ${expressions.length} available expressions · position ${esc((entity.metadata?.face_position || []).join(', '))}</div></div><div class="adv-controls"><label>Expression <select id="expression-select">${options || '<option>No expressions available</option>'}</select></label><label>Show <select id="expression-filter"><option value="all">All expressions</option><option value="referenced">Story-referenced only</option></select></label><button id="save-adv" class="button">Save composed PNG</button></div><div class="adv-stage"><canvas id="adv-canvas"></canvas></div><div class="adv-parts"><figure><img loading="lazy" src="${esc(dataUrl(entity.representations?.body))}" alt="ADV body"><figcaption>Body / base</figcaption></figure><figure id="adv-face-preview"><figcaption>Selected face</figcaption></figure></div>`;
}
function renderAdvDetail(entity) {
  const expressions = advExpressions(entity);
  const choices = expressions.map(item => `<button type="button" class="adv-expression-choice" data-adv-expression="${esc(item.id)}"><img loading="lazy" src="${esc(dataUrl(item.preview || item.path))}" alt="Expression ${esc(item.id)}"><span>Expression ${esc(item.id)}</span></button>`).join('');
  const referenced = state.expressionFilter === 'referenced' ? ' checked' : '';
  return `<div class="detail-head"><p class="eyebrow">ADV BASE / BODY</p><h2>${esc(title(entity))}</h2><div class="detail-meta">${esc(entity.metadata?.adv_namespace || '')} · ${expressions.length} available expressions · position ${esc((entity.metadata?.face_position || []).join(', '))}</div></div><div class="adv-detail"><section class="adv-expression-panel"><label class="adv-used-filter"><input id="expression-filter" type="checkbox"${referenced}> <span>Show only used sprites</span></label><div class="adv-expression-list">${choices || '<p class="empty">No expressions available</p>'}</div></section><section class="adv-display-panel"><div class="adv-display-stage"><button id="previous-expression" class="adv-expression-nav previous" type="button" aria-label="Previous expression">‹</button><div class="adv-stage"><canvas id="adv-canvas"></canvas></div><button id="next-expression" class="adv-expression-nav next" type="button" aria-label="Next expression">›</button></div><button id="save-adv" class="button">Save composed PNG</button><figure id="adv-face-preview" class="adv-face-preview"><figcaption>Selected expression</figcaption></figure></section></div>`;
}
function loadImage(path) { return new Promise((resolve, reject) => { const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => resolve(image); image.onerror = reject; image.src = dataUrl(path); }); }
async function setupAdvViewerLegacy(entity) {
  const filter = $('#expression-filter'); filter.value = state.expressionFilter; filter.onchange = () => { state.expressionFilter = filter.value; showDetail(entity.entity_id); };
  const select = $('#expression-select'); const expressions = advExpressions(entity); if (!expressions.length) return;
  select.onchange = () => composeSelected(entity, select.value);
  $('#save-adv').onclick = () => $('#adv-canvas').toBlob(blob => { const link = document.createElement('a'); link.download = `${entity.metadata?.adv_base_key || 'adv'}_${select.value}.png`; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href); }, 'image/png');
  await composeSelected(entity, expressions[0].id);
}
async function setupAdvViewer(entity) {
  const filter = $('#expression-filter');
  filter.onchange = () => { state.expressionFilter = filter.checked ? 'referenced' : 'all'; showDetail(entity.entity_id); };
  const expressions = advExpressions(entity);
  if (!expressions.length) return;
  document.querySelectorAll('[data-adv-expression]').forEach(button => button.onclick = () => composeSelected(entity, button.dataset.advExpression));
  const defaultId = state.advExpression[entity.entity_id] || String(entity.metadata?.default_expression || expressions[0].id);
  const initial = expressions.some(item => item.id === defaultId) ? defaultId : expressions[0].id;
  $('#previous-expression').onclick = () => switchAdvExpression(entity, -1);
  $('#next-expression').onclick = () => switchAdvExpression(entity, 1);
  $('#save-adv').onclick = () => $('#adv-canvas').toBlob(blob => { const link = document.createElement('a'); link.download = `${entity.metadata?.adv_base_key || 'adv'}_${state.advExpression[entity.entity_id] || initial}.png`; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href); }, 'image/png');
  await composeSelected(entity, initial);
}
function switchAdvExpression(entity, offset) {
  const expressions = advExpressions(entity); if (!expressions.length) return;
  const current = state.advExpression[entity.entity_id] || expressions[0].id;
  const index = Math.max(0, expressions.findIndex(item => item.id === current));
  const next = expressions[(index + offset + expressions.length) % expressions.length];
  composeSelected(entity, next.id);
}
async function composeSelectedLegacy(entity, expressionId) {
  const expression = entity.representations?.[`face_${expressionId}`]; if (!expression) return;
  const [body, face] = await Promise.all([loadImage(entity.representations.body), loadImage(expression)]);
  const canvas = $('#adv-canvas'); canvas.width = body.naturalWidth; canvas.height = body.naturalHeight; const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(body, 0, 0);
  const [x, y] = entity.metadata?.face_position || []; context.drawImage(face, Number(x) || 0, Number(y) || 0); const select = $('#expression-select'); if (select) select.value = expressionId;
  const preview = $('#adv-face-preview'); if (preview) preview.innerHTML = `<img loading="lazy" src="${esc(dataUrl(expression))}" alt="Expression ${esc(expressionId)}"><figcaption>Expression ${esc(expressionId)} · top-left ${esc(x)}, ${esc(y)}</figcaption>`;
}

async function composeSelected(entity, expressionId) {
  const expression = entity.representations?.[`face_${expressionId}`]; if (!expression) return;
  const [body, face] = await Promise.all([loadImage(entity.representations.body), loadImage(expression)]);
  const canvas = $('#adv-canvas'); canvas.width = body.naturalWidth; canvas.height = body.naturalHeight;
  const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(body, 0, 0);
  const [x, y] = entity.metadata?.face_position || []; context.drawImage(face, Number(x) || 0, Number(y) || 0);
  state.advExpression[entity.entity_id] = String(expressionId);
  document.querySelectorAll('[data-adv-expression]').forEach(button => button.classList.toggle('active', button.dataset.advExpression === String(expressionId)));
  const expressions = advExpressions(entity); const index = expressions.findIndex(item => item.id === String(expressionId));
  $('#previous-expression').disabled = index <= 0; $('#next-expression').disabled = index < 0 || index >= expressions.length - 1;
  const preview = $('#adv-face-preview'); if (preview) preview.innerHTML = `<figcaption>Expression ${esc(expressionId)} · top-left ${esc(x)}, ${esc(y)}</figcaption>`;
}

$('#sort-select').onchange = event => { state.sort = event.target.value; render(); };
$('#sort-direction').onclick = event => { state.sortReverse = !state.sortReverse; event.currentTarget.setAttribute('aria-pressed', String(state.sortReverse)); event.currentTarget.textContent = state.sortReverse ? 'Descending' : 'Ascending'; render(); };
$('#close-detail').onclick = () => $('#detail-dialog').close();
$('#detail-dialog').onclick = event => { if (event.target === event.currentTarget) event.currentTarget.close(); };
loadMultiCharacter().catch(showLoadError);
