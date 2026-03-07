export const IPC = {
  // Tasks
  TASKS_GET_TODAY:    'tasks:getToday',
  TASKS_GET_CARRYOVER:'tasks:getCarryover',
  TASKS_CREATE:       'tasks:create',
  TASKS_UPDATE:       'tasks:update',
  TASKS_DELETE:       'tasks:delete',
  TASKS_REORDER:      'tasks:reorder',
  TASKS_RESOLVE_CARRY:'tasks:resolveCarry',

  // Categories
  CATEGORIES_GET_ALL: 'categories:getAll',
  CATEGORIES_CREATE:  'categories:create',
  CATEGORIES_UPDATE:  'categories:update',
  CATEGORIES_DELETE:  'categories:delete',

  // Pomodoro sessions
  SESSIONS_CREATE:       'sessions:create',
  SESSIONS_GET_BY_DATE:  'sessions:getByDate',
  SESSIONS_COUNT_BY_TASK:'sessions:countByTask',
  SESSIONS_TODAY_STATS:  'sessions:todayStats',
  SESSIONS_STREAK:       'sessions:streak',

  // Calendar
  CALENDAR_GET_BY_DATE: 'calendar:getByDate',

  // Journal
  JOURNAL_GET_BY_DATE: 'journal:getByDate',
  JOURNAL_UPSERT:      'journal:upsert',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // System
  SET_LOGIN_ITEM: 'system:setLoginItem',
  SET_WINDOW_TITLE: 'system:setWindowTitle',
  SET_TRAY_TOOLTIP: 'system:setTrayTooltip',
} as const
