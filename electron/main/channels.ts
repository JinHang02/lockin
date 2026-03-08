export const IPC = {
  // Tasks
  TASKS_GET_TODAY:    'tasks:getToday',
  TASKS_GET_CARRYOVER:'tasks:getCarryover',
  TASKS_CREATE:       'tasks:create',
  TASKS_UPDATE:       'tasks:update',
  TASKS_DELETE:       'tasks:delete',
  TASKS_REORDER:      'tasks:reorder',
  TASKS_RESOLVE_CARRY:'tasks:resolveCarry',
  TASKS_COMPLETED_HISTORY: 'tasks:completedHistory',

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
  SESSIONS_STREAK_DETAIL:'sessions:streakDetail',

  // Calendar
  CALENDAR_GET_BY_DATE: 'calendar:getByDate',

  // Journal
  JOURNAL_GET_BY_DATE: 'journal:getByDate',
  JOURNAL_UPSERT:      'journal:upsert',

  // Notes
  NOTES_GET_ALL: 'notes:getAll',
  NOTES_GET_ONE: 'notes:getOne',
  NOTES_CREATE:  'notes:create',
  NOTES_UPDATE:  'notes:update',
  NOTES_DELETE:  'notes:delete',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Search
  TASKS_SEARCH: 'tasks:search',

  // Bulk operations
  TASKS_BULK_UPDATE: 'tasks:bulkUpdate',
  TASKS_BULK_DELETE: 'tasks:bulkDelete',

  // Recurring tasks
  RECURRING_GET_ALL: 'recurring:getAll',
  RECURRING_CREATE: 'recurring:create',
  RECURRING_UPDATE: 'recurring:update',
  RECURRING_DELETE: 'recurring:delete',
  RECURRING_GENERATE: 'recurring:generate',

  // Analytics
  ANALYTICS_WEEKLY: 'analytics:weekly',
  ANALYTICS_CATEGORY_BREAKDOWN: 'analytics:categoryBreakdown',
  ANALYTICS_DAILY_HISTORY: 'analytics:dailyHistory',

  // Backup
  DATA_EXPORT: 'data:export',
  DATA_IMPORT: 'data:import',

  // System
  SET_LOGIN_ITEM: 'system:setLoginItem',
  SET_WINDOW_TITLE: 'system:setWindowTitle',
  SET_TRAY_TOOLTIP: 'system:setTrayTooltip',
} as const
