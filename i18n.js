// Presentation-only localization layer. Add locales here without changing catalog data.
const LOCALE = document.documentElement.dataset.locale || localStorage.getItem('t7s-locale') || 'en';
const TRANSLATIONS = {
  en: {
    'category.card': 'Cards', 'category.adv': 'Character Sprites', 'category.ing': 'ING', 'category.sd': 'SD',
    'category.photo': 'Photo', 'category.character_ui': 'Character / UI', 'category.character_name': 'Character name',
    'category.live_ui': 'Live UI', 'category.gacha': 'Gacha', 'category.gifthall': 'Gift Hall',
    'page.card': 'Cards', 'page.adv': 'Character Sprites', 'page.misc': 'Misc', 'page.index': 'Characters',
    'ui.prototype': 'T7S CHARACTER CATALOG · PROTOTYPE', 'ui.loading': 'Loading…', 'ui.contact': 'Contact',
    'ui.gallery_items': 'gallery items', 'ui.physical_assets': 'physical assets', 'ui.sort': 'Sort',
    'ui.card_id': 'Card ID', 'ui.card_name': 'Card name', 'ui.card_type': 'Card type',
    'ui.limited': 'Limited', 'ui.release_time': 'Release time', 'ui.filter_cards': 'Filter cards',
    'ui.any': 'Any', 'ui.yes': 'Yes', 'ui.no': 'No', 'ui.clear': 'Clear',
    'ui.card_parameters': 'Card parameters', 'ui.card': 'Card', 'ui.rarity': 'Rarity',
    'ui.details': 'Details', 'ui.card_messages': 'Card Message', 'ui.message_type': 'Message', 'ui.no_card_messages': 'No card messages available.',
    'ui.card_message_type.0': 'Type 0', 'ui.card_message_type.1': 'Type 1', 'ui.card_message_type.2': 'Type 2', 'ui.card_message_type.3': 'Type 3',
    'ui.card_message_type.4': 'Type 4', 'ui.card_message_type.5': 'Type 5', 'ui.card_message_type.6': 'Type 6', 'ui.card_message_type.7': 'Type 7',
    'profile.title': 'Profile', 'profile.open': 'View Profile', 'profile.close': 'Close Profile', 'profile.photo_source': '7th Photo', 'profile.fallback_source': 'Card image', 'profile.no_data': 'No profile data available.',
    'profile.field.character_id': 'Character ID', 'profile.field.character_full_name': 'Character / Full Name', 'profile.field.character_name': 'Character Name', 'profile.field.first_name': 'First Name',
    'profile.field.english_name': 'English Name', 'profile.field.nickname': 'Nickname', 'profile.field.sort_name': 'Sort Name',
    'profile.field.affiliation': 'Affiliation', 'profile.field.cv': 'Voice Actor', 'profile.field.birthday': 'Birthday',
    'profile.field.constellation': 'Constellation', 'profile.field.blood_type': 'Blood Type', 'profile.field.age': 'Age', 'profile.field.height': 'Height', 'profile.field.weight': 'Weight', 'profile.field.height_weight': 'Height / Weight', 'profile.field.three_sizes': 'Three Sizes',
    'profile.field.bust': 'Bust', 'profile.field.waist': 'Waist', 'profile.field.hips': 'Hips', 'profile.field.cup': 'Cup', 'profile.field.favorite': 'Favorite', 'profile.field.special_ability': 'Special Ability',
    'profile.month.1': 'Jan', 'profile.month.2': 'Feb', 'profile.month.3': 'Mar', 'profile.month.4': 'Apr', 'profile.month.5': 'May', 'profile.month.6': 'Jun',
    'profile.month.7': 'Jul', 'profile.month.8': 'Aug', 'profile.month.9': 'Sep', 'profile.month.10': 'Oct', 'profile.month.11': 'Nov', 'profile.month.12': 'Dec', 'profile.month.unknown': 'Unknown', 'profile.blood_type.na': 'N/A',
    'field.card_name': 'Card Name', 'field.rarity_id': 'Rarity', 'field.card_type_id': 'Card Type',
    'field.limited_flg': 'Limited?', 'field.sign_flg': 'Signed?', 'field.start_time': 'Release Time',
    'field.max_level': 'Max Level', 'field.break_max_level': 'Break Max Level',
    'value.rarity.1': 'B', 'value.rarity.2': 'BS', 'value.rarity.3': 'S', 'value.rarity.4': 'SS',
    'value.rarity.5': 'G', 'value.rarity.6': 'GS', 'value.rarity.7': 'G+', 'value.rarity.8': 'GS+',
    'value.rarity.9': 'P', 'value.rarity.10': 'PS', 'value.rarity.11': 'BD', 'value.rarity.12': 'BDS',
    'value.card_type.1': 'Vocalist', 'value.card_type.2': 'Variety Idol', 'value.card_type.3': 'Model',
    'value.card_type.4': 'Player', 'value.card_type.5': 'Dancer', 'value.card_type.6': 'God Voice',
    'value.card_type.7': 'Comedienne', 'value.card_type.8': 'Actress', 'value.card_type.9': 'Star Player',
    'value.card_type.10': 'Trickster', 'value.card_type.11': 'No Type',
    'value.limited.yes': 'Yes', 'value.limited.no': 'No',
    'value.signed.yes': 'Signed', 'value.signed.no': 'Unsigned',
    'ui.view_larger': 'View larger', 'ui.download': 'Download', 'ui.close': 'Close',
    'ui.no_items': 'No items in this category.', 'ui.no_representations': 'No image representations available.',
    'ui.character_index': 'Character index', 'ui.back_to_characters': 'Back to Characters', 'ui.search_characters': 'Search characters', 'ui.birth_month': 'Birth month',
    'ui.blood_type': 'Blood type', 'ui.character_type': 'Character type', 'ui.all_characters': 'All characters',
    'ui.character_index_empty': 'No characters match the current filters.', 'ui.switch_character': 'Switch character',
    'ui.previous_character': 'Previous character', 'ui.next_character': 'Next character', 'ui.character_id': 'Character ID',
    'ui.adv_base_body': 'ADV BASE / BODY', 'ui.expressions': 'expressions', 'ui.expression': 'Expression',
    'ui.show': 'Show', 'ui.all_expressions': 'All expressions', 'ui.story_referenced': 'Story-referenced only',
    'ui.save_composed': 'Save composed PNG', 'ui.body_base': 'Body / base', 'ui.selected_face': 'Selected face',
    'ui.fit_window': 'Fit to window', 'ui.zoom': 'Zoom', 'ui.card_image': 'Card image',
    'ui.unable_load': 'Unable to load generated catalog: {message}',
    'ui.unsupported_content_schema': 'This archive uses an unsupported content schema ({version}).',
    'ui.invalid_content_manifest': 'The content manifest is missing its character catalog location.',
  },
  ja: {
    'ui.contact': 'お問い合わせ',
    'ui.back_to_characters': 'キャラクター一覧へ戻る', 'ui.switch_character': 'キャラクターを切り替え',
    'ui.previous_character': '前のキャラクター', 'ui.next_character': '次のキャラクター',
    'value.rarity.1': 'B', 'value.rarity.2': 'BS', 'value.rarity.3': 'S', 'value.rarity.4': 'SS',
    'value.rarity.5': 'G', 'value.rarity.6': 'GS', 'value.rarity.7': 'G+', 'value.rarity.8': 'GS+',
    'value.rarity.9': 'P', 'value.rarity.10': 'PS', 'value.rarity.11': 'BD', 'value.rarity.12': 'BDS',
    'value.card_type.1': 'ボーカリスト', 'value.card_type.2': 'バラドル', 'value.card_type.3': 'モデル',
    'value.card_type.4': 'プレイヤー', 'value.card_type.5': 'ダンサー', 'value.card_type.6': 'ゴッドボイス',
    'value.card_type.7': 'コメディエンヌ', 'value.card_type.8': 'アクトレス', 'value.card_type.9': 'スタープレイヤー',
    'value.card_type.10': 'トリックスター', 'value.card_type.11': 'ノータイプ',
  },
};

function t(key, variables = {}) {
  const dictionary = TRANSLATIONS[LOCALE] || TRANSLATIONS.en;
  let value = dictionary[key] ?? TRANSLATIONS.en[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name) => variables[name] ?? '');
}

function cardFieldLabel(key) {
  return t(`field.${key}`) || key.replaceAll('_', ' ');
}

function cardFieldValue(key, value) {
  if (key === 'limited_flg') return t(`value.limited.${String(value) === '1' ? 'yes' : 'no'}`);
  if (key === 'sign_flg') return t(`value.signed.${String(value) === '1' ? 'yes' : 'no'}`);
  if (key === 'rarity_id') return t(`value.rarity.${value}`);
  if (key === 'card_type_id') return t(`value.card_type.${value}`);
  return String(value);
}

function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
}
