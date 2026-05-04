export const INTERCOM_TEAM_GROUPS = [
  {
    value: 'seller_365_sr',
    label: 'Seller 365+SR',
    teams: [
      'unassigned',
      'inventorylab',
      'tactical arbitrage',
      'scoutIQ',
      'FeedbackWhiz',
      'SmartRepricer',
      'SellerRunning',
      'support led growth',
      'threecolts support general',
      'trial concierge',
    ],
  },
  {
    value: 'seller_365',
    label: 'Seller 365',
    teams: [
      'unassigned',
      'inventorylab',
      'tactical arbitrage',
      'scoutIQ',
      'FeedbackWhiz',
      'SmartRepricer',
      'support led growth',
      'threecolts support general',
      'trial concierge',
    ],
  },
];

const normalizeKey = (value) => String(value ?? '').trim().toLowerCase();

export const resolveIntercomGroupTeams = (groupValue, availableTeams) => {
  const selectedGroup = INTERCOM_TEAM_GROUPS.find((group) => group.value === groupValue);

  if (!selectedGroup) {
    return [];
  }

  const availableTeamMap = new Map(
    availableTeams.map((team) => [normalizeKey(team), team])
  );

  return selectedGroup.teams
    .map((team) => availableTeamMap.get(normalizeKey(team)))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
};

